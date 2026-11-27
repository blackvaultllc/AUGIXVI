/**
 * THE MATRIX WALL — the model (phone fix pass, owner orders
 * 2026-11-27 ~00:27–00:45 CST): his gold binary rain is the
 * construct's background — "always and forever" — a LIVE,
 * MOVING, boxed-in room of it: back wall, floor, left, right,
 * and top, the streams running in different directions on each
 * face. The alphabet is 0s and 1s ONLY — the real alphabet,
 * eight bits to a byte — never the film's glyphs.
 *
 * This module is the plain-data half (repo rule): the room's
 * planes, the per-role tuning, the drop model, and the step
 * math. MatrixWall.tsx is the canvas half. The wall carries no
 * readings and claims no data — it is the foundation made
 * visible, dress with a doctrine, and it invents nothing.
 *
 * PERFORMANCE LAW (his, standing): the wall must run smooth on
 * a modest phone. The model therefore caps the total columns
 * across all five planes, steps on a fixed clock (the
 * calibrated WORKING speed — the ~1/3-speed copy is the
 * separate sleep tool, never this wall), and the component
 * pauses whenever the wall is off-screen or the page hidden.
 */

/** The five faces of the boxed room. */
export type MatrixPlaneId = "back" | "floor" | "ceiling" | "left" | "right";

/**
 * Whose side the wall stands on. ONE INTERFACE FOR ALL (owner
 * order 2026-11-27): the same wall, the same alphabet, on every
 * agent's side — his, Khadija's, Violet's, and the seats to
 * come. The tuning differs by the work of the seat, the way he
 * ordered it: the tempo and density that strengthen the mind
 * for the position — finance measured, security alert and
 * dense, engineering steady, the learner's calm and sparse.
 */
export type MatrixWallRole = "owner" | "finance" | "security" | "engineering" | "learner";

export interface MatrixPlaneSpec {
  id: MatrixPlaneId;
  /** The direction this face's streams run, in plain words. */
  flow: "down" | "toward" | "away" | "down-left" | "down-right";
  /** This face's share of the room's total column budget. */
  columnShare: number;
}

export const MATRIX_PLANES: readonly MatrixPlaneSpec[] = [
  { id: "back", flow: "down", columnShare: 0.4 },
  { id: "floor", flow: "toward", columnShare: 0.2 },
  { id: "ceiling", flow: "away", columnShare: 0.13 },
  { id: "left", flow: "down-left", columnShare: 0.135 },
  { id: "right", flow: "down-right", columnShare: 0.135 },
];

/**
 * THE WORKING SPEED: one step every 66ms — the calibrated pace
 * of the working wall. The sleep tool's slow copy runs at a
 * third of this and lives elsewhere; nothing here reads it.
 */
export const MATRIX_WALL_STEP_MS = 66;

/** The whole room's column budget — the performance law's cap. */
export const MATRIX_WALL_MAX_COLUMNS = 84;

export interface MatrixRoleTuning {
  /** Column budget multiplier for the seat (≤ 1). */
  density: number;
  /** Step-clock multiplier: 1 is the working speed itself. */
  speed: number;
  /** How many glyphs a drop's lit trail carries. */
  trail: number;
  /** The gold this seat's wall burns, head glyph first. */
  headColor: string;
  trailColor: string;
}

export const MATRIX_ROLE_TUNING: Record<MatrixWallRole, MatrixRoleTuning> = {
  owner: { density: 1, speed: 1, trail: 9, headColor: "#ffe98a", trailColor: "#c9a227" },
  finance: { density: 0.7, speed: 0.8, trail: 8, headColor: "#ffe98a", trailColor: "#bfa02e" },
  security: { density: 1, speed: 1.15, trail: 10, headColor: "#ffd94d", trailColor: "#c9a227" },
  engineering: { density: 0.85, speed: 0.95, trail: 11, headColor: "#ffe98a", trailColor: "#c9a227" },
  learner: { density: 0.5, speed: 0.6, trail: 7, headColor: "#ffedb0", trailColor: "#a8892f" },
};

/** Columns for one plane at a given pixel width — capped, always. */
export function matrixPlaneColumns(
  plane: MatrixPlaneId,
  widthPx: number,
  role: MatrixWallRole,
): number {
  const spec = MATRIX_PLANES.find((p) => p.id === plane) ?? MATRIX_PLANES[0]!;
  const tuning = MATRIX_ROLE_TUNING[role];
  const budget = Math.floor(MATRIX_WALL_MAX_COLUMNS * spec.columnShare * tuning.density);
  const byWidth = Math.floor(widthPx / 22);
  return Math.max(2, Math.min(budget, byWidth));
}

/** One falling drop: a column's head position and its glyphs. */
export interface MatrixDrop {
  /** The head's row (may be negative — the drop is entering). */
  head: number;
  /** The drop's glyphs, head first — 0s and 1s only, ever. */
  glyphs: string;
  /** Rows per step this drop falls (1, occasionally 2). */
  speed: number;
}

function randomGlyphs(length: number, rng: () => number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += rng() < 0.5 ? "0" : "1";
  return out;
}

/** A fresh drop entering above the plane. */
export function newMatrixDrop(rows: number, trail: number, rng: () => number = Math.random): MatrixDrop {
  return {
    head: -Math.floor(rng() * Math.max(2, rows / 2)),
    glyphs: randomGlyphs(trail, rng),
    speed: rng() < 0.18 ? 2 : 1,
  };
}

/**
 * Step every drop one tick: heads fall by their speed, a glyph
 * flips here and there (the rain is alive, not a recording),
 * and a drop whose trail has fully left the plane is replaced
 * by a fresh one entering above it.
 */
export function stepMatrixDrops(
  drops: MatrixDrop[],
  rows: number,
  trail: number,
  rng: () => number = Math.random,
): MatrixDrop[] {
  return drops.map((drop) => {
    const head = drop.head + drop.speed;
    if (head - drop.glyphs.length > rows) return newMatrixDrop(rows, trail, rng);
    let glyphs = drop.glyphs;
    if (rng() < 0.12) {
      const at = Math.floor(rng() * glyphs.length);
      const flipped = glyphs[at] === "1" ? "0" : "1";
      glyphs = glyphs.slice(0, at) + flipped + glyphs.slice(at + 1);
    }
    return { head, glyphs, speed: drop.speed };
  });
}

/** The glyph a cell shows, or null for dark: drops own their cells. */
export function matrixCellGlyph(drop: MatrixDrop, row: number): { glyph: string; head: boolean } | null {
  const offset = drop.head - row;
  if (offset < 0 || offset >= drop.glyphs.length) return null;
  return { glyph: drop.glyphs[offset]!, head: offset === 0 };
}
