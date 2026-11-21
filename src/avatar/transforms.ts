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

/**
 * Wolf — must read as a wolf AT A GLANCE (owner order 2026-11-21: the
 * old proportions rendered as crossed sticks and a blob once the bust's
 * arm props were left floating beside it; the renderer now hides the
 * humanoid props in form, and this shape carries the silhouette):
 * a long quadruped body, a neck ruff, a big head with a tapered snout,
 * two pointed ears, four legs ending in paws, and a tail that dips and
 * sweeps up behind. Forward is +z, up is +y; nose at z ≈ +2.2, tail
 * tip at z ≈ -2.1, ear tips at y ≈ +1.12, paws at y ≈ -1.3.
 */
function fillWolf(positions: Float32Array, count: number) {
  const bodyEnd = Math.floor(count * 0.38);
  const headEnd = bodyEnd + Math.floor(count * 0.16);
  const earEnd = headEnd + Math.floor(count * 0.04);
  const legEnd = earEnd + Math.floor(count * 0.26);
  const tailEnd = legEnd + Math.floor(count * 0.1);
  for (let i = 0; i < count; i++) {
    if (i < bodyEnd) {
      // BODY: long ellipsoid along z, chest a touch deeper than hips.
      const tube = Math.random() * Math.PI * 2;
      const along = Math.random() * 2 - 1; // -1 rear .. 1 front
      const taper = 0.62 + 0.38 * Math.cos(along * Math.PI * 0.45);
      const radius = Math.sqrt(Math.random()) * taper;
      set(
        positions,
        i,
        Math.cos(tube) * radius * 0.58,
        -0.05 + Math.sin(tube) * radius * 0.6,
        along * 1.25 + jitter(0.04),
      );
    } else if (i < headEnd) {
      // HEAD: a real skull sphere, then a tapered snout to the nose.
      if (Math.random() < 0.55) {
        // SKULL: sphere centered (0, 0.42, 1.5), radius 0.4.
        const tube = Math.random() * Math.PI * 2;
        const pitch = Math.asin(Math.random() * 2 - 1);
        const radius = 0.4 * Math.cbrt(Math.random());
        set(
          positions,
          i,
          Math.cos(pitch) * Math.cos(tube) * radius,
          0.42 + Math.sin(pitch) * radius,
          1.5 + Math.cos(pitch) * Math.sin(tube) * radius,
        );
      } else {
        // SNOUT: tapering from the skull to a nose tip at z ≈ 2.2,
        // centerline dropping slightly as it goes (0.36 → 0.3).
        const along = Math.random(); // 0 skull .. 1 nose
        const tube = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * (0.21 - along * 0.1);
        set(
          positions,
          i,
          Math.cos(tube) * radius,
          0.36 - along * 0.06 + Math.sin(tube) * radius * 0.8,
          1.74 + along * 0.46,
        );
      }
    } else if (i < earEnd) {
      // EARS: two pointed cones on top of the skull, tips at y ≈ 1.12.
      const side = i % 2 === 0 ? -1 : 1;
      const t = Math.random(); // 0 base .. 1 tip
      const spread = (1 - t) * 0.07;
      set(
        positions,
        i,
        side * (0.21 + t * 0.05) + jitter(spread),
        0.72 + t * 0.4,
        1.44 - t * 0.06 + jitter(spread),
      );
    } else if (i < legEnd) {
      // LEGS: four columns — front pair under the chest (z ≈ 0.78),
      // rear pair under the hips (z ≈ -0.82) — each ending in a paw
      // that juts slightly forward at the ground.
      const legIndex = i % 4;
      const lx = legIndex < 2 ? -0.36 : 0.36;
      const lz = legIndex % 2 === 0 ? 0.78 : -0.82;
      if (Math.random() < 0.12) {
        // PAW: a small forward foot at ground level.
        set(positions, i, lx + jitter(0.05), -1.28 + jitter(0.03), lz + 0.07 + jitter(0.06));
      } else {
        const t = Math.random();
        set(positions, i, lx + jitter(0.05), -0.3 - t * 0.95, lz + jitter(0.05));
      }
    } else if (i < tailEnd) {
      // TAIL: leaves the rear high, dips, and sweeps up at the tip.
      const t = Math.random(); // 0 root .. 1 tip
      set(
        positions,
        i,
        Math.sin(t * 2.2) * 0.08 + jitter(0.045),
        0.05 - Math.sin(t * Math.PI) * 0.25 + t * 0.35,
        -1.25 - t * 0.85,
      );
    } else {
      // MANE / RUFF: a thick band around the neck where head meets
      // body — the silhouette cue that separates head from torso.
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.5 * (0.88 + Math.random() * 0.24);
      set(
        positions,
        i,
        Math.cos(angle) * radius,
        0.22 + Math.sin(angle) * radius * 0.92,
        1.08 + Math.random() * 0.2,
      );
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
