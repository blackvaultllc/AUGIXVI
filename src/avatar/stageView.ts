/**
 * STAGE VIEW — THE PERSPECTIVE BY BUTTON (owner eye-check
 * 2026-11-23 ~06:51 EST): "I need him to be centered — and then
 * have a button I can do left perspective, right perspective."
 *
 * Anubis does not move — the VIEW moves. The stage view is where
 * the stage's camera stands: FRONT (dead-on, the standing view),
 * LEFT (the camera steps to the stage's left and looks across),
 * or RIGHT (the mirror). The renderer's camera takes the offset
 * (AvatarRenderer.setStageView); every medallion is a DOM element
 * over the canvas and never feels it — Anubis's geometry is not
 * an input here, let alone an output.
 *
 * Plain data, no rendering — unit-testable per the repo's rules.
 * The choice persists like every other stage preference.
 */
export type StageView = "front" | "left" | "right";

export const DEFAULT_STAGE_VIEW: StageView = "front";

export const STAGE_VIEW_STORAGE_KEY = "augi.avatar.stage-view.v1";

const STAGE_VIEWS: readonly StageView[] = ["front", "left", "right"];

export function isStageView(value: unknown): value is StageView {
  return typeof value === "string" && (STAGE_VIEWS as readonly string[]).includes(value);
}

export function loadStageView(): StageView {
  try {
    const raw = globalThis.localStorage?.getItem(STAGE_VIEW_STORAGE_KEY);
    return isStageView(raw) ? raw : DEFAULT_STAGE_VIEW;
  } catch {
    return DEFAULT_STAGE_VIEW;
  }
}

export function saveStageView(view: StageView) {
  try {
    globalThis.localStorage?.setItem(STAGE_VIEW_STORAGE_KEY, view);
  } catch {
    // best effort only
  }
}

/**
 * The camera's x-offset for a view, in world units (the camera
 * stands at z≈11, fov 40 — an offset of 3.4 reads as a clear step
 * to the side without losing the room). LEFT perspective stands
 * the camera on the stage's left; RIGHT mirrors it; FRONT is the
 * dead-on zero.
 */
export function stageViewCameraX(view: StageView): number {
  switch (view) {
    case "left":
      return -3.4;
    case "right":
      return 3.4;
    case "front":
      return 0;
  }
}
