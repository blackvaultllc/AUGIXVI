/**
 * Two-bone arm solver and pose targets. Kept independent of three.js for unit testing.
 */
export type V3 = [number, number, number];

export const ARM = {
  upper: 0.8,
  fore: 0.75,
  shoulder: (side: number): V3 => [side * 0.79, 0.05, 0.05],
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3, fallback: V3 = [0, 0, 1]): V3 => {
  const l = len(a);
  return l > 1e-8 ? [a[0] / l, a[1] / l, a[2] / l] : fallback;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

export type ArmSolution = { elbow: V3; wrist: V3; clamped: boolean };

export function solveArm(
  shoulder: V3,
  target: V3,
  pole: V3,
  l1 = ARM.upper,
  l2 = ARM.fore,
): ArmSolution {
  const to = sub(target, shoulder);
  const raw = len(to);
  const min = Math.abs(l1 - l2) + 1e-3;
  const max = l1 + l2 - 1e-3;
  const dist = Math.min(max, Math.max(min, raw));
  const dir = norm(to);
  const wrist = add(shoulder, mul(dir, dist));
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let bend = sub(pole, mul(dir, dot(pole, dir)));
  if (len(bend) < 1e-4) {
    const axis: V3 =
      Math.abs(dir[0]) <= Math.abs(dir[1]) && Math.abs(dir[0]) <= Math.abs(dir[2])
        ? [1, 0, 0]
        : Math.abs(dir[1]) <= Math.abs(dir[2])
          ? [0, 1, 0]
          : [0, 0, 1];
    bend = sub(axis, mul(dir, dot(axis, dir)));
  }
  const elbow = add(add(shoulder, mul(dir, a)), mul(norm(bend), h));
  return { elbow, wrist, clamped: raw > max || raw < min };
}

export type ArmPose = { target: V3; pole: V3; palm: V3; curl: number };

export function armPose(side: number, pose: number, t: number, speech: number, phase = 0): ArmPose {
  const bob = Math.sin(t * 1.3 + phase) * 0.025;
  const rest: V3 = [side * 1.1, -1.3 + bob + speech * 0.1 * Math.sin(t * 4 + phase), 0.35];
  const present: V3 = [side * 0.46, -0.52 + bob, 1.45];
  return {
    target: lerp3(rest, present, pose),
    pole: lerp3([side * 0.7, -0.4, -0.6], [side * 0.9, -0.5, -0.1], pose),
    palm: lerp3([-side, 0, 0.4], [-side, 0.35, 0.6], pose),
    curl: pose,
  };
}

export function handDirection(elbow: V3, wrist: V3, side: number, curl: number): V3 {
  const forearm = norm(sub(wrist, elbow));
  return norm(add(forearm, [-side * 0.9 * curl, 0.7 * curl, 0]));
}
