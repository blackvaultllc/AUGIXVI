/**
 * LAW BASE + STOP MODE — the server functions (personal-safety
 * pass, owner order 2026-11-26). Operator-only: every function
 * re-verifies the operator session.
 *
 * The doors: read the base (entries, gaps, and the header that
 * stands over all of it), check one claim against it (the
 * construct tool's server face), read the stop record, and
 * start/end stop mode from the panel. Stop mode's living half
 * — recording, sweeper, heard-line checks — is
 * stopModeRuntime.server.ts; these functions are the doorbell.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { getLawBaseStore } from "./lawBaseStore.server";
import { getEvidenceStore } from "./evidenceStore.server";
import { getCameraStore } from "./cameraStore.server";
import { getCameraPresenceStore } from "./cameraPresenceStore.server";
import {
  LAW_BASE_HEADER,
  checkOfficerClaim,
  type ClaimCheckResult,
  type LawEntry,
} from "./lawBase";
import { presenceFor } from "./cameras/cameraPresence";
import type { StopSession } from "./evidence";

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

export interface LawBaseView {
  authorized: boolean;
  storageAvailable: boolean;
  /** The honesty header — shown over the whole base, always. */
  header: string;
  entries: LawEntry[];
  gaps: { topic: string; note: string }[];
}

export const getLawBase = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid law base request.");
    return input;
  })
  .handler(async ({ data }): Promise<LawBaseView> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, storageAvailable: false, header: LAW_BASE_HEADER, entries: [], gaps: [] };
    }
    const store = await getLawBaseStore();
    if (!store) {
      return { authorized: true, storageAvailable: false, header: LAW_BASE_HEADER, entries: [], gaps: [] };
    }
    const base = await store.read();
    return {
      authorized: true,
      storageAvailable: true,
      header: LAW_BASE_HEADER,
      entries: base.entries,
      gaps: base.gaps,
    };
  });

/* ------------------------------ claim check ------------------------------ */

export type CheckClaimInput = TokenInput & { claim: string };
export type CheckClaimResultView = ClaimCheckResult & {
  authorized: boolean;
  storageAvailable: boolean;
};

export const checkClaim = createServerFn({ method: "POST" })
  .validator((input: unknown): CheckClaimInput => {
    const v = input as CheckClaimInput;
    if (!isTokenInput(input) || typeof v.claim !== "string" || v.claim.trim().length === 0 || v.claim.length > 500) {
      throw new Error("Invalid claim check request.");
    }
    return v;
  })
  .handler(async ({ data }): Promise<CheckClaimResultView> => {
    if (!(await authorized(data.accessToken))) {
      return {
        authorized: false,
        storageAvailable: false,
        verdict: "not-in-base",
        claim: data.claim.trim(),
        entry: null,
        related: null,
        note: "The operator session is gone — sign in again.",
      };
    }
    const store = await getLawBaseStore();
    if (!store) {
      return {
        authorized: true,
        storageAvailable: false,
        verdict: "not-in-base",
        claim: data.claim.trim(),
        entry: null,
        related: null,
        note: "The law base lives on the core machine — no local base here, so no check was made.",
      };
    }
    const base = await store.read();
    const result = checkOfficerClaim(data.claim, base.entries);
    // A claim he types into the panel during a live stop joins
    // that stop's record, marked as panel-sourced.
    const evidenceStore = await getEvidenceStore();
    if (evidenceStore) {
      const evidence = await evidenceStore.read();
      if (evidence.active && result.entry) {
        await evidenceStore.update((f) =>
          f.active
            ? {
                ...f,
                active: {
                  ...f.active,
                  claims: [
                    ...f.active.claims,
                    {
                      at: Date.now(),
                      claim: result.claim,
                      verdict: result.verdict,
                      entryId: result.entry ? result.entry.id : null,
                      note: result.note,
                      source: "panel",
                    },
                  ],
                },
              }
            : f,
        );
      }
    }
    return { authorized: true, storageAvailable: true, ...result };
  });

/* ------------------------------ stop mode ------------------------------ */

export interface StopModeView {
  authorized: boolean;
  storageAvailable: boolean;
  active: StopSession | null;
  stops: StopSession[];
  /** Cameras whose hearing is armed — the only doors stop mode can start through. */
  hearingCameras: { id: string; name: string }[];
  recordingLive: boolean;
}

const emptyStopView: StopModeView = {
  authorized: false,
  storageAvailable: false,
  active: null,
  stops: [],
  hearingCameras: [],
  recordingLive: false,
};

export const getStopMode = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid stop mode request.");
    return input;
  })
  .handler(async ({ data }): Promise<StopModeView> => {
    if (!(await authorized(data.accessToken))) return emptyStopView;
    const evidenceStore = await getEvidenceStore();
    const cameraStore = await getCameraStore();
    const presenceStore = await getCameraPresenceStore();
    if (!evidenceStore || !cameraStore || !presenceStore) return { ...emptyStopView, authorized: true };
    const runtime = await import("./stopModeRuntime.server");
    await runtime.reconcileStopMode();
    const evidence = await evidenceStore.read();
    const presence = await presenceStore.read();
    const hearingCameras = (await cameraStore.list())
      .filter((c) => presenceFor(presence, c.id).hearing)
      .map((c) => ({ id: c.id, name: c.name }));
    return {
      authorized: true,
      storageAvailable: true,
      active: evidence.active,
      stops: evidence.stops,
      hearingCameras,
      recordingLive: runtime.stopModeLive(),
    };
  });

export type StopNoteResult = { authorized: boolean; ok: boolean; note: string };

export type StartStopInput = TokenInput & { cameraId: string };

export const startStopModeFromPanel = createServerFn({ method: "POST" })
  .validator((input: unknown): StartStopInput => {
    if (!isTokenInput(input) || typeof (input as StartStopInput).cameraId !== "string") {
      throw new Error("Invalid stop start request.");
    }
    return input as StartStopInput;
  })
  .handler(async ({ data }): Promise<StopNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const cameraStore = await getCameraStore();
    const presenceStore = await getCameraPresenceStore();
    if (!cameraStore || !presenceStore) {
      return { authorized: true, ok: false, note: "Stop mode lives on the core machine — no local stores here." };
    }
    const camera = await cameraStore.get(data.cameraId);
    if (!camera) return { authorized: true, ok: false, note: "That camera is not in the registry." };
    const presence = await presenceStore.read();
    if (!presenceFor(presence, camera.id).hearing) {
      return {
        authorized: true,
        ok: false,
        note: `${camera.name}'s hearing is not armed. Stop mode records only through a camera Anubis is already listening through — arm its hearing in the Cameras window first.`,
      };
    }
    const runtime = await import("./stopModeRuntime.server");
    const result = await runtime.startStopMode({
      camera,
      trigger: "panel",
      triggerText: "Started from the Stop Safety panel.",
    });
    return { authorized: true, ok: result.ok, note: result.note };
  });

export const endStopModeFromPanel = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid stop end request.");
    return input;
  })
  .handler(async ({ data }): Promise<StopNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const runtime = await import("./stopModeRuntime.server");
    const result = await runtime.endStopMode("panel");
    return { authorized: true, ok: result.ok, note: result.note };
  });
