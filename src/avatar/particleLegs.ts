export type ParticleLegData = {
  positions: Float32Array;
  sides: Float32Array;
};

const HIP_Y = -1.48;
const KNEE_Y = -2.18;
const ANKLE_Y = -2.96;
const FOOT_Y = -3.12;

/** Sample articulated leg surfaces in the avatar body's local coordinate space. */
export function createParticleLegData(count: number, side: -1 | 1): ParticleLegData {
  const positions = new Float32Array(count * 3);
  const sides = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const choice = Math.random();
    const offset = index * 3;
    let x: number;
    let y: number;
    let z: number;

    if (choice < 0.42) {
      const t = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const centerX = side * (0.27 + t * 0.16 + Math.sin(t * Math.PI) * 0.06);
      const radiusX = 0.18 - t * 0.075;
      const radiusZ = 0.17 - t * 0.045;
      x = centerX + Math.cos(angle) * radiusX;
      y = HIP_Y + (KNEE_Y - HIP_Y) * t;
      z = Math.sin(angle) * radiusZ;
    } else if (choice < 0.52) {
      const polar = Math.random() * Math.PI * 2;
      const around = Math.random() * Math.PI * 2;
      x = side * 0.43 + Math.sin(polar) * Math.cos(around) * 0.15;
      y = KNEE_Y + Math.cos(polar) * 0.14;
      z = Math.sin(polar) * Math.sin(around) * 0.14;
    } else if (choice < 0.78) {
      const t = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const centerX = side * (0.43 - t * 0.2);
      const radiusX = 0.12 - t * 0.055;
      const radiusZ = 0.13 - t * 0.055;
      x = centerX + Math.cos(angle) * radiusX;
      y = KNEE_Y + (ANKLE_Y - KNEE_Y) * t;
      z = Math.sin(angle) * radiusZ;
    } else {
      const t = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const around = Math.sin(angle);
      if (t < 0.32) {
        const ankleAngle = Math.random() * Math.PI * 2;
        x = side * 0.23 + Math.cos(ankleAngle) * 0.082;
        y = ANKLE_Y + Math.sin(ankleAngle) * 0.09;
        z = around * 0.085;
      } else {
        const footT = (t - 0.32) / 0.68;
        x = side * (0.3 + footT * 0.03) + Math.cos(angle) * (0.15 + footT * 0.11);
        y = ANKLE_Y + 0.06 + footT * (FOOT_Y - ANKLE_Y - 0.06);
        z = 0.02 + footT * 0.6 + around * (0.15 - footT * 0.03);
      }
    }

    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
    sides[index] = side;
  }

  return { positions, sides };
}

/**
 * HUMAN WALK (owner fix #3): knees bend, feet lift, weight shifts — loose and
 * chill, never stiff. Legends-of-Logic proportions: thigh swing ±0.42 rad,
 * knee flexes most at leg-forward, foot pitches heel-to-toe. Dance adds a
 * bounce and hip sway on top when he celebrates.
 */
export function getLegGaitAngle(
  isMoving: boolean,
  time: number,
  side: 0 | 1,
  speaking: number,
  dancing = false,
): number {
  const phase = side === 0 ? 0 : Math.PI;
  if (!isMoving && !dancing) {
    return Math.sin(time * 1.1 + phase) * speaking * 0.025;
  }
  const cycle = time * 7 + phase;
  const thigh = Math.sin(cycle) * 0.42;
  // Knee bends as the leg swings behind and during lift-through.
  const kneeFlex = Math.max(0, -Math.sin(cycle - 0.6)) * 0.55;
  // Foot lift: toe-off / heel-strike pitch on top of the thigh swing.
  const footPitch = Math.sin(cycle + Math.PI / 2) * 0.18;
  const gait = thigh + kneeFlex * 0.35 + footPitch * 0.4;
  if (dancing) {
    // Loose groove: bounce and cross-step lean.
    const bounce = Math.sin(time * 5.2 + phase) * 0.28;
    const groove = Math.sin(time * 2.6) * 0.22;
    return gait * 0.6 + bounce + groove;
  }
  return gait + (isMoving ? 0 : Math.sin(time * 1.1 + phase) * speaking * 0.025);
}

/** Arm swing mirrors the legs — opposite phase, loose shoulders. */
export function getArmSwingAngle(
  isMoving: boolean,
  time: number,
  side: 0 | 1,
  dancing = false,
): number {
  const phase = side === 0 ? Math.PI : 0;
  if (!isMoving && !dancing) return 0;
  const swing = Math.sin(time * 7 + phase) * (dancing ? 0.5 : 0.3);
  return swing;
}

/** Should he dance? Occasionally yes — his own celebration (owner: add dance moves). */
export function wantsToDance(random: () => number = Math.random): boolean {
  return random() < 0.12;
}
