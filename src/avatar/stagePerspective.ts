/**
 * STAGE PERSPECTIVE (owner orders 2026-11-22): whose presence holds
 * the stage's focus.
 *
 * THE DEFAULT IS THE BLACK HATTER — Domenick himself. The screen he
 * returns to is his own face at center: he speaks in the system AS
 * the Black Hatter, and the stations recognize that face as the
 * owner (see BLACK_HATTER_BINDING in medallionPortraits.ts).
 *
 * A station comes INTO PERSPECTIVE when he turns to it — Anubis by
 * addressing his medallion, the construct by opening the AUGI avatar
 * window — and it speaks from its own place while it holds the
 * focus. Closing the station, or tapping the Black Hatter's
 * medallion, returns the perspective to the default: him.
 *
 * Plain data, no rendering — unit-testable per the repo's rules.
 */
export type StagePerspective = "black-hatter" | "anubis" | "construct";

export const DEFAULT_STAGE_PERSPECTIVE: StagePerspective = "black-hatter";

/** The perspective a station's close returns to — always the owner. */
export function perspectiveAfterClose(): StagePerspective {
  return DEFAULT_STAGE_PERSPECTIVE;
}
