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
 * FACE ONLY (owner eye-check 2026-11-22 ~19:40 EST): the name
 * plate and the Move/Center/Anchor row no longer stand under the
 * face — the plate is gone entirely and the controls live inside
 * the medallion's box menu (MedallionMenu.tsx), an overlay that
 * takes no room in the medallion's body. So nothing stands under
 * the face: the under-face allowance is zero, kept as a named
 * constant because the clamping and centering math reads it.
 */
export const MEDALLION_PLATE_HEIGHT = 0;

/** The menu is an overlay — it adds nothing under the face. */
export const MEDALLION_CONTROLS_HEIGHT = 0;

/** Everything under the face: nothing — the face alone. */
export const MEDALLION_UNDER_FACE_HEIGHT = MEDALLION_PLATE_HEIGHT + MEDALLION_CONTROLS_HEIGHT;

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
      stageH - WINDOW_MARGIN * 2 - MEDALLION_UNDER_FACE_HEIGHT,
    ),
  );
  const size = Math.round(Math.min(Math.max(geometry.size, MEDALLION_MIN_SIZE), maxSize));
  const position = clampWindowPosition(
    geometry.x,
    geometry.y,
    size,
    size + MEDALLION_UNDER_FACE_HEIGHT,
    stageW,
    stageH,
  );
  return { x: Math.round(position.x), y: Math.round(position.y), size };
}

/**
 * A medallion's factory home — where it stands before he has ever
 * moved it. ANUBIS'S HOME IS CENTER STAGE (presence doctrine,
 * owner order 2026-11-22): he is the resident commander, the one
 * presence on the stage by default, standing in the middle of it.
 * The Black Hatter's home is likewise the middle, at his commanding
 * size — for when the Captain brings him back from put-away. A
 * saved placement always outranks the home: where the Captain
 * leaves a medallion is where it stands — EXCEPT Anubis, whose
 * seat the lock-down (owner eye-check 2026-11-23) fixed at this
 * home for good; see loadOrDefaultMedallionGeometry.
 */
export function defaultMedallionGeometry(
  id: string,
  stageW: number,
  stageH: number,
): MedallionGeometry {
  if (id === "anubis") {
    // BIG BY DEFAULT (owner eye-check 2026-11-23): he had stretched
    // Anubis to the large size himself and ordered it kept —
    // "Leave it big like that — default, centered." The factory
    // home is now the medallion maximum, dead-center; the clamp
    // still pulls it inside smaller stages. And since the
    // LOCK-DOWN later the same morning (see
    // loadOrDefaultMedallionGeometry), this home is not just the
    // default for Anubis — it is his seat, period: no saved
    // placement outranks it anymore.
    const size = MEDALLION_MAX_SIZE;
    // THE SIZE CLAMPS FIRST, THEN THE SEAT CENTERS (owner phone
    // photo 2026-11-23): centering on the full 560 and clamping
    // the position afterwards left him shoved toward a corner on
    // phone-sized stages — big was ordered, and CENTERED with it.
    // On a stage too small for 560 he wears what fits (358 of a
    // 390-wide stage) and the seat centers on the size he wears.
    let fitted = clampMedallionGeometry(
      { x: 0, y: 0, size },
      stageW,
      stageH,
    ).size;
    // SMALLER ON THE PHONE (owner orders 2026-11-27): the
    // morning's pass capped a phone-sized stage at 80% of the
    // short side — but the presence ring stands at 122% of the
    // face, so 80% still read as the whole screen edge to edge
    // (his eye-check ~21:32 CST: "why is it taking up the whole
    // screen? It doesn't look accurate"). On a phone-sized
    // stage (either dimension phone-narrow) he now wears at
    // most 66% of the short side — 257 of a 390 stage — so the
    // ring lands near 80% and the stage breathes around him:
    // controls and margins visible on every side. Still big,
    // still centered. Desktop keeps the full measure he
    // ordered kept.
    // SMALLER AND HIGHER STILL (owner order 2026-11-27 ~23:03
    // CST, phone fix pass 7): "make Anubis a little bit smaller
    // and move Anubis up a little bit so that way the chat
    // board won't even touch him at all." The phone cap steps
    // down 66% → 59% of the short side (230 of a 390 stage),
    // and the phone seat's center rises from the stage's
    // middle (50%) to 46% of its height. Phone-sized stages
    // only: the desktop seat keeps the full measure and the
    // dead-center seat he ordered kept.
    const phoneStage = stageW <= 700 || stageH <= 500;
    if (phoneStage) {
      fitted = Math.min(fitted, Math.round(Math.min(stageW, stageH) * 0.59));
    }
    return clampMedallionGeometry(
      {
        x: (stageW - fitted) / 2,
        y: stageH * (phoneStage ? 0.46 : 0.5) - (fitted + MEDALLION_UNDER_FACE_HEIGHT) / 2,
        size: fitted,
      },
      stageW,
      stageH,
    );
  }
  if (id === "montu") {
    // Montu's station: the right flank, mid-height — the seat of the
    // commander who is sent out, clear of Anubis at center. It is
    // where he appears when summoned (he is not resident); if the
    // spot would overlap someone on a given stage, the summon takes
    // a clear spot instead (clearMedallionSpot). His to move, like
    // every medallion.
    const size = 156;
    return clampMedallionGeometry(
      {
        x: stageW - size - WINDOW_MARGIN,
        y: stageH / 2 - (size + MEDALLION_UNDER_FACE_HEIGHT) / 2,
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
      y: stageH * centerY - (size + MEDALLION_UNDER_FACE_HEIGHT) / 2,
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
 *
 * ANUBIS IS THE EXCEPTION — THE LOCK-DOWN (owner eye-check
 * 2026-11-23 ~06:51 EST): "I don't want to move it around anymore —
 * even if it's anchored it still lets me click and move it, that's
 * stupid. Anubis needs to stay centered, anchored, nobody can move
 * him around — unless I have an emergency edit I have to do."
 * Anubis's saved record is NO LONGER honored: his seat is the
 * centered, big factory home, full stop. A placement made inside
 * an emergency-edit session lives in that session's state and is
 * re-seated centered when the session ends (useMedallionAnchor);
 * a stale off-center record left from before the lock-down is
 * simply never read again — and the hook overwrites it with the
 * centered seat on mount, so the record itself is reset too.
 */
export function loadOrDefaultMedallionGeometry(
  id: string,
  stageW: number,
  stageH: number,
): MedallionGeometry {
  if (id === "anubis") return defaultMedallionGeometry(id, stageW, stageH);
  const saved = loadMedallionGeometry(id);
  if (saved) return clampMedallionGeometry(saved, stageW, stageH);
  return defaultMedallionGeometry(id, stageW, stageH);
}

/**
 * THE CENTER ACTION (owner order 2026-11-22): he could not find how
 * to move the other avatars or get them centered — a hidden gesture
 * is a defect. Every medallion now carries a visible Center button;
 * this is the geometry it lands on: the medallion (face + plate +
 * controls) dead-center of the stage, at the size it already wears.
 *
 * THE CAPTAIN'S FACE IS NEVER COVERED (standing law): centering any
 * OTHER medallion must not stack it onto the Black Hatter. When the
 * centered spot would overlap the owner's face, the medallion tries
 * the spots that clear him — below his medallion, above it, then
 * flanking him right and left. On a stage too small for any of
 * them, the centered spot stands (the clamp keeps it on-screen) —
 * the only case the law cannot be kept.
 */
export const OWNER_MEDALLION_ID = "black-hatter";

/** Live geometry of the mounted medallions, by id — the registry
 *  the center action consults so one face never covers another. */
const liveMedallionGeometry = new Map<string, MedallionGeometry>();

export function registerMedallionGeometry(id: string, geometry: MedallionGeometry) {
  liveMedallionGeometry.set(id, geometry);
}

export function registeredMedallionGeometry(id: string): MedallionGeometry | null {
  return liveMedallionGeometry.get(id) ?? null;
}

export function unregisterMedallionGeometry(id: string) {
  liveMedallionGeometry.delete(id);
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function centeredMedallionGeometry(
  current: MedallionGeometry,
  stageW: number,
  stageH: number,
  avoid?: MedallionGeometry | null,
): MedallionGeometry {
  const size = current.size;
  const centered = clampMedallionGeometry(
    {
      x: (stageW - size) / 2,
      y: (stageH - (size + MEDALLION_UNDER_FACE_HEIGHT)) / 2,
      size,
    },
    stageW,
    stageH,
  );
  if (!avoid) return centered;
  const ownerFace = { x: avoid.x, y: avoid.y, w: avoid.size, h: avoid.size };
  const clears = (g: MedallionGeometry) =>
    !rectsOverlap({ x: g.x, y: g.y, w: size, h: size }, ownerFace);
  if (clears(centered)) return centered;
  // Clear him, in order: below his whole medallion, above it, then
  // flanking him on the right and the left (the free axis stays
  // centered). The first spot that clears his face wins.
  const gap = 12;
  const candidates: MedallionGeometry[] = [
    clampMedallionGeometry(
      { x: centered.x, y: avoid.y + avoid.size + MEDALLION_UNDER_FACE_HEIGHT + gap, size },
      stageW,
      stageH,
    ),
    clampMedallionGeometry(
      { x: centered.x, y: avoid.y - size - MEDALLION_UNDER_FACE_HEIGHT - gap, size },
      stageW,
      stageH,
    ),
    clampMedallionGeometry(
      { x: avoid.x + avoid.size + gap, y: centered.y, size },
      stageW,
      stageH,
    ),
    clampMedallionGeometry(
      { x: avoid.x - size - gap, y: centered.y, size },
      stageW,
      stageH,
    ),
  ];
  for (const candidate of candidates) {
    if (clears(candidate)) return candidate;
  }
  return centered;
}

/** A medallion's full footprint on the stage — face plus its plate. */
export interface MedallionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function medallionRect(geometry: MedallionGeometry): MedallionRect {
  return {
    x: geometry.x,
    y: geometry.y,
    w: geometry.size,
    h: geometry.size + MEDALLION_PLATE_HEIGHT,
  };
}

/** True when two footprints touch or cross, with `gap` of air demanded between them. */
export function medallionRectsOverlap(a: MedallionRect, b: MedallionRect, gap = 8): boolean {
  return (
    a.x - gap < b.x + b.w && b.x - gap < a.x + a.w && a.y - gap < b.y + b.h && b.y - gap < a.y + a.h
  );
}

/**
 * A CLEAR SPOT FOR A GOD WHO COMES ON (the no-overlap law, owner
 * order 2026-11-22): when a summoned god's standing spot would
 * overlap someone already on the stage, he takes another spot that
 * overlaps nobody — the flanks and corners in order — at his own
 * size. A spot that overlaps nobody is returned exactly as given:
 * where he was left is respected until the law itself is violated.
 * If every candidate overlaps (a very small stage), the clamped
 * standing spot stands — the stage's bounds outrank the preference.
 */
export function clearMedallionSpot(
  geometry: MedallionGeometry,
  others: readonly MedallionGeometry[],
  stageW: number,
  stageH: number,
): MedallionGeometry {  const taken = others.map(medallionRect);
  const clear = (candidate: MedallionGeometry) =>
    !taken.some((rect) => medallionRectsOverlap(medallionRect(candidate), rect));
  const standing = clampMedallionGeometry(geometry, stageW, stageH);
  if (clear(standing)) return standing;
  const size = standing.size;
  const bottom = stageH - (size + MEDALLION_PLATE_HEIGHT) - WINDOW_MARGIN;
  const midY = stageH / 2 - (size + MEDALLION_PLATE_HEIGHT) / 2;
  const candidates: MedallionGeometry[] = [
    { x: stageW - size - WINDOW_MARGIN, y: midY, size }, // right flank
    { x: WINDOW_MARGIN, y: midY, size }, // left flank
    { x: stageW - size - WINDOW_MARGIN, y: bottom, size }, // bottom right
    { x: WINDOW_MARGIN, y: bottom, size }, // bottom left
    { x: stageW - size - WINDOW_MARGIN, y: WINDOW_MARGIN, size }, // top right
    { x: WINDOW_MARGIN, y: WINDOW_MARGIN, size }, // top left
  ];
  for (const candidate of candidates) {
    const clamped = clampMedallionGeometry(candidate, stageW, stageH);
    if (clear(clamped)) return clamped;
  }
  return standing;
}

/**
 * THE COUNCIL SEAT — BESIDE THE COMMANDER (owner order 2026-11-22
 * ~20:09 EST): "Call another god: that god comes up ON THE SCREEN
 * RIGHT NEXT TO ANUBIS, SMALL — beside the commander, not replacing
 * him." When a council forms, the called god's seat is beside
 * Anubis's seat: his right flank first (reading order), then his
 * left, then below, then above — vertically centered on the
 * commander, one readable gap away, at the god's own size (the
 * SMALL of the council is the presentation scale the stage CSS
 * lays on; the seat itself is honest geometry). The first flank
 * that overlaps nobody standing wins; if every flank is blocked,
 * the clear-spot law decides. Anubis's own geometry is an input
 * here, never an output: nobody is seated BY moving him.
 */
export function besideMedallionGeometry(
  anchor: MedallionGeometry,
  size: number,
  stageW: number,
  stageH: number,
  others: readonly MedallionGeometry[] = [],
): MedallionGeometry {
  const gap = 28;
  const centerY = anchor.y + anchor.size / 2 - size / 2;
  const centerX = anchor.x + anchor.size / 2 - size / 2;
  const candidates: MedallionGeometry[] = [
    { x: anchor.x + anchor.size + gap, y: centerY, size }, // his right
    { x: anchor.x - size - gap, y: centerY, size }, // his left
    { x: centerX, y: anchor.y + anchor.size + gap, size }, // below him
    { x: centerX, y: anchor.y - size - gap, size }, // above him
  ];
  const taken = [medallionRect(anchor), ...others.map(medallionRect)];
  for (const candidate of candidates) {
    const clamped = clampMedallionGeometry(candidate, stageW, stageH);
    if (!taken.some((rect) => medallionRectsOverlap(medallionRect(clamped), rect))) {
      return clamped;
    }
  }
  return clearMedallionSpot({ x: anchor.x + anchor.size + gap, y: centerY, size }, others, stageW, stageH);
}
