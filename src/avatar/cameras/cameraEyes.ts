/**
 * CAMERA EYES — RED, ALWAYS (owner order 2026-11-27 ~08:14 CST:
 * "Every camera needs to always have red eyes regardless. Now
 * if it needs to change its eyes in order to see something
 * better that's up to the constructs.").
 *
 * The law, whole:
 *
 *   · Every registered camera's eye state is RED by default and
 *     stays RED. There is NO off state in this module — the
 *     type has no "off", the sanitizer maps any stored claim of
 *     darkness back to red, and no function here can produce a
 *     dark camera. A camera sitting with its eyes off is not a
 *     state this system can represent.
 *   · A construct may change a camera's eyes ONLY to see
 *     something better — night-vision to read a dark room, the
 *     spotlight to put light on a subject. The change is a
 *     decision, not a drift: it carries WHO made it and WHY, in
 *     plain words, and it is written to the eye-change log at
 *     the moment it happens. A change with no reason stated
 *     does not happen — applyEyeChange refuses it and the eyes
 *     stay where they were.
 *   · Coming back to RED is always allowed and needs no
 *     justification beyond the standing order itself.
 *
 * What an "eye mode" is, honestly: the camera's standing
 * seeing-posture as the system records and shows it — red for
 * the watchful default (the IR-lit eye the Captain looks for),
 * night-vision where the construct is reading the dark,
 * spotlight where it has put its white light on a subject. The
 * mode is the record of the posture; where a unit exposes no
 * door for a posture, that is the unit's limit (the spotlight
 * probe in cameraPresence.ts already says so per camera) —
 * this module never claims a door exists.
 *
 * Plain TS, no I/O — the presence core sanitizes this state
 * with the rest of the record, and the runtime writes changes
 * through applyEyeChange so the log and the state never part.
 */

/* ------------------------------------------------------------------ */
/* The modes — red, and the two ways of seeing better                  */
/* ------------------------------------------------------------------ */

export type CameraEyeMode = "red" | "night-vision" | "spotlight";

export const CAMERA_EYE_MODES: CameraEyeMode[] = ["red", "night-vision", "spotlight"];

/** The default, and the state every camera returns to: RED. */
export const DEFAULT_EYE_MODE: CameraEyeMode = "red";

/** Plain words for a mode — the words the window and the log use. */
export function eyeModeWords(mode: CameraEyeMode): string {
  switch (mode) {
    case "red":
      return "RED — the standing watchful eye";
    case "night-vision":
      return "NIGHT-VISION — changed to read the dark";
    case "spotlight":
      return "SPOTLIGHT — changed to put light on the subject";
  }
}

/** Why a non-red mode exists at all, in one line — seeing better, nothing else. */
export function eyeModePurpose(mode: CameraEyeMode): string {
  switch (mode) {
    case "red":
      return "The standing order: red eyes always, on every camera, regardless.";
    case "night-vision":
      return "A construct changed the eyes to see something better in the dark.";
    case "spotlight":
      return "A construct changed the eyes to see something better by lighting it.";
  }
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface CameraEyeState {
  mode: CameraEyeMode;
  /** When the current mode was set (ms epoch), or null when it stands at the born default. */
  since: number | null;
  /** Who set the current mode ("the Captain", a construct's name, "the standing order"). */
  by: string;
  /** Why — the reason recorded with the change; the standing order's words at the default. */
  reason: string;
}

export const EYE_DEFAULT_REASON =
  "The standing order of 2026-11-27: red eyes always, on every camera, regardless.";

export function defaultEyeState(): CameraEyeState {
  return { mode: DEFAULT_EYE_MODE, since: null, by: "the standing order", reason: EYE_DEFAULT_REASON };
}

/* ------------------------------------------------------------------ */
/* The change log — every change, with its reason, or it did not happen */
/* ------------------------------------------------------------------ */

/** Plain words for a mode — panels and records speak these. */
export function eyeLabel(mode: CameraEyeMode): string {
  switch (mode) {
    case "red":
      return "red";
    case "night-vision":
      return "night vision";
    case "spotlight":
      return "spotlight";
  }
}

export interface EyeChangeEntry {
  id: string;
  at: number;
  cameraId: string;
  cameraName: string;
  from: CameraEyeMode;
  to: CameraEyeMode;
  /** Who made the change — the Captain or a construct, by name. */
  by: string;
  /** The reason, in plain words. A change without one is refused before it is logged. */
  reason: string;
}

export const EYE_CHANGES_MAX = 60;

/**
 * Make a change — the ONLY road from one eye state to another.
 * Returns the new state and the log entry to write with it, or
 * null when the change is refused:
 *   · no reason, or no one standing behind it (empty by) — a
 *     change nobody explains does not happen;
 *   · no change at all (to === current mode) — nothing to log.
 * There is deliberately no way to ask for darkness: the target
 * is a CameraEyeMode, and "off" is not one.
 */
export function applyEyeChange(
  current: CameraEyeState,
  input: { id: string; at: number; cameraId: string; cameraName: string; to: CameraEyeMode; by: string; reason: string },
): { state: CameraEyeState; entry: EyeChangeEntry } | null {
  const by = input.by.trim();
  const reason = input.reason.trim();
  if (!by || !reason) return null;
  if (input.to === current.mode) return null;
  const entry: EyeChangeEntry = {
    id: input.id,
    at: input.at,
    cameraId: input.cameraId,
    cameraName: input.cameraName,
    from: current.mode,
    to: input.to,
    by,
    reason,
  };
  return { state: { mode: input.to, since: input.at, by, reason }, entry };
}

/** Plain words for a change — the log line and the window speak the same sentence. */
export function describeEyeChange(entry: EyeChangeEntry): string {
  return `${entry.cameraName}: eyes ${entry.from} → ${entry.to}, by ${entry.by} — ${entry.reason}`;
}

/* ------------------------------------------------------------------ */
/* Sanitizers — a stored claim of darkness does not survive the read   */
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

/**
 * A stored mode survives only if it is one of the three real
 * modes. Anything else — "off", "dark", a hand-edited claim —
 * sanitizes to RED: the read itself enforces the order.
 */
export function sanitizeEyeMode(v: unknown): CameraEyeMode {
  return v === "night-vision" || v === "spotlight" ? v : DEFAULT_EYE_MODE;
}

export function sanitizeEyeState(v: unknown): CameraEyeState {
  const base = defaultEyeState();
  if (!isRecord(v)) return base;
  const mode = sanitizeEyeMode(v["mode"]);
  if (mode === DEFAULT_EYE_MODE) {
    // A red claim keeps its recorded who/why when they are in
    // shape; the mode is the default either way.
    return {
      mode,
      since: cleanTime(v["since"]),
      by: cleanString(v["by"], 60) ?? base.by,
      reason: cleanString(v["reason"], 300) ?? base.reason,
    };
  }
  // A non-red mode stands ONLY with its reason attached — a
  // stored change that lost its reason falls back to red,
  // because an unexplained change is not a state the law holds.
  const by = cleanString(v["by"], 60);
  const reason = cleanString(v["reason"], 300);
  if (!by || !reason) return base;
  return { mode, since: cleanTime(v["since"]), by, reason };
}

export function sanitizeEyeChangeEntry(v: unknown): EyeChangeEntry | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 64);
  const cameraId = cleanString(v["cameraId"], 64);
  const by = cleanString(v["by"], 60);
  const reason = cleanString(v["reason"], 300);
  const at = cleanTime(v["at"]);
  if (!id || !cameraId || !by || !reason || at === null) return null;
  const from = sanitizeEyeMode(v["from"]);
  const to = sanitizeEyeMode(v["to"]);
  if (from === to) return null; // a "change" to the same mode is not a change
  return {
    id,
    at,
    cameraId,
    cameraName: cleanString(v["cameraName"], 80) ?? "Camera",
    from,
    to,
    by,
    reason,
  };
}
