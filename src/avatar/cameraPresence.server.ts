/**
 * CAMERA PRESENCE — the server functions (Camera Presence pass,
 * owner orders 2026-11-26). Operator-only, like the camera
 * system itself: every function re-verifies the operator
 * session. What crosses the wire is presence STATE and plain-
 * word notes — never a password, never audio.
 *
 * The sends themselves live in cameraPresenceRuntime.server.ts,
 * behind the one gated executor (Permission Law + ALL-STOP).
 * These functions are the doorbell, not the road.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { getCameraStore } from "./cameraStore.server";
import { getCameraPresenceStore } from "./cameraPresenceStore.server";
import {
  presenceFor,
  type CameraPresenceState,
  type CreatorEnrollment,
  type HearingEvent,
  type RecordingInfo,
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

export type CameraPresenceViewState = CameraPresenceState & {
  /** The audio listener is actually running right now. */
  listening: boolean;
  /** A recording is actually being written right now. */
  recordingNow: boolean;
};

export type CameraPresenceView = {
  authorized: boolean;
  storageAvailable: boolean;
  cameras: Record<string, CameraPresenceViewState>;
  hearing: HearingEvent[];
  recordings: (RecordingInfo & { live: boolean })[];
  enrollment: CreatorEnrollment | null;
};

export const getCameraPresence = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid presence request.");
    return input;
  })
  .handler(async ({ data }): Promise<CameraPresenceView> => {
    const empty: CameraPresenceView = {
      authorized: false,
      storageAvailable: false,
      cameras: {},
      hearing: [],
      recordings: [],
      enrollment: null,
    };
    if (!(await authorized(data.accessToken))) return empty;
    const presenceStore = await getCameraPresenceStore();
    if (!presenceStore) return { ...empty, authorized: true };
    const runtime = await import("./cameraPresenceRuntime.server");
    await runtime.reconcilePresence();
    const file = await presenceStore.read();
    const cameras: Record<string, CameraPresenceViewState> = {};
    for (const [id, state] of Object.entries(file.cameras)) {
      cameras[id] = {
        ...state,
        listening: runtime.hearingLive(id),
        recordingNow: runtime.recordingLive(id),
      };
    }
    return {
      authorized: true,
      storageAvailable: true,
      cameras,
      hearing: file.hearing,
      recordings: file.recordings.map((r) => ({ ...r, live: r.stoppedAt === null && runtime.recordingLive(r.cameraId) })),
      enrollment: file.enrollment,
    };
  });

/* ------------------------------ hearing ------------------------------ */

export type SetHearingInput = TokenInput & { cameraId: string; hearing: boolean; commands: boolean };
export type PresenceNoteResult = { authorized: boolean; ok: boolean; note: string };

export const setCameraHearing = createServerFn({ method: "POST" })
  .validator((input: unknown): SetHearingInput => {
    if (!isTokenInput(input) || typeof (input as SetHearingInput).cameraId !== "string") {
      throw new Error("Invalid hearing request.");
    }
    return input as SetHearingInput;
  })
  .handler(async ({ data }): Promise<PresenceNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const presenceStore = await getCameraPresenceStore();
    const cameraStore = await getCameraStore();
    if (!presenceStore || !cameraStore) {
      return { authorized: true, ok: false, note: "Presence lives on the core machine — no local store here." };
    }
    const camera = await cameraStore.get(data.cameraId);
    if (!camera) return { authorized: true, ok: false, note: "That camera is not in the registry." };
    await presenceStore.update((file) => {
      const state = presenceFor(file, data.cameraId);
      state.hearing = data.hearing === true;
      state.commands = data.commands === true;
      return { ...file, cameras: { ...file.cameras, [data.cameraId]: state } };
    });
    const runtime = await import("./cameraPresenceRuntime.server");
    if (data.hearing) {
      await runtime.ensureListener(camera);
      return {
        authorized: true,
        ok: true,
        note: runtime.hearingLive(camera.id)
          ? `${camera.name} is listening — its audio is transcribed on this machine.`
          : `${camera.name}'s hearing is armed, but the audio pull did not start — the stream may be down.`,
      };
    }
    runtime.stopListener(camera.id);
    return { authorized: true, ok: true, note: `${camera.name} has stopped listening.` };
  });

/* ------------------------------ actions ------------------------------ */

export type PresenceAction =
  | "patrol-start"
  | "patrol-stop"
  | "follow-start"
  | "follow-stop"
  | "stop-motion"
  | "record-start"
  | "record-stop"
  | "spotlight"
  | "tracking"
  | "turn-to-speaker";

export type CameraActionInput = TokenInput & {
  cameraId: string;
  action: PresenceAction;
  on?: boolean;
};

export const cameraPresenceAction = createServerFn({ method: "POST" })
  .validator((input: unknown): CameraActionInput => {
    if (!isTokenInput(input) || typeof (input as CameraActionInput).cameraId !== "string") {
      throw new Error("Invalid presence action.");
    }
    return input as CameraActionInput;
  })
  .handler(async ({ data }): Promise<PresenceNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const cameraStore = await getCameraStore();
    if (!cameraStore) return { authorized: true, ok: false, note: "No local camera store here." };
    const camera = await cameraStore.get(data.cameraId);
    if (!camera) return { authorized: true, ok: false, note: "That camera is not in the registry." };
    const runtime = await import("./cameraPresenceRuntime.server");
    if (data.action === "tracking") {
      if (typeof data.on !== "boolean") {
        return { authorized: true, ok: false, note: "The tracking action needs an on/off choice." };
      }
      // Unit tracking is a camera send like any other: same gates.
      const { cameraCanControl } = await import("./cameras/cameraRegistry");
      if (!cameraCanControl(camera)) {
        return { authorized: true, ok: false, note: "Refused — control is not granted for this camera." };
      }
      if (await runtime.allStopInForce()) {
        return { authorized: true, ok: false, note: "Refused — the ALL-STOP is in force." };
      }
      const result = await runtime.setUnitTracking(camera, data.on);
      return { authorized: true, ok: result.ok, note: result.note };
    }
    const intent =
      data.action === "spotlight"
        ? ({ type: "spotlight", cameraId: data.cameraId, on: data.on === true } as const)
        : ({ type: data.action, cameraId: data.cameraId } as const);
    const result = await runtime.executeCameraIntent(intent, camera.name);
    return { authorized: true, ok: result.ok, note: result.note };
  });

/* ------------------------------ probe ------------------------------ */

export type ProbePresenceInput = TokenInput & { cameraId: string };
export type ProbePresenceResult = {
  authorized: boolean;
  ok: boolean;
  spotlightNote: string;
  trackingNote: string;
};

export const probeCameraPresence = createServerFn({ method: "POST" })
  .validator((input: unknown): ProbePresenceInput => {
    if (!isTokenInput(input) || typeof (input as ProbePresenceInput).cameraId !== "string") {
      throw new Error("Invalid presence probe request.");
    }
    return input as ProbePresenceInput;
  })
  .handler(async ({ data }): Promise<ProbePresenceResult> => {
    const denied: ProbePresenceResult = {
      authorized: false,
      ok: false,
      spotlightNote: "The operator session is gone — sign in again.",
      trackingNote: "The operator session is gone — sign in again.",
    };
    if (!(await authorized(data.accessToken))) return denied;
    const cameraStore = await getCameraStore();
    if (!cameraStore) return { ...denied, authorized: true, spotlightNote: "No local camera store here.", trackingNote: "No local camera store here." };
    const camera = await cameraStore.get(data.cameraId);
    if (!camera) return { ...denied, authorized: true, spotlightNote: "That camera is not in the registry.", trackingNote: "That camera is not in the registry." };
    const runtime = await import("./cameraPresenceRuntime.server");
    const result = await runtime.probePresence(camera);
    return { authorized: true, ok: result.ok, spotlightNote: result.spotlightNote, trackingNote: result.trackingNote };
  });

export type ProbeStreamResult = { authorized: boolean; ok: boolean; note: string };

/**
 * The stream probe: measure whether THIS camera's pulled stream
 * follows its moving lens (a short test pan, frames compared,
 * the head returned toward its start). The verdict is recorded
 * in the presence store; follow steering and the watch read it.
 */
export const probeCameraStreamFollow = createServerFn({ method: "POST" })
  .validator((input: unknown): ProbePresenceInput => {
    if (!isTokenInput(input) || typeof (input as ProbePresenceInput).cameraId !== "string") {
      throw new Error("Invalid stream probe request.");
    }
    return input as ProbePresenceInput;
  })
  .handler(async ({ data }): Promise<ProbeStreamResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const cameraStore = await getCameraStore();
    if (!cameraStore) return { authorized: true, ok: false, note: "No local camera store here." };
    const camera = await cameraStore.get(data.cameraId);
    if (!camera) return { authorized: true, ok: false, note: "That camera is not in the registry." };
    const runtime = await import("./cameraPresenceRuntime.server");
    const result = await runtime.probeStreamFollow(camera);
    return { authorized: true, ok: result.ok, note: result.note };
  });

/* ------------------------------ creator ------------------------------ */

export type CreatorInput = TokenInput & { cameraId: string };

export const enrollCreatorFace = createServerFn({ method: "POST" })
  .validator((input: unknown): CreatorInput => {
    if (!isTokenInput(input) || typeof (input as CreatorInput).cameraId !== "string") {
      throw new Error("Invalid enrollment request.");
    }
    return input as CreatorInput;
  })
  .handler(async ({ data }): Promise<PresenceNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const cameraStore = await getCameraStore();
    if (!cameraStore) return { authorized: true, ok: false, note: "No local camera store here." };
    const camera = await cameraStore.get(data.cameraId);
    if (!camera) return { authorized: true, ok: false, note: "That camera is not in the registry." };
    const runtime = await import("./cameraPresenceRuntime.server");
    const result = await runtime.enrollCreator(camera);
    return { authorized: true, ok: result.ok, note: result.note };
  });

export const checkCreatorFace = createServerFn({ method: "POST" })
  .validator((input: unknown): CreatorInput => {
    if (!isTokenInput(input) || typeof (input as CreatorInput).cameraId !== "string") {
      throw new Error("Invalid creator check request.");
    }
    return input as CreatorInput;
  })
  .handler(async ({ data }): Promise<PresenceNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const cameraStore = await getCameraStore();
    if (!cameraStore) return { authorized: true, ok: false, note: "No local camera store here." };
    const camera = await cameraStore.get(data.cameraId);
    if (!camera) return { authorized: true, ok: false, note: "That camera is not in the registry." };
    const runtime = await import("./cameraPresenceRuntime.server");
    const result = await runtime.checkCreator(camera);
    return { authorized: true, ok: result.state === "match", note: result.note };
  });

export const clearCreatorEnrollment = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid enrollment request.");
    return input;
  })
  .handler(async ({ data }): Promise<PresenceNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const presenceStore = await getCameraPresenceStore();
    if (!presenceStore) return { authorized: true, ok: false, note: "No local presence store here." };
    const file = await presenceStore.read();
    if (file.enrollment) {
      const fs = await import("node:fs/promises");
      for (const frame of file.enrollment.frames) {
        await fs.unlink(`${presenceStore.dataDirectory}/creator-faces/${frame}`).catch(() => undefined);
      }
    }
    await presenceStore.update((f) => ({ ...f, enrollment: null }));
    return { authorized: true, ok: true, note: "Creator enrollment cleared — the reference frames are deleted from this machine." };
  });

/* --------------------------- stage speech poll --------------------------- */

export type CameraSpeechView = {
  authorized: boolean;
  /** Name events (for the stage's notification) + unrouted speech. */
  events: HearingEvent[];
};

export const getCameraSpeech = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid camera speech request.");
    return input;
  })
  .handler(async ({ data }): Promise<CameraSpeechView> => {
    if (!(await authorized(data.accessToken))) return { authorized: false, events: [] };
    // HEARING SELF-START (the Captain's correction, 2026-11-26):
    // the stage polls this read every ~20 s, so it is a presence
    // read path — armed-in-store must mean listening WITHOUT the
    // Cameras window ever being opened. Reconcile the presence
    // loops from the store here, and make sure the core watch
    // timer exists (its ticks keep the reconcile running on
    // their own from then on).
    const runtime = await import("./cameraPresenceRuntime.server");
    await runtime.reconcilePresence();
    const sectorRuntime = await import("./sectorWatchRuntime.server");
    sectorRuntime.reconcileSectorWatch();
    const presenceStore = await getCameraPresenceStore();
    if (!presenceStore) return { authorized: true, events: [] };
    const file = await presenceStore.read();
    return {
      authorized: true,
      events: file.hearing.filter((e) => e.kind === "name" || (e.kind === "speech" && !e.routed)),
    };
  });

export type MarkRoutedInput = TokenInput & { ids: string[] };

export const markCameraSpeechRouted = createServerFn({ method: "POST" })
  .validator((input: unknown): MarkRoutedInput => {
    if (!isTokenInput(input) || !Array.isArray((input as MarkRoutedInput).ids)) {
      throw new Error("Invalid mark-routed request.");
    }
    return input as MarkRoutedInput;
  })
  .handler(async ({ data }): Promise<{ authorized: boolean }> => {
    if (!(await authorized(data.accessToken))) return { authorized: false };
    const presenceStore = await getCameraPresenceStore();
    if (!presenceStore) return { authorized: true };
    const ids = new Set(data.ids.filter((i) => typeof i === "string").slice(0, 40));
    if (ids.size === 0) return { authorized: true };
    await presenceStore.update((file) => ({
      ...file,
      hearing: file.hearing.map((e) => (ids.has(e.id) ? { ...e, routed: true } : e)),
    }));
    return { authorized: true };
  });
