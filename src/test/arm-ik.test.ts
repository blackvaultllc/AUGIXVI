import { describe, expect, it } from "vitest";
import { ARM, armPose, solveArm, type V3 } from "@/avatar/armIK";

const distance = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("arm IK", () => {
  it("keeps both bone lengths fixed from rest through the presenting pose", () => {
    for (const side of [-1, 1]) {
      for (let pose = 0; pose <= 1.0001; pose += 0.1) {
        const target = armPose(side, pose, 1.7, 0.5);
        const shoulder = ARM.shoulder(side);
        const { elbow, wrist, clamped } = solveArm(shoulder, target.target, target.pole);
        expect(clamped).toBe(false);
        expect(distance(shoulder, elbow)).toBeCloseTo(ARM.upper, 3);
        expect(distance(elbow, wrist)).toBeCloseTo(ARM.fore, 3);
      }
    }
  });

  it("reaches both presenting targets without clamping", () => {
    for (const side of [-1, 1]) {
      const target = armPose(side, 1, 0, 0);
      const result = solveArm(ARM.shoulder(side), target.target, target.pole);
      expect(result.clamped).toBe(false);
      expect(distance(result.wrist, target.target)).toBeLessThan(1e-6);
    }
  });

  it("clamps unreachable targets without stretching either bone", () => {
    const shoulder = ARM.shoulder(1);
    const result = solveArm(shoulder, [1, -0.5, 9], [1, 0, 0]);
    expect(result.clamped).toBe(true);
    expect(distance(shoulder, result.elbow)).toBeCloseTo(ARM.upper, 3);
    expect(distance(result.elbow, result.wrist)).toBeCloseTo(ARM.fore, 3);
  });

  it("solves a stable elbow when the pole is parallel to the arm", () => {
    const shoulder = ARM.shoulder(1);
    const result = solveArm(shoulder, [1.05, -0.55, -10], [0, 0, 1]);
    expect(distance(shoulder, result.elbow)).toBeCloseTo(ARM.upper, 3);
    expect(distance(result.elbow, result.wrist)).toBeCloseTo(ARM.fore, 3);
  });

  it("mirrors the left and right wrist targets", () => {
    const left = armPose(-1, 0.4, 0, 0);
    const right = armPose(1, 0.4, 0, 0);
    expect(left.target[0]).toBeCloseTo(-right.target[0]);
    expect(left.target[1]).toBeCloseTo(right.target[1]);
  });
});
