import { describe, expect, it } from "vitest";
import { buildShape } from "@/avatar/transforms";

/**
 * THE WOLF MUST BE A WOLF (owner order 2026-11-21): the particle shape
 * is checked by its keypoints — a head with a snout and ears up front,
 * four legs under the body, a tail behind — so a regression back to
 * "crossed sticks and a blob" fails here before it reaches his screen.
 * Counts are statistical (the generator samples randomly), so every
 * region threshold sits far below the expected density at n = 24000.
 */
describe("wolf transform keypoints", () => {
  const COUNT = 24000;
  const positions = buildShape("wolf", COUNT);
  const points: Array<[number, number, number]> = [];
  for (let i = 0; i < COUNT; i++) {
    points.push([positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!]);
  }
  const inRegion = (
    test: (x: number, y: number, z: number) => boolean,
  ) => points.filter(([x, y, z]) => test(x, y, z)).length;

  it("has a skull up front", () => {
    expect(
      inRegion((x, y, z) => Math.abs(x) < 0.45 && y > 0.05 && y < 0.8 && z > 1.15 && z < 1.85),
    ).toBeGreaterThan(400);
  });

  it("has a snout reaching well past the skull", () => {
    expect(inRegion((x, y, z) => z > 1.9 && Math.abs(x) < 0.25 && y > 0.1 && y < 0.6)).toBeGreaterThan(
      150,
    );
  });

  it("has two ears on top of the head", () => {
    expect(inRegion((x, y, z) => y > 0.95 && z > 1.2 && z < 1.65)).toBeGreaterThan(80);
    // Both sides, not one lump in the middle.
    expect(inRegion((x, y, z) => y > 0.85 && x < -0.12 && z > 1.2 && z < 1.65)).toBeGreaterThan(40);
    expect(inRegion((x, y, z) => y > 0.85 && x > 0.12 && z > 1.2 && z < 1.65)).toBeGreaterThan(40);
  });

  it("stands on four legs — one cluster per corner", () => {
    const corners: Array<[number, number]> = [
      [-0.36, 0.78],
      [0.36, 0.78],
      [-0.36, -0.82],
      [0.36, -0.82],
    ];
    for (const [lx, lz] of corners) {
      expect(
        inRegion((x, y, z) => Math.abs(x - lx) < 0.17 && Math.abs(z - lz) < 0.17 && y < -0.85),
      ).toBeGreaterThan(120);
    }
  });

  it("has a tail behind", () => {
    expect(inRegion((x, y, z) => z < -1.6 && Math.abs(x) < 0.3)).toBeGreaterThan(150);
  });

  it("has a neck ruff between head and body", () => {
    expect(
      inRegion(
        (x, y, z) =>
          z > 1.0 && z < 1.35 && Math.hypot(x, y - 0.22) > 0.38 && Math.hypot(x, y - 0.22) < 0.68,
      ),
    ).toBeGreaterThan(150);
  });

  it("spans a wolf's silhouette — long, with head up and paws down", () => {
    let minY = Infinity,
      maxY = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const [, y, z] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    expect(maxZ - minZ).toBeGreaterThan(4.0); // nose to tail tip
    expect(maxY).toBeGreaterThan(1.05); // ear tips
    expect(minY).toBeLessThan(-1.2); // paws on the ground
  });
});
