import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * AR TAKEOVER SEAT (v2.5, Domenick's live test 2026-11-23): the model
 * must TAKE OVER the cube — base on the volume's floor, centered in
 * the cube's space, footprint covering the tracked face — for every
 * model in the library, under one seat rule. These tests import the
 * EXACT module the AR page runs (public/ar-cube/js/volumeSeat.js)
 * and assert the transform against known model bounds:
 *   - the Squishy's bounds are measured from buildSquishy's geometry
 *     in app.js (spheres unioned by hand from the builder's numbers);
 *   - the tower/dish/wolf bounds are the shapes the GLB seat pipeline
 *     hands the staging (a tall figure, a too-wide dish — the old
 *     pipeline left it wider than the face — and a profile wolf whose
 *     face seat already fits, where the computed seat must reduce to
 *     the old hand shift exactly).
 */
type Vec = { x: number; y: number; z: number };
type Bounds = { min: Vec; max: Vec };
type Seat = { scale: number; position: Vec };

let seatPromise: Promise<{ computeVolumeSeat: (b: Bounds) => Seat }> | null = null;
function loadSeat() {
  if (!seatPromise) {
    seatPromise = import(
      pathToFileURL(resolve(process.cwd(), "public/ar-cube/js/volumeSeat.js")).href
    ) as Promise<{ computeVolumeSeat: (b: Bounds) => Seat }>;
  }
  return seatPromise;
}

function seated(bounds: Bounds, seat: Seat): Bounds {
  const map = (v: Vec): Vec => ({
    x: seat.position.x + seat.scale * v.x,
    y: seat.position.y + seat.scale * v.y,
    z: seat.position.z + seat.scale * v.z,
  });
  return { min: map(bounds.min), max: map(bounds.max) };
}

const EPS = 1e-6;

function expectTakeover(bounds: Bounds, seat: Seat) {
  const s = seated(bounds, seat);
  // Base on the volume floor; centered in the volume.
  expect(s.min.y).toBeCloseTo(-0.5, 6);
  expect((s.min.x + s.max.x) / 2).toBeCloseTo(0, 6);
  expect((s.min.z + s.max.z) / 2).toBeCloseTo(-0.5, 6);
  // Fully inside the cube's volume: nothing through the side walls,
  // the ceiling, the back wall, or the open face plane.
  expect(s.min.x).toBeGreaterThanOrEqual(-0.5 - EPS);
  expect(s.max.x).toBeLessThanOrEqual(0.5 + EPS);
  expect(s.max.y).toBeLessThanOrEqual(0.5 + EPS);
  expect(s.min.z).toBeGreaterThanOrEqual(-1 - EPS);
  expect(s.max.z).toBeLessThanOrEqual(0 + EPS);
  // And it FILLS the cube: scaled up until one of the seat rule's
  // caps binds — the footprint reaches 0.92 of the face, or the
  // height reaches 0.96 of the volume (a tall tower is height-bound
  // before its footprint can reach 0.92; that is the rule working).
  const footprint = Math.max(s.max.x - s.min.x, s.max.z - s.min.z);
  const height = s.max.y - s.min.y;
  expect(footprint).toBeLessThanOrEqual(0.92 + EPS);
  expect(height).toBeLessThanOrEqual(0.96 + EPS);
  expect(Math.abs(footprint - 0.92) < 1e-6 || Math.abs(height - 0.96) < 1e-6).toBe(true);
  return s;
}

describe("AR volume seat — the model takes over the cube", () => {
  it("seats the Squishy (bounds measured from its builder) on the floor, covering the face", async () => {
    const { computeVolumeSeat } = await loadSeat();
    // buildSquishy: body r=0.30 at z=0.26, arms to |x|=0.394, feet to
    // y=-0.339, eye highlights to z=0.5715 — unioned from the builder.
    const squishy: Bounds = {
      min: { x: -0.394, y: -0.339, z: -0.01 },
      max: { x: 0.394, y: 0.285, z: 0.5715 },
    };
    const seat = computeVolumeSeat(squishy);
    // The old hand scale (1.3x) made it 1.02 wide — wider than the
    // face — with its base sunk to -0.56, below the floor. The
    // computed seat is footprint-bound instead:
    expect(seat.scale).toBeCloseTo(0.92 / 0.788, 6);
    expectTakeover(squishy, seat);
  });

  it("seats a tall tower by its height cap, base on the floor", async () => {
    const { computeVolumeSeat } = await loadSeat();
    const tower: Bounds = {
      min: { x: -0.445, y: -0.4, z: 0 },
      max: { x: 0.445, y: 0.55, z: 0.43 },
    };
    const seat = computeVolumeSeat(tower);
    const s = expectTakeover(tower, seat);
    expect(s.max.y - s.min.y).toBeCloseTo(0.96, 6); // height cap binds
  });

  it("shrinks a too-wide model to the face instead of clipping the walls", async () => {
    const { computeVolumeSeat } = await loadSeat();
    // A wide dish in face-seat space: 1.5 units across — the old
    // staging passed it through at full width, through the shell.
    const dish: Bounds = {
      min: { x: -0.75, y: -0.38, z: 0.05 },
      max: { x: 0.75, y: 0.47, z: 0.55 },
    };
    const seat = computeVolumeSeat(dish);
    expect(seat.scale).toBeLessThan(1);
    expectTakeover(dish, seat);
  });

  it("reduces to the old hand shift when the face seat already fits (profile wolf)", async () => {
    const { computeVolumeSeat } = await loadSeat();
    // GLB face seat: base at y=-0.38, z centered on the holder plane
    // z=0.30, footprint already 0.92 — the computed seat must be the
    // pure shift (0, -0.12, -0.80) the hand-tuned staging used.
    const wolf: Bounds = {
      min: { x: -0.46, y: -0.38, z: 0.12 },
      max: { x: 0.46, y: 0.47, z: 0.48 },
    };
    const seat = computeVolumeSeat(wolf);
    expect(seat.scale).toBeCloseTo(1, 6);
    expect(seat.position.x).toBeCloseTo(0, 6);
    expect(seat.position.y).toBeCloseTo(-0.12, 6);
    expect(seat.position.z).toBeCloseTo(-0.8, 6);
    expectTakeover(wolf, seat);
  });

  it("survives a degenerate zero-size model without inventing a scale", async () => {
    const { computeVolumeSeat } = await loadSeat();
    const point: Bounds = {
      min: { x: 0.1, y: 0.1, z: 0.1 },
      max: { x: 0.1, y: 0.1, z: 0.1 },
    };
    const seat = computeVolumeSeat(point);
    expect(seat.scale).toBe(1);
    expect(Number.isFinite(seat.position.y)).toBe(true);
  });
});
