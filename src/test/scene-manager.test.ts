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

    const id = world.add("sphere");
    expect(id).toMatch(/^sphere-/);
    expect(scene.children).toHaveLength(2);

    world.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("drives an actual car mesh and reports when no car exists", () => {
    const scene = new THREE.Scene();
    const world = new SceneManager(scene);
    expect(world.drive()).toBe(false);
    world.add("car");
    const car = scene.children.at(-1)!;
    const startX = car.position.x;

    expect(world.drive()).toBe(true);
    world.tick(1);

    expect(car.position.x).not.toBe(startX);
    world.dispose();
  });

  it("keeps background mountains in the world scene, separate from avatar particles", () => {
    const data = proceduralBust(1000);
    expect(Array.from(data.kind).every((kind) => kind === 0 || kind === 2)).toBe(true);
  });
});
