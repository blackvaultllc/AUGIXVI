/**
 * THE PHONE SWIPE — turning the stage's view by hand (owner
 * order 2026-11-26, the circuit-ring theme): on the phone, a
 * finger slide left or right moves between the stage's views.
 *
 * THE HONEST MAPPING: the stage already has exactly one set of
 * views a sideways move can honestly turn — the PERSPECTIVE
 * (stageView.ts: Left / Front / Right, the view that steps
 * around Anubis, set by the buttons in his menu). The swipe
 * steps that same view, one stop per swipe, clamped at the
 * ends — it invents no navigation the stage does not have, and
 * where there is no further view the swipe simply does nothing,
 * exactly like the end buttons' pressed state. Windows are NOT
 * cycled: the window system carries no focus order to cycle
 * (FloatingWindow stacks by render order), so a swipe never
 * pretends to shuffle them.
 *
 * Plain data, no rendering — unit-testable per the repo's rules.
 */
import type { StageView } from "./stageView";

/** A swipe must travel at least this far to count as a swipe. */
export const SWIPE_MIN_DISTANCE_PX = 48;

export type SwipeDirection = "left" | "right";

/**
 * Read a touch's travel as a swipe direction. Only a mostly
 * horizontal slide counts: the sideways travel must clear the
 * minimum distance and clearly dominate the vertical travel —
 * a scroll, a drag, or a tap is never a swipe.
 */
export function swipeDirection(dx: number, dy: number): SwipeDirection | null {
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE_PX) return null;
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? "left" : "right";
}

/** The views in their standing spatial order, left to right. */
export const STAGE_VIEW_SWEEP_ORDER: readonly StageView[] = ["left", "front", "right"];

/**
 * The view a swipe lands on. A LEFTWARD swipe (the finger
 * travels left, the way a page turns) steps the view one stop
 * toward the RIGHT-hand view: Front → Right, Left → Front. A
 * RIGHTWARD swipe steps it back: Front → Left, Right → Front.
 * At either end the view holds — clamped, never wrapped.
 */
export function stageViewAfterSwipe(current: StageView, direction: SwipeDirection): StageView {
  const index = STAGE_VIEW_SWEEP_ORDER.indexOf(current);
  const next = direction === "left" ? index + 1 : index - 1;
  const clamped = Math.min(STAGE_VIEW_SWEEP_ORDER.length - 1, Math.max(0, next));
  return STAGE_VIEW_SWEEP_ORDER[clamped] ?? current;
}
