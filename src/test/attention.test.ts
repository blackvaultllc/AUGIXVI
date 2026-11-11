import { describe, expect, it } from "vitest";
import { greetOperator, spokenOperatorName } from "@/avatar/greeting";
import { targetParams } from "@/avatar/stateParams";
import { armPose, flightArmPose } from "@/avatar/armIK";
import {
  buildShape,
  isTransformBackRequest,
  parseTransformRequest,
  TRANSFORM_SHAPES,
} from "@/avatar/transforms";

describe("COME BACK = FACE ME", () => {
  it("greets by name, said out loud — 'Yes, Domenick'", () => {
    expect(spokenOperatorName("Domenick")).toBe("Domenick");
    expect(spokenOperatorName("domenick")).toBe("Domenick");
    expect(spokenOperatorName(null)).toBe("Anubis");
    const greeting = greetOperator("Domenick", () => 0);
    expect(greeting.startsWith("Yes, Domenick")).toBe(true);
    for (let i = 0; i < 20; i += 1) {
      expect(greetOperator("Domenick")).toMatch(/^Yes, Domenick|^Here, Domenick/);
    }
  });

  it("intensity rises when called (alert) and chills when dismissed", () => {
    const chill = targetParams("IDLE", 0);
    const alert = targetParams("IDLE", 0, 1);
    expect(alert.core).toBeGreaterThan(chill.core);
    expect(alert.tight).toBeGreaterThan(chill.tight);
    expect(alert.drift).toBeLessThan(chill.drift);
    const dismissed = targetParams("IDLE", 0, 0);
    expect(dismissed).toEqual(chill);
  });

  it("when he talks his hands move — speech raises and animates the wrists", () => {
    const silent = armPose(-1, 0, 1.2, 0, 0);
    const talking1 = armPose(-1, 0, 0.4, 0.8, 0);
    const talking2 = armPose(-1, 0, 1.1, 0.8, 0);
    // Talking lifts the wrists well above the resting hang.
    expect(talking1.target[1]).toBeGreaterThan(silent.target[1] + 0.4);
    expect(talking1.target[2]).toBeGreaterThan(silent.target[2]);
    // The gesture animates — two instants differ noticeably.
    expect(
      Math.abs(talking1.target[1] - talking2.target[1]) +
        Math.abs(talking1.target[2] - talking2.target[2]),
    ).toBeGreaterThan(0.05);
    // Curl closes while speaking — expressive hands.
    expect(talking1.curl).toBeGreaterThan(silent.curl);
  });

  it("flight keeps superman pose even while speaking", () => {
    const flight = flightArmPose(1, 1, 0.9, 0);
    expect(flight.target[1]).toBeGreaterThan(1);
  });
});

describe("real transforms — each looks like what it is", () => {
  it("parses the requests in natural words", () => {
    expect(parseTransformRequest("transform into a spaceship")).toBe("enterprise");
    expect(parseTransformRequest("transform into the Enterprise")).toBe("enterprise");
    expect(parseTransformRequest("become a wolf")).toBe("wolf");
    expect(parseTransformRequest("turn into the orb")).toBe("orb");
    expect(parseTransformRequest("walk around")).toBeNull();
    expect(isTransformBackRequest("land")).toBe(true);
    expect(isTransformBackRequest("transform back")).toBe(true);
    expect(isTransformBackRequest("transform into a spaceship")).toBe(false);
  });

  it("Enterprise: flat round saucer + TWO nacelles behind, off to the sides", () => {
    const n = 3000;
    const p = buildShape("enterprise", n);
    let saucer = 0;
    let dome = 0;
    let leftNacelle = 0;
    let rightNacelle = 0;
    let maxY = -Infinity;
    let minY = Infinity;
    for (let i = 0; i < n; i++) {
      const x = p[i * 3]!;
      const y = p[i * 3 + 1]!;
      const z = p[i * 3 + 2]!;
      const isNacelle = z < -1.4 && Math.abs(x) > 0.3;
      const isDome = y > 0.25 && Math.abs(x) < 0.6 && Math.abs(z) < 0.6;
      if (isDome) dome += 1;
      else if (isNacelle) {
        if (x < 0) leftNacelle += 1;
        else rightNacelle += 1;
      } else {
        saucer += 1;
        if (y > -0.3) {
          // Only the disc itself (exclude deflector housing under the nose).
          maxY = Math.max(maxY, y);
          minY = Math.min(minY, y);
        }
      }
    }
    // Flat disc: saucer point spread is far wider in x/z than in y.
    expect(maxY - minY).toBeLessThan(0.4);
    expect(leftNacelle).toBeGreaterThan(100);
    expect(rightNacelle).toBeGreaterThan(100);
    // Balanced twin nacelles.
    expect(Math.abs(leftNacelle - rightNacelle)).toBeLessThan(120);
    expect(dome).toBeGreaterThan(50);
    // Nacelles sit BEHIND the saucer.
    let saucerMaxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      if (p[i * 3 + 2]! > saucerMaxZ) saucerMaxZ = p[i * 3 + 2]!;
    }
    expect(saucerMaxZ).toBeGreaterThan(2);
  });

  it("wolf: four distinct leg clusters below the body", () => {
    const n = 3000;
    const p = buildShape("wolf", n);
    const clusters = new Set<string>();
    for (let i = 0; i < n; i++) {
      const x = p[i * 3]!;
      const y = p[i * 3 + 1]!;
      const z = p[i * 3 + 2]!;
      if (y < -0.8) {
        clusters.add(`${x < 0 ? "L" : "R"}${z < 0 ? "B" : "F"}`);
      }
    }
    expect(clusters.size).toBe(4); // LF, LB, RF, RB — four legs
  });

  it("orb: a ball plus exactly three lines on top", () => {
    const n = 2400;
    const p = buildShape("orb", n);
    const columns = new Set<number>();
    let sphere = 0;
    for (let i = 0; i < n; i++) {
      const x = p[i * 3]!;
      const y = p[i * 3 + 1]!;
      if (y > 1.4) {
        columns.add(Math.round(x * 5));
      } else sphere += 1;
    }
    expect(columns.size).toBe(3);
    expect(sphere).toBeGreaterThan(n * 0.7);
  });

  it("offers exactly the three shapes", () => {
    expect(TRANSFORM_SHAPES).toEqual(["enterprise", "wolf", "orb"]);
  });
});
