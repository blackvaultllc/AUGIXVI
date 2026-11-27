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
import {
  enrollProfileFromCandidate,
  SILENT_SENSOR_NAME,
  type SilentSensorState,
} from "./cameras/silentSensor";
import {
  emptyAgamossState,
  interactionLight,
  type AgamossState,
} from "./cameras/agamoss";
import {
  CAMERA_EYE_MODES,
  type CameraEyeMode,
  type EyeChangeEntry,
} from "./cameras/cameraEyes";

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
  /** An Agamoss conversation stands at this camera right now. */
  agamossAwake: boolean;
  /**
   * The spotlight state DERIVED from the listening state
   * (Agamoss package): shouldBeOn follows agamossAwake; canDrive
   * says whether this unit exposes a door to show it with.
   */
  agamossLight: { shouldBeOn: boolean; canDrive: boolean; note: string };
};

export type CameraPresenceView = {
  authorized: boolean;
  storageAvailable: boolean;
  cameras: Record<string, CameraPresenceViewState>;
  hearing: HearingEvent[];
  recordings: (RecordingInfo & { live: boolean })[];
  enrollment: CreatorEnrollment | null;
  /** Montu Silent Sensor: the enrolled siren profile + the standing candidate. */
  silentSensor: SilentSensorState;
  /** Agamoss: the wake-phrase list (the core config) + the danger-flag chain records. */
  agamoss: AgamossState;
  /** The eye-change log (2026-11-27): every change of a camera's eyes, with who and why. */
  eyeChanges: EyeChangeEntry[];
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
      silentSensor: { profile: null, candidate: null, lastTripAt: null },
      agamoss: emptyAgamossState(),
      eyeChanges: [],
    };
    if (!(await authorized(data.accessToken))) return empty;
    const presenceStore = await getCameraPresenceStore();
    if (!presenceStore) return { ...empty, authorized: true };
    const runtime = await import("./cameraPresenceRuntime.server");
    await runtime.reconcilePresence();
    const file = await presenceStore.read();
    const cameras: Record<string, CameraPresenceViewState> = {};
    for (const [id, state] of Object.entries(file.cameras)) {
      const awake = runtime.agamossSessionLive(id);
      cameras[id] = {
        ...state,
        listening: runtime.hearingLive(id),
        recordingNow: runtime.recordingLive(id),
        agamossAwake: awake,
        agamossLight: interactionLight({ listening: awake, spotlightDoor: state.spotlight.door }),
      };
    }
    return {
      authorized: true,
      storageAvailable: true,
      cameras,
      hearing: file.hearing,
      recordings: file.recordings.map((r) => ({ ...r, live: r.stoppedAt === null && runtime.recordingLive(r.cameraId) })),
      enrollment: file.enrollment,
      silentSensor: file.silentSensor,
      agamoss: file.agamoss,
      eyeChanges: file.eyeChanges,
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
  | "turn-to-speaker"
  | "gesture-yes"
  | "gesture-no";

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
    if (data.action === "gesture-yes" || data.action === "gesture-no") {
      // A named PTZ gesture (2026-11-27): the little robot's
      // head answers — nod yes, shake no. The runtime stands
      // behind the same gates as every send.
      const result = await runtime.playCameraGesture(
        data.cameraId,
        data.action === "gesture-yes" ? "yes" : "no",
      );
      return { authorized: true, ok: result.ok, note: result.note };
    }
    const intent =
      data.action === "spotlight"
        ? ({ type: "spotlight", cameraId: data.cameraId, on: data.on === true } as const)
        : ({ type: data.action, cameraId: data.cameraId } as const);
    const result = await runtime.executeCameraIntent(intent, camera.name);
    return { authorized: true, ok: result.ok, note: result.note };
  });

/* ------------------------------ the eyes ------------------------------ */

export type SetEyeModeInput = TokenInput & {
  cameraId: string;
  mode: CameraEyeMode;
  /** Who is making the change — the Captain or a construct, by name. */
  by: string;
  /** Why — the change is logged with it, or it does not happen. */
  reason: string;
};

/**
 * Change a camera's eyes (owner order 2026-11-27: red always;
 * a change only to see something better, logged with its
 * reason). There is no off among the modes — the type itself
 * refuses it before the runtime ever sees the request.
 */
export const setCameraEyeMode = createServerFn({ method: "POST" })
  .validator((input: unknown): SetEyeModeInput => {
    const raw = input as SetEyeModeInput;
    if (
      !isTokenInput(input) ||
      typeof raw.cameraId !== "string" ||
      !(CAMERA_EYE_MODES as string[]).includes(raw.mode) ||
      typeof raw.by !== "string" ||
      typeof raw.reason !== "string"
    ) {
      throw new Error("Invalid eye change request.");
    }
    return raw;
  })
  .handler(async ({ data }): Promise<PresenceNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const runtime = await import("./cameraPresenceRuntime.server");
    const result = await runtime.setCameraEyes(data.cameraId, data.mode, data.by, data.reason);
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

/* ------------------------- Montu Silent Sensor ------------------------- */

/**
 * His word enrolls the siren: the standing candidate (the loud
 * sound a camera kept from his test) becomes the profile under
 * its fixed name. No candidate → nothing is enrolled and the
 * note says so — a profile is never invented.
 */
export const enrollSilentSensor = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid silent sensor request.");
    return input;
  })
  .handler(async ({ data }): Promise<PresenceNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const presenceStore = await getCameraPresenceStore();
    if (!presenceStore) return { authorized: true, ok: false, note: "No local presence store here." };
    const file = await presenceStore.read();
    const candidate = file.silentSensor.candidate;
    if (!candidate) {
      return {
        authorized: true,
        ok: false,
        note: "There is no candidate sound to enroll. Run the test first: arm a camera's hearing, set a motion sensor off within its earshot, and the loud sound it hears is kept here for your word.",
      };
    }
    const profile = enrollProfileFromCandidate(candidate, Date.now());
    await presenceStore.update((f) => ({
      ...f,
      silentSensor: { ...f.silentSensor, profile, candidate: null },
    }));
    return {
      authorized: true,
      ok: true,
      note: `Enrolled as ${SILENT_SENSOR_NAME} — the sound ${candidate.cameraName} heard is now the back motion sensors' siren on this record. When a hearing camera matches it twice, Sector Watch logs a trip and you are notified.`,
    };
  });

/** Forget the siren: the profile is cleared; the sensors go silent to the system again. */
export const forgetSilentSensor = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid silent sensor request.");
    return input;
  })
  .handler(async ({ data }): Promise<PresenceNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const presenceStore = await getCameraPresenceStore();
    if (!presenceStore) return { authorized: true, ok: false, note: "No local presence store here." };
    await presenceStore.update((f) => ({
      ...f,
      silentSensor: { ...f.silentSensor, profile: null },
    }));
    return {
      authorized: true,
      ok: true,
      note: `${SILENT_SENSOR_NAME} forgotten — no siren profile stands on the record. Run the test again whenever you want it back.`,
    };
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
