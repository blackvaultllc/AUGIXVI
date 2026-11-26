/**
 * THE LOGIN GATE — pure core (no I/O, unit-testable).
 *
 * Montu's gate check (Captain's order, 2026-11-26): Montu already
 * stands on the login surface; now the gate itself works. A regular
 * login asks for the microphone and the camera, takes ONE snapshot
 * of whoever is at the gate, and — for the Captain — listens for his
 * spoken words and checks the voice against his enrolled voiceprint.
 *
 * The verdict discipline is the house discipline (the same one the
 * camera hearing uses): match / no-match / no-verdict, and NEVER a
 * confidence number anywhere in a record or on a screen.
 *
 * The voice layer is an ADDED lock on top of his credentials, never
 * a replacement (Fire Cell law: his regular credentials are the
 * underlying key, and the house unlocks when he enters them):
 *   · voice match + the words heard  → the gate names him: "Zero."
 *   · voice NO-match (the print says, plainly, not his voice)
 *     → that attempt is refused and recorded, photo and all.
 *   · NO verdict (not enrolled, the speech service unreachable, the
 *     words not heard through noise) → credentials carry the entry,
 *     and the attempt record carries the note. He is never locked
 *     out of his own house by a check that could not judge.
 *
 * This module holds the phrase matching, the outcome rule, and the
 * attempt-record format. The node-only store lives in
 * loginGateStore.server.ts; the endpoints in loginGate.server.ts.
 */

/** The words the Captain speaks at his gate — from his creed. */
export const GATE_PHRASE = "cast in the name of God, ye not guilty";

/** The name the gate speaks when his voice opens it. */
export const CAPTAIN_GATE_NAME = "Zero";

/** The name Khadija's door speaks when it knows her. */
export const LEARNER_GATE_NAME = "One";

/** The spoken word Khadija's door listens for: her own name. */
export const LEARNER_GATE_WORD = "Khadija";

/** Speech → comparable words: lowercase, punctuation gone, single spaces. */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The creed phrase as comparable words. */
export const GATE_PHRASE_WORDS = normalizeSpeech(GATE_PHRASE);

/** True when the transcript carries the Captain's gate words. */
export function gatePhraseHeard(transcript: string): boolean {
  const heard = normalizeSpeech(transcript);
  if (!heard) return false;
  return ` ${heard} `.includes(` ${GATE_PHRASE_WORDS} `);
}

/** True when the transcript carries Khadija's gate word (her name). */
export function learnerWordHeard(transcript: string): boolean {
  const heard = normalizeSpeech(transcript);
  if (!heard) return false;
  return ` ${heard} `.includes(` ${normalizeSpeech(LEARNER_GATE_WORD)} `);
}

export type GateVoiceOutcome = "match" | "no-match" | "no-verdict";

export interface GateVoiceInputs {
  /** The speech services answered at all (transcription + verify). */
  servicesAnswered: boolean;
  /** A voiceprint is enrolled on this machine. */
  enrolled: boolean;
  /** The voiceprint verdict: true = his voice, false = not his, null = no answer. */
  voiceMatch: boolean | null;
  /** The gate words were heard in the transcript. */
  phraseHeard: boolean;
}

/**
 * The outcome rule. Only a positive voiceprint NO-match can refuse
 * an attempt; everything the check could not establish is a
 * no-verdict and falls back to credentials (with a logged note).
 * His voice matching while the words go unheard is a no-verdict,
 * not a refusal — a noisy room must not bar the Captain.
 */
export function gateVoiceOutcome(inputs: GateVoiceInputs): GateVoiceOutcome {
  if (!inputs.servicesAnswered || !inputs.enrolled || inputs.voiceMatch === null) {
    return "no-verdict";
  }
  if (inputs.voiceMatch === false) return "no-match";
  return inputs.phraseHeard ? "match" : "no-verdict";
}

/** Which door an attempt came through. */
export type GateDoor = "operator" | "learner";

/**
 * How an attempt ended, in plain words:
 *   voice-match          his voice + his words opened the gate check
 *   credentials-fallback the voice check gave no verdict; credentials carried it
 *   voice-no-match       the voiceprint said plainly: not his voice — refused
 *   sign-in-failed       the credentials (or the registry) refused
 *   permission-denied    mic/camera permission was refused — no entry
 *   no-camera            this device has no camera — stated plainly, no entry
 *   learner-entry        Khadija came through her own door
 */
export type GateAttemptResult =
  | "voice-match"
  | "credentials-fallback"
  | "voice-no-match"
  | "sign-in-failed"
  | "permission-denied"
  | "no-camera"
  | "learner-entry";

export const GATE_ATTEMPT_RESULTS: readonly GateAttemptResult[] = [
  "voice-match",
  "credentials-fallback",
  "voice-no-match",
  "sign-in-failed",
  "permission-denied",
  "no-camera",
  "learner-entry",
];

/**
 * One recorded attempt at the gate — his doorbell record. The photo
 * is ONE still frame from the granted camera stream, stored beside
 * this record in the core (photoFile names it; null when no camera
 * was granted). No voice score is ever recorded — verdicts only.
 */
export interface GateAttemptRecord {
  /** ISO-8601 timestamp of the attempt. */
  ts: string;
  door: GateDoor;
  result: GateAttemptResult;
  /** The name the gate spoke for this attempt, when it spoke one. */
  namedAs: string | null;
  /** Plain-words note (e.g. why a fallback carried the entry). */
  note: string;
  /** Core-side photo file name, or null when no snapshot exists. */
  photoFile: string | null;
}

/**
 * The ones flagged for his review: a refused or failed attempt at
 * the OPERATOR gate. Khadija's own entries through her door are
 * never flagged — she is One, and her door is hers.
 */
export function gateAttemptFlagged(record: GateAttemptRecord): boolean {
  if (record.door !== "operator") return false;
  return (
    record.result === "voice-no-match" ||
    record.result === "sign-in-failed" ||
    record.result === "permission-denied" ||
    record.result === "no-camera"
  );
}

/** Plain words for a result, as the gate log speaks them. */
export function gateAttemptResultWords(result: GateAttemptResult): string {
  switch (result) {
    case "voice-match":
      return "His voice and his words opened the gate";
    case "credentials-fallback":
      return "The voice check gave no verdict — credentials carried the entry";
    case "voice-no-match":
      return "The voice was not the Captain's — refused";
    case "sign-in-failed":
      return "Sign-in refused";
    case "permission-denied":
      return "Camera/microphone permission refused — no entry";
    case "no-camera":
      return "This device has no camera — no entry";
    case "learner-entry":
      return "Khadija came through her door";
  }
}

/** One attempt as one JSON line (the on-disk format, newline included). */
export function serializeGateAttempt(record: GateAttemptRecord): string {
  return `${JSON.stringify(record)}\n`;
}

function isGateAttemptRecord(value: unknown): value is GateAttemptRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r["ts"] === "string" &&
    (r["door"] === "operator" || r["door"] === "learner") &&
    typeof r["result"] === "string" &&
    (GATE_ATTEMPT_RESULTS as readonly string[]).includes(r["result"]) &&
    (typeof r["namedAs"] === "string" || r["namedAs"] === null) &&
    typeof r["note"] === "string" &&
    (typeof r["photoFile"] === "string" || r["photoFile"] === null)
  );
}

/**
 * Parse the attempts file (JSONL) into records, oldest first as
 * stored. Malformed lines are skipped — a torn final write must
 * never take the whole log down with it.
 */
export function parseGateAttempts(text: string): GateAttemptRecord[] {
  const records: GateAttemptRecord[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isGateAttemptRecord(parsed)) records.push(parsed);
    } catch {
      // Skip the malformed line.
    }
  }
  return records;
}

/** The attempts log is capped at 1 MiB; past that it rotates once. */
export const GATE_ATTEMPT_LOG_MAX_BYTES = 1_048_576;

/** Photo file names are core-made only: attempt-<stamp>-<n>.jpg */
export const GATE_PHOTO_NAME_PATTERN = /^attempt-[0-9]{14}-[0-9]+\.jpg$/;

export function isGatePhotoName(name: string): boolean {
  return GATE_PHOTO_NAME_PATTERN.test(name);
}
