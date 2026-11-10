import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { SceneManager } from "@/avatar/sceneManager";
import { getThemePalette } from "@/avatar/themes";

describe("3D scene manager", () => {
  it("adds, moves, reshapes, and removes rendered scene objects", () => {
    const scene = new THREE.Scene();
    const world = new SceneManager(scene);
    world.add("mountain");
    expect(world.move("mountain", "left")).toBe(1);
    expect(world.reshape("mountain", "tree")).toBe(1);
    expect(world.remove("tree")).toBe(1);

    const previousChildren = scene.children.length;
    const id = world.add("sphere");
    expect(id).toMatch(/^sphere-/);
    expect(scene.children).toHaveLength(previousChildren + 1);

    world.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("drives a particle car and reports when no car exists", () => {
    const scene = new THREE.Scene();
    const world = new SceneManager(scene);
    expect(world.drive("car")).toBe(false);
    world.add("car");
    const car = scene.getObjectByName("avatar-particle-car");
    expect(car).toBeInstanceOf(THREE.Group);
    const carGroup = car as THREE.Group;
    const particles = carGroup.children[0];
    expect(particles).toBeInstanceOf(THREE.Points);
    const startX = carGroup.position.x;

    expect(world.drive("car")).toBe(true);
    world.tick(1);

    expect(carGroup.position.x).not.toBe(startX);
    world.dispose();
  });

  it("creates an open building before producing a traversal path through its doorway", () => {
    const scene = new THREE.Scene();
    const world = new SceneManager(scene);
    expect(world.getWalkThroughPath("building")).toBeNull();
    world.add("building");

    const path = world.getWalkThroughPath("building");
    const building = scene.getObjectByName("avatar-particle-building");

    expect(path).toEqual([
      { x: 0, z: 2.1 },
      { x: 0, z: 0 },
      { x: 0, z: -2.1 },
    ]);
    expect(building?.getObjectByProperty("type", "Points")).toBeDefined();
    expect(building?.getObjectByProperty("type", "Mesh")).toBeUndefined();
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

  it("renders only theme-colored particle scenery and updates it with the theme", () => {
    const scene = new THREE.Scene();
    const world = new SceneManager(scene);
    const environment = scene.getObjectByName("avatar-particle-environment");
    const points: THREE.Points[] = [];
    environment?.traverse((child) => {
      if (child instanceof THREE.Points) points.push(child);
      expect(child).not.toBeInstanceOf(THREE.Mesh);
      expect(child).not.toBeInstanceOf(THREE.Line);
    });

    expect(points.length).toBeGreaterThan(0);
    expect(points.every((entry) => entry.material instanceof THREE.PointsMaterial)).toBe(true);

    world.setTheme("green", "#22d3ee");
    const palette = getThemePalette("green", "#22d3ee");
    const expectedColor = new THREE.Color().setRGB(palette.a[0]!, palette.a[1]!, palette.a[2]!);
    expect((points[0]!.material as THREE.PointsMaterial).color.equals(expectedColor)).toBe(true);

    world.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("materializes every supported object type as theme-colored particles", () => {
    const scene = new THREE.Scene();
    const world = new SceneManager(scene, "green");
    const objectTypes = [
      "building",
      "car",
      "blimp",
      "balloon",
      "door",
      "room",
      "mountain",
      "tree",
      "box",
      "sphere",
      "light",
    ] as const;
    const palette = getThemePalette("green", "#22d3ee");
    const expectedColor = new THREE.Color().setRGB(palette.a[0]!, palette.a[1]!, palette.a[2]!);

    for (const kind of objectTypes) {
      world.add(kind);
      const object = scene.children.at(-1);
      const points: THREE.Points[] = [];
      object?.traverse((child) => {
        if (child instanceof THREE.Points) points.push(child);
        expect(child).not.toBeInstanceOf(THREE.Mesh);
        expect(child).not.toBeInstanceOf(THREE.Line);
      });

      expect(points.length).toBeGreaterThan(0);
      expect(points.every((entry) => entry.material instanceof THREE.PointsMaterial)).toBe(true);
      expect((points[0]!.material as THREE.PointsMaterial).color.equals(expectedColor)).toBe(true);
    }

    world.dispose();
  });
});
