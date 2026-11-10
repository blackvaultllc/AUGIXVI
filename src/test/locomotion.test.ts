import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { AvatarLocomotion } from "@/avatar/locomotion";

describe("avatar locomotion", () => {
  it("shrinks and walks in world space while keeping feet on the ground", () => {
    const root = new THREE.Group();
    const walker = new AvatarLocomotion(root);

    walker.walk();
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
});
