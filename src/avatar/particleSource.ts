/** Pluggable particle source. Replace with a mesh/image loader returning the same shape. */
import { createParticleLegData } from "./particleLegs";

export type ParticleData = {
  positions: Float32Array;
  kind: Float32Array;
  rand: Float32Array;
  legSide: Float32Array;
  count: number;
};
export type ParticleSource = (count: number) => ParticleData;

/**
 * Bust profile: half-width (rx) and depth (rz) at height y.
 * Human proportions: broad shoulders at the TOP of the torso (just under the neck),
 * tapering down to the waist — not a cone that widens toward the base.
 */
function profile(y: number): [number, number] | null {
  if (y > 0.5 && y < 1.62) {
    // head (sphere, unchanged shape)
    const t = (y - 1.0) / 0.62;
    const s = Math.sqrt(Math.max(0, 1 - t * t));
    return [0.44 * s, 0.5 * s];
  }
  if (y >= 0.32 && y <= 0.5) return [0.18, 0.2]; // neck
  if (y >= -1.15 && y < 0.32) {
    // torso: shoulders (widest) -> waist
    const t = Math.min(1, Math.max(0, (0.32 - y) / 1.05)); // 0 at shoulders, 1 at waist
    const shoulderS = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (y - 0.02) / 0.3), 2))); // rounded shoulder cap
    const rx = (0.28 + (1.02 - 0.28) * shoulderS) * (1 - t) + 0.5 * t;
    const rz = (0.22 + (0.5 - 0.22) * shoulderS) * (1 - t) + 0.34 * t;
    return [rx, rz];
  }
  if (y >= -1.7 && y < -1.15) {
    // hips / lower base, gentle flare
    const t = (-1.15 - y) / 0.55;
    return [0.5 + 0.12 * t, 0.34 + 0.06 * t];
  }
  return null;
}

export const proceduralBust: ParticleSource = (count) => {
  const pos = new Float32Array(count * 3),
    kind = new Float32Array(count),
    rand = new Float32Array(count),
    legSide = new Float32Array(count);
  const legCount = Math.floor(count * 0.1);
  const pointsPerLeg = Math.floor(legCount / 2);
  const nBody = count - pointsPerLeg * 2;
  const LINES = 95;
  for (let i = 0; i < nBody; i++) {
    let x = 0,
      y = 0,
      z = 0,
      k = 0;
    if (i < Math.floor(nBody * 0.91)) {
      let p: [number, number] | null = null;
      while (!p) {
        y =
          -1.7 + (Math.floor(Math.random() * LINES) / LINES) * 3.32 + (Math.random() - 0.5) * 0.002;
        p = profile(y);
      }
      const a = Math.random() * Math.PI * 2;
      x = Math.cos(a) * p[0];
      z = Math.sin(a) * p[1];
    } else {
      k = 2;
      const r = Math.abs(gauss()) * 0.2;
      const t = Math.random() * Math.PI * 2,
        ph = Math.acos(Math.random() * 2 - 1);
      const chest = Math.random() < 0.15;
      x = r * Math.sin(ph) * Math.cos(t) * 1.5;
      y = (chest ? -0.6 : 1.0) + r * Math.cos(ph) * 1.2;
      z = (chest ? 0.28 : 0.5) + Math.abs(r * Math.sin(ph) * Math.sin(t)) * 0.3;
    }
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    kind[i] = k;
    rand[i] = Math.random();
  }
  for (const [legIndex, side] of ([-1, 1] as const).entries()) {
    const leg = createParticleLegData(pointsPerLeg, side);
    const start = nBody + legIndex * pointsPerLeg;
    pos.set(leg.positions, start * 3);
    legSide.set(leg.sides, start);
    for (let i = start; i < start + pointsPerLeg; i += 1) rand[i] = Math.random();
  }
  // shuffle so drawRange scales density evenly
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    for (let c = 0; c < 3; c++) {
      const t = pos[i * 3 + c]!;
      pos[i * 3 + c] = pos[j * 3 + c]!;
      pos[j * 3 + c] = t;
    }
    let t = kind[i]!;
    kind[i] = kind[j]!;
    kind[j] = t;
    t = rand[i]!;
    rand[i] = rand[j]!;
    rand[j] = t;
    t = legSide[i]!;
    legSide[i] = legSide[j]!;
    legSide[j] = t;
  }
  return { positions: pos, kind, rand, legSide, count };
};
function gauss() {
  return Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random());
}
