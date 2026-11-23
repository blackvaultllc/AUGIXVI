/**
 * BRAIN STATE IN PLAIN WORDS (Captain's phone screenshot, 2026-11-23
 * ~15:09 CST): the online copy on his phone read CORE: NOT CONFIGURED
 * and PHONE BRAIN: NOT DOWNLOADED while the thread sat at a bare
 * "No response yet." — a silent box that never said WHY nothing could
 * answer or what would fix it.
 *
 * This module derives the one standing line the stage shows before
 * the first exchange whenever no brain path is ready, from the two
 * earned client-side states (the core link's real round trip and the
 * on-phone brain's cache check — never asserted). The line is short;
 * the doors are named on screen, and the full explanation lives in
 * the Master Manual (Troubleshooting → "No brain can answer yet").
 *
 * Pure and unit-tested (src/test/brain-state.test.ts).
 */
import type { CoreStatus } from "./coreLink";
import type { PhoneBrainStatus } from "./phoneBrain";

export type BrainAvailability = {
  /** Earned by the core link's round trip (coreLink.ts). */
  core: CoreStatus;
  /** Earned by the on-phone brain's cache check; null while checking. */
  phoneBrain: PhoneBrainStatus | null;
};

/**
 * A brain path is ready when the core answers (connected), or a core
 * is configured and exchanges are queued for it, or the on-phone
 * brain is downloaded and ready. Cloud fallbacks answer through the
 * server pipe when their keys are entered — that path is exercised by
 * asking, and the reply machinery reports its failures in words (the
 * no-silent-deaths law), so it is not part of this standing line.
 */
export function anyBrainCanAnswer(state: BrainAvailability): boolean {
  return (
    state.core === "connected" ||
    state.core === "queued" ||
    state.phoneBrain === "ready"
  );
}

/** The standing line, shown INSTEAD of a bare "No response yet." */
export const NO_BRAIN_LINE =
  "No brain can answer yet — connect the core in Settings, download the on-phone brain, or enter a cloud key in Connections.";

/**
 * The line the stage stands on before the first exchange, or null
 * when a brain can answer (or the phone brain's state is still being
 * checked — never declare "no brain" on unchecked evidence).
 */
export function brainStateLine(state: BrainAvailability): string | null {
  if (state.phoneBrain === null) return null;
  return anyBrainCanAnswer(state) ? null : NO_BRAIN_LINE;
}
