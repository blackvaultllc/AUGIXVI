import { describe, expect, it } from "vitest";
import { eyeBrightnessFor, eyeColorFor, smoothEyePulse } from "@/avatar/eyes";
import type { AvatarState } from "@/avatar/AvatarBridge";

/**
 * THE EYES (owner orders 2026-11-21, RED order 2026-11-22): two eyes
 * replace the single dot; every state is BLOODSHOT RED — visibility
 * is the point — with the states kept distinct by shade and heat.
 * The pulse must be provably smooth (bounded steps, no overshoot),
 * never a strobe.
 */
describe("eye color mapping", () => {
  const states: AvatarState[] = ["IDLE", "LISTENING", "THINKING", "SPEAKING", "GLITCH"];

  it("maps every state to its documented color", () => {
    expect(eyeColorFor("IDLE")).toEqual({ r: 0.85, g: 0.1, b: 0.08 }); // deep bloodshot red
    expect(eyeColorFor("LISTENING")).toEqual({ r: 1.0, g: 0.16, b: 0.1 }); // ember red
    expect(eyeColorFor("THINKING")).toEqual({ r: 0.9, g: 0.08, b: 0.28 }); // crimson-magenta
    expect(eyeColorFor("SPEAKING")).toEqual({ r: 1.0, g: 0.28, b: 0.08 }); // hot red-orange
    expect(eyeColorFor("GLITCH")).toEqual({ r: 1.0, g: 0.05, b: 0.05 }); // alarm red
  });

  it("keeps every state inside the red family — red always dominates", () => {
    for (const s of states) {
      const c = eyeColorFor(s);
      expect(c.r).toBeGreaterThanOrEqual(0.85);
      expect(c.r).toBeGreaterThan(c.g);
      expect(c.r).toBeGreaterThan(c.b);
    }
  });

  it("gives every state a distinct color", () => {
    const seen = new Set(states.map((s) => JSON.stringify(eyeColorFor(s))));
    expect(seen.size).toBe(states.length);
  });

  it("keeps every channel in range", () => {
    for (const s of states) {
      const c = eyeColorFor(s);
      for (const v of [c.r, c.g, c.b]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("eye brightness", () => {
  it("rides the speech level while speaking", () => {
    expect(eyeBrightnessFor("SPEAKING", 0)).toBeCloseTo(1.0);
    expect(eyeBrightnessFor("SPEAKING", 1)).toBeCloseTo(1.9);
    expect(eyeBrightnessFor("SPEAKING", 0.5)).toBeCloseTo(1.45);
  });

  it("clamps an out-of-range speech level", () => {
    expect(eyeBrightnessFor("SPEAKING", 5)).toBeCloseTo(1.9);
    expect(eyeBrightnessFor("SPEAKING", -2)).toBeCloseTo(1.0);
  });

  it("a summons heats any state up without changing its color", () => {
    expect(eyeBrightnessFor("IDLE", 0, 1)).toBeCloseTo(eyeBrightnessFor("IDLE", 0, 0) + 0.5);
    expect(eyeBrightnessFor("LISTENING", 0, 0.5)).toBeCloseTo(1.25);
  });

  it("idle is the calmest state and glitch the hottest base", () => {
    expect(eyeBrightnessFor("IDLE", 0)).toBeLessThan(eyeBrightnessFor("LISTENING", 0));
    expect(eyeBrightnessFor("GLITCH", 0)).toBeGreaterThan(eyeBrightnessFor("LISTENING", 0));
  });
});

describe("smooth eye pulse", () => {
  it("approaches the target without overshooting", () => {
    let value = 0.2;
    for (let i = 0; i < 120; i++) {
      value = smoothEyePulse(value, 1.8, 1 / 60);
      expect(value).toBeLessThanOrEqual(1.8);
    }
    expect(value).toBeCloseTo(1.8, 1);
  });

  it("bounds the per-frame step — a swell, not a strobe", () => {
    // Worst case: full-range jump at 60fps must take several frames.
    const step = Math.abs(smoothEyePulse(0, 2, 1 / 60) - 0);
    expect(step).toBeLessThan(0.45);
    expect(step).toBeGreaterThan(0);
  });

  it("attacks faster than it releases, like a voice envelope", () => {
    const attack = smoothEyePulse(0, 1, 0.05) - 0;
    const release = 1 - smoothEyePulse(1, 0, 0.05);
    expect(attack).toBeGreaterThan(release);
  });

  it("holds still when already on target", () => {
    expect(smoothEyePulse(1.2, 1.2, 1 / 60)).toBeCloseTo(1.2);
  });
});
