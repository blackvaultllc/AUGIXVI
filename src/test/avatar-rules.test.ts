import { describe, expect, it } from "vitest";
import { SnapDetector } from "@/avatar/snapDetector";
import { intensityLabel } from "@/avatar/stateParams";

const mk = (requireAudio = true) => new SnapDetector({ sensitivity: 0.8, cooldownMs: 800, requireAudio });
const spike = (d: SnapDetector, t: number) => { d.pushHand(t - 20, 0.1); return d.pushHand(t, 1.5); };

describe("snap detection", () => {
  it("fires only when hand spike and audio transient coincide", () => {
    const d = mk();
    expect(spike(d, 1000)).toBe(false);
    expect(d.pushAudioOnset(1050)).toBe(true);
  });
  it("ignores a hand spike with no audio when mic is required", () => {
    const d = mk(); spike(d, 1000);
    expect(d.pushAudioOnset(1500)).toBe(false);
  });
  it("respects the 800ms cooldown", () => {
    const d = mk(false);
    expect(spike(d, 1000)).toBe(true);
    expect(spike(d, 1500)).toBe(false);
    expect(spike(d, 1900)).toBe(true);
  });
});

it("maps intensity labels", () => {
  expect([intensityLabel(0.1), intensityLabel(0.5), intensityLabel(0.9)]).toEqual(["LOW", "MED", "HIGH"]);
});
