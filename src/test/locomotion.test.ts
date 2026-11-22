import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { AvatarLocomotion, FLY_ALTITUDE, hasArrivedAtMark, MARK } from "@/avatar/locomotion";

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

  it("marks home at the origin and only counts a landed return as arrived", () => {
    expect(MARK).toEqual({ x: 0, z: 0 });
    expect(hasArrivedAtMark(0, 0, 0)).toBe(true);
    expect(hasArrivedAtMark(0.05, -0.05, 0.04)).toBe(true);
    expect(hasArrivedAtMark(0.5, 0, 0)).toBe(false); // off to the side
    expect(hasArrivedAtMark(0, 0, 1.2)).toBe(false); // over the mark but still in the air
    expect(hasArrivedAtMark(-2.2, 0.8, 0)).toBe(false); // out at a waypoint
  });

  it("takes off vertically before it travels", () => {
    const root = new THREE.Group();
    const flyer = new AvatarLocomotion(root);
    flyer.fly();
    flyer.tick(0.05);
    flyer.tick(0.05);
    // Two frames in: he has climbed, but barely moved sideways —
    // rise first, then go (the Superman order, not the pancake).
    expect(flyer.currentAltitude).toBeGreaterThan(0.2);
    expect(Math.hypot(root.position.x, root.position.z)).toBeLessThan(0.05);
    expect(flyer.isHovering).toBe(true);
    expect(flyer.isCruising).toBe(false);
  });

  it("reaches cruise — up at altitude and travelling — and hovers in place on hover()", () => {
    const root = new THREE.Group();
    const flyer = new AvatarLocomotion(root);
    flyer.fly();
    for (let frame = 0; frame < 80; frame++) flyer.tick(0.05);
    expect(flyer.currentAltitude).toBeGreaterThan(FLY_ALTITUDE * 0.9);
    expect(flyer.isCruising).toBe(true);
    expect(Math.hypot(root.position.x, root.position.z)).toBeGreaterThan(0.5);

    const hoverRoot = new THREE.Group();
    const hoverer = new AvatarLocomotion(hoverRoot);
    hoverer.hover();
    for (let frame = 0; frame < 80; frame++) hoverer.tick(0.05);
    expect(hoverer.currentAltitude).toBeGreaterThan(FLY_ALTITUDE * 0.9);
    expect(hoverer.isHovering).toBe(true);
    expect(hoverer.isCruising).toBe(false);
    expect(hoverRoot.position.x).toBe(0);
    expect(hoverRoot.position.z).toBe(0);
  });

  it("come back from the air glides home and lands whole on the mark", () => {
    const root = new THREE.Group();
    const flyer = new AvatarLocomotion(root);
    flyer.fly();
    for (let frame = 0; frame < 60; frame++) flyer.tick(0.05);
    expect(Math.hypot(root.position.x, root.position.z)).toBeGreaterThan(0.5);

    flyer.comeBack();
    expect(flyer.isReturning).toBe(true);
    // The journey actually happens — one frame in he is NOT home yet
    // (the old stage bug froze him mid-scene while claiming a return).
    flyer.tick(0.05);
    expect(flyer.isReturning).toBe(true);

    for (let frame = 0; frame < 600; frame++) flyer.tick(0.05);
    expect(flyer.isReturning).toBe(false);
    expect(flyer.currentMode).toBe("idle");
    expect(root.position.x).toBeCloseTo(MARK.x, 5);
    expect(root.position.z).toBeCloseTo(MARK.z, 5);
    expect(flyer.currentAltitude).toBeLessThan(0.05);
    expect(root.scale.x).toBeCloseTo(1, 3);
    expect(root.rotation.y).toBe(0); // facing the operator
    expect(root.position.y + root.scale.y * -3.2).toBeCloseTo(-3.2, 6); // feet on the ground
  });

  it("walks ONE round and stops at his mark — no circling (Part 9 amendment 2)", () => {
    const root = new THREE.Group();
    const walker = new AvatarLocomotion(root);
    walker.walk();
    for (let frame = 0; frame < 1200; frame++) walker.tick(0.05);
    expect(walker.currentMode).toBe("idle");
    expect(root.position.x).toBeCloseTo(MARK.x, 5);
    expect(root.position.z).toBeCloseTo(MARK.z, 5);
    // And he STAYS there — a second circuit never begins.
    for (let frame = 0; frame < 200; frame++) walker.tick(0.05);
    expect(walker.currentMode).toBe("idle");
    expect(Math.hypot(root.position.x - MARK.x, root.position.z - MARK.z)).toBeLessThan(0.01);
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
