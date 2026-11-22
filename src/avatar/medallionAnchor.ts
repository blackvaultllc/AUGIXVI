/**
 * MEDALLION ANCHORS (owner order 2026-11-22): the stage's presence
 * medallions are anchored elements under his anchor law. He can grab
 * a medallion, lift it, set it down at a new perspective/position,
 * and stretch it — where he leaves it is where it stays, and the
 * placement persists like every other geometry on his stage.
 * Anchored = set into the stage, free-standing at the spot he chose;
 * unanchored = lifted in his hand for adjustment.
 *
 * This module is the plain-data half (repo rule: rules stay in plain
 * TS modules, unit-testable): geometry, bounds, defaults, and the
 * localStorage record. useMedallionAnchor.ts is the React half, and
 * every stage medallion (the Black Hatter, Anubis) runs on this one
 * system — no one-off placements.
 */
import { WINDOW_MARGIN, clampWindowPosition } from "./windows/windowGeometry";

export interface MedallionGeometry {
  /** Top-left of the medallion element, stage pixels. */
  x: number;
  y: number;
  /** The face's diameter, pixels. */
  size: number;
}

export const MEDALLION_MIN_SIZE = 72;
export const MEDALLION_MAX_SIZE = 560;
/**
 * Vertical allowance for the name plate and gap under the face, so
 * position clamping keeps the WHOLE medallion — plate included —
 * inside the stage, not just the circle.
 */
export const MEDALLION_PLATE_HEIGHT = 46;

export function medallionStorageKey(id: string): string {
  return `augi.avatar.medallion.${id}.v1`;
}

export function loadMedallionGeometry(id: string): MedallionGeometry | null {
  try {
    const raw = globalThis.localStorage?.getItem(medallionStorageKey(id));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { x?: unknown }).x === "number" &&
      typeof (parsed as { y?: unknown }).y === "number" &&
      typeof (parsed as { size?: unknown }).size === "number"
    ) {
      return parsed as MedallionGeometry;
    }
  } catch {
    // fall through — no usable record
  }
  return null;
}

export function saveMedallionGeometry(id: string, geometry: MedallionGeometry) {
  try {
    globalThis.localStorage?.setItem(medallionStorageKey(id), JSON.stringify(geometry));
  } catch {
    // best effort only
  }
}

/**
 * Clamp a medallion geometry into the stage: the face never smaller
 * than a readable minimum or larger than the stage can hold with
 * margins, and the whole element (face + plate) inside the viewport
 * with a margin — the same discipline as the floating windows.
 */
export function clampMedallionGeometry(
  geometry: MedallionGeometry,
  stageW: number,
  stageH: number,
): MedallionGeometry {
  const maxSize = Math.max(
    MEDALLION_MIN_SIZE,
    Math.min(
      MEDALLION_MAX_SIZE,
      stageW - WINDOW_MARGIN * 2,
      stageH - WINDOW_MARGIN * 2 - MEDALLION_PLATE_HEIGHT,
    ),
  );
  const size = Math.round(Math.min(Math.max(geometry.size, MEDALLION_MIN_SIZE), maxSize));
  const position = clampWindowPosition(
    geometry.x,
    geometry.y,
    size,
    size + MEDALLION_PLATE_HEIGHT,
    stageW,
    stageH,
  );
  return { x: Math.round(position.x), y: Math.round(position.y), size };
}

/**
 * A medallion's factory home — where it stands before he has ever
 * moved it. The default state is BIG in the middle of the screen:
 * the Black Hatter, the default presence, stands at center at a
 * commanding size. Anubis's station is top-center (he speaks from
 * his place; the station's home does not move) — larger than before,
 * and equally his to lift and reset wherever he wants it.
 */
export function defaultMedallionGeometry(
  id: string,
  stageW: number,
  stageH: number,
): MedallionGeometry {
  if (id === "anubis") {
    const size = 168;
    return clampMedallionGeometry(
      { x: (stageW - size) / 2, y: WINDOW_MARGIN, size },
      stageW,
      stageH,
    );
  }
  if (id === "montu") {
    // Montu's station: the right flank, mid-height — the seat of the
    // commander who is sent out, clear of Anubis at top-center and
    // of the owner at center. His to move, like every medallion.
    const size = 156;
    return clampMedallionGeometry(
      {
        x: stageW - size - WINDOW_MARGIN,
        y: stageH / 2 - (size + MEDALLION_PLATE_HEIGHT) / 2,
        size,
      },
      stageW,
      stageH,
    );
  }
  // The Black Hatter's home: BIGGER, IN THE MIDDLE (owner verdict
  // from his screen check, 2026-11-22: "I like how my avatar looks
  // but it needs to be bigger in the middle") — 380px, centered
  // horizontally, the whole medallion (face + plate) centered
  // vertically. Placement and scale only; the presence itself is
  // unchanged, and the anchor system still lets him move/stretch it.
  const size = id === "black-hatter" ? 380 : 220;
  const centerY = id === "black-hatter" ? 0.5 : 0.42;
  return clampMedallionGeometry(
    {
      x: (stageW - size) / 2,
      y: stageH * centerY - (size + MEDALLION_PLATE_HEIGHT) / 2,
      size,
    },
    stageW,
    stageH,
  );
}

/**
 * The geometry a medallion opens with: his saved placement, healed
 * into the current stage (a placement saved on a bigger screen must
 * never reopen half off this one), or the factory home when he has
 * never moved it.
 */
export function loadOrDefaultMedallionGeometry(
  id: string,
  stageW: number,
  stageH: number,
): MedallionGeometry {
  const saved = loadMedallionGeometry(id);
  if (saved) return clampMedallionGeometry(saved, stageW, stageH);
  return defaultMedallionGeometry(id, stageW, stageH);
}
