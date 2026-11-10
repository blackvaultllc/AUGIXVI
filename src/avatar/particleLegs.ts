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

/** Keep the same alternating swing at full and compact avatar scales. */
export function getLegGaitAngle(isMoving: boolean, time: number, side: 0 | 1, speaking: number) {
  const phase = side === 0 ? 0 : Math.PI;
  const gait = isMoving ? Math.sin(time * 7 + phase) * 0.42 : 0;
  return gait + (isMoving ? 0 : Math.sin(time * 1.1 + phase) * speaking * 0.025);
}
