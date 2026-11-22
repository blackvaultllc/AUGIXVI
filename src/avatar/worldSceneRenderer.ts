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
  type BuiltFloor,
  type BuiltScene,
  type PortalDef,
  type PortalKind,
  type PortalTransition,
  type WorldSceneId,
} from "./worldScenes";
import { buildPersonPoints, PeopleSim } from "./people";

/** Same ground line the SceneManager builds on. */
const GROUND_Y = -3.2;
/** Citizen point size — smaller on the owner's order (2026-11-21). */
const CITIZEN_POINT_SIZE = 0.04;
/** The office's set renders finer than the outdoor scenes (same order). */
const OFFICE_STATIC_POINT_SIZE = 0.046;
const STATIC_POINT_SIZE = 0.055;
/** Seconds after a portal trip before another portal can take him. */
const PORTAL_COOLDOWN_S = 1.2;

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

/**
 * AUGIE'S OWN MATERIAL FAMILY (owner refinement 2026-11-21): the
 * citizens must read as his kind — "look more similar to Augie
 * himself, in their own way" — and the old look bothered his eyes.
 * His body renders as soft round points with controlled light; the
 * citizens rendered as hard square points under ADDITIVE blending,
 * which stacks overlapping points toward white glare wherever a
 * figure is dense. Citizens now get: a radial soft-disc sprite (his
 * round-point signature), NORMAL blending (overlaps occlude instead
 * of blowing out), and colors softened before they ever reach the
 * stage — saturation eased, brightness capped, warmed a breath
 * toward his gold. Their own clothes and skin stay their own.
 */
let softDiscCache: THREE.Texture | null | undefined;
function softDiscTexture(): THREE.Texture | null {
  if (softDiscCache !== undefined) return softDiscCache;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      softDiscCache = null;
      return null;
    }
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.85)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    softDiscCache = new THREE.CanvasTexture(canvas);
  } catch {
    softDiscCache = null;
  }
  return softDiscCache;
}

/** Ease a citizen palette down: less saturation, less glare, a warm lift. */
export function softenCitizenColors(colors: Float32Array): Float32Array {
  const out = new Float32Array(colors.length);
  const warm = [1.0, 0.88, 0.66] as const;
  for (let i = 0; i < colors.length; i += 3) {
    const r = colors[i]!;
    const g = colors[i + 1]!;
    const b = colors[i + 2]!;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const soften = (c: number, w: number) => (c + (luma - c) * 0.12) * 0.94 * 0.95 + w * 0.05;
    out[i] = soften(r, warm[0]);
    out[i + 1] = soften(g, warm[1]);
    out[i + 2] = soften(b, warm[2]);
  }
  return out;
}

function makeCitizenPoints(
  positions: Float32Array,
  colors: Float32Array,
  size: number,
): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(softenCitizenColors(colors), 3));
  const texture = softDiscTexture();
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
      ...(texture ? { map: texture } : {}),
    }),
  );
  points.frustumCulled = false;
  points.name = "living-world-citizen";
  return points;
}

export class WorldSceneManager {
  private group = new THREE.Group();
  private built: BuiltScene | null = null;
  private staticPoints: THREE.Points | null = null;
  private waterPoints: THREE.Points | null = null;
  private sim: PeopleSim | null = null;
  private citizens: THREE.Points[] = [];
  private current: WorldSceneId | null = null;
  /** Multi-floor state (the Office): the floors + which one is on stage. */
  private floors: readonly BuiltFloor[] | null = null;
  private floorIndex = 0;
  private portalReadyAt = 0;
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

  /** The floor number on stage (1-based), or null outside the Office. */
  get currentFloor(): number | null {
    return this.floors ? (this.floors[this.floorIndex]?.floor ?? null) : null;
  }

  /** The portal of the given kind on the active floor, if it has one. */
  portalOfKind(kind: PortalKind): PortalDef | null {
    if (!this.floors) return null;
    return this.floors[this.floorIndex]?.portals.find((portal) => portal.kind === kind) ?? null;
  }

  setScene(id: WorldSceneId) {
    this.clear();
    this.built = buildScene(id);
    this.current = id;
    if (this.built.floors) {
      this.floors = this.built.floors;
      this.loadFloor(0);
      return;
    }
    this.staticPoints = makePoints(
      this.built.staticPositions,
      this.built.staticColors,
      STATIC_POINT_SIZE,
    );
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
    this.spawnCitizens(this.built.people);
  }

  /** Swap the stage to one of the active scene's floors. */
  private loadFloor(index: number) {
    if (!this.floors) return;
    const floor = this.floors[index];
    if (!floor) return;
    this.floorIndex = index;
    this.clearFloorPoints();
    this.staticPoints = makePoints(
      floor.staticPositions,
      floor.staticColors,
      OFFICE_STATIC_POINT_SIZE,
    );
    this.staticPoints.name = `living-world-office-floor-${floor.floor}`;
    this.group.add(this.staticPoints);
    this.spawnCitizens(floor.people);
  }

  /** Go to a floor by number. False when the scene has no such floor. */
  setFloor(floorNumber: number): boolean {
    if (!this.floors) return false;
    const index = this.floors.findIndex((floor) => floor.floor === floorNumber);
    if (index < 0) return false;
    this.loadFloor(index);
    return true;
  }

  /**
   * PORTALS (owner order 2026-11-21): if Augie stands inside a portal
   * ring on the active floor, carry him through — the floor swaps
   * under him and the caller lands him at the arrival point from the
   * returned transition. A short cooldown after each trip keeps a
   * doorway from firing twice while he steps out of the far ring.
   */
  checkPortals(x: number, z: number): PortalTransition | null {
    if (!this.floors || this.time < this.portalReadyAt) return null;
    const floor = this.floors[this.floorIndex];
    if (!floor) return null;
    for (const portal of floor.portals) {
      if (Math.hypot(x - portal.x, z - portal.z) > portal.radius) continue;
      if (!this.setFloor(portal.toFloor)) return null;
      this.portalReadyAt = this.time + PORTAL_COOLDOWN_S;
      const arrived = this.floors[this.floorIndex]!;
      return {
        toFloor: portal.toFloor,
        floorName: arrived.name,
        line: arrived.line,
        arriveX: portal.arriveX,
        arriveZ: portal.arriveZ,
      };
    }
    return null;
  }

  private spawnCitizens(defs: BuiltScene["people"]) {
    this.sim = new PeopleSim(defs);
    this.citizens = this.sim.people.map((person) => {
      const figure = buildPersonPoints(person.def.appearance, {
        mode: person.mode,
        gaitTime: 0,
        time: 0,
      });
      const points = makeCitizenPoints(figure.positions.slice(), figure.colors, CITIZEN_POINT_SIZE);
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

  /** Remove the on-stage set + citizens (a floor swap keeps the scene). */
  private clearFloorPoints() {
    if (this.staticPoints) {
      this.group.remove(this.staticPoints);
      disposePoints(this.staticPoints);
      this.staticPoints = null;
    }
    for (const citizen of this.citizens) {
      this.group.remove(citizen);
      disposePoints(citizen);
    }
    this.citizens = [];
    this.sim = null;
  }

  private clear() {
    this.clearFloorPoints();
    if (this.waterPoints) {
      this.group.remove(this.waterPoints);
      disposePoints(this.waterPoints);
      this.waterPoints = null;
    }
    this.floors = null;
    this.floorIndex = 0;
    this.portalReadyAt = 0;
    this.built = null;
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
    this.current = null;
  }
}
