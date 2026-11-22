/**
 * LISTENING MODE — shared logic (Part 12, owner order 2026-11-21).
 *
 * The ear itself lives in the local speech service on this machine
 * (augie-stt, listening.py): the operator arms a session there, the
 * service transcribes the chunks it is fed, appends lines to its
 * session store ON THE PARROT ONLY, takes NO actions and gives NO
 * responses — silent — until a line contains the wake word, "Osiris"
 * or "Usir". This module is the app-side contract for that service:
 * the shapes its endpoints return, the wake-word rule (mirrored so
 * the UI can mark the moment without a round trip), and the recap
 * builder, which repeats ONLY lines the service actually recorded —
 * an empty session says so in words and nothing is ever invented.
 */

export interface ListeningLine {
  /** ISO timestamp from the service, when it sent one. */
  at: string | null;
  text: string;
  /** Part 13 label: "Operator", "Speaker 2", "Speaker 3"… or "Voice"
   *  when separation could not run (no voiceprint enrolled). */
  speaker: string;
  wake: boolean;
}

export interface ListeningStatus {
  armed: boolean;
  sessionId: string | null;
  startedAt: string | null;
  lineCount: number;
  wakeHeard: boolean;
}

export interface ListeningRecap {
  recorded: boolean;
  sessionId: string | null;
  lines: ListeningLine[];
  /** Present when nothing was recorded — the service's own words. */
  message?: string;
}

export const WAKE_WORDS = ["osiris", "usir"] as const;

export function containsWakeWord(text: string): boolean {
  const clean = text.toLowerCase();
  return WAKE_WORDS.some((word) => new RegExp(`\\b${word}\\b`).test(clean));
}

/** Parse the service's /listening/status payload; null when the shape
 *  is not what the service contract promises (never guessed at). */
export function parseListeningStatus(payload: unknown): ListeningStatus | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p["armed"] !== "boolean") return null;
  return {
    armed: p["armed"],
    sessionId: typeof p["sessionId"] === "string" ? p["sessionId"] : null,
    startedAt: typeof p["startedAt"] === "string" ? p["startedAt"] : null,
    lineCount: typeof p["lineCount"] === "number" ? p["lineCount"] : 0,
    wakeHeard: p["wakeHeard"] === true,
  };
}

/** Parse the service's /listening/recap payload. Lines that do not
 *  carry text are dropped — a recap line is only ever a recorded one. */
export function parseListeningRecap(payload: unknown): ListeningRecap | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const rawLines = Array.isArray(p["lines"]) ? p["lines"] : [];
  const lines: ListeningLine[] = [];
  for (const raw of rawLines) {
    if (typeof raw !== "object" || raw === null) continue;
    const line = raw as Record<string, unknown>;
    if (typeof line["text"] !== "string" || !line["text"]) continue;
    lines.push({
      at: typeof line["at"] === "string" ? line["at"] : null,
      text: line["text"],
      speaker: typeof line["speaker"] === "string" ? line["speaker"] : "Voice",
      wake: line["wake"] === true,
    });
  }
  const recap: ListeningRecap = {
    recorded: p["recorded"] === true && lines.length > 0,
    sessionId: typeof p["sessionId"] === "string" ? p["sessionId"] : null,
    lines,
  };
  if (typeof p["message"] === "string") recap.message = p["message"];
  return recap;
}

/**
 * The recap he asks for after waking: what was said, in order, with
 * speaker labels. An empty recap refuses in words — the exact line
 * the doctrine demands, never an invented conversation.
 */
export function buildRecap(recap: ListeningRecap, maxLines = 12): string {
  if (!recap.recorded || recap.lines.length === 0) {
    return (
      recap.message ??
      "Nothing was recorded in this listening session — I will not invent a conversation that did not happen."
    );
  }
  const shown = recap.lines.slice(-maxLines);
  const body = shown.map((line) => `${line.speaker}: ${line.text}`).join(" ");
  return recap.lines.length > maxLines
    ? `Here is the last part of what was said. ${body}`
    : `Here is what was said. ${body}`;
}

/** The always-visible indicator line for an armed session. Recording
 *  state is shown, never hidden: this text is what the window renders
 *  for as long as the service reports armed. */
export function listeningIndicatorText(status: ListeningStatus): string {
  if (!status.armed) return "Listening is OFF — nothing is being heard or recorded.";
  return status.wakeHeard
    ? "LISTENING — Osiris heard his name. The session is awake."
    : "LISTENING — recording on this machine only. Silent until \u201cOsiris\u201d is said.";
}
