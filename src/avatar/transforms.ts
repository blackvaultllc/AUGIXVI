/**
 * PARTICLE TRANSFORMS (owner order): each form must LOOK like what it is.
 * - Enterprise: flat circular saucer disc + two long glowing nacelles behind.
 * - Wolf: four legs, body, head with snout and ears, tail.
 * - Orb: a particle circle with three lines standing on top.
 * Pure point-cloud generators (no three.js) — unit-testable.
 */

export type TransformShape = "enterprise" | "wolf" | "orb";

export const TRANSFORM_SHAPES: readonly TransformShape[] = ["enterprise", "wolf", "orb"];

/** Parse "transform into a spaceship / the Enterprise" etc. */
export function parseTransformRequest(text: string): TransformShape | null {
  const t = text.toLowerCase();
  if (
    /\b(spaceship|starship|enterprise|ship)\b/.test(t) &&
    /\b(transform|become|turn into|be)\b/.test(t)
  ) {
    return "enterprise";
  }
  if (/\bwolf\b/.test(t) && /\b(transform|become|turn into|be)\b/.test(t)) return "wolf";
  if (/\borb\b/.test(t) && /\b(transform|become|turn into|be)\b/.test(t)) return "orb";
  return null;
}

/** "land" / "transform back" returns him to Osiris. */
export function isTransformBackRequest(text: string): boolean {
  return /^(?:please\s+)?(?:land|touch\s*down|transform\s+back(?:\s+to\s+osiris)?|reform|osiris\s+form|be\s+osiris(?:\s+again)?)\b/i.test(
    text.trim(),
  );
}

/**
 * Build a point cloud for the shape: `count` points, roughly within radius
 * 2.6, centered at the origin. Forward is +z, up is +y.
 */
export function buildShape(shape: TransformShape, count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  switch (shape) {
    case "enterprise":
      fillEnterprise(positions, count);
      break;
    case "wolf":
      fillWolf(positions, count);
      break;
    case "orb":
      fillOrb(positions, count);
      break;
  }
  return positions;
}

function set(positions: Float32Array, i: number, x: number, y: number, z: number) {
  positions[i * 3] = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;
}

/** Flat circular saucer disc + bridge dome + TWO long nacelles behind, glowing. */
function fillEnterprise(positions: Float32Array, count: number) {
  const saucerEnd = Math.floor(count * 0.68);
  const domeEnd = saucerEnd + Math.floor(count * 0.07);
  // Nacelles split evenly; deflector housing gets the remainder.
  const nacelleEnd = domeEnd + Math.floor((count - domeEnd) * 0.92);
  const R = 2.3;
  for (let i = 0; i < count; i++) {
    if (i < saucerEnd) {
      // SAUCER: flat disc — thin on y, round and wide on x/z.
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * R;
      const taper = 1 - (radius / R) * 0.35; // rim thins toward the edge
      set(
        positions,
        i,
        Math.cos(angle) * radius + jitter(0.03),
        (Math.random() - 0.5) * 0.22 * taper + 0.05,
        Math.sin(angle) * radius + jitter(0.03),
      );
    } else if (i < domeEnd) {
      // BRIDGE DOME: small hemisphere on top center.
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * 0.42;
      set(
        positions,
        i,
        Math.cos(angle) * radius,
        0.16 + Math.sqrt(Math.max(0, 1 - (radius / 0.42) ** 2)) * 0.34,
        Math.sin(angle) * radius,
      );
    } else if (i < nacelleEnd) {
      // TWO NACELLES: long cylinders behind the saucer, one per side, glowing.
      const side = i % 2 === 0 ? -1 : 1;
      const along = Math.random(); // 0 back edge .. 1 tail
      const z = -1.55 - along * 1.9;
      const tube = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * 0.14;
      const isTip = along > 0.92;
      set(
        positions,
        i,
        side * 0.62 + Math.cos(tube) * radius + jitter(0.02),
        0.42 + Math.sin(tube) * radius + jitter(0.02),
        z - (isTip ? jitter(0.05) : 0),
      );
    } else {
      // DEFLECTOR: small housing under the saucer front.
      const tube = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * 0.3;
      set(
        positions,
        i,
        Math.cos(tube) * radius,
        -0.34 - Math.abs(Math.sin(tube)) * 0.18,
        0.95 + Math.sin(tube) * radius * 0.6,
      );
    }
  }
}

/** Wolf: body, head with snout and ears, four legs, tail. */
function fillWolf(positions: Float32Array, count: number) {
  const bodyEnd = Math.floor(count * 0.42);
  const headEnd = bodyEnd + Math.floor(count * 0.14);
  const earEnd = headEnd + Math.floor(count * 0.04);
  const legEnd = earEnd + Math.floor(count * 0.28);
  for (let i = 0; i < count; i++) {
    if (i < bodyEnd) {
      // BODY: elongated ellipsoid along z.
      const tube = Math.random() * Math.PI * 2;
      const along = Math.random() * 2 - 1; // -1 rear .. 1 front
      const taper = 0.55 + 0.45 * Math.cos(along * Math.PI * 0.5);
      const radius = Math.sqrt(Math.random()) * taper;
      set(
        positions,
        i,
        Math.cos(tube) * radius * 0.62,
        -0.1 + Math.sin(tube) * radius * 0.55,
        along * 1.15 + jitter(0.04),
      );
    } else if (i < headEnd) {
      // HEAD: sphere + snout pointing forward (+z).
      const tube = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random());
      if (radius < 0.62) {
        const r = radius / 0.62;
        set(
          positions,
          i,
          Math.cos(tube) * r * 0.34,
          0.52 + Math.sin(tube) * r * 0.3,
          1.25 + Math.cos(tube * 1.7) * r * 0.05,
        );
      } else {
        const r = (radius - 0.62) / 0.38;
        set(
          positions,
          i,
          Math.cos(tube) * r * 0.16,
          0.44 + Math.sin(tube) * r * 0.12,
          1.42 + r * 0.42,
        );
      }
    } else if (i < earEnd) {
      // EARS: two pointed cones on top of the head.
      const side = i % 2 === 0 ? -1 : 1;
      const t = Math.random();
      set(positions, i, side * (0.2 + t * 0.1) + jitter(0.02), 0.78 + t * 0.34, 1.22 - t * 0.1);
    } else if (i < legEnd) {
      // LEGS: four columns.
      const legIndex = i % 4;
      const lx = legIndex < 2 ? -0.38 : 0.38;
      const lz = legIndex % 2 === 0 ? 0.72 : -0.72;
      const t = Math.random();
      set(positions, i, lx + jitter(0.05), -0.35 - t * 0.85, lz + jitter(0.05));
    } else {
      // TAIL: sweeping curve behind.
      const t = Math.random();
      const sway = Math.sin(t * Math.PI) * 0.3;
      set(positions, i, sway + jitter(0.04), -0.05 + t * 0.45, -1.2 - t * 0.75);
    }
  }
}

/** Orb: a particle circle with three lines standing on top. */
function fillOrb(positions: Float32Array, count: number) {
  const sphereEnd = Math.floor(count * 0.86);
  const R = 1.15;
  const lineX = [-0.4, 0, 0.4];
  for (let i = 0; i < count; i++) {
    if (i < sphereEnd) {
      // Sphere shell, denser at the surface.
      const tube = Math.random() * Math.PI * 2;
      const pitch = Math.asin(Math.random() * 2 - 1);
      const radius = R * (0.86 + Math.random() * 0.14);
      set(
        positions,
        i,
        Math.cos(pitch) * Math.cos(tube) * radius,
        Math.sin(pitch) * radius,
        Math.cos(pitch) * Math.sin(tube) * radius,
      );
    } else {
      // THREE LINES on top: thin vertical columns of light.
      const x = lineX[i % 3] ?? 0;
      const t = Math.random();
      set(positions, i, x + jitter(0.03), R * 0.7 + t * 0.85, jitter(0.05));
    }
  }
}

function jitter(amount: number): number {
  return (Math.random() - 0.5) * 2 * amount;
}

/** Morph easing — fast start, soft landing. */
export function morphEase(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return 1 - (1 - p) * (1 - p) * (1 - p);
}

export const MORPHER = {
  introSeconds: 1.1,
  /** Per-frame morph positions write count — chunked so frames stay smooth. */
  chunk: 24000,
};
