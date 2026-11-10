/**
 * WOLF FAMILIARS — renderer glue (owner order 2026-11-10).
 * Two wolves built from wolf_with_animations.glb, tinted as particles that
 * cycle colors randomly, walking beside Osiris at all times. The GLB
 * sampling mirrors the particle-bust approach: sample mesh vertices into
 * per-wolf point clouds. Pure fallback pack (procedural wolf silhouette)
 * when the model isn't reachable, so the familiars are never missing.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { WOLF_COLOR_CYCLE, type WolfName } from "./familiars";

export const WOLF_MODEL_URL = "/models/wolf_with_animations.glb";

export type WolfPackMember = {
  name: WolfName;
  group: THREE.Group;
  points: THREE.Points;
  update: (dt: number, t: number, companion: THREE.Vector3) => void;
};

/** Procedural fallback wolf: a four-legged silhouette in particle lines. */
export function proceduralWolfGeometry(): Float32Array {
  const positions: number[] = [];
  const line = (a: [number, number, number], b: [number, number, number], segments = 14) => {
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      positions.push(
        a[0] + (b[0] - a[0]) * t + (Math.random() - 0.5) * 0.04,
        a[1] + (b[1] - a[1]) * t + (Math.random() - 0.5) * 0.04,
        a[2] + (b[2] - a[2]) * t + (Math.random() - 0.5) * 0.04,
      );
    }
  };
  // body
  line([-0.7, 0, 0], [0.7, 0.02, 0]);
  line([-0.68, 0.12, 0.05], [0.68, 0.14, 0.05]);
  // neck + head
  line([0.66, 0.02, 0], [0.98, 0.34, 0.02]);
  line([0.98, 0.34, 0.02], [1.22, 0.28, 0]);
  // ears
  line([1.0, 0.42, 0], [1.08, 0.62, 0.02]);
  // tail
  line([-0.68, 0.05, 0], [-1.18, 0.42, 0.06]);
  // legs (front pair, back pair)
  for (const side of [-1, 1]) {
    line([0.52, -0.02, side * 0.16], [0.56, -0.78, side * 0.18]);
    line([-0.52, -0.02, side * 0.16], [-0.56, -0.78, side * 0.18]);
  }
  return new Float32Array(positions);
}

export async function loadWolfPoints(name: WolfName, count: number): Promise<WolfPackMember> {
  const geometry = new THREE.BufferGeometry();
  let positions: Float32Array | null = null;

  try {
    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      new GLTFLoader().load(WOLF_MODEL_URL, resolve, undefined, reject);
    });
    const meshPositions: number[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const attribute = mesh.geometry.getAttribute("position") as
          THREE.BufferAttribute | undefined;
        if (!attribute) return;
        const world = new THREE.Vector3();
        for (
          let i = 0;
          i < attribute.count;
          i += Math.max(1, Math.floor(attribute.count / count))
        ) {
          world.fromBufferAttribute(attribute, i).applyMatrix4(mesh.matrixWorld);
          meshPositions.push(world.x * 0.5, world.y * 0.5, world.z * 0.5);
        }
      }
    });
    if (meshPositions.length >= 9) positions = new Float32Array(meshPositions);
  } catch {
    positions = null;
  }

  if (!positions) positions = proceduralWolfGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: new THREE.Color(WOLF_COLOR_CYCLE[0]),
    size: 0.05,
    transparent: true,
    opacity: 0.92,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  const group = new THREE.Group();
  group.add(points);

  // Walking pattern: orbit Osiris, Thunder faster and wider, Demon closer.
  const orbitRadius = name === "thunder" ? 1.7 : 1.15;
  const orbitSpeed = name === "thunder" ? 0.55 : 0.32;
  const phase = name === "demon" ? 0 : Math.PI;
  let colorIndex = Math.floor(Math.random() * WOLF_COLOR_CYCLE.length);
  let colorTimer = 0;

  return {
    name,
    group,
    points,
    update(dt, t, companion) {
      colorTimer += dt;
      if (colorTimer > 4.2) {
        // Random color switching — familiars shift like storm light.
        colorTimer = 0;
        colorIndex = (colorIndex + 1 + Math.floor(Math.random() * 3)) % WOLF_COLOR_CYCLE.length;
        material.color.set(WOLF_COLOR_CYCLE[colorIndex] ?? WOLF_COLOR_CYCLE[0]);
      }
      const angle = t * orbitSpeed + phase;
      const targetX = companion.x + Math.cos(angle) * orbitRadius;
      const targetZ = companion.z + Math.sin(angle) * orbitRadius;
      group.position.lerp(new THREE.Vector3(targetX, 0, targetZ), Math.min(1, dt * 2.4));
      // Face the direction of travel.
      const heading = Math.atan2(targetX - group.position.x, targetZ - group.position.z);
      group.rotation.y = heading;
      // Trot bob.
      group.position.y = Math.abs(Math.sin(t * orbitSpeed * 6)) * 0.05;
    },
  };
}
