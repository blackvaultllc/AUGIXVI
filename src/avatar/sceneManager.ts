import * as THREE from "three";
import type { MaterialKind } from "./worldCommands";

type SceneEntity = { kind: MaterialKind; group: THREE.Group };
type MoveDirection = "left" | "right" | "forward" | "back" | "up" | "down";

const GROUND_Y = -3.2;
const PALETTE: Record<MaterialKind, number> = {
  car: 0xff653b,
  blimp: 0x55c9ff,
  balloon: 0xff7ac4,
  mountain: 0x384d75,
  tree: 0x35b87a,
  box: 0xf0b84c,
  sphere: 0x9a78ff,
  light: 0xffed91,
};

function material(color: number, emissive = false) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: emissive ? color : 0x000000,
    emissiveIntensity: emissive ? 0.6 : 0,
    roughness: 0.62,
    metalness: 0.08,
  });
}

function mesh(
  geometry: THREE.BufferGeometry,
  color: number,
  position: [number, number, number],
  options: { emissive?: boolean; scale?: [number, number, number] } = {},
) {
  const object = new THREE.Mesh(geometry, material(color, options.emissive));
  object.position.set(...position);
  if (options.scale) object.scale.set(...options.scale);
  return object;
}

function buildObject(kind: MaterialKind): THREE.Group {
  const group = new THREE.Group();
  const color = PALETTE[kind];
  if (kind === "car") {
    group.add(mesh(new THREE.BoxGeometry(1.05, 0.32, 0.56), color, [0, 0.27, 0]));
    group.add(mesh(new THREE.BoxGeometry(0.52, 0.34, 0.48), 0x9bdcff, [0.02, 0.58, 0]));
    for (const x of [-0.36, 0.36]) {
      for (const z of [-0.29, 0.29]) {
        const tire = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.11, 12), 0x171b23, [x, 0.14, z]);
        tire.rotation.z = Math.PI / 2;
        group.add(tire);
      }
    }
  } else if (kind === "blimp") {
    group.add(
      mesh(new THREE.SphereGeometry(0.7, 24, 16), color, [0, 0, 0], { scale: [1.7, 0.58, 0.65] }),
    );
    group.add(mesh(new THREE.BoxGeometry(0.36, 0.18, 0.42), 0xd8eaff, [-1.12, 0, 0]));
    group.add(mesh(new THREE.BoxGeometry(0.45, 0.2, 0.35), 0xd8eaff, [0, -0.5, 0]));
    group.position.y = GROUND_Y + 4.5;
  } else if (kind === "balloon") {
    group.add(mesh(new THREE.SphereGeometry(0.72, 24, 18), color, [0, 0.5, 0]));
    group.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), 0xdec99d, [0, -0.18, 0]));
    group.add(mesh(new THREE.BoxGeometry(0.38, 0.24, 0.34), 0x825c3b, [0, -0.62, 0]));
    group.position.y = GROUND_Y + 4;
  } else if (kind === "mountain") {
    group.add(mesh(new THREE.ConeGeometry(1.05, 3.8, 7), color, [0, 1.9, 0]));
    group.add(mesh(new THREE.ConeGeometry(0.75, 2.9, 7), 0x4c6288, [0.9, 1.45, -0.18]));
    group.add(mesh(new THREE.ConeGeometry(0.68, 2.55, 7), 0x2a3c61, [-0.8, 1.27, 0.12]));
  } else if (kind === "tree") {
    group.add(mesh(new THREE.CylinderGeometry(0.12, 0.19, 0.9, 9), 0x815b3c, [0, 0.45, 0]));
    group.add(mesh(new THREE.ConeGeometry(0.65, 1.15, 9), color, [0, 1.25, 0]));
    group.add(mesh(new THREE.ConeGeometry(0.48, 0.92, 9), 0x2d945f, [0, 1.85, 0]));
  } else if (kind === "box") {
    group.add(mesh(new THREE.BoxGeometry(0.82, 0.82, 0.82), color, [0, 0.41, 0]));
  } else if (kind === "sphere") {
    group.add(mesh(new THREE.SphereGeometry(0.48, 24, 16), color, [0, 0.48, 0]));
  } else {
    group.add(mesh(new THREE.SphereGeometry(0.19, 16, 12), color, [0, 1.1, 0], { emissive: true }));
    group.add(new THREE.PointLight(color, 2, 8));
    group.children[group.children.length - 1]!.position.y = 1.1;
  }
  return group;
}

function disposeGroup(group: THREE.Group) {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
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
  private ground: THREE.Group;

  constructor(private scene: THREE.Scene) {
    this.ground = new THREE.Group();
    this.ground.add(mesh(new THREE.PlaneGeometry(200, 200), 0x07101b, [0, GROUND_Y, 0]));
    this.ground.children[0]!.rotation.x = -Math.PI / 2;
    const grid = new THREE.GridHelper(100, 100, 0x16465b, 0x11283a);
    grid.position.y = GROUND_Y + 0.012;
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(-4, 8, 6);
    this.ground.add(grid, new THREE.AmbientLight(0xffffff, 1.15), keyLight);
    this.scene.add(this.ground);
    this.add("mountain", -2.9, -5.2);
    this.add("mountain", 2.8, -5.8);
  }

  add(kind: MaterialKind, x?: number, z?: number): string {
    const id = `${kind}-${++this.sequence}`;
    const group = buildObject(kind);
    if (kind !== "blimp" && kind !== "balloon") group.position.y = GROUND_Y;
    if (kind === "mountain") {
      group.position.x = x ?? (this.sequence % 2 ? -1 : 1) * (1.5 + (this.sequence % 3));
      group.position.z = z ?? -5;
    } else {
      group.position.x = x ?? 0;
      if (z !== undefined) group.position.z = z;
      else if (kind !== "blimp" && kind !== "balloon") group.position.z = 0;
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
      const group = buildObject(kind);
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

  drive(): boolean {
    const entry = [...this.entities.entries()].find(([, entity]) => entity.kind === "car");
    if (!entry) return false;
    this.drivingId = entry[0];
    this.driveDirection = 1;
    return true;
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
    this.scene.remove(this.ground);
    for (const { group } of this.entities.values()) {
      this.scene.remove(group);
      disposeGroup(group);
    }
    this.ground.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.GridHelper) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((entry) => entry.dispose());
      }
    });
    this.entities.clear();
  }
}
