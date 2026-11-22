/**
 * THE PEOPLE OF AUGIE'S WORLD (owner order 2026-11-21).
 * "The code is alive" — the same particle language that builds Augie
 * builds his citizens: smaller clouds, same gait (thigh swing, knee
 * flex, arms counter-phase — the formulas in particleLegs.ts), same
 * point-cloud skin. They walk to their desks, sit, work, fetch coffee.
 *
 * Pure data + math, no three.js — unit-testable like the avatar rules.
 * The renderer (worldSceneRenderer.ts) turns these points into Points.
 *
 * DENSITY (Part 18, owner order 2026-11-21): the first builds read as
 * GHOSTS on his screen — too few points per figure, so bodies looked
 * see-through. Every part's point count is raised ~60% (torso rings
 * 7x16 -> 9x24, head 80 -> 150, limbs up by a third) and the renderer
 * draws citizens solid. Per-citizen count is asserted in tests so the
 * density cannot silently drift back down.
 */
import { getArmSwingAngle } from "./particleLegs";

export type Rgb = readonly [number, number, number];

/** Deterministic RNG so scenes build identically every load (and in tests). */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export type PersonPoseMode = "stand" | "walk" | "sit" | "work";
export type HairStyle = "short" | "long" | "bun" | "none";

export type PersonAppearance = {
  /** "woman" | "man" — carried by build + hair, for scene rosters. */
  kind: "woman" | "man";
  /**
   * Total standing height in world units (Augie is ~3.1). Citizens
   * stand well under him — owner order 2026-11-21: "the people around
   * him… they're very tall, they shouldn't be that tall. Make them
   * smaller." (They were 2.78–3.08, nearly his height.)
   */
  height: number;
  shoulder: number; // half-width at the shoulders
  hip: number; // half-width at the hips
  hair: HairStyle;
  skin: Rgb;
  hairColor: Rgb;
  shirt: Rgb;
  pants: Rgb;
  shoes: Rgb;
};

const SKIN_TONES: readonly Rgb[] = [
  [0.98, 0.8, 0.66],
  [0.85, 0.6, 0.44],
  [0.62, 0.42, 0.3],
  [0.42, 0.28, 0.19],
  [0.93, 0.7, 0.55],
];
const HAIR_COLORS: readonly Rgb[] = [
  [0.12, 0.09, 0.07],
  [0.3, 0.19, 0.1],
  [0.55, 0.36, 0.18],
  [0.75, 0.72, 0.68],
  [0.08, 0.08, 0.1],
];
const SHIRTS: readonly Rgb[] = [
  [0.25, 0.65, 0.85],
  [0.9, 0.45, 0.4],
  [0.4, 0.8, 0.5],
  [0.95, 0.8, 0.3],
  [0.65, 0.5, 0.9],
  [0.95, 0.6, 0.75],
  [0.35, 0.75, 0.75],
  [0.9, 0.9, 0.92],
];
const PANTS: readonly Rgb[] = [
  [0.16, 0.2, 0.38],
  [0.25, 0.22, 0.2],
  [0.35, 0.3, 0.45],
  [0.45, 0.35, 0.25],
  [0.2, 0.3, 0.3],
];

/** Deterministic citizen generator — index picks the look, seed varies it. */
export function makeAppearance(index: number, seed = 11): PersonAppearance {
  const random = createSeededRandom(seed * 7919 + index * 131);
  const woman = index % 2 === 0;
  return {
    kind: woman ? "woman" : "man",
    height: 2.02 + random() * 0.24,
    shoulder: woman ? 0.19 + random() * 0.04 : 0.225 + random() * 0.05,
    hip: woman ? 0.18 + random() * 0.04 : 0.155 + random() * 0.03,
    hair: woman ? (index % 4 === 0 ? "bun" : "long") : index % 5 === 3 ? "none" : "short",
    skin: SKIN_TONES[Math.floor(random() * SKIN_TONES.length)]!,
    hairColor: HAIR_COLORS[Math.floor(random() * HAIR_COLORS.length)]!,
    shirt: SHIRTS[Math.floor(random() * SHIRTS.length)]!,
    pants: PANTS[Math.floor(random() * PANTS.length)]!,
    shoes: [0.1, 0.09, 0.1],
  };
}

/* ------------------------- figure point builder ------------------------- */

type Vec3 = readonly [number, number, number];

class FigureCloud {
  positions: number[] = [];
  colors: number[] = [];
  constructor(private random: () => number) {}
  point(x: number, y: number, z: number, color: Rgb, jitter = 0.012) {
    const r = this.random;
    this.positions.push(
      x + (r() - 0.5) * 2 * jitter,
      y + (r() - 0.5) * 2 * jitter,
      z + (r() - 0.5) * 2 * jitter,
    );
    this.colors.push(color[0], color[1], color[2]);
  }
  /** A limb: points along segment a→b with a soft tube radius. */
  segment(a: Vec3, b: Vec3, count: number, radius: number, color: Rgb) {
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const angle = this.random() * Math.PI * 2;
      const rad = radius * Math.sqrt(this.random());
      this.point(
        a[0] + (b[0] - a[0]) * t + Math.cos(angle) * rad,
        a[1] + (b[1] - a[1]) * t + (this.random() - 0.5) * radius,
        a[2] + (b[2] - a[2]) * t + Math.sin(angle) * rad,
        color,
        0.004,
      );
    }
  }
  /** Ellipsoid shell, same sampling language as the avatar's own body. */
  ellipsoid(center: Vec3, rx: number, ry: number, rz: number, count: number, color: Rgb) {
    for (let i = 0; i < count; i += 1) {
      const y = this.random() * 2 - 1;
      const angle = this.random() * Math.PI * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const scale = 0.82 + this.random() * 0.18;
      this.point(
        center[0] + Math.cos(angle) * ring * rx * scale,
        center[1] + y * ry * scale,
        center[2] + Math.sin(angle) * ring * rz * scale,
        color,
        0.006,
      );
    }
  }
}

const dirFromAngle = (angle: number): Vec3 => [0, -Math.cos(angle), Math.sin(angle)];

/** Thigh swing amplitude (rad) of the walk cycle — the avatar's own number. */
export const GAIT_SWING = 0.42;
/** Thigh + shin length as a fraction of standing height (see the pose builder). */
const LEG_FRACTION = 0.52;

/**
 * Ground distance one full gait cycle (both steps) covers at this
 * height: each step carries the foot from full back-swing to full
 * front-swing, 2 · sin(swing) · leg length.
 */
export function strideCycleLength(height: number): number {
  return 4 * Math.sin(GAIT_SWING) * LEG_FRACTION * height;
}

/**
 * How far gaitTime advances when a citizen actually covers `distance`
 * of ground. The gait clock (cycle = gaitTime · 7 in the pose builder)
 * is driven by DISTANCE, not wall time — owner defect 2026-11-21: the
 * old time-based advance cycled the legs ~4× faster than the ground
 * passing under them, so feet slid and strides read wrong.
 */
export function gaitAdvance(distance: number, height: number): number {
  return ((Math.PI * 2) / 7) * (distance / strideCycleLength(height));
}
const addScaled = (a: Vec3, dir: Vec3, len: number): Vec3 => [
  a[0] + dir[0] * len,
  a[1] + dir[1] * len,
  a[2] + dir[2] * len,
];

export type PersonPose = {
  mode: PersonPoseMode;
  /** Accumulated walk-cycle clock (seconds of walking) — drives the gait. */
  gaitTime: number;
  /** Wall clock for idle sway / typing jitter. */
  time: number;
};

/**
 * One citizen as a point cloud, feet at y=0, facing +z. Point ORDER is
 * stable across poses (same parts in the same counts), so the renderer
 * can build colors once and stream fresh positions every frame.
 */
export function buildPersonPoints(
  appearance: PersonAppearance,
  pose: PersonPose,
  seed = 5,
): { positions: Float32Array; colors: Float32Array; count: number } {
  const cloud = new FigureCloud(createSeededRandom(seed));
  const H = appearance.height;
  const seated = pose.mode === "sit" || pose.mode === "work";
  const hipY = seated ? 0.27 * H : 0.52 * H;
  const torsoLen = 0.26 * H;
  const shoulderY = hipY + torsoLen;
  const headR = 0.105 * H;
  const headCenter: Vec3 = [0, shoulderY + 0.045 * H + headR, 0];
  const thighLen = 0.26 * H;
  const shinLen = 0.26 * H;
  const upperArmLen = 0.21 * H;
  const forearmLen = 0.19 * H;
  const sway = pose.mode === "stand" ? Math.sin(pose.time * 1.1) * 0.008 : 0;

  // TORSO — stacked rings, waist pinch, like a soft turned column.
  const rings = 9;
  for (let ring = 0; ring < rings; ring += 1) {
    const t = ring / (rings - 1);
    const y = hipY + t * torsoLen;
    const rx =
      (appearance.hip + (appearance.shoulder - appearance.hip) * t) *
      (1 - 0.13 * Math.sin(Math.PI * t));
    const per = 24;
    for (let i = 0; i < per; i += 1) {
      const angle = (i / per) * Math.PI * 2 + ring * 0.35;
      cloud.point(
        Math.cos(angle) * rx + sway * t,
        y,
        Math.sin(angle) * rx * 0.62,
        appearance.shirt,
        0.01,
      );
    }
  }
  // NECK + HEAD
  cloud.segment(
    [sway, shoulderY, 0],
    [sway, headCenter[1] - headR * 0.7, 0],
    12,
    0.045,
    appearance.skin,
  );
  cloud.ellipsoid(
    [headCenter[0] + sway, headCenter[1], headCenter[2]],
    headR * 0.88,
    headR,
    headR * 0.94,
    150,
    appearance.skin,
  );
  // HAIR — cap, plus the style: long falls down the back, a bun sits high.
  if (appearance.hair !== "none") {
    const capCenter: Vec3 = [
      headCenter[0] + sway,
      headCenter[1] + headR * 0.22,
      headCenter[2] - headR * 0.12,
    ];
    cloud.ellipsoid(capCenter, headR * 0.95, headR * 0.82, headR * 1.0, 44, appearance.hairColor);
    if (appearance.hair === "long") {
      for (let strand = 0; strand < 4; strand += 1) {
        const x = (strand - 1.5) * headR * 0.32;
        cloud.segment(
          [x + sway, headCenter[1] + headR * 0.5, -headR * 0.78],
          [x + sway, shoulderY + 0.02 * H, -headR * 0.95],
          9,
          0.02,
          appearance.hairColor,
        );
      }
    } else if (appearance.hair === "bun") {
      cloud.ellipsoid(
        [sway, headCenter[1] + headR * 1.05, -headR * 0.55],
        headR * 0.42,
        headR * 0.42,
        headR * 0.42,
        18,
        appearance.hairColor,
      );
    }
  }

  // ARMS — shoulder → elbow → hand, posed by mode. Walking arms swing
  // counter-phase to the legs (getArmSwingAngle, the avatar's own rule).
  for (const side of [-1, 1] as const) {
    const sideIndex = side === -1 ? 0 : 1;
    const shoulder: Vec3 = [side * appearance.shoulder + sway, shoulderY - 0.01 * H, 0];
    let elbow: Vec3;
    let hand: Vec3;
    if (pose.mode === "walk") {
      const swing = getArmSwingAngle(true, pose.gaitTime, sideIndex as 0 | 1);
      const upperDir = dirFromAngle(swing * 0.8);
      elbow = addScaled(shoulder, [side * 0.1, upperDir[1], upperDir[2]], upperArmLen);
      const foreDir = dirFromAngle(swing * 0.8 - 0.3);
      hand = addScaled(elbow, [side * 0.04, foreDir[1], foreDir[2]], forearmLen);
    } else if (pose.mode === "sit") {
      elbow = addScaled(shoulder, [side * 0.14, -0.95, 0.28], upperArmLen);
      hand = addScaled(elbow, [0, -0.12, 1], forearmLen * 0.82);
    } else if (pose.mode === "work") {
      elbow = addScaled(shoulder, [side * 0.12, -0.82, 0.44], upperArmLen);
      const typeJitter = Math.sin(pose.time * 9 + sideIndex * 2.1) * 0.014;
      hand = addScaled(elbow, [typeJitter, -0.1, 1], forearmLen * 0.9);
      hand = [hand[0], hand[1] + Math.sin(pose.time * 7.3 + sideIndex * 1.7) * 0.01, hand[2]];
    } else {
      elbow = addScaled(shoulder, [side * 0.13, -0.98, 0.06], upperArmLen);
      hand = addScaled(elbow, [side * 0.05, -0.97, 0.2], forearmLen);
    }
    cloud.segment(shoulder, elbow, 34, 0.062, appearance.shirt);
    cloud.segment(elbow, hand, 28, 0.05, appearance.shirt);
    cloud.ellipsoid(hand, 0.045, 0.05, 0.045, 10, appearance.skin);
  }

  // LEGS — hip → knee → ankle. The walk uses particleLegs' own numbers:
  // thigh swing ±0.42 rad on a time*7 cycle, knee flexing as it lifts.
  for (const side of [-1, 1] as const) {
    const sideIndex = side === -1 ? 0 : 1;
    const hip: Vec3 = [side * appearance.hip * 0.55, hipY, 0];
    let knee: Vec3;
    let ankle: Vec3;
    if (pose.mode === "walk") {
      const cycle = pose.gaitTime * 7 + (sideIndex === 0 ? 0 : Math.PI);
      const thighAngle = Math.sin(cycle) * GAIT_SWING;
      const kneeFlex = Math.max(0, -Math.sin(cycle - 0.6)) * 0.55;
      knee = addScaled(hip, dirFromAngle(thighAngle), thighLen);
      ankle = addScaled(knee, dirFromAngle(thighAngle - kneeFlex), shinLen);
    } else if (seated) {
      knee = addScaled(hip, [0, -0.1, 1], thighLen);
      ankle = [knee[0], Math.max(0.02, knee[1] - shinLen), knee[2] + 0.04];
    } else {
      knee = addScaled(hip, [0, -1, 0.01], thighLen);
      ankle = addScaled(knee, [0, -1, 0.01], shinLen);
    }
    cloud.segment(hip, knee, 38, 0.075, appearance.pants);
    cloud.segment(knee, ankle, 32, 0.06, appearance.pants);
    // shoe — a short forward line at the ankle.
    cloud.segment(
      ankle,
      [ankle[0], Math.max(0.01, ankle[1] - 0.02), ankle[2] + 0.16],
      9,
      0.035,
      appearance.shoes,
    );
  }

  return {
    positions: new Float32Array(cloud.positions),
    colors: new Float32Array(cloud.colors),
    count: cloud.positions.length / 3,
  };
}

/* ------------------------------ the sim ------------------------------ */

export type Waypoint = {
  x: number;
  z: number;
  /** What the citizen does when they get here. */
  mode: PersonPoseMode;
  /** Seconds spent here before moving on: [min, max]. */
  dwell: readonly [number, number];
  /** Heading (radians, 0 = facing +z/camera) while dwelling. */
  face?: number;
};

export type PersonDef = {
  appearance: PersonAppearance;
  waypoints: readonly Waypoint[];
  /** Walk speed in world units/sec. */
  speed?: number;
};

export type PersonState = {
  def: PersonDef;
  x: number;
  z: number;
  heading: number;
  mode: PersonPoseMode;
  gaitTime: number;
  waypointIndex: number;
  dwellLeft: number;
  walking: boolean;
};

const DEFAULT_SPEED = 0.85;
/** How fast a walking citizen turns toward where they're headed (rad/s). */
const TURN_RATE = 7;
/** How fast a dwelling citizen turns in place to their waypoint's facing. */
const FACE_TURN_RATE = 4;

function angleLerp(current: number, target: number, maxStep: number): number {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + Math.max(-maxStep, Math.min(maxStep, delta));
}

/**
 * The citizens' daily round: dwell at a waypoint (work, sit, stand),
 * then walk the floor to the next one, forever. Deterministic under a
 * fixed seed + fixed dt — tests walk the same rounds the stage shows.
 *
 * FACING LAW (owner defect 2026-11-21 — "the people around him look
 * like they're walking backwards sometimes"): a citizen only covers
 * ground in the direction they actually face. The old sim translated
 * at full speed toward the target while the heading was still turning
 * from the previous waypoint's facing (and SNAPPED the heading to a
 * waypoint's `face` on arrival), so every departure from a faced
 * waypoint began with strides taken facing the wrong way — measured
 * at dot(facing, velocity) = −1.0, dead backwards, in every scene.
 * Now: translation scales with cos(heading error) — facing away means
 * turning in place, never backpedalling — arrival never snaps, and a
 * dwelling citizen turns in place toward their facing.
 */
export class PeopleSim {
  readonly people: PersonState[] = [];
  private random: () => number;

  constructor(defs: readonly PersonDef[], seed = 23) {
    this.random = createSeededRandom(seed);
    for (const def of defs) {
      const first = def.waypoints[0]!;
      this.people.push({
        def,
        x: first.x,
        z: first.z,
        heading: first.face ?? 0,
        mode: first.mode,
        gaitTime: 0,
        waypointIndex: 0,
        dwellLeft: this.rollDwell(first),
        walking: false,
      });
    }
  }

  private rollDwell(waypoint: Waypoint): number {
    const [min, max] = waypoint.dwell;
    return min + this.random() * (max - min);
  }

  tick(deltaSeconds: number) {
    const dt = Math.max(0, Math.min(deltaSeconds, 0.05));
    for (const person of this.people) {
      const waypoints = person.def.waypoints;
      if (person.walking) {
        const target = waypoints[person.waypointIndex]!;
        const dx = target.x - person.x;
        const dz = target.z - person.z;
        const distance = Math.hypot(dx, dz);
        const speed = person.def.speed ?? DEFAULT_SPEED;
        const desired = Math.atan2(dx, dz);
        person.heading = angleLerp(person.heading, desired, dt * TURN_RATE);
        if (distance < 0.06) {
          person.x = target.x;
          person.z = target.z;
          person.walking = false;
          person.mode = target.mode;
          person.dwellLeft = this.rollDwell(target);
          // No heading snap: the dwell below turns him to `face`.
        } else {
          // FACING GATE: ground covered only in the direction faced.
          // cos(error) is the gate — at 90° off he turns in place, at
          // 180° he never backpedals, aligned he walks at full speed.
          let error = (desired - person.heading) % (Math.PI * 2);
          if (error > Math.PI) error -= Math.PI * 2;
          if (error < -Math.PI) error += Math.PI * 2;
          const alignment = Math.max(0, Math.cos(error));
          const step = Math.min(distance, speed * dt * alignment);
          if (step > 0) {
            person.x += (dx / distance) * step;
            person.z += (dz / distance) * step;
            // The gait clock runs on ground actually covered, so the
            // feet keep time with the floor — no sliding, no scurry.
            person.gaitTime += gaitAdvance(step, person.def.appearance.height);
          }
          person.mode = "walk";
        }
      } else {
        // Dwelling: turn in place toward this waypoint's facing.
        const current = waypoints[person.waypointIndex]!;
        if (current.face !== undefined) {
          person.heading = angleLerp(person.heading, current.face, dt * FACE_TURN_RATE);
        }
        person.dwellLeft -= dt;
        if (person.dwellLeft <= 0 && waypoints.length > 1) {
          person.waypointIndex = (person.waypointIndex + 1) % waypoints.length;
          person.walking = true;
        } else if (person.dwellLeft <= 0) {
          // Single-waypoint citizens (the bench sitter) just renew.
          person.dwellLeft = this.rollDwell(waypoints[person.waypointIndex]!);
        }
      }
    }
  }
}
