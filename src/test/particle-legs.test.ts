import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createParticleLeg, getLegGaitAngle } from "@/avatar/particleLegs";

describe("particle legs", () => {
  it("builds upper leg, lower leg, and foot from themed Points props", () => {
    const { root, points } = createParticleLeg(-1);

    expect(root.position.x).toBeCloseTo(-0.28);
    expect(points).toHaveLength(3);
    expect(root.children.every((child) => child instanceof THREE.Points)).toBe(true);
    expect(
      points.every((part) => {
        const material = part.material as THREE.ShaderMaterial;
        return (
          part.geometry.getAttribute("position").count > 0 &&
          material.uniforms["uColA"] !== undefined &&
          material.uniforms["uGlow"] !== undefined
        );
      }),
    ).toBe(true);

    for (const part of points) {
      part.geometry.dispose();
      (part.material as THREE.Material).dispose();
    }
  });

  it("keeps the same alternating swing at full and compact scales", () => {
    const fullScale = new THREE.Group();
    const compactScale = new THREE.Group();
    compactScale.scale.setScalar(0.34);
    const leftAngle = getLegGaitAngle(true, 1, 0, 0);
    const rightAngle = getLegGaitAngle(true, 1, 1, 0);

    expect(fullScale.scale.x).toBe(1);
    expect(compactScale.scale.x).toBe(0.34);
    expect(leftAngle).toBeCloseTo(-rightAngle);
    expect(getLegGaitAngle(false, 1, 0, 0)).toBe(0);
  });
});
