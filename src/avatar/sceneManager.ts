import * as THREE from "three";
import { getThemePalette, type ThemeChoice } from "./themes";
import type { MaterialKind } from "./worldCommands";

type SceneEntity = { kind: MaterialKind; group: THREE.Group };
type MoveDirection = "left" | "right" | "forward" | "back" | "up" | "down";
type WorldPoint = Readonly<{ x: number; z: number }>;

const GROUND_Y = -3.2;
const DEFAULT_THEME_COLOR = "#22d3ee";

function appendLine(
  output: number[],
  start: THREE.Vector3,
  end: THREE.Vector3,
  segments = 36,
  radius = 0.015,
) {
  for (let index = 0; index <= segments; index += 1) {
    const point = start.clone().lerp(end, index / segments);
    output.push(
      point.x + (Math.random() - 0.5) * radius,
      point.y + (Math.random() - 0.5) * radius,
      point.z + (Math.random() - 0.5) * radius,
    );
  }
}

function appendBoxEdges(
  output: number[],
  center: THREE.Vector3,
  width: number,
  height: number,
  depth: number,
  segments = 28,
) {
  const [x, y, z] = center.toArray();
  const corners = [
    new THREE.Vector3(x - width / 2, y - height / 2, z - depth / 2),
    new THREE.Vector3(x + width / 2, y - height / 2, z - depth / 2),
    new THREE.Vector3(x - width / 2, y + height / 2, z - depth / 2),
    new THREE.Vector3(x + width / 2, y + height / 2, z - depth / 2),
    new THREE.Vector3(x - width / 2, y - height / 2, z + depth / 2),
    new THREE.Vector3(x + width / 2, y - height / 2, z + depth / 2),
    new THREE.Vector3(x - width / 2, y + height / 2, z + depth / 2),
    new THREE.Vector3(x + width / 2, y + height / 2, z + depth / 2),
  ];
  const edges = [
    [0, 1],
    [0, 2],
    [0, 4],
    [1, 3],
    [1, 5],
    [2, 3],
    [2, 6],
    [3, 7],
    [4, 5],
    [4, 6],
    [5, 7],
    [6, 7],
  ] as const;
  for (const [from, to] of edges) appendLine(output, corners[from]!, corners[to]!, segments);
}

function appendEllipsoid(
  output: number[],
  center: THREE.Vector3,
  radii: THREE.Vector3,
  count: number,
  shell = false,
) {
  for (let index = 0; index < count; index += 1) {
    const y = Math.random() * 2 - 1;
    const angle = Math.random() * Math.PI * 2;
    const surfaceRadius = Math.sqrt(1 - y * y);
    const scale = shell ? 0.86 + Math.random() * 0.14 : Math.cbrt(Math.random());
    output.push(
      center.x + Math.cos(angle) * surfaceRadius * radii.x * scale,
      center.y + y * radii.y * scale,
      center.z + Math.sin(angle) * surfaceRadius * radii.z * scale,
    );
  }
}

function appendCone(
  output: number[],
  base: THREE.Vector3,
  radius: number,
  height: number,
  count: number,
) {
  for (let index = 0; index < count; index += 1) {
    const y = Math.random() * height;
    const angle = Math.random() * Math.PI * 2;
    const edgeRadius = radius * (1 - y / height);
    const r = edgeRadius * (0.65 + Math.random() * 0.35);
    output.push(base.x + Math.cos(angle) * r, base.y + y, base.z + Math.sin(angle) * r);
  }
}

function appendCylinder(
  output: number[],
  center: THREE.Vector3,
  radius: number,
  height: number,
  count: number,
) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const y = Math.random() * height - height / 2;
    const r = radius * (0.8 + Math.random() * 0.2);
    output.push(center.x + Math.cos(angle) * r, center.y + y, center.z + Math.sin(angle) * r);
  }
}

function makeObjectPoints(kind: MaterialKind, density = 1): Float32Array {
  const output: number[] = [];
  const line = (from: [number, number, number], to: [number, number, number], count = 36) =>
    appendLine(output, new THREE.Vector3(...from), new THREE.Vector3(...to), count);

  if (kind === "building" || kind === "room") {
    const y0 = 0;
    const y1 = 2.5;
    for (const z of [-1.3, 1.3]) {
      for (const x of [-1.4, 1.4]) line([x, y0, z], [x, y1, z], 52);
      if (z < 0) line([-1.4, y0, z], [1.4, y0, z], 58);
      line([-1.4, y1, z], [1.4, y1, z], 58);
    }
    for (const x of [-1.4, 1.4]) {
      line([x, y0, -1.3], [x, y0, 1.3], 48);
      line([x, y1, -1.3], [x, y1, 1.3], 48);
    }
    for (const x of [-0.95, 0.95]) line([x, y0, 1.3], [x, 2.1, 1.3], 46);
    line([-0.95, 2.1, 1.3], [0.95, 2.1, 1.3], 40);
    if (kind === "building") {
      for (const x of [-1.4, 1.4]) line([x, 2.58, -1.3], [x, 2.58, 1.3], 40);
      line([-1.4, 2.58, -1.3], [1.4, 2.58, -1.3], 42);
      line([-1.4, 2.58, 1.3], [1.4, 2.58, 1.3], 42);
    }
  } else if (kind === "door") {
    line([-0.62, 0, 0], [-0.62, 2.4, 0], 56);
    line([0.62, 0, 0], [0.62, 2.4, 0], 56);
    line([-0.69, 2.33, 0], [0.69, 2.33, 0], 48);
  } else if (kind === "car") {
    appendBoxEdges(output, new THREE.Vector3(0, 0.3, 0), 1.2, 0.38, 0.68, 34);
    appendBoxEdges(output, new THREE.Vector3(0, 0.67, -0.02), 0.72, 0.4, 0.54, 30);
    for (const x of [-0.38, 0.38]) {
      for (const z of [-0.34, 0.34]) {
        for (let index = 0; index < 36; index += 1) {
          const angle = (index / 36) * Math.PI * 2;
          output.push(x + Math.cos(angle) * 0.14, 0.14 + Math.sin(angle) * 0.14, z);
        }
      }
    }
  } else if (kind === "blimp") {
    appendEllipsoid(output, new THREE.Vector3(), new THREE.Vector3(1.2, 0.42, 0.48), 1100, true);
    appendBoxEdges(output, new THREE.Vector3(-1.25, 0, 0), 0.36, 0.2, 0.4, 16);
    appendBoxEdges(output, new THREE.Vector3(0, -0.48, 0), 0.4, 0.16, 0.3, 16);
  } else if (kind === "balloon") {
    appendEllipsoid(
      output,
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(0.65, 0.78, 0.58),
      900,
      true,
    );
    appendCylinder(output, new THREE.Vector3(0, -0.05, 0), 0.012, 0.55, 80);
    appendBoxEdges(output, new THREE.Vector3(0, -0.45, 0), 0.36, 0.22, 0.32, 18);
  } else if (kind === "mountain") {
    appendCone(output, new THREE.Vector3(0, 0, 0), 1.2, 3.8, Math.floor(4000 * density));
    appendCone(output, new THREE.Vector3(0.92, 0, -0.16), 0.72, 2.85, Math.floor(2200 * density));
    appendCone(output, new THREE.Vector3(-0.88, 0, 0.14), 0.67, 2.55, Math.floor(2000 * density));
  } else if (kind === "tree") {
    appendCylinder(output, new THREE.Vector3(0, 0.48, 0), 0.17, 0.96, Math.floor(380 * density));
    appendEllipsoid(
      output,
      new THREE.Vector3(0, 1.2, 0),
      new THREE.Vector3(0.74, 0.8, 0.68),
      Math.floor(1500 * density),
    );
    appendEllipsoid(
      output,
      new THREE.Vector3(0, 1.82, 0),
      new THREE.Vector3(0.55, 0.68, 0.52),
      Math.floor(1000 * density),
    );
  } else if (kind === "box") {
    appendBoxEdges(output, new THREE.Vector3(0, 0.41, 0), 0.82, 0.82, 0.82);
  } else if (kind === "sphere") {
    appendEllipsoid(
      output,
      new THREE.Vector3(0, 0.48, 0),
      new THREE.Vector3(0.48, 0.48, 0.48),
      1100,
      true,
    );
  } else {
    appendEllipsoid(
      output,
      new THREE.Vector3(0, 1.1, 0),
      new THREE.Vector3(0.2, 0.2, 0.2),
      180,
      true,
    );
  }

  return new Float32Array(output);
}

function makeParticleGroup(kind: MaterialKind, color: THREE.Color, density = 1) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(makeObjectPoints(kind, density), 3));
  const particles = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color,
      size: 0.045,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  particles.frustumCulled = false;
  const group = new THREE.Group();
  group.name = `avatar-particle-${kind}`;
  group.add(particles);
  return group;
}

function disposeGroup(group: THREE.Group) {
  group.traverse((child) => {
    if (!(child instanceof THREE.Points)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((entry) => entry.dispose());
  });
}

export class SceneManager {
  private entities = new Map<string, SceneEntity>();
  private sequence = 0;
  private drivingId: string | null = null;
  private driveDirection = 1;
  private readonly environment = new THREE.Group();
  private theme: ThemeChoice;
  private customColor: string;

  constructor(
    private scene: THREE.Scene,
    theme: ThemeChoice = "cyan",
    customColor = DEFAULT_THEME_COLOR,
  ) {
    this.theme = theme;
    this.customColor = customColor;
    this.environment.name = "avatar-particle-environment";
    this.scene.add(this.environment);
    this.createEnvironment();
  }

  private get particleColor() {
    const palette = getThemePalette(this.theme, this.customColor);
    return new THREE.Color().setRGB(palette.a[0]!, palette.a[1]!, palette.a[2]!);
  }

  private createEnvironment() {
    const color = this.particleColor;
    const mountainLeft = makeParticleGroup("mountain", color, 0.72);
    mountainLeft.position.set(-4.3, GROUND_Y, -5.3);
    mountainLeft.scale.set(1.15, 1.15, 1.15);
    const mountainRight = makeParticleGroup("mountain", color, 0.58);
    mountainRight.position.set(4.5, GROUND_Y, -5.8);
    mountainRight.scale.set(0.92, 0.92, 0.92);
    const trees = [
      [-6.25, -3.65, 0.82],
      [-3.65, -4.7, 0.72],
      [6.2, -3.8, 0.86],
    ] as const;
    this.environment.add(mountainLeft, mountainRight);
    for (const [x, z, scale] of trees) {
      const tree = makeParticleGroup("tree", color, 0.72);
      tree.position.set(x, GROUND_Y, z);
      tree.scale.setScalar(scale);
      this.environment.add(tree);
    }

    const starPositions = new Float32Array(900 * 3);
    for (let index = 0; index < starPositions.length; index += 3) {
      starPositions[index] = (Math.random() - 0.5) * 24;
      starPositions[index + 1] = Math.random() * 11 - 1;
      starPositions[index + 2] = -9 - Math.random() * 8;
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starsGeometry,
      new THREE.PointsMaterial({
        color,
        size: 0.025,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    stars.name = "avatar-particle-atmosphere";
    this.environment.add(stars);
  }

  setTheme(theme: ThemeChoice, customColor: string) {
    this.theme = theme;
    this.customColor = customColor;
    const color = this.particleColor;
    this.environment.traverse((child) => {
      if (child instanceof THREE.Points && child.material instanceof THREE.PointsMaterial) {
        child.material.color.copy(color);
      }
    });
    for (const { group } of this.entities.values()) {
      group.traverse((child) => {
        if (child instanceof THREE.Points && child.material instanceof THREE.PointsMaterial) {
          child.material.color.copy(color);
        }
      });
    }
  }

  add(kind: MaterialKind, x?: number, z?: number): string {
    const id = `${kind}-${++this.sequence}`;
    const group = makeParticleGroup(kind, this.particleColor);
    if (kind !== "blimp" && kind !== "balloon") group.position.y = GROUND_Y;
    else group.position.y = GROUND_Y + (kind === "blimp" ? 4.5 : 4);
    if (kind === "mountain") {
      group.position.x = x ?? (this.sequence % 2 ? -1 : 1) * (1.5 + (this.sequence % 3));
      group.position.z = z ?? -5;
    } else {
      group.position.x = x ?? 0;
      group.position.z = z ?? 0;
    }
    this.scene.add(group);
    this.entities.set(id, { kind, group });
    return id;
  }

  move(target: MaterialKind, direction: MoveDirection): number {
    const entities = this.matching(target);
    if (!entities.length) return 0;
    const offset: Record<MoveDirection, THREE.Vector3> = {
      left: new THREE.Vector3(-1.25, 0, 0),
      right: new THREE.Vector3(1.25, 0, 0),
      forward: new THREE.Vector3(0, 0, 1.25),
      back: new THREE.Vector3(0, 0, -1.25),
      up: new THREE.Vector3(0, 1.25, 0),
      down: new THREE.Vector3(0, -1.25, 0),
    };
    for (const entity of entities) {
      entity.group.position.add(offset[direction]);
      if (entity.kind === "blimp" || entity.kind === "balloon") {
        entity.group.position.y = Math.max(GROUND_Y + 2.5, entity.group.position.y);
      } else {
        entity.group.position.y = Math.max(GROUND_Y, entity.group.position.y);
      }
    }
    return entities.length;
  }

  reshape(target: MaterialKind, kind: MaterialKind): number {
    const entities = this.matching(target);
    if (
      kind !== "car" &&
      entities.some((entity) => entity === this.entities.get(this.drivingId ?? ""))
    ) {
      this.drivingId = null;
    }
    for (const entity of entities) {
      const position = entity.group.position.clone();
      const rotation = entity.group.rotation.clone();
      const scale = entity.group.scale.clone();
      this.scene.remove(entity.group);
      disposeGroup(entity.group);
      const group = makeParticleGroup(kind, this.particleColor);
      group.position.copy(position);
      group.rotation.copy(rotation);
      group.scale.copy(scale);
      if (kind === "blimp" || kind === "balloon") {
        group.position.y = Math.max(group.position.y, GROUND_Y + 3.5);
      } else {
        group.position.y = GROUND_Y;
      }
      this.scene.add(group);
      entity.group = group;
      entity.kind = kind;
    }
    return entities.length;
  }

  remove(target: MaterialKind): number {
    const entities = this.matching(target);
    for (const entity of entities) {
      this.scene.remove(entity.group);
      disposeGroup(entity.group);
    }
    for (const [id, entity] of this.entities) {
      if (entities.includes(entity)) this.entities.delete(id);
    }
    if (entities.some((entity) => entity.kind === "car")) this.drivingId = null;
    return entities.length;
  }

  drive(target: MaterialKind): boolean {
    if (target !== "car") return false;
    const entry = [...this.entities.entries()].find(([, entity]) => entity.kind === target);
    if (!entry) return false;
    this.drivingId = entry[0];
    this.driveDirection = 1;
    return true;
  }

  getWalkThroughPath(target: MaterialKind): WorldPoint[] | null {
    if (target !== "building" && target !== "room" && target !== "door") return null;
    const entity = [...this.entities.values()].find((entry) => entry.kind === target);
    if (!entity) return null;
    const { x, z } = entity.group.position;
    return [
      { x, z: z + 2.1 },
      { x, z },
      { x, z: z - 2.1 },
    ];
  }

  stopDriving() {
    this.drivingId = null;
  }

  tick(deltaSeconds: number) {
    if (!this.drivingId) return;
    const car = this.entities.get(this.drivingId);
    if (!car) {
      this.drivingId = null;
      return;
    }
    car.group.position.x += this.driveDirection * deltaSeconds * 1.5;
    car.group.position.z = Math.sin(car.group.position.x * 0.35) * 0.55;
    car.group.rotation.y = Math.atan2(this.driveDirection, Math.cos(car.group.position.x * 0.35));
    if (car.group.position.x > 4 || car.group.position.x < -4) this.driveDirection *= -1;
  }

  private matching(target: MaterialKind) {
    return [...this.entities.values()].filter((entity) => entity.kind === target);
  }

  dispose() {
    this.scene.remove(this.environment);
    for (const { group } of this.entities.values()) {
      this.scene.remove(group);
      disposeGroup(group);
    }
    disposeGroup(this.environment);
    this.entities.clear();
  }
}
