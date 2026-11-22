/**
 * Renders the living world scenes (worldScenes.ts) inside the avatar
 * stage: one vertex-colored point cloud for the set, a second cloud
 * for the beach's moving water, and one small cloud per citizen whose
 * positions stream from the people system every frame.
 */
import * as THREE from "three";
import {
  buildScene,
  writeWaterPoints,
  type BuiltScene,
  type WorldSceneId,
} from "./worldScenes";
import { buildPersonPoints, PeopleSim } from "./people";

/** Same ground line the SceneManager builds on. */
const GROUND_Y = -3.2;

function makePoints(positions: Float32Array, colors: Float32Array, size: number): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  points.frustumCulled = false;
  return points;
}

function disposePoints(points: THREE.Points) {
  points.geometry.dispose();
  const materials = Array.isArray(points.material) ? points.material : [points.material];
  materials.forEach((material) => material.dispose());
}

export class WorldSceneManager {
  private group = new THREE.Group();
  private built: BuiltScene | null = null;
  private staticPoints: THREE.Points | null = null;
  private waterPoints: THREE.Points | null = null;
  private sim: PeopleSim | null = null;
  private citizens: THREE.Points[] = [];
  private current: WorldSceneId | null = null;
  /** Elapsed scene clock — drives the waves and idle motion. */
  private time = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = "augie-living-world";
    this.group.position.y = GROUND_Y;
    scene.add(this.group);
  }

  get currentScene(): WorldSceneId | null {
    return this.current;
  }

  /** Total points on stage for the active scene (set + water + citizens). */
  get particleCount(): number {
    return this.built?.totalParticles ?? 0;
  }

  get citizenCount(): number {
    return this.sim?.people.length ?? 0;
  }

  private problemDepts: readonly string[] = [];

  /**
   * Part 9: mark departments whose real status is a problem — the
   * office rebuilds with those desks in the problem state (alert
   * screen, worker standing, no fake work). Fed by Office Analytics.
   */
  setProblemDepts(depts: readonly string[]) {
    this.problemDepts = depts;
    if (this.current === "office") this.setScene("office");
  }

  setScene(id: WorldSceneId) {
    this.clear();
    this.built = buildScene(id, { problemDepts: this.problemDepts });
    this.current = id;
    this.staticPoints = makePoints(this.built.staticPositions, this.built.staticColors, 0.06);
    this.staticPoints.name = `living-world-${id}`;
    this.group.add(this.staticPoints);
    if (this.built.water) {
      this.waterPoints = makePoints(
        this.built.water.positions.slice(),
        this.built.water.colors,
        0.06,
      );
      this.waterPoints.name = "living-world-water";
      this.group.add(this.waterPoints);
    }
    this.sim = new PeopleSim(this.built.people);
    this.citizens = this.sim.people.map((person) => {
      const figure = buildPersonPoints(person.def.appearance, {
        mode: person.mode,
        gaitTime: 0,
        time: 0,
      });
      // Part 18: citizens render bigger and fully opaque — solid
      // people, not ghosts (they were size 0.05 at 0.95 opacity).
      const points = makePoints(figure.positions.slice(), figure.colors, 0.062);
      (points.material as THREE.PointsMaterial).opacity = 1;
      points.position.set(person.x, 0, person.z);
      points.rotation.y = person.heading;
      this.group.add(points);
      return points;
    });
  }

  tick(deltaSeconds: number) {
    if (!this.built) return;
    this.time += deltaSeconds;
    if (this.waterPoints && this.built.water) {
      const attribute = this.waterPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
      writeWaterPoints(this.time, attribute.array as Float32Array);
      attribute.needsUpdate = true;
    }
    if (this.sim) {
      this.sim.tick(deltaSeconds);
      this.sim.people.forEach((person, index) => {
        const points = this.citizens[index];
        if (!points) return;
        const figure = buildPersonPoints(person.def.appearance, {
          mode: person.mode,
          gaitTime: person.gaitTime,
          time: this.time,
        });
        const attribute = points.geometry.getAttribute("position") as THREE.BufferAttribute;
        (attribute.array as Float32Array).set(figure.positions);
        attribute.needsUpdate = true;
        points.position.set(person.x, 0, person.z);
        points.rotation.y = person.heading;
      });
    }
  }

  private clear() {
    if (this.staticPoints) {
      this.group.remove(this.staticPoints);
      disposePoints(this.staticPoints);
      this.staticPoints = null;
    }
    if (this.waterPoints) {
      this.group.remove(this.waterPoints);
      disposePoints(this.waterPoints);
      this.waterPoints = null;
    }
    for (const citizen of this.citizens) {
      this.group.remove(citizen);
      disposePoints(citizen);
    }
    this.citizens = [];
    this.sim = null;
    this.built = null;
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
    this.current = null;
  }
}
