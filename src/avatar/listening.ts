/**
 * WAND LISTENING MODE — shared logic (Part 12, owner order
 * 2026-11-21). When he turns the wand/listening on, Augie hears and
 * records the conversation FROM THAT MOMENT, stays SILENT, and wakes
 * only on the wake word — then he can ask for the recap of what was
 * said. The doctrine is unchanged: silence until called.
 */

export interface ListeningLine {
  at: number;
  text: string;
  /** Part 13 label: "Operator" or "Speaker 2", "Speaker 3"… */
  speaker: string;
}

export const WAKE_WORDS = ["osiris", "usir"] as const;

export function containsWakeWord(text: string): boolean {
  const clean = text.toLowerCase();
  return WAKE_WORDS.some((word) => new RegExp(`\\b${word}\\b`).test(clean));
}

/** The recap he asks for after waking: what was said, in order. */
export function buildRecap(lines: readonly ListeningLine[], maxLines = 12): string {
  if (lines.length === 0) {
    return "Nothing was recorded in this listening session yet — I will not invent a conversation that did not happen.";
  }
  const shown = lines.slice(-maxLines);
  const body = shown
    .map((line) => `${line.speaker}: ${line.text}`)
    .join(" ");
  return lines.length > maxLines
    ? `Here is the last part of what was said. ${body}`
    : `Here is what was said. ${body}`;
}
