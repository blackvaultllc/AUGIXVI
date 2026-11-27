/**
 * CAMERA PRESENCE — the pure core of the Camera Presence pass
 * (owner orders 2026-11-26: "Whenever I talk to the camera I'm
 * talking to Anubis… can I tell Anubis commands through the
 * camera — like turn off the spotlight, or use this camera to
 * keep monitoring this area left and right?" and "he can hear
 * whenever I call his name, the camera will turn to me… build
 * into it that we don't even need to use the app").
 *
 * What lives here is everything that must be TRUE before any of
 * it touches a wire:
 *
 *   · The per-camera presence state (hearing armed, patrol,
 *     follow, spotlight door, unit-tracking door) and the file
 *     shape the core store keeps — sanitized on every read, so a
 *     hand-edited or half-written store can never invent a state.
 *   · The heard-speech record: what a camera heard, which camera
 *     heard it (known truth — the audio came down that camera's
 *     own stream), and what was done about it.
 *   · The deterministic camera-command parser: the small set of
 *     things the Captain can SAY to a camera. Anything outside
 *     the set is not a camera command — it is speech for Anubis
 *     and routes onward untouched.
 *   · The patrol pattern and the follow step: plain math over
 *     measured inputs (elapsed time, a motion centroid). The
 *     follow tracks MOVEMENT measured between real frames; a
 *     person is only ever claimed by the analyzer's reading,
 *     labeled a draft — this module never calls motion a person.
 *   · The probe readers: they read what a unit's ONVIF answers
 *     actually contain (imaging fields, auxiliary commands,
 *     analytics configurations) and say whether a REAL door for
 *     the spotlight or for unit auto-tracking exists. No door →
 *     no switch, anywhere. That refusal is the feature.
 *
 * Plain TS, no I/O — the server modules do the dialing.
 */

import {
  emptySilentSensorState,
  sanitizeSilentSensorState,
  type SilentSensorState,
} from "./silentSensor";
import {
  emptyAgamossState,
  sanitizeAgamossState,
  type AgamossState,
} from "./agamoss";
import {
  defaultEyeState,
  sanitizeEyeChangeEntry,
  sanitizeEyeState,
  EYE_CHANGES_MAX,
  type CameraEyeState,
  type EyeChangeEntry,
} from "./cameraEyes";

/* ------------------------------------------------------------------ */
/* State shapes                                                        */
/* ------------------------------------------------------------------ */

export interface PatrolState {
  active: boolean;
  startedAt: number | null;
  /** One full left (or right) leg of the sweep, milliseconds. */
  sweepMs: number;
  /**
   * This patrol was armed by AUTONOMY (2026-11-27), not by the
   * Captain's hand or voice. The distinction matters exactly
   * once: when a recorded order turns autonomy off, only the
   * autonomy-armed patrols stand down — his own patrols are
   * his and keep running.
   */
  autonomous: boolean;
}

export type FollowBasis = "person" | "movement";

export interface FollowState {
  active: boolean;
  startedAt: number | null;
  /**
   * What the follow is standing on right now: "person" only when
   * the analyzer's latest draft reading said a person is in the
   * frame; otherwise "movement" — measured motion, honestly named.
   */
  basis: FollowBasis | null;
  /** Last measured subject position, 0..1 across / down the frame. */
  lastCentroid: { x: number; y: number } | null;
  /** When the analyzer last said "person" for this camera. */
  lastPersonAt: number | null;
}

export interface SpotlightState {
  /** The ONVIF door that drives it (an imaging field name), or null. */
  door: string | null;
  /** Last state WE set or read; null = never established. */
  on: boolean | null;
  probedAt: number | null;
  /** Plain words: what the probe found, or why there is no switch. */
  note: string;
}

export interface TrackingState {
  /** "analytics:<configToken>:<itemName>" when a real toggle exists. */
  door: string | null;
  on: boolean | null;
  probedAt: number | null;
  note: string;
}

export interface CameraPresenceState {
  /** The camera's audio is being pulled and transcribed on the core. */
  hearing: boolean;
  /**
   * Heard speech may act: camera commands execute and other
   * speech routes to Anubis's command path. Off = the camera
   * still hears his name (that event is always recorded) but
   * nothing it hears is obeyed or forwarded.
   */
  commands: boolean;
  patrol: PatrolState;
  follow: FollowState;
  spotlight: SpotlightState;
  tracking: TrackingState;
  /**
   * MEASURED, per camera (the stream probe): does the stream
   * the core pulls swing when the moving lens is panned?
   * true = the pulled frames follow the PTZ (proven on the
   * Bedroom unit, 2026-11-26); false = the pulled frames stay
   * on the fixed view while the head moves (the Command unit's
   * evidence); null = never measured — nobody claims either
   * way until the probe runs.
   */
  streamFollowsPtz: boolean | null;
  streamProbedAt: number | null;
  /** Plain words: what the stream probe measured. */
  streamNote: string;
  /**
   * THE EYES (owner order 2026-11-27): RED by default and
   * always — the law and the change log live in cameraEyes.ts.
   * A construct may change them only to see something better,
   * and that change is logged with its reason or it does not
   * stand. There is no off state.
   */
  eyes: CameraEyeState;
}

export type HearingEventKind = "name" | "command" | "speech";

/**
 * Whose voice a heard line carried, by the voiceprint's
 * verdict (voice-distinction pass, owner order 2026-11-26):
 * "captain" — the voice matched the Captain's enrolled
 * voiceprint; "another" — the voice was checked and did NOT
 * match it; null — NO VERDICT (no voiceprint enrolled, the
 * speech service could not answer, or the line predates the
 * distinction). The verdict is voice SIMILARITY, never proof
 * of identity, and the service's numeric score never crosses
 * into this record — match, no-match, or no verdict, exactly
 * the enrollment discipline.
 */
export type SpeakerLabel = "captain" | "another";

export interface HearingEvent {
  id: string;
  at: number;
  cameraId: string;
  cameraName: string;
  /** The transcript exactly as the speech service returned it. */
  text: string;
  kind: HearingEventKind;
  /** Plain words: what was done ("patrol started", "sent to Anubis", …). */
  acted: string | null;
  /** Speech only: the stage has fed this line to Anubis already. */
  routed: boolean;
  /** The voiceprint's verdict on this line's voice — null = no verdict. */
  speaker: SpeakerLabel | null;
}

/** The verdict → label mapping, kept pure so it is testable:
 *  enrolled + match → the Captain; enrolled + no match →
 *  another person; anything else → no verdict (null). */
export function speakerLabelFromVerdict(
  enrolled: boolean,
  match: boolean | null,
): SpeakerLabel | null {
  if (!enrolled || match === null) return null;
  return match ? "captain" : "another";
}

/** Plain words for a label, as the hearing record speaks them. */
export function speakerLabelWords(label: SpeakerLabel | null): string | null {
  if (label === "captain") return "the Captain";
  if (label === "another") return "another person";
  return null;
}

/**
 * The pipeline may strengthen the Captain's voiceprint with
 * samples IT attributed to him at a match — never with
 * anything else — and only this many, ever. The strengthening
 * is written into the hearing record when it happens.
 */
export const VOICE_STRENGTHEN_MAX = 4;

/**
 * May this matched sample strengthen the reference? Only when
 * the voiceprint service's own bookkeeping says the road is
 * clear: enrolled, NO manual enrollment session in progress
 * (pending samples are the Captain's own work — never mixed),
 * and room under the service's own sample cap counting what
 * the pipeline has already added.
 */
export function mayStrengthenVoiceprint(input: {
  enrolled: boolean;
  pendingSamples: number;
  samples: number | null;
  maxSamples: number;
  alreadyAdded: number;
}): boolean {
  if (!input.enrolled) return false;
  if (input.pendingSamples !== 0) return false;
  if (input.samples === null) return false;
  if (input.alreadyAdded >= VOICE_STRENGTHEN_MAX) return false;
  return input.samples + input.alreadyAdded < input.maxSamples;
}

/** The pipeline's own strengthening bookkeeping, kept on the record. */
export interface VoiceStrengthening {
  /** Samples the pipeline has added to the voiceprint at a match. */
  count: number;
  lastAt: number | null;
}

export interface RecordingInfo {
  id: string;
  cameraId: string;
  cameraName: string;
  /** File name inside the core's camera-recordings folder. */
  file: string;
  startedAt: number;
  stoppedAt: number | null;
  bytes: number | null;
}

export interface CreatorEnrollment {
  cameraId: string;
  cameraName: string;
  /** Reference frame file names inside the core's creator-faces folder. */
  frames: string[];
  at: number;
}

/**
 * One member of the household, enrolled by the Captain (Sector
 * Watch, 2026-11-26): a name and reference frames, kept on the
 * core only (the household-faces folder). The bedroom rule
 * checks a person in the Captain's room against this list —
 * the Captain and Khadija are the names the rule expects.
 */
export interface HouseholdEnrollment {
  /** The name the rule knows this face by ("The Captain", "Khadija"). */
  name: string;
  cameraId: string;
  cameraName: string;
  /** Reference frame file names inside the core's household-faces folder. */
  frames: string[];
  at: number;
}

export const HOUSEHOLD_MAX = 8;

export interface CameraPresenceFile {
  cameras: Record<string, CameraPresenceState>;
  hearing: HearingEvent[];
  recordings: RecordingInfo[];
  enrollment: CreatorEnrollment | null;
  /** The household faces Sector Watch checks against (may be empty). */
  household: HouseholdEnrollment[];
  /** Voiceprint strengthening the hearing pipeline has performed (capped). */
  voiceStrengthening: VoiceStrengthening;
  /**
   * MONTU SILENT SENSOR (2026-11-26): the enrolled PIR-siren
   * sound profile, the latest unnamed loud-sound candidate,
   * and the last confirmed trip — the hearing pipeline's sound
   * record, kept with the hearing record it stands on. The
   * shapes and the law live in silentSensor.ts.
   */
  silentSensor: SilentSensorState;
  /**
   * AGAMOSS (2026-11-26): the wake-phrase list (the ONE
   * editable list in the core config — the Captain edits it
   * here, in this store) and the danger-flag escalation
   * records of the alarm chain. The shapes and the law live
   * in agamoss.ts.
   */
  agamoss: AgamossState;
  /**
   * THE EYE-CHANGE LOG (2026-11-27): every change of a
   * camera's eyes away from — or back to — red, with who made
   * it and why. A change that is not in this log did not
   * happen; a change with no reason never reaches this log.
   */
  eyeChanges: EyeChangeEntry[];
}

export const HEARING_MAX = 60;
export const RECORDINGS_MAX = 100;

export function defaultPresenceState(): CameraPresenceState {
  return {
    hearing: false,
    commands: false,
    patrol: { active: false, startedAt: null, sweepMs: 6000, autonomous: false },
    follow: { active: false, startedAt: null, basis: null, lastCentroid: null, lastPersonAt: null },
    spotlight: { door: null, on: null, probedAt: null, note: "Not probed yet — run the presence probe." },
    tracking: { door: null, on: null, probedAt: null, note: "Not probed yet — run the presence probe." },
    streamFollowsPtz: null,
    streamProbedAt: null,
    streamNote: "Not measured yet — run the stream probe to learn whether this camera's stream follows its moving lens.",
    eyes: defaultEyeState(),
  };
}

export function emptyPresenceFile(): CameraPresenceFile {
  return {
    cameras: {},
    hearing: [],
    recordings: [],
    enrollment: null,
    household: [],
    voiceStrengthening: { count: 0, lastAt: null },
    silentSensor: emptySilentSensorState(),
    agamoss: emptyAgamossState(),
    eyeChanges: [],
  };
}

/* ------------------------------------------------------------------ */
/* Sanitizers — a stored claim survives only in its exact shape        */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function cleanString(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function cleanTime(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

function cleanBoolOrNull(v: unknown): boolean | null {
  return v === true ? true : v === false ? false : null;
}

function sanitizeCentroid(v: unknown): { x: number; y: number } | null {
  if (!isRecord(v)) return null;
  const x = v["x"];
  const y = v["y"];
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

export function sanitizePresenceState(v: unknown): CameraPresenceState {
  const base = defaultPresenceState();
  if (!isRecord(v)) return base;
  const patrol = isRecord(v["patrol"]) ? v["patrol"] : {};
  const follow = isRecord(v["follow"]) ? v["follow"] : {};
  const spotlight = isRecord(v["spotlight"]) ? v["spotlight"] : {};
  const tracking = isRecord(v["tracking"]) ? v["tracking"] : {};
  const sweep = patrol["sweepMs"];
  return {
    hearing: v["hearing"] === true,
    commands: v["commands"] === true,
    patrol: {
      active: patrol["active"] === true,
      startedAt: cleanTime(patrol["startedAt"]),
      sweepMs:
        typeof sweep === "number" && sweep >= 2000 && sweep <= 30_000 ? sweep : base.patrol.sweepMs,
      autonomous: patrol["autonomous"] === true,
    },
    follow: {
      active: follow["active"] === true,
      startedAt: cleanTime(follow["startedAt"]),
      basis: follow["basis"] === "person" || follow["basis"] === "movement" ? follow["basis"] : null,
      lastCentroid: sanitizeCentroid(follow["lastCentroid"]),
      lastPersonAt: cleanTime(follow["lastPersonAt"]),
    },
    spotlight: {
      door: cleanString(spotlight["door"], 80) ?? null,
      on: cleanBoolOrNull(spotlight["on"]),
      probedAt: cleanTime(spotlight["probedAt"]),
      note: cleanString(spotlight["note"], 400) ?? base.spotlight.note,
    },
    tracking: {
      door: cleanString(tracking["door"], 160) ?? null,
      on: cleanBoolOrNull(tracking["on"]),
      probedAt: cleanTime(tracking["probedAt"]),
      note: cleanString(tracking["note"], 400) ?? base.tracking.note,
    },
    streamFollowsPtz: cleanBoolOrNull(v["streamFollowsPtz"]),
    streamProbedAt: cleanTime(v["streamProbedAt"]),
    streamNote: cleanString(v["streamNote"], 400) ?? base.streamNote,
    eyes: sanitizeEyeState(v["eyes"]),
  };
}

export function sanitizeHearingEvent(v: unknown): HearingEvent | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 64);
  const cameraId = cleanString(v["cameraId"], 64);
  const text = cleanString(v["text"], 500);
  const at = cleanTime(v["at"]);
  if (!id || !cameraId || !text || at === null) return null;
  const kind = v["kind"];
  const speaker = v["speaker"];
  return {
    id,
    at,
    cameraId,
    cameraName: cleanString(v["cameraName"], 80) ?? "Camera",
    text,
    kind: kind === "name" || kind === "command" ? kind : "speech",
    acted: cleanString(v["acted"], 300) ?? null,
    routed: v["routed"] === true,
    speaker: speaker === "captain" || speaker === "another" ? speaker : null,
  };
}

export function sanitizeRecording(v: unknown): RecordingInfo | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 64);
  const cameraId = cleanString(v["cameraId"], 64);
  const file = cleanString(v["file"], 200);
  const startedAt = cleanTime(v["startedAt"]);
  if (!id || !cameraId || !file || startedAt === null) return null;
  return {
    id,
    cameraId,
    cameraName: cleanString(v["cameraName"], 80) ?? "Camera",
    file,
    startedAt,
    stoppedAt: cleanTime(v["stoppedAt"]),
    bytes: typeof v["bytes"] === "number" && v["bytes"] >= 0 ? v["bytes"] : null,
  };
}

export function sanitizePresenceFile(v: unknown): CameraPresenceFile {
  if (!isRecord(v)) return emptyPresenceFile();
  const cameras: Record<string, CameraPresenceState> = {};
  if (isRecord(v["cameras"])) {
    for (const [id, state] of Object.entries(v["cameras"])) {
      cameras[id.slice(0, 64)] = sanitizePresenceState(state);
    }
  }
  const hearing = Array.isArray(v["hearing"])
    ? v["hearing"]
        .map(sanitizeHearingEvent)
        .filter((e): e is HearingEvent => e !== null)
        .slice(0, HEARING_MAX)
    : [];
  const recordings = Array.isArray(v["recordings"])
    ? v["recordings"]
        .map(sanitizeRecording)
        .filter((r): r is RecordingInfo => r !== null)
        .slice(0, RECORDINGS_MAX)
    : [];
  let enrollment: CreatorEnrollment | null = null;
  if (isRecord(v["enrollment"])) {
    const e = v["enrollment"];
    const cameraId = cleanString(e["cameraId"], 64);
    const at = cleanTime(e["at"]);
    const frames = Array.isArray(e["frames"])
      ? e["frames"].filter((f): f is string => typeof f === "string" && f.length > 0).slice(0, 6)
      : [];
    if (cameraId && at !== null && frames.length > 0) {
      enrollment = {
        cameraId,
        cameraName: cleanString(e["cameraName"], 80) ?? "Camera",
        frames,
        at,
      };
    }
  }
  const household = Array.isArray(v["household"])
    ? v["household"]
        .map(sanitizeHouseholdEnrollment)
        .filter((m): m is HouseholdEnrollment => m !== null)
        .slice(0, HOUSEHOLD_MAX)
    : [];
  const vs = isRecord(v["voiceStrengthening"]) ? v["voiceStrengthening"] : {};
  const voiceStrengthening: VoiceStrengthening = {
    count:
      typeof vs["count"] === "number" && Number.isFinite(vs["count"]) && vs["count"] >= 0
        ? Math.min(Math.floor(vs["count"]), VOICE_STRENGTHEN_MAX)
        : 0,
    lastAt: cleanTime(vs["lastAt"]),
  };
  return {
    cameras,
    hearing,
    recordings,
    enrollment,
    household,
    voiceStrengthening,
    silentSensor: sanitizeSilentSensorState(v["silentSensor"]),
    agamoss: sanitizeAgamossState(v["agamoss"]),
    eyeChanges: Array.isArray(v["eyeChanges"])
      ? v["eyeChanges"]
          .map(sanitizeEyeChangeEntry)
          .filter((e): e is EyeChangeEntry => e !== null)
          .slice(0, EYE_CHANGES_MAX)
      : [],
  };
}

export function sanitizeHouseholdEnrollment(v: unknown): HouseholdEnrollment | null {
  if (!isRecord(v)) return null;
  const name = cleanString(v["name"], 60);
  const cameraId = cleanString(v["cameraId"], 64);
  const at = cleanTime(v["at"]);
  const frames = Array.isArray(v["frames"])
    ? v["frames"].filter((f): f is string => typeof f === "string" && f.length > 0).slice(0, 6)
    : [];
  if (!name || !cameraId || at === null || frames.length === 0) return null;
  return {
    name,
    cameraId,
    cameraName: cleanString(v["cameraName"], 80) ?? "Camera",
    frames,
    at,
  };
}

/**
 * The faces the bedroom rule checks against: the household list
 * as enrolled, and — until the Captain enrolls anyone there —
 * the standing creator enrollment standing in as the Captain's
 * own entry (it IS his face; its frames live in the
 * creator-faces folder, the household's in household-faces —
 * the reader tries both). Empty means recognition does not
 * exist yet, and the rule says so instead of pretending.
 */
export function effectiveHousehold(file: CameraPresenceFile): HouseholdEnrollment[] {
  if (file.household.length > 0) return file.household;
  if (file.enrollment) {
    return [
      {
        name: "The Captain",
        cameraId: file.enrollment.cameraId,
        cameraName: file.enrollment.cameraName,
        frames: file.enrollment.frames,
        at: file.enrollment.at,
      },
    ];
  }
  return [];
}

/** The state for one camera, born at the honest default when absent. */
export function presenceFor(file: CameraPresenceFile, cameraId: string): CameraPresenceState {
  return file.cameras[cameraId] ?? defaultPresenceState();
}

/* ------------------------------------------------------------------ */
/* Heard speech — the name, and the command set                        */
/* ------------------------------------------------------------------ */

/** His name, as a whole word, anywhere in the transcript. */
export function hearsAnubisName(text: string): boolean {
  return /\banubis\b/i.test(text);
}

export type CameraCommandIntent =
  | { type: "ptz"; cameraId: string; pan: number; tilt: number }
  | { type: "stop-motion"; cameraId: string }
  | { type: "patrol-start"; cameraId: string }
  | { type: "patrol-stop"; cameraId: string }
  | { type: "spotlight"; cameraId: string; on: boolean }
  | { type: "follow-start"; cameraId: string }
  | { type: "follow-stop"; cameraId: string }
  | { type: "record-start"; cameraId: string }
  | { type: "record-stop"; cameraId: string }
  | { type: "turn-to-speaker"; cameraId: string };

export interface CameraNameRef {
  id: string;
  name: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolve WHICH camera a command means: a camera named in the
 * words wins; otherwise the camera that heard him. Name matching
 * is whole-word on the camera's registered name (and on the last
 * word of a multi-word name, so "the bedroom camera" finds the
 * camera named "Bedroom").
 */
const GENERIC_NAME_WORDS = new Set(["camera", "cam", "the", "a"]);

export function resolveCommandCamera(
  text: string,
  cameras: CameraNameRef[],
  sourceCameraId: string,
): string {
  const lower = ` ${text.toLowerCase()} `;
  const others = cameras.filter((c) => c.id !== sourceCameraId);
  // A full registered name anywhere in the words wins first…
  for (const camera of others) {
    const full = camera.name.toLowerCase().trim();
    if (full && new RegExp(`\\b${escapeRegExp(full)}\\b`).test(lower)) return camera.id;
  }
  // …then a distinctive last word ("bedroom" for "Bedroom",
  // never the generic "camera").
  for (const camera of others) {
    const words = camera.name.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const lastWord = words[words.length - 1];
    if (
      lastWord &&
      lastWord.length >= 3 &&
      !GENERIC_NAME_WORDS.has(lastWord) &&
      new RegExp(`\\b${escapeRegExp(lastWord)}\\b`).test(lower)
    ) {
      return camera.id;
    }
  }
  return sourceCameraId;
}

/**
 * The camera command set — deliberately small and explicit. A
 * transcript that matches nothing here is NOT a camera command:
 * the caller routes it to Anubis as ordinary speech. Matching is
 * on plain imperative phrases a man actually says to a camera.
 */
export function parseCameraCommand(
  text: string,
  cameras: CameraNameRef[],
  sourceCameraId: string,
): CameraCommandIntent | null {
  const t = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  const cameraId = resolveCommandCamera(text, cameras, sourceCameraId);
  const has = (...phrases: string[]) => phrases.some((p) => t.includes(` ${p} `) || t.includes(` ${p},`) || t.includes(` ${p}.`));

  if (has("stop patrolling", "stop patrol", "stop the patrol", "stop monitoring", "stop watching")) {
    return { type: "patrol-stop", cameraId };
  }
  if (has("stop following", "stop following me", "stop follow")) {
    return { type: "follow-stop", cameraId };
  }
  if (has("stop recording")) return { type: "record-stop", cameraId };
  if (has("stop moving", "stop the camera", "hold still", "stay there", "stop")) {
    return { type: "stop-motion", cameraId };
  }
  if (
    has(
      "start patrolling",
      "start patrol",
      "patrol the area",
      "patrol this area",
      "keep monitoring",
      "monitor this area",
      "keep watch",
      "watch this area",
      "sweep the area",
      "patrol mode",
    )
  ) {
    return { type: "patrol-start", cameraId };
  }
  if (has("turn off the spotlight", "spotlight off", "kill the spotlight", "turn the spotlight off")) {
    return { type: "spotlight", cameraId, on: false };
  }
  if (has("turn on the spotlight", "spotlight on", "turn the spotlight on", "light on")) {
    return { type: "spotlight", cameraId, on: true };
  }
  if (has("follow me", "keep following me", "start following", "start following me")) {
    return { type: "follow-start", cameraId };
  }
  if (has("start recording", "record this", "record the area", "record now")) {
    return { type: "record-start", cameraId };
  }
  if (has("turn to me", "look at me", "face me", "turn around to me")) {
    return { type: "turn-to-speaker", cameraId };
  }
  const pan = has("turn left", "pan left", "look left", "move left", "swing left")
    ? -1
    : has("turn right", "pan right", "look right", "move right", "swing right")
      ? 1
      : 0;
  const tilt = has("tilt up", "look up", "move up") ? 1 : has("tilt down", "look down", "move down") ? -1 : 0;
  if (pan !== 0 || tilt !== 0) return { type: "ptz", cameraId, pan, tilt };
  return null;
}

/** Plain words for an intent — the hearing record says what was done. */
export function describeIntent(intent: CameraCommandIntent, cameraName: string): string {
  switch (intent.type) {
    case "ptz":
      return `Moved ${cameraName} by voice command`;
    case "stop-motion":
      return `Stopped ${cameraName}'s motion by voice command`;
    case "patrol-start":
      return `Started ${cameraName}'s patrol by voice command`;
    case "patrol-stop":
      return `Stopped ${cameraName}'s patrol by voice command`;
    case "spotlight":
      return `Turned ${cameraName}'s spotlight ${intent.on ? "on" : "off"} by voice command`;
    case "follow-start":
      return `Started ${cameraName} following by voice command`;
    case "follow-stop":
      return `Stopped ${cameraName} following by voice command`;
    case "record-start":
      return `Started recording ${cameraName} by voice command`;
    case "record-stop":
      return `Stopped recording ${cameraName} by voice command`;
    case "turn-to-speaker":
      return `Turned ${cameraName} toward where he was last seen`;
  }
}

/* ------------------------------------------------------------------ */
/* Patrol + follow math                                                */
/* ------------------------------------------------------------------ */

export const PATROL_SPEED = 0.35;
export const PATROL_PAUSE_MS = 1200;

/**
 * The patrol pattern: sweep one way for the leg, rest, sweep
 * back, rest — forever, until stopped. Pure over elapsed time,
 * so the loop is just "ask what the pattern says now".
 */
export function patrolVelocityAt(
  elapsedMs: number,
  sweepMs: number,
  pauseMs: number = PATROL_PAUSE_MS,
): number {
  if (elapsedMs < 0) return 0;
  const cycle = 2 * sweepMs + 2 * pauseMs;
  const t = elapsedMs % cycle;
  if (t < sweepMs) return -PATROL_SPEED;
  if (t < sweepMs + pauseMs) return 0;
  if (t < 2 * sweepMs + pauseMs) return PATROL_SPEED;
  return 0;
}

/**
 * The centroid of what CHANGED between two grayscale frames —
 * measured motion, nothing more. Returns null when the change
 * is under the floor (a quiet frame is not a subject).
 */
export function motionCentroidIn(
  prev: ArrayLike<number>,
  curr: ArrayLike<number>,
  width: number,
  height: number,
  diffThreshold = 28,
  minCoverage = 0.002,
): { x: number; y: number; coverage: number } | null {
  const n = Math.min(prev.length, curr.length, width * height);
  if (n <= 0 || width <= 0 || height <= 0) return null;
  let changed = 0;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs((curr[i] ?? 0) - (prev[i] ?? 0));
    if (d >= diffThreshold) {
      changed++;
      sumX += i % width;
      sumY += Math.floor(i / width);
    }
  }
  if (changed === 0) return null;
  const coverage = changed / n;
  if (coverage < minCoverage) return null;
  return { x: sumX / changed / Math.max(1, width - 1), y: sumY / changed / Math.max(1, height - 1), coverage };
}

export const FOLLOW_DEADBAND = 0.1;

/**
 * One follow step: from the subject's measured position to the
 * PTZ velocity that centers it. Inside the deadband the honest
 * answer is "hold still" (null) — chasing noise is not following.
 */
export function followVelocity(
  centroid: { x: number; y: number },
  deadband: number = FOLLOW_DEADBAND,
): { pan: number; tilt: number } | null {
  const dx = centroid.x - 0.5;
  const dy = 0.5 - centroid.y;
  const pan = Math.abs(dx) > deadband ? Math.max(-0.6, Math.min(0.6, dx * 1.8)) : 0;
  const tilt = Math.abs(dy) > deadband ? Math.max(-0.6, Math.min(0.6, dy * 1.8)) : 0;
  if (pan === 0 && tilt === 0) return null;
  return { pan, tilt };
}

/* ------------------------------------------------------------------ */
/* Analyzer verdicts — strict parsing, the Second Look discipline      */
/* ------------------------------------------------------------------ */

/**
 * A yes/no question put to the vision model is answered ONLY by
 * a reply that begins with yes or no. Anything else — hedging, a
 * paragraph, silence — is "no verdict", never a guessed pass.
 */
export function parseStrictYesNo(text: string): boolean | null {
  const clean = text.trim().toLowerCase().replace(/^[^a-z]+/, "");
  if (/^yes\b/.test(clean)) return true;
  if (/^no\b/.test(clean)) return false;
  return null;
}

export const PERSON_CHECK_PROMPT =
  "Answer only yes or no: is there a person in this image? Begin your answer with yes or no and say nothing else.";

export const SAME_PERSON_PROMPT =
  "The first image shows the owner of this camera. Answer only yes or no: does the second image show the same person? Begin your answer with yes or no and say nothing else.";

/* ------------------------------------------------------------------ */
/* Probe readers — what the unit's own answers contain                 */
/* ------------------------------------------------------------------ */

function localNames(xml: string): string[] {
  const names: string[] = [];
  const re = /<\/?(?:[a-zA-Z0-9]+:)?([A-Za-z][A-Za-z0-9]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1]) names.push(m[1]);
  }
  return names;
}

/** Every element name inside an ImagingSettings reply, deduped. */
export function imagingFieldNames(imagingXml: string): string[] {
  return [...new Set(localNames(imagingXml))];
}

const SPOTLIGHT_FIELD_RE = /spot|flood|white.?light/i;

/**
 * The spotlight door: a REAL imaging field whose name is about
 * the white light (spot / flood / white light). IR fields
 * (IrCutFilter, IR lamp) are a different light — night vision,
 * not the spotlight — and are reported as such, never wired as
 * the spotlight switch.
 */
export function spotlightDoorFromImaging(fields: string[]): { door: string | null; note: string } {
  const door = fields.find((f) => SPOTLIGHT_FIELD_RE.test(f));
  if (door) {
    return { door, note: `The unit exposes “${door}” in its ONVIF imaging settings — that is the spotlight's door.` };
  }
  const ir = fields.filter((f) => /ir|infrared/i.test(f));
  if (ir.length > 0) {
    return {
      door: null,
      note: `No ONVIF spotlight door: the imaging settings carry IR/night fields (${ir.join(", ")}) but nothing for the white spotlight. On this unit the spotlight answers only in its vendor app, so Augie shows no switch rather than a fake one.`,
    };
  }
  return {
    door: null,
    note: "No ONVIF spotlight door: the imaging settings expose no light control at all. On this unit the spotlight answers only in its vendor app, so Augie shows no switch rather than a fake one.",
  };
}

/** Auxiliary commands a PTZ service advertises (raw capability XML). */
export function auxiliaryCommands(capabilitiesXml: string): string[] {
  const out: string[] = [];
  const re = /AuxiliaryCommand[^>]*>([^<]+)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(capabilitiesXml)) !== null) {
    if (m[1]) out.push(m[1].trim());
  }
  // Some firmwares list them as tt:AuxiliaryData text instead.
  const re2 = /AuxiliaryData[^>]*>([^<]+)</g;
  while ((m = re2.exec(capabilitiesXml)) !== null) {
    if (m[1]) out.push(m[1].trim());
  }
  return [...new Set(out)];
}

/**
 * A spotlight door through PTZ auxiliary commands, when the unit
 * advertises one (e.g. a lamp/white-light aux). The command
 * string is the door; on/off rides its |On / |Off suffix shape.
 */
export function spotlightDoorFromAux(commands: string[]): { door: string | null; note: string } | null {
  const hit = commands.find((c) => /light|lamp|spot/i.test(c) && /\|On$/i.test(c));
  if (!hit) return null;
  const base = hit.replace(/\|On$/i, "");
  return {
    door: `aux:${base}`,
    note: `The unit advertises a PTZ auxiliary command “${base}” — that is the spotlight's door.`,
  };
}

/**
 * The unit-tracking door: a video-analytics configuration whose
 * name or items speak of TRACKING, carrying a simple enable item
 * Augie can flip. Motion/human DETECTION rules are not tracking
 * — they are named in the note and never wired as a follow switch.
 */
export function trackingDoorFromAnalytics(analyticsXml: string): { door: string | null; note: string } {
  // Walk the configuration OPENING tags (a tag whose name is
  // exactly VideoAnalyticsConfiguration, namespace prefix allowed —
  // the Get…Response wrapper must not match, or its split would eat
  // the real tag's token). Each block runs to the next opening tag.
  const openRe = /<(?:[a-zA-Z0-9]+:)?VideoAnalyticsConfiguration\s[^>]*?token="([^"]+)"[^>]*>/g;
  const opens: { token: string; start: number; end: number }[] = [];
  let open: RegExpExecArray | null;
  while ((open = openRe.exec(analyticsXml))) {
    opens.push({ token: open[1] ?? "", start: open.index, end: open.index + open[0].length });
  }
  const names: string[] = [];
  let door: string | null = null;
  for (let i = 0; i < opens.length; i++) {
    const block = analyticsXml.slice(opens[i]!.end, opens[i + 1]?.start ?? undefined);
    const nameMatch = /<(?:[a-zA-Z0-9]+:)?Name>([^<]+)</.exec(block);
    const name = nameMatch?.[1] ?? opens[i]!.token ?? "configuration";
    names.push(name);
    const items = [...block.matchAll(/SimpleItem[^>]*Name="([^"]+)"[^>]*Value="([^"]*)"/g)].map(
      (m) => ({ name: m[1] ?? "", value: m[2] ?? "" }),
    );
    const enableItem = items.find((i) => /enable/i.test(i.name));
    if (/track/i.test(name) || items.some((i) => /track/i.test(i.name))) {
      if (enableItem && opens[i]!.token) {
        door = `analytics:${opens[i]!.token}:${enableItem.name}`;
      }
    }
  }
  if (door) {
    return { door, note: "The unit exposes its own auto-tracking as an ONVIF analytics configuration with an enable switch — Augie can turn it on and off." };
  }
  if (names.length > 0) {
    return {
      door: null,
      note: `No ONVIF auto-tracking door: the unit's analytics configurations (${names.join(", ")}) carry no tracking enable Augie can flip. Detection rules are not tracking. Following runs on the core instead (see Follow).`,
    };
  }
  return {
    door: null,
    note: "No ONVIF auto-tracking door: the unit offers no video-analytics configurations at all. Following runs on the core instead (see Follow).",
  };
}

/** The VideoAnalyticsConfiguration token named inside a profiles reply. */
export function analyticsConfigTokenFromProfiles(profilesXml: string): string | null {
  const m = /VideoAnalyticsConfiguration[^>]*token="([^"]+)"/.exec(profilesXml);
  return m?.[1] ?? null;
}

/**
 * Flip one boolean SimpleItem inside a VideoAnalyticsConfiguration
 * document — the smallest honest edit: the unit's own configuration,
 * with exactly one value changed, ready to hand back through
 * SetVideoAnalyticsConfiguration. Null when the item is not there.
 */
export function flipAnalyticsEnable(configXml: string, itemName: string, on: boolean): string | null {
  const re = new RegExp(
    `(<(?:[a-zA-Z0-9]+:)?SimpleItem[^>]*Name="${itemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*Value=")([^"]*)(")`,
  );
  if (!re.test(configXml)) return null;
  return configXml.replace(re, `$1${on ? "true" : "false"}$3`);
}

/* ------------------------------------------------------------------ */
/* The stream probe — does the pulled stream follow the moving lens    */
/* ------------------------------------------------------------------ */

/**
 * The share of the frame that must change across a solid test
 * pan before the probe calls it "the stream follows the lens".
 * A real pan swings the whole scene (a large share); a fixed
 * stream shows only life passing through it (a small, local
 * share). The measured share is recorded either way — the
 * verdict never travels without its evidence.
 */
export const STREAM_FOLLOW_MIN_COVERAGE = 0.15;

/**
 * The verdict from the probe's measurement: the share of the
 * frame that changed between the frame before a test pan and
 * the frame after it. Null coverage (a frame never came back)
 * is null the verdict — unmeasured, never guessed.
 */
export function streamFollowsPtzFromCoverage(coverage: number | null): boolean | null {
  if (coverage === null || !Number.isFinite(coverage)) return null;
  return coverage >= STREAM_FOLLOW_MIN_COVERAGE;
}

/** Plain words for a stream-probe measurement, evidence included. */
export function streamProbeNote(coverage: number | null): string {
  if (coverage === null) {
    return "The stream probe could not compare frames — one of the two frames never came back, so nothing about this stream is claimed.";
  }
  const pct = Math.round(coverage * 100);
  return streamFollowsPtzFromCoverage(coverage)
    ? `Measured: ${pct}% of the picture changed across a test pan — this camera's stream FOLLOWS its moving lens. Frame analysis (follow, watch) sees what the lens sees.`
    : `Measured: only ${pct}% of the picture changed across a test pan — this camera's stream does NOT follow its moving lens; the pulled frames stay on the fixed view while the head turns. Follow and the watch judge that fixed view on this camera.`;
}

/**
 * May the follow STEER on this camera? Only where the pulled
 * stream follows the moving lens (measured true) or has not
 * been measured yet (the follow's original road). Where the
 * probe measured false, steering by picture is blind — the
 * follow still watches and reports from the fixed view, but it
 * does not nudge a lens its picture cannot see move.
 */
export function followMaySteer(streamFollowsPtz: boolean | null): boolean {
  return streamFollowsPtz !== false;
}

/** The current value of one SimpleItem in a configuration document. */
export function analyticsItemValue(configXml: string, itemName: string): boolean | null {
  const re = new RegExp(
    `<(?:[a-zA-Z0-9]+:)?SimpleItem[^>]*Name="${itemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*Value="([^"]*)"`,
  );
  const m = re.exec(configXml);
  if (!m) return null;
  return m[1] === "true" || m[1] === "1" ? true : m[1] === "false" || m[1] === "0" ? false : null;
}
