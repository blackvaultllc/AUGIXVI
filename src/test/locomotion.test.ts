import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { AvatarLocomotion } from "@/avatar/locomotion";

describe("avatar locomotion", () => {
  it("shrinks and walks in world space while keeping feet on the ground", () => {
    const root = new THREE.Group();
    const walker = new AvatarLocomotion(root);

    walker.walk();
    walker.tick(0.2);
    walker.tick(0.2);

    expect(walker.isWalking).toBe(true);
    expect(root.position.x).toBeLessThan(0);
    expect(root.rotation.y).not.toBe(0);
    expect(root.scale.x).toBeLessThan(1);
    expect(root.position.y + root.scale.y * -3.2).toBeCloseTo(-3.2, 6);
  });

  it("looks around, stops, returns home, and grows back", () => {
    const root = new THREE.Group();
    const walker = new AvatarLocomotion(root);
    walker.shrink();
    walker.tick(1);
    walker.walk();
    walker.tick(0.2);
    walker.comeBack();
    for (let frame = 0; frame < 100; frame++) walker.tick(0.1);

    expect(walker.isMoving).toBe(false);
    expect(root.position.x).toBeCloseTo(0, 5);
    expect(root.scale.x).toBeCloseTo(1, 3);
    expect(root.position.y + root.scale.y * -3.2).toBeCloseTo(-3.2, 6);

    walker.lookAround();
    expect(walker.isLookingAround).toBe(true);
    walker.stop();
    expect(walker.isLookingAround).toBe(false);
  });

  it("supports bounded speed and walk, run, fly, jump, and idle modes", () => {
    const root = new THREE.Group();
    const walker = new AvatarLocomotion(root);

    expect(walker.setSpeed(9)).toBe(3);
    walker.setMode("run");
    expect(walker.currentMode).toBe("run");
    walker.tick(0.05);
    walker.tick(0.05);
    expect(root.position.x).toBeLessThan(0);

    walker.setMode("fly");
    walker.tick(0.05);
    expect(root.position.y + root.scale.y * -3.2).toBeGreaterThan(-3.2);

    walker.setMode("jump");
    walker.tick(0.05);
    expect(root.position.y + root.scale.y * -3.2).toBeGreaterThan(-3.2);
    for (let frame = 0; frame < 20; frame++) walker.tick(0.05);
    expect(walker.currentMode).toBe("idle");
    expect(walker.setSpeed(0.01)).toBe(0.25);
  });

  it("keeps a full-size avatar full-size when flight is selected", () => {
    const root = new THREE.Group();
    const flyer = new AvatarLocomotion(root);

    flyer.setMode("fly");
    flyer.tick(0.05);

    expect(flyer.currentMode).toBe("fly");
    expect(flyer.isWalking).toBe(false);
    expect(root.scale.x).toBe(1);
    expect(root.position.y + root.scale.y * -3.2).toBeGreaterThan(-3.2);
  });

  it("follows a finite custom path through an object before stopping", () => {
    const root = new THREE.Group();
    const walker = new AvatarLocomotion(root);
    expect(
      walker.followPath([
        { x: 0, z: 1 },
        { x: 0, z: 0 },
        { x: 0, z: -1 },
      ]),
    ).toBe(true);
    for (let frame = 0; frame < 100; frame++) walker.tick(0.05);

    expect(walker.currentMode).toBe("idle");
    expect(root.position.z).toBeCloseTo(-1, 2);
  });
});
