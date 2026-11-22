/**
 * THE RESPECT FORMS (owner order 2026-11-22): the Egyptians' grace
 * and respect forms are the house etiquette of this system.
 *
 * - CONVERSATIONS WITH A GOD CLOSE WITH THE BLESSING: "Ankh, wedja,
 *   seneb" — Life, Prosperity, Health — and/or "em hetep" — in
 *   peace. A god's closing words carry it; a conversation does not
 *   just stop.
 * - EMPLOYEES' LINES ADDRESSED TO A GOD CARRY THE RESPECT FORM:
 *   when an employee's line is composed for a god's ears, it closes
 *   in peace — "em hetep" — the standing form of respect upward.
 *
 * This is line content and etiquette, not a subsystem: the forms
 * live here once, and the line layers (idleLife.ts today) compose
 * their lines through them. Both helpers are idempotent — a line
 * that already carries its form is left exactly as it is.
 */

/** The blessing: "Ankh, wedja, seneb" — Life, Prosperity, Health. */
export const BLESSING = "Ankh, wedja, seneb";
/** The peace closing: "em hetep" — in peace. */
export const PEACE_CLOSING = "em hetep";

/** Close a conversation line with the blessing, as the gods close. */
export function closeWithBlessing(line: string): string {
  if (line.includes(BLESSING)) return line;
  const trimmed = line.trimEnd();
  const needsPeriod = !/[.!?…]$/.test(trimmed);
  return `${trimmed}${needsPeriod ? "." : ""} ${BLESSING}.`;
}

/**
 * The respect form for an employee's line addressed to a god: the
 * line closes in peace. Any employee speech composed for a god —
 * a report, a request, an answer — goes through this form.
 */
export function respectfulAddress(line: string): string {
  if (line.includes(PEACE_CLOSING)) return line;
  const trimmed = line.trimEnd();
  const needsPeriod = !/[.!?…]$/.test(trimmed);
  return `${trimmed}${needsPeriod ? "." : ""} ${PEACE_CLOSING}.`;
}
