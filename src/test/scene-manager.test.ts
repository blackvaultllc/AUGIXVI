import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { proceduralBust } from "@/avatar/particleSource";
import { SceneManager } from "@/avatar/sceneManager";

describe("3D scene manager", () => {
  it("adds, moves, reshapes, and removes rendered scene objects", () => {
    const scene = new THREE.Scene();
    const world = new SceneManager(scene);
    expect(world.move("mountain", "left")).toBe(2);
    expect(world.reshape("mountain", "tree")).toBe(2);
    expect(world.remove("tree")).toBe(2);

    const previousChildren = scene.children.length;
    const id = world.add("sphere");
    expect(id).toMatch(/^sphere-/);
    expect(scene.children).toHaveLength(previousChildren + 1);

    world.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("drives an actual car mesh and reports when no car exists", () => {
    const scene = new THREE.Scene();
    const world = new SceneManager(scene);
    expect(world.drive("car")).toBe(false);
    world.add("car");
    const car = scene.children.at(-1)!;
    const startX = car.position.x;

    expect(world.drive("car")).toBe(true);
    world.tick(1);

    expect(car.position.x).not.toBe(startX);
    world.dispose();
  });

  it("creates an open building before producing a traversal path through its doorway", () => {
    const scene = new THREE.Scene();
    const world = new SceneManager(scene);
    expect(world.getWalkThroughPath("building")).toBeNull();
    world.add("building");

    const path = world.getWalkThroughPath("building");

    expect(path).toEqual([
      { x: 0, z: 2.1 },
      { x: 0, z: 0 },
      { x: 0, z: -2.1 },
    ]);
    expect(world.drive("building")).toBe(false);
    world.dispose();
  });

  it("supports walking through a standalone door frame", () => {
    const scene = new THREE.Scene();
    const world = new SceneManager(scene);
    world.add("door", 2, 1);

    expect(world.getWalkThroughPath("door")).toEqual([
      { x: 2, z: 3.1 },
      { x: 2, z: 1 },
      { x: 2, z: -1.1 },
    ]);
    world.dispose();
  });

  it("keeps background mountains in the world scene, separate from avatar particles", () => {
    const data = proceduralBust(1000);
    expect(Array.from(data.kind).every((kind) => kind === 0 || kind === 2)).toBe(true);
  });

  it("renders a local zone layout and walk route", () => {
    const scene = new THREE.Scene();
    const world = new SceneManager(scene);
    const layout = scene.getObjectByName("avatar-world-layout");

    expect(layout).toBeInstanceOf(THREE.Group);
    expect(layout?.children.some((child) => child instanceof THREE.Line)).toBe(true);
    expect(layout?.children.filter((child) => child instanceof THREE.Mesh).length).toBeGreaterThan(
      3,
    );

    world.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
