/**
 * SECTOR WATCH — the server functions (Sector Watch pass, owner
 * order 2026-11-26). Operator-only, like the camera system
 * itself: every function re-verifies the operator session. What
 * crosses the wire is sector STATE, the watch log, the events,
 * and the household names — never a password, never a frame.
 *
 * The watch itself lives in sectorWatchRuntime.server.ts, on
 * the core. These functions are the doorbell, not the road:
 * they read the sector record, change its settings under his
 * hand, enroll the household faces, and take his
 * acknowledgment of an event (the acknowledgment is what
 * releases that event from the Alert Ring).
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { getCameraStore } from "./cameraStore.server";
import { getCameraPresenceStore } from "./cameraPresenceStore.server";
import { getSectorWatchStore } from "./sectorWatchStore.server";
import {
  autonomyByOrder,
  sectorConfigFor,
  unacknowledgedJudgments,
  unacknowledgedSectorEvents,
  type AutonomyState,
  type SectorCameraConfig,
  type SectorEvent,
  type SectorJudgment,
  type SectorZone,
  type WatchLogEntry,
} from "./cameras/sectorWatch";
import {
  effectiveHousehold,
  type HouseholdEnrollment,
} from "./cameras/cameraPresence";

type TokenInput = { accessToken: string };

function isTokenInput(input: unknown): input is TokenInput {
  return (
    typeof input === "object" &&
    input !== null &&
    typeof (input as TokenInput).accessToken === "string" &&
    (input as TokenInput).accessToken.length > 0 &&
    (input as TokenInput).accessToken.length <= 16_384
  );
}

async function authorized(accessToken: string): Promise<boolean> {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return verification.authorized;
}

export type SectorWatchView = {
  authorized: boolean;
  storageAvailable: boolean;
  /** The scheduler is running on this core right now. */
  schedulerRunning: boolean;
  intervalSec: number;
  cameras: Record<string, SectorCameraConfig>;
  /** The newest watch-log entries, newest first. */
  log: WatchLogEntry[];
  events: SectorEvent[];
  /** Anubis's judgment escalations — "look at this" items, newest first. */
  judgments: SectorJudgment[];
  household: HouseholdEnrollment[];
  /** True when the household list is standing on the creator enrollment alone. */
  householdFromCreatorOnly: boolean;
  unacknowledged: number;
  /** Autonomy (2026-11-27): on by standing order until a recorded order turns it off. */
  autonomy: AutonomyState;
};

const emptyView: SectorWatchView = {
  authorized: false,
  storageAvailable: false,
  schedulerRunning: false,
  intervalSec: 60,
  cameras: {},
  log: [],
  events: [],
  judgments: [],
  household: [],
  householdFromCreatorOnly: false,
  unacknowledged: 0,
  autonomy: { enabled: true, since: null, note: "" },
};

export const getSectorWatch = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid sector watch request.");
    return input;
  })
  .handler(async ({ data }): Promise<SectorWatchView> => {
    if (!(await authorized(data.accessToken))) return emptyView;
    const sectorStore = await getSectorWatchStore();
    const presenceStore = await getCameraPresenceStore();
    const cameraStore = await getCameraStore();
    if (!sectorStore || !presenceStore || !cameraStore) return { ...emptyView, authorized: true };
    const runtime = await import("./sectorWatchRuntime.server");
    runtime.reconcileSectorWatch();
    const file = await sectorStore.read();
    const presenceFile = await presenceStore.read();
    const cameras: Record<string, SectorCameraConfig> = {};
    for (const camera of await cameraStore.list()) {
      cameras[camera.id] = sectorConfigFor(file.settings, camera.id);
    }
    return {
      authorized: true,
      storageAvailable: true,
      schedulerRunning: runtime.sectorWatchSchedulerRunning(),
      intervalSec: file.settings.intervalSec,
      cameras,
      log: file.log.slice(0, 60),
      events: file.events,
      judgments: file.judgments,
      household: effectiveHousehold(presenceFile),
      householdFromCreatorOnly: presenceFile.household.length === 0 && presenceFile.enrollment !== null,
      unacknowledged: unacknowledgedSectorEvents(file).length,
      autonomy: file.settings.autonomy,
    };
  });

/* --------------------- the stage's alert poll --------------------- */

export type SectorAlertState = {
  authorized: boolean;
  /** Unacknowledged events only — the Alert Ring's sector input + the stage's notices. */
  events: { id: string; at: number; cameraName: string; summary: string }[];
  /**
   * Unacknowledged judgment items — the stage raises these as
   * "look at this" notices. NOT alerts: they never feed the
   * Alert Ring.
   */
  judgments: { id: string; at: number; cameraName: string; text: string }[];
};

export const getSectorAlertState = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid sector alert request.");
    return input;
  })
  .handler(async ({ data }): Promise<SectorAlertState> => {
    if (!(await authorized(data.accessToken))) return { authorized: false, events: [], judgments: [] };
    const sectorStore = await getSectorWatchStore();
    if (!sectorStore) return { authorized: true, events: [], judgments: [] };
    const runtime = await import("./sectorWatchRuntime.server");
    runtime.reconcileSectorWatch();
    // The notifications pass rides this poll (owner orders
    // 2026-11-26): the inbox and the property feed re-derive
    // from the sector record while the Captain is at his Augie,
    // so the stage's notification count is never staler than
    // this poll. Derivation is deterministic and silent on
    // failure — the records stand either way.
    const notificationsRuntime = await import("./notificationsRuntime.server");
    await notificationsRuntime.reconcileNotifications();
    const file = await sectorStore.read();
    return {
      authorized: true,
      events: unacknowledgedSectorEvents(file).map((e) => ({
        id: e.id,
        at: e.at,
        cameraName: e.cameraName,
        summary: e.summary,
      })),
      judgments: unacknowledgedJudgments(file).map((j) => ({
        id: j.id,
        at: j.at,
        cameraName: j.cameraName,
        text: j.text,
      })),
    };
  });

/* ------------------------------ settings ------------------------------ */

export type SectorNoteResult = { authorized: boolean; ok: boolean; note: string };

export type SetSectorCameraInput = TokenInput & {
  cameraId: string;
  watch?: boolean;
  zone?: SectorZone;
};

export const setSectorCamera = createServerFn({ method: "POST" })
  .validator((input: unknown): SetSectorCameraInput => {
    if (!isTokenInput(input) || typeof (input as SetSectorCameraInput).cameraId !== "string") {
      throw new Error("Invalid sector camera request.");
    }
    return input as SetSectorCameraInput;
  })
  .handler(async ({ data }): Promise<SectorNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const sectorStore = await getSectorWatchStore();
    const cameraStore = await getCameraStore();
    if (!sectorStore || !cameraStore) {
      return { authorized: true, ok: false, note: "Sector Watch lives on the core machine — no local store here." };
    }
    const camera = await cameraStore.get(data.cameraId);
    if (!camera) return { authorized: true, ok: false, note: "That camera is not in the registry." };
    await sectorStore.update((file) => {
      const current = sectorConfigFor(file.settings, data.cameraId);
      const next: SectorCameraConfig = {
        cameraId: data.cameraId,
        zone:
          data.zone === "front" || data.zone === "bedroom" || data.zone === "common"
            ? data.zone
            : current.zone,
        watch: typeof data.watch === "boolean" ? data.watch : current.watch,
      };
      return {
        ...file,
        settings: {
          ...file.settings,
          cameras: { ...file.settings.cameras, [data.cameraId]: next },
        },
      };
    });
    const runtime = await import("./sectorWatchRuntime.server");
    runtime.reconcileSectorWatch();
    return { authorized: true, ok: true, note: `${camera.name}'s sector is set.` };
  });

export type SetSectorIntervalInput = TokenInput & { intervalSec: number };

export const setSectorInterval = createServerFn({ method: "POST" })
  .validator((input: unknown): SetSectorIntervalInput => {
    if (!isTokenInput(input) || typeof (input as SetSectorIntervalInput).intervalSec !== "number") {
      throw new Error("Invalid sector interval request.");
    }
    return input as SetSectorIntervalInput;
  })
  .handler(async ({ data }): Promise<SectorNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const sectorStore = await getSectorWatchStore();
    if (!sectorStore) {
      return { authorized: true, ok: false, note: "Sector Watch lives on the core machine — no local store here." };
    }
    const next = await sectorStore.update((file) => ({
      ...file,
      settings: { ...file.settings, intervalSec: data.intervalSec },
    }));
    return {
      authorized: true,
      ok: true,
      note: `The watch now looks every ${next.settings.intervalSec} seconds.`,
    };
  });

/* ------------------------------ autonomy ------------------------------ */

export type SetSectorAutonomyInput = TokenInput & { enabled: boolean };

/**
 * Autonomy on/off (owner order 2026-11-27): ON is the standing
 * default — autonomous until further notice. Turning it either
 * way is a RECORDED order: the state carries the time it
 * landed, and the presence reconcile arms or releases the
 * cameras' own patrols from this record.
 */
export const setSectorAutonomy = createServerFn({ method: "POST" })
  .validator((input: unknown): SetSectorAutonomyInput => {
    if (!isTokenInput(input) || typeof (input as SetSectorAutonomyInput).enabled !== "boolean") {
      throw new Error("Invalid sector autonomy request.");
    }
    return input as SetSectorAutonomyInput;
  })
  .handler(async ({ data }): Promise<SectorNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const sectorStore = await getSectorWatchStore();
    if (!sectorStore) {
      return { authorized: true, ok: false, note: "Sector Watch lives on the core machine — no local store here." };
    }
    const next = await sectorStore.update((file) => ({
      ...file,
      settings: { ...file.settings, autonomy: autonomyByOrder(data.enabled, Date.now()) },
    }));
    const runtime = await import("./cameraPresenceRuntime.server");
    if (!data.enabled) {
      // Autonomy standing down releases ONLY the patrols
      // autonomy itself armed — the Captain's own patrols are
      // his and keep running.
      const presenceStore = await getCameraPresenceStore();
      const cameraStore = await getCameraStore();
      if (presenceStore && cameraStore) {
        const presenceFile = await presenceStore.read();
        for (const camera of await cameraStore.list()) {
          const s = presenceFile.cameras[camera.id];
          if (s?.patrol.active && s.patrol.autonomous) {
            await runtime.stopPatrol(camera.id, "autonomy was turned off by a recorded order");
          }
        }
      }
    }
    await runtime.reconcilePresence();
    return {
      authorized: true,
      ok: true,
      note: next.settings.autonomy.enabled
        ? "Autonomy is ON — the cameras choose their own look targets inside their zones, until a recorded order turns it off."
        : "Autonomy is OFF by recorded order — the cameras hold their set patrol and watch only.",
    };
  });

/* ------------------------------ household ------------------------------ */

export type EnrollHouseholdInput = TokenInput & { cameraId: string; name: string };

export const enrollHousehold = createServerFn({ method: "POST" })
  .validator((input: unknown): EnrollHouseholdInput => {
    if (
      !isTokenInput(input) ||
      typeof (input as EnrollHouseholdInput).cameraId !== "string" ||
      typeof (input as EnrollHouseholdInput).name !== "string"
    ) {
      throw new Error("Invalid household enrollment request.");
    }
    return input as EnrollHouseholdInput;
  })
  .handler(async ({ data }): Promise<SectorNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const cameraStore = await getCameraStore();
    if (!cameraStore) return { authorized: true, ok: false, note: "No local camera store here." };
    const camera = await cameraStore.get(data.cameraId);
    if (!camera) return { authorized: true, ok: false, note: "That camera is not in the registry." };
    const runtime = await import("./sectorWatchRuntime.server");
    const result = await runtime.enrollHouseholdMember(camera, data.name);
    return { authorized: true, ok: result.ok, note: result.note };
  });

export type RemoveHouseholdInput = TokenInput & { name: string };

export const removeHousehold = createServerFn({ method: "POST" })
  .validator((input: unknown): RemoveHouseholdInput => {
    if (!isTokenInput(input) || typeof (input as RemoveHouseholdInput).name !== "string") {
      throw new Error("Invalid household removal request.");
    }
    return input as RemoveHouseholdInput;
  })
  .handler(async ({ data }): Promise<SectorNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const runtime = await import("./sectorWatchRuntime.server");
    const result = await runtime.removeHouseholdMember(data.name);
    return { authorized: true, ok: result.ok, note: result.note };
  });

/* ------------------------------ events ------------------------------ */

export type AcknowledgeEventInput = TokenInput & { eventId: string };

export const acknowledgeSectorEvent = createServerFn({ method: "POST" })
  .validator((input: unknown): AcknowledgeEventInput => {
    if (!isTokenInput(input) || typeof (input as AcknowledgeEventInput).eventId !== "string") {
      throw new Error("Invalid acknowledge request.");
    }
    return input as AcknowledgeEventInput;
  })
  .handler(async ({ data }): Promise<SectorNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const sectorStore = await getSectorWatchStore();
    if (!sectorStore) {
      return { authorized: true, ok: false, note: "Sector Watch lives on the core machine — no local store here." };
    }
    let found = false;
    await sectorStore.update((file) => ({
      ...file,
      events: file.events.map((e) => {
        if (e.id !== data.eventId) return e;
        found = true;
        return { ...e, acknowledged: true };
      }),
    }));
    return found
      ? { authorized: true, ok: true, note: "Event acknowledged — it leaves the Alert Ring." }
      : { authorized: true, ok: false, note: "That event is not on the record." };
  });

export type AcknowledgeJudgmentInput = TokenInput & { judgmentId: string };

export const acknowledgeSectorJudgment = createServerFn({ method: "POST" })
  .validator((input: unknown): AcknowledgeJudgmentInput => {
    if (!isTokenInput(input) || typeof (input as AcknowledgeJudgmentInput).judgmentId !== "string") {
      throw new Error("Invalid judgment acknowledge request.");
    }
    return input as AcknowledgeJudgmentInput;
  })
  .handler(async ({ data }): Promise<SectorNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const sectorStore = await getSectorWatchStore();
    if (!sectorStore) {
      return { authorized: true, ok: false, note: "Sector Watch lives on the core machine — no local store here." };
    }
    let found = false;
    await sectorStore.update((file) => ({
      ...file,
      judgments: file.judgments.map((j) => {
        if (j.id !== data.judgmentId) return j;
        found = true;
        return { ...j, acknowledged: true };
      }),
    }));
    return found
      ? { authorized: true, ok: true, note: "Seen — the judgment item is filed away." }
      : { authorized: true, ok: false, note: "That judgment is not on the record." };
  });

/* ------------------------------ kept stills ------------------------------ */

export type SectorStillInput = TokenInput & { file: string };
export type SectorStillResult = { authorized: boolean; dataUrl: string | null; note: string };

/**
 * One kept still, served to the Cameras window so the Captain
 * can SEE what Anubis saw (evidence stills + judgment
 * pictures). The file name must be on the sector record —
 * referenced by an event's frames/evidence or a judgment —
 * and must be a bare file name: no path ever crosses. The
 * image leaves the core only into the Captain's own signed-in
 * window, as a data URL; nothing is published anywhere.
 */
export const getSectorStill = createServerFn({ method: "POST" })
  .validator((input: unknown): SectorStillInput => {
    if (!isTokenInput(input) || typeof (input as SectorStillInput).file !== "string") {
      throw new Error("Invalid sector still request.");
    }
    return input as SectorStillInput;
  })
  .handler(async ({ data }): Promise<SectorStillResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, dataUrl: null, note: "The operator session is gone — sign in again." };
    }
    const name = data.file.trim();
    if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) {
      return { authorized: true, dataUrl: null, note: "That is not a kept-still name." };
    }
    const sectorStore = await getSectorWatchStore();
    if (!sectorStore) return { authorized: true, dataUrl: null, note: "No local sector store here." };
    const file = await sectorStore.read();
    const referenced =
      file.events.some(
        (e) => e.frames.includes(name) || e.evidence.some((s) => s.file === name),
      ) || file.judgments.some((j) => j.still === name);
    if (!referenced) {
      return { authorized: true, dataUrl: null, note: "That still is not on the sector record." };
    }
    try {
      const fs = await import("node:fs/promises");
      const bytes = await fs.readFile(`${sectorStore.dataDirectory}/sector-events/${name}`);
      return {
        authorized: true,
        dataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`,
        note: "The kept still, from the core.",
      };
    } catch {
      return { authorized: true, dataUrl: null, note: "The still is named on the record but its file did not read." };
    }
  });
