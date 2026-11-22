/**
 * Department plaque sizing (Part 9 labels; scale fix, owner defect
 * report 2026-11-22: "the names are way too big").
 *
 * A plaque is a SIGN in the room, not a billboard over it. Its size is
 * fixed in world units against the office's own furniture: a desk top
 * is 1.9 × FURNITURE_SCALE ≈ 1.18 world units wide and stands 0.88
 * tall; a citizen stands ≈2.02–2.26; Augie stands ≈3.1. Every plaque
 * stands LABEL_PLAQUE_HEIGHT (0.30) tall — about a third of a desk's
 * height — and grows sideways only as far as its name needs: the
 * longest department name in the building, "SECURITY OPERATIONS",
 * spans ≈2.02 units (under two desk widths); a short one, "FINANCE",
 * spans ≈0.83 — less than a single desk.
 *
 * The canvas the renderer draws a plaque on uses these same numbers
 * (labelCanvasWidth IS the canvas width), so the size pinned by the
 * tests here is the size that ships — there is no second scale.
 *
 * Plain TS with no three.js imports, per the repo rule, so the sizing
 * is unit-testable.
 */

/** Plaque height in world units, border included. */
export const LABEL_PLAQUE_HEIGHT = 0.3;

/** The plaque canvas: fixed height, width fitted to the text. */
export const LABEL_CANVAS_HEIGHT = 176;
export const LABEL_FONT_PX = 92;
/** Horizontal padding inside the plaque border, canvas px per side. */
const LABEL_PAD_PX = 30;

/**
 * Advance width of one glyph at LABEL_FONT_PX as a fraction of the
 * font size — a deterministic stand-in for canvas measureText, so a
 * plaque's size is computable without a DOM. Calibrated to 700-weight
 * system-ui capitals: letters ≈0.66em, a space ≈0.35em, a dash ≈0.55em.
 */
function glyphAdvanceEm(ch: string): number {
  if (ch === " ") return 0.35;
  if (ch === "—" || ch === "-") return 0.55;
  return 0.66;
}

/** Canvas width in px for a plaque carrying `text`. */
export function labelCanvasWidth(text: string): number {
  const ems = [...text].reduce((sum, ch) => sum + glyphAdvanceEm(ch), 0);
  return Math.ceil(ems * LABEL_FONT_PX) + LABEL_PAD_PX * 2;
}

/** World-unit size of the plaque for `text`. */
export function labelPlaqueSize(text: string): { width: number; height: number } {
  return {
    width: LABEL_PLAQUE_HEIGHT * (labelCanvasWidth(text) / LABEL_CANVAS_HEIGHT),
    height: LABEL_PLAQUE_HEIGHT,
  };
}
