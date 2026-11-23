/**
 * WINDOW GEOMETRY BOUNDS (operator order 2026-11-21).
 * A floating window must always open INSIDE the stage with clear
 * margins on every side — never covering the whole viewport, whatever
 * size was saved last session or however small the screen is now.
 * Domenick's AR Cube opened at a persisted near-full-screen size and
 * buried the stage and the command box; these bounds are the fix.
 * Pure functions over plain numbers so the bounds are unit-testable
 * (see src/test/window-geometry.test.ts).
 */

/** Clear margin kept between a window and every viewport edge. */
export const WINDOW_MARGIN = 16;
/** Smallest gap allowed when a window is dragged against an edge. */
export const WINDOW_EDGE = 4;
export const WINDOW_MIN_WIDTH = 260;
export const WINDOW_MIN_HEIGHT = 140;

/**
 * Clamp a window size so the window fits the viewport with
 * WINDOW_MARGIN to spare on every side. Minimum sizes still win on a
 * viewport too small to honor both. A window whose layout needs
 * more room than the shared floor (the chat box — its rail stack
 * and input row must hold together) passes its own minimums.
 */
export function clampWindowSize(
  w: number,
  h: number,
  viewportW: number,
  viewportH: number,
  minW: number = WINDOW_MIN_WIDTH,
  minH: number = WINDOW_MIN_HEIGHT,
): { w: number; h: number } {
  const maxW = Math.max(minW, viewportW - WINDOW_MARGIN * 2);
  const maxH = Math.max(minH, viewportH - WINDOW_MARGIN * 2);
  return {
    w: Math.min(Math.max(w, minW), maxW),
    h: Math.min(Math.max(h, minH), maxH),
  };
}

/**
 * Clamp a window position so a window of the given size stays fully
 * inside the viewport (at least WINDOW_EDGE from every edge).
 */
export function clampWindowPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  viewportW: number,
  viewportH: number,
): { x: number; y: number } {
  const maxX = Math.max(WINDOW_EDGE, viewportW - w - WINDOW_EDGE);
  const maxY = Math.max(WINDOW_EDGE, viewportH - h - WINDOW_EDGE);
  return {
    x: Math.min(Math.max(x, WINDOW_EDGE), maxX),
    y: Math.min(Math.max(y, WINDOW_EDGE), maxY),
  };
}
