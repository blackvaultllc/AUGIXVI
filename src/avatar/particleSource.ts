/** Pluggable particle source. Replace with a mesh/image loader returning the same shape. */
export type ParticleData = { positions: Float32Array; kind: Float32Array; rand: Float32Array; count: number };
export type ParticleSource = (count: number) => ParticleData;

function hash(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function ridge(x: number, z: number) {
  let h = 0, amp = 1, f = 0.6;
  for (let i = 0; i < 5; i++) { h += (1 - Math.abs(vnoise(x * f, z * f) * 2 - 1)) ** 2 * amp; amp *= 0.5; f *= 2.1; }
  return h;
}

/** Bust profile: half-width (rx) and depth (rz) at height y. */
function profile(y: number): [number, number] | null {
  if (y > 0.3 && y < 1.62) { const t = (y - 0.92) / 0.7; const s = Math.sqrt(Math.max(0, 1 - t * t)); return [0.5 * s, 0.58 * s]; }
  if (y >= -0.15 && y <= 0.3) return [0.24, 0.27];
  if (y >= -1.7 && y < -0.15) { const t = Math.min(1, (-0.15 - y) / 0.55); const e = t * t * (3 - 2 * t); return [0.24 + 1.25 * e, 0.27 + 0.18 * e]; }
  return null;
}

export const proceduralBust: ParticleSource = (count) => {
  const pos = new Float32Array(count * 3), kind = new Float32Array(count), rand = new Float32Array(count);
  const nBody = Math.floor(count * 0.48), nCore = Math.floor(count * 0.09);
  const LINES = 95;
  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0, k = 0;
    if (i < nBody) {
      let p: [number, number] | null = null;
      while (!p) { y = -1.7 + Math.floor(Math.random() * LINES) / LINES * 3.32 + (Math.random() - 0.5) * 0.002; p = profile(y); }
      const a = (Math.random() * 1.15 - 0.075) * Math.PI; // front-biased hemisphere
      x = Math.cos(a) * p[0]; z = Math.sin(a) * p[1];
    } else if (i < nBody + nCore) {
      k = 2; const r = Math.abs(gauss()) * 0.2;
      const t = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      const chest = Math.random() < 0.15;
      x = r * Math.sin(ph) * Math.cos(t) * 1.5; y = (chest ? -0.6 : 0.85) + r * Math.cos(ph) * 1.2; z = (chest ? 0.32 : 0.48) + Math.abs(r * Math.sin(ph) * Math.sin(t)) * 0.3;
    } else {
      k = 1; const side = Math.random() < 0.5 ? -1 : 1;
      const u = Math.random() ** 0.8, v = Math.random();
      const ax = 0.9 + u * 4.8; const wz = -0.3 - v * 3;
      const h = ridge(ax * side + 7, wz) * 1.9 * Math.exp(-((ax - 2.6) ** 2) / 5) + 0.3 * u;
      x = ax * side; y = -1.35 + h; z = wz;
      rand[i] = 0;
      // vein strength stored in rand's fractional part via separate encoding below
      const vein = Math.pow(1 - Math.abs(vnoise(ax * 1.3 + side * 3, wz * 1.3) * 2 - 1), 12);
      kind[i] = 1 + Math.min(0.99, vein);
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    if (k !== 1) kind[i] = k;
    rand[i] = Math.random();
  }
  // shuffle so drawRange scales density evenly
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    for (let c = 0; c < 3; c++) { const t = pos[i * 3 + c]; pos[i * 3 + c] = pos[j * 3 + c]; pos[j * 3 + c] = t; }
    let t = kind[i]; kind[i] = kind[j]; kind[j] = t; t = rand[i]; rand[i] = rand[j]; rand[j] = t;
  }
  return { positions: pos, kind, rand, count };
};
function gauss() { return Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random()); }
