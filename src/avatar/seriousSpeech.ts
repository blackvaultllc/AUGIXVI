/**
 * SERIOUS THINGS ARE SPOKEN (owner expansion 2026-11-26 ~12:51 CST):
 * "the deities themselves may speak to him when there is something
 * serious — a serious matter can be spoken to him directly."
 *
 * The line this module draws, plainly: a SYSTEM entry in Anubis's
 * inbox is spoken only when its core event is one of the serious
 * two — a REPAIR PROPOSAL (the core proposing to heal itself) or
 * an UPDATE-APPLY REQUEST (the core asking to change itself).
 * Update checks and test results are routine: they stay silent
 * text in the inbox, as do suggestions and captures. Only real
 * core events can ever become entries (the inbox's own law: no
 * event, no entry), so nothing here can invent a thing to say.
 *
 * The voice is Anubis's: the inbox is his, the entry carries no
 * other god's name in the core record, and he is the construct
 * who reports to Zero. And the address is the law of the house:
 * in speech the gods call him ZERO — never Captain.
 *
 * Pure functions over the inbox entry shape — the stage's poll
 * decides WHEN (a new serious entry arriving while he is on the
 * program); this module decides WHAT counts and WHAT is said.
 */
import type { AnubisNotification } from "./cameras/anubisInbox";

/**
 * The inbox titles of the serious system events. These strings
 * are the titles anubisInbox.ts stamps from the core event types
 * "repair-proposal" and "update-apply-request" — kept here as the
 * one classification the speech path reads, beside the spoken
 * forms of the same titles.
 */
const SERIOUS_SYSTEM_LINES: ReadonlyArray<{ title: string; spoken: string }> = [
  { title: "System — a repair was proposed", spoken: "A repair was proposed for the core" },
  { title: "System — an update was requested", spoken: "An update was requested for the core" },
];

/** True only for a SYSTEM entry standing on a serious core event. */
export function isSeriousSystemEntry(entry: AnubisNotification): boolean {
  return (
    entry.kind === "system" &&
    SERIOUS_SYSTEM_LINES.some((line) => line.title === entry.title)
  );
}

/**
 * The line Anubis speaks for a serious entry: addressed to Zero,
 * the matter named, then the entry's own words (the core event's
 * summary and detail, as recorded) — trimmed to a spoken length.
 */
export function seriousSpeechLine(entry: AnubisNotification): string {
  const found = SERIOUS_SYSTEM_LINES.find((line) => line.title === entry.title);
  const matter = found?.spoken ?? "Something serious stands in the core";
  const detail = entry.text.replace(/\s+/g, " ").trim();
  const trimmed = detail.length > 220 ? `${detail.slice(0, 217).trimEnd()}…` : detail;
  return trimmed ? `Zero. ${matter}. ${trimmed}` : `Zero. ${matter}.`;
}
