import * as THREE from "three";
import { limbPoints, makeProp } from "./props";

export type ParticleLeg = {
  root: THREE.Group;
  points: THREE.Points[];
};

/** Build a leg and forward foot entirely from themed particle props. */
export function createParticleLeg(side: -1 | 1): ParticleLeg {
  const root = new THREE.Group();
  root.position.set(side * 0.28, -1.62, 0);

  const thigh = makeProp(limbPoints(2200, 0.13, 0.1), 2.5);
  thigh.position.y = -0.74;
  thigh.rotation.z = Math.PI;
  thigh.scale.y = 0.74;

  const shin = makeProp(limbPoints(1800, 0.1, 0.055), 2.5);
  shin.position.y = -0.74;
  shin.rotation.z = Math.PI;
  shin.scale.y = 0.62;

  const foot = makeProp(limbPoints(1500, 0.11, 0.075), 2.5);
  foot.position.set(0, -1.48, -0.12);
  foot.rotation.x = Math.PI / 2;
  foot.scale.set(1.35, 0.48, 0.22);

  const points = [thigh, shin, foot];
  root.add(...points);
  return { root, points };
}

/** The same alternating swing is used at full and compact avatar scales. */
export function getLegGaitAngle(isMoving: boolean, time: number, side: 0 | 1, speaking: number) {
  const phase = side === 0 ? 0 : Math.PI;
  const gait = isMoving ? Math.sin(time * 7 + phase) * 0.42 : 0;
  return gait + (isMoving ? 0 : Math.sin(time * 1.1 + phase) * speaking * 0.025);
}
