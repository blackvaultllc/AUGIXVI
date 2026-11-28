/**
 * CAPTAIN ZERO'S OFFICE — the law of his private room (owner
 * order 2026-11-27 ~22:28 CST): "Make Captain Zero's office —
 * it's my own office to be left alone, work in focus, but if
 * emergency any of the gods can come in there and ask if they
 * can speak with me if it's important."
 *
 * The room itself stands in CaptainsOffice.tsx; this module
 * is its law, in plain data — unit-testable per the repo's
 * rules:
 *
 * - THE QUIET: while he is in the Office, no god pop-up
 *   stands and no report calls out. Reports still land in the
 *   record (notify() writes them there, as ever) and wait for
 *   him — they collect silently, exactly where they already
 *   collect. The stage enforces the quiet (the pop-ups are not
 *   rendered while the Office stands); this module owns the
 *   one exception —
 *
 * - THE KNOCK: a god may come to the door and ASK. A knock is
 *   raised only from a REAL standing emergency record — the
 *   same records the alert ring reads (alertRing.ts): Sector
 *   Watch security events waiting unacknowledged, and Sound
 *   Watch alert sounds waiting unacknowledged. The knock is
 *   signed by the god who would sign that report in the
 *   record (godPopUp.ts — security signs Montu). Nothing else
 *   knocks: no invented urgency, no attention score, no
 *   ambient summons dressed as an emergency.
 *
 *   Khadija's call is NOT a knock: she is not a god, and her
 *   line does not ask permission. The reading carries it
 *   (daddyRinging) and the Office shows it as its own line —
 *   the view's business, not this module's.
 *
 * A knock is an ASK, never an entry. The Captain admits the
 * god — the god's own chat opens, the standing way he speaks
 * with a god — or dismisses him: "not now." A dismissal is
 * remembered against the knock's SIGNATURE (the standing
 * counts it answers to): the same standing alert does not
 * knock twice, but if the count GROWS the signature changes
 * and the knock comes again — a worse emergency knocks twice.
 * The record underneath a dismissed knock still stands until
 * he acknowledges it in its own window (the Cameras window
 * for Sector Watch, Sound Watch for its alerts — the alert
 * ring's own law), and it shows on the stage as ever when he
 * steps out of the Office.
 *
 * The command words are kept apart from the world office's
 * walk-in on purpose: "go to the office" still walks into
 * Osiris's city office (world/office.ts), untouched. The
 * Captain's Office answers to the possessive forms — "my
 * office", "Zero's office", "Captain Zero's office" — which
 * the walk-in matcher never claimed.
 */
import type { AlertRingReading } from "./alertRing";
import { godForReportTopic, type ReportGodId } from "./godPopUp";
import { ADDRESSEE_NAMES } from "./addressee";

/** A god who can knock is a god who can sign a report. */
export type OfficeKnockGod = ReportGodId;

export interface OfficeKnock {
  /** The god at the door. */
  god: OfficeKnockGod;
  /** His name, as the record signs him. */
  godName: string;
  /** Why he knocks, in plain words, from the real record's own counts. */
  reason: string;
  /**
   * The standing alert set this knock answers to (god + the
   * counts). A dismissal remembers it; a changed set knocks
   * again.
   */
  signature: string;
}

/**
 * Derive the standing knocks from the alert ring's reading —
 * the same three records the ring reads, and nothing else.
 * Both standing sources sign Montu today (security is his
 * remit), so they arrive as ONE knock with both reasons; the
 * grouping by signing god keeps the law true if a source
 * that signs Anubis ever stands.
 */
export function officeKnocks(reading: AlertRingReading): OfficeKnock[] {
  const byGod = new Map<OfficeKnockGod, { reasons: string[]; parts: string[] }>();
  const add = (topic: string, count: number, reason: string, part: string) => {
    if (count <= 0) return;
    const god = godForReportTopic(topic);
    const entry = byGod.get(god) ?? { reasons: [], parts: [] };
    entry.reasons.push(reason);
    entry.parts.push(part);
    byGod.set(god, entry);
  };
  add(
    "sector watch security",
    reading.sectorAlertsWaiting,
    reading.sectorAlertsWaiting === 1
      ? "Sector Watch: one security event is waiting, not yet acknowledged."
      : `Sector Watch: ${reading.sectorAlertsWaiting} security events are waiting, not yet acknowledged.`,
    `sector=${reading.sectorAlertsWaiting}`,
  );
  add(
    "sound-watch security",
    reading.soundAlertsWaiting,
    reading.soundAlertsWaiting === 1
      ? "Sound Watch: one alert sound was heard, not yet acknowledged."
      : `Sound Watch: ${reading.soundAlertsWaiting} alert sounds were heard, not yet acknowledged.`,
    `sound=${reading.soundAlertsWaiting}`,
  );
  return [...byGod.entries()].map(([god, entry]) => ({
    god,
    godName: ADDRESSEE_NAMES[god],
    reason: entry.reasons.join(" "),
    signature: `${god}|${entry.parts.join("|")}`,
  }));
}

/**
 * His words for his own office — the possessive forms only,
 * so the world office's walk-in ("go to the office", bare
 * "office") keeps its meaning untouched.
 */
export function isCaptainsOfficeRequest(text: string): boolean {
  const line = text.trim();
  return (
    /\bcaptain\s+zero'?s\s+office\b/i.test(line) ||
    /\bzero'?s\s+office\b/i.test(line) ||
    /\bmy\s+office\b/i.test(line)
  );
}

/**
 * Leaving his office by word. The stage honors this only
 * while the Office stands; when it does not, "leave the
 * office" keeps its world meaning (the OfficeScene exit),
 * untouched.
 */
export function isCaptainsOfficeExit(text: string): boolean {
  return /^(?:leave|exit)\s+(?:the\s+|my\s+)?office[.!]?$/i.test(text.trim());
}
