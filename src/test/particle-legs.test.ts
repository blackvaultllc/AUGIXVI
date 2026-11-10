import { describe, expect, it } from "vitest";
import { getLegGaitAngle, createParticleLegData } from "@/avatar/particleLegs";
import { proceduralBust } from "@/avatar/particleSource";

function pointsInBand(positions: Float32Array, minY: number, maxY: number, side: -1 | 1): number[] {
  const xs: number[] = [];
  for (let index = 0; index < positions.length / 3; index += 1) {
    const x = positions[index * 3]!;
    const y = positions[index * 3 + 1]!;
    if (y >= minY && y < maxY && x * side > 0) xs.push(x);
  }
  return xs;
}

describe("particle legs", () => {
  it("forms articulated thighs, knees, shins, ankles and forward feet", () => {
    const { positions, sides } = createParticleLegData(6000, -1);
    const thigh = pointsInBand(positions, -2.12, -1.55, -1);
    const knee = pointsInBand(positions, -2.32, -2.04, -1);
    const shin = pointsInBand(positions, -2.88, -2.3, -1);
    let forwardFootParticles = 0;
    const footXs: number[] = [];
    let lowestFootY = 0;

    for (let index = 0; index < positions.length / 3; index += 1) {
      const x = positions[index * 3]!;
      const y = positions[index * 3 + 1]!;
      const z = positions[index * 3 + 2]!;
      if (y < -2.94 && z > 0.25) {
        forwardFootParticles += 1;
        footXs.push(x);
        lowestFootY = Math.min(lowestFootY, y);
      }
    }

    expect(thigh.length).toBeGreaterThan(1000);
    expect(knee.length).toBeGreaterThan(200);
    expect(shin.length).toBeGreaterThan(700);
    expect(forwardFootParticles).toBeGreaterThan(100);
    expect(Math.max(...footXs) - Math.min(...footXs)).toBeGreaterThan(0.25);
    expect(lowestFootY).toBeGreaterThan(-3.2);
    expect(sides.every((side) => side === -1)).toBe(true);

    const thighWidth = Math.max(...thigh) - Math.min(...thigh);
    const shinWidth = Math.max(...shin) - Math.min(...shin);
    expect(thighWidth).toBeGreaterThan(shinWidth);
    const kneeCenter = knee.reduce((sum, x) => sum + x, 0) / knee.length;
    const shinCenter = shin.reduce((sum, x) => sum + x, 0) / shin.length;
    expect(kneeCenter).toBeLessThan(shinCenter - 0.05);
    expect(Math.max(...positions.filter((_, index) => index % 3 === 2))).toBeGreaterThan(0.35);
  });

  it("keeps both legs in the torso's single themed particle data set", () => {
    const data = proceduralBust(120_000);
    const leftLegParticles = data.legSide.filter((side) => side === -1).length;
    const rightLegParticles = data.legSide.filter((side) => side === 1).length;

    expect(data.positions).toHaveLength(120_000 * 3);
    expect(data.kind).toHaveLength(120_000);
    expect(data.rand).toHaveLength(120_000);
    expect(leftLegParticles).toBe(6000);
    expect(rightLegParticles).toBe(6000);
    expect(data.legSide.filter((side) => side === 0)).toHaveLength(108_000);

    let frontBodyPoints = 0;
    let backBodyPoints = 0;
    for (let index = 0; index < data.positions.length / 3; index += 1) {
      const y = data.positions[index * 3 + 1]!;
      const z = data.positions[index * 3 + 2]!;
      if (y > -0.5 && y < 0.1 && data.legSide[index] === 0) {
        if (z > 0.25) frontBodyPoints += 1;
        if (z < -0.25) backBodyPoints += 1;
      }
    }
    expect(frontBodyPoints).toBeGreaterThan(1000);
    expect(backBodyPoints).toBeGreaterThan(1000);
  });

  it("keeps the alternating swing at full and compact scales", () => {
    const leftAngle = getLegGaitAngle(true, 1, 0, 0);
    const rightAngle = getLegGaitAngle(true, 1, 1, 0);

    expect(leftAngle).toBeCloseTo(-rightAngle);
    expect(getLegGaitAngle(false, 1, 0, 0)).toBe(0);
  });
});
