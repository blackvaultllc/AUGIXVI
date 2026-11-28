/**
 * PERIODIC PHOTO VERIFICATION — pure core (no I/O, unit-testable).
 *
 * HIS LAW (owner order 2026-11-28 ~07:28 CST; full text in
 * ~/workspace/goals/the-infinity-engine/hidden_files/avatar-notes.md):
 * for security, while a person is using the AI, the AI may
 * OCCASIONALLY ask for a one-time picture to verify the person
 * is who they are — not all the time. His cadence range: once a
 * day, once every three days, or once a week. It may also ask
 * at the moment a person wants to do certain (sensitive)
 * things. So Anubis, in his autonomous mindset, can verify it
 * is really him.
 *
 * PERMISSION IS ABSOLUTE: the AI asks first. The camera opens
 * and a snapshot is taken ONLY after the person grants
 * permission. A decline is respected — no snapshot, no penalty,
 * no lockout for declining, and the refusal is never treated as
 * suspicion. Other login methods remain fully valid: this is
 * an added check INSIDE a session, never a replacement gate,
 * and the owner's never-locked-out law is untouched.
 *
 * THE CADENCE lives here, in one place: the options are his
 * range (1 / 3 / 7 days) and the default is 3 — the middle of
 * his range — until he settles the exact value. The clock runs
 * from the last ASK, whatever its answer: a completed check and
 * a declined check both start the window, so a "no" is never
 * followed by nagging. One due rule serves both triggers (the
 * periodic ask and a sensitive action), so no path can ask
 * inside the window.
 *
 * THE VERDICT DISCIPLINE is the house discipline: this app
 * holds NO face enrollment and NO face matcher — the gate
 * judges VOICES (see loginGate.ts), and its snapshots stand in
 * the record for the Captain's own eyes. So a completed photo
 * check takes its one snapshot FOR THE RECORD and says plainly
 * on its face that there is nothing to match it against yet.
 * Nothing here pretends a match happened.
 *
 * THE RECORD states facts only, in the gate log's style (one
 * JSON object per line, see photoCheckStore.server.ts): that a
 * check was asked, by which trigger, and how it ended —
 * completed (picture taken), declined (no picture), or the
 * camera could not open after a yes (no picture). The snapshot,
 * when there is one, is stored beside the record, core-side.
 */

/* ------------------------------ the cadence ------------------------------ */

/** His range, in days: once a day, once every three days, once a week. */
export type PhotoCheckCadenceDays = 1 | 3 | 7;

export const PHOTO_CHECK_CADENCE_OPTIONS: readonly PhotoCheckCadenceDays[] = [1, 3, 7];

/** The middle of his range — the standing default until he settles it. */
export const PHOTO_CHECK_DEFAULT_CADENCE_DAYS: PhotoCheckCadenceDays = 3;

const DAY_MS = 86_400_000;

/** Only his three values are a cadence; anything else falls back to the default. */
export function sanitizePhotoCheckCadenceDays(value: unknown): PhotoCheckCadenceDays {
  return value === 1 || value === 3 || value === 7 ? value : PHOTO_CHECK_DEFAULT_CADENCE_DAYS;
}

/** The cadence in plain words, the way the ask speaks it. */
export function photoCheckCadenceWords(days: PhotoCheckCadenceDays): string {
  switch (days) {
    case 1:
      return "once a day";
    case 3:
      return "once every three days";
    case 7:
      return "once a week";
  }
}

/* --------------------------- the per-device state --------------------------- */

/**
 * The cadence setting and the last-ask clock are per-device
 * facts (this browser, this machine), kept in localStorage the
 * way the saved login and the trusted device keep theirs. The
 * storage is passed in so the tests can hand over a fake.
 */
export interface PhotoCheckStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const PHOTO_CHECK_CADENCE_KEY = "augi.photoCheck.cadenceDays.v1";
export const PHOTO_CHECK_LAST_ASK_KEY = "augi.photoCheck.lastAskAt.v1";

function defaultStorage(): PhotoCheckStorage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadPhotoCheckCadenceDays(
  storage: PhotoCheckStorage | null = defaultStorage(),
): PhotoCheckCadenceDays {
  if (!storage) return PHOTO_CHECK_DEFAULT_CADENCE_DAYS;
  try {
    const raw = storage.getItem(PHOTO_CHECK_CADENCE_KEY);
    const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
    return sanitizePhotoCheckCadenceDays(parsed);
  } catch {
    return PHOTO_CHECK_DEFAULT_CADENCE_DAYS;
  }
}

export function savePhotoCheckCadenceDays(
  days: PhotoCheckCadenceDays,
  storage: PhotoCheckStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(PHOTO_CHECK_CADENCE_KEY, String(days));
  } catch {
    /* a device that cannot keep the setting simply keeps the default */
  }
}

/** When the last ask happened on this device (epoch ms), or null when never. */
export function loadPhotoCheckLastAskAt(
  storage: PhotoCheckStorage | null = defaultStorage(),
): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PHOTO_CHECK_LAST_ASK_KEY);
    if (raw === null) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function savePhotoCheckLastAskAt(
  atMs: number,
  storage: PhotoCheckStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(PHOTO_CHECK_LAST_ASK_KEY, String(Math.floor(atMs)));
  } catch {
    /* a device that cannot keep the clock asks on its next session — stated, never hidden */
  }
}

/* ------------------------------ the due rule ------------------------------ */

/**
 * THE DUE RULE — the one rule both triggers answer to. A check
 * is due when this device has never been asked, or when the
 * last ask stands at least one full cadence window behind now.
 * The clock runs from the last ASK whatever its answer was, so
 * a decline is never chased inside the window. A last-ask time
 * in the future (a moved clock) is not due — the ask waits.
 */
export function photoCheckDue(
  nowMs: number,
  lastAskAtMs: number | null,
  cadenceDays: PhotoCheckCadenceDays,
): boolean {
  if (lastAskAtMs === null) return true;
  if (lastAskAtMs > nowMs) return false;
  return nowMs - lastAskAtMs >= cadenceDays * DAY_MS;
}

/* ------------------------------ the ask copy ------------------------------ */

/** The ask's title — plain words, his plain-writing standard. */
export const PHOTO_CHECK_ASK_TITLE = "Anubis asks: is it still you?";

/**
 * The ask itself, in plain words: what is being asked, why, and
 * that it is one picture, this once. It also says the two things
 * the law requires be said out loud: the camera opens only on a
 * yes, and a no costs nothing.
 */
export function photoCheckAskBody(cadenceDays: PhotoCheckCadenceDays): string {
  return (
    `Once in a while — ${photoCheckCadenceWords(cadenceDays)} — Anubis asks for one picture ` +
    "to check that the person using the AI is still the person who signed in. " +
    "It is one picture, this once. The camera opens only if you say yes. " +
    "Saying no is fine: no picture is taken, and nothing is held against you."
  );
}

/** Said plainly on a completed check — the honest bound of this build. */
export const PHOTO_CHECK_NO_MATCH_NOTE =
  "Your picture is taken and kept with the record, beside your gate pictures. " +
  "There is no face on file to match it against yet, so no match was run — " +
  "the picture itself stands in the record for the Captain's own review.";

/* ------------------------------ the record ------------------------------ */

/** What brought the ask: the standing cadence, or a sensitive action. */
export type PhotoCheckTrigger = "periodic" | "sensitive-action";

export const PHOTO_CHECK_TRIGGERS: readonly PhotoCheckTrigger[] = [
  "periodic",
  "sensitive-action",
];

/**
 * How an ask ended, in plain words:
 *   completed          the person said yes; one picture was taken for the record
 *   declined           the person said no; no picture was taken, nothing held against them
 *   camera-unavailable the person said yes, but the camera could not open; no picture
 */
export type PhotoCheckOutcome = "completed" | "declined" | "camera-unavailable";

export const PHOTO_CHECK_OUTCOMES: readonly PhotoCheckOutcome[] = [
  "completed",
  "declined",
  "camera-unavailable",
];

/**
 * One recorded photo check — the ask and its answer, nothing
 * more. The photo is ONE still frame from the granted camera
 * stream, stored beside this record in the core (photoFile
 * names it; null whenever no picture was taken — a decline and
 * a failed camera NEVER carry a photo).
 */
export interface PhotoCheckRecord {
  /** ISO-8601 timestamp of the record (the server's, never the caller's). */
  ts: string;
  trigger: PhotoCheckTrigger;
  outcome: PhotoCheckOutcome;
  /** Plain-words note (e.g. what the sensitive action was). */
  note: string;
  /** Core-side photo file name, or null when no snapshot exists. */
  photoFile: string | null;
}

/** Plain words for an outcome, as the record speaks them. */
export function photoCheckOutcomeWords(outcome: PhotoCheckOutcome): string {
  switch (outcome) {
    case "completed":
      return "Asked, the person said yes, and one picture was taken for the record";
    case "declined":
      return "Asked, and the person said no — no picture taken, nothing held against them";
    case "camera-unavailable":
      return "The person said yes, but the camera could not open — no picture taken";
  }
}

/** One record as one JSON line (the on-disk format, newline included). */
export function serializePhotoCheck(record: PhotoCheckRecord): string {
  return `${JSON.stringify(record)}\n`;
}

function isPhotoCheckRecord(value: unknown): value is PhotoCheckRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r["ts"] === "string" &&
    (PHOTO_CHECK_TRIGGERS as readonly string[]).includes(r["trigger"] as string) &&
    (PHOTO_CHECK_OUTCOMES as readonly string[]).includes(r["outcome"] as string) &&
    typeof r["note"] === "string" &&
    (typeof r["photoFile"] === "string" || r["photoFile"] === null)
  );
}

/**
 * Parse the photo-checks file (JSONL) into records, oldest first
 * as stored. Malformed lines are skipped — a torn final write
 * must never take the whole log down with it.
 */
export function parsePhotoChecks(text: string): PhotoCheckRecord[] {
  const records: PhotoCheckRecord[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isPhotoCheckRecord(parsed)) records.push(parsed);
    } catch {
      // Skip the malformed line.
    }
  }
  return records;
}

/** The live log file is capped at 1 MiB; past that it rotates once (gate-log rule). */
export const PHOTO_CHECK_LOG_MAX_BYTES = 1_048_576;

/**
 * Core-made snapshot names only: check-<14 digits>-<counter>.jpg —
 * the same discipline as the gate's attempt photos, under its own
 * prefix so the two records never share a name.
 */
const PHOTO_CHECK_PHOTO_NAME_PATTERN = /^check-\d{14}-\d+\.jpg$/;

export function isPhotoCheckPhotoName(name: string): boolean {
  return PHOTO_CHECK_PHOTO_NAME_PATTERN.test(name);
}
