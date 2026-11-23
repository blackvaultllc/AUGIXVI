import { describe, expect, it } from "vitest";
import {
  estimatePulseFromRois,
  pulseSummary,
  stabilizeReading,
  type MotionSample,
  type RoiSample,
  type TimedReading,
} from "@/avatar/pulse";

/**
 * PULSE TIGHTENING ROUND (2026-11-23) — the Captain's order: "really
 * tighten on the pulse — get it as best as accurate as we can, like
 * the companies do when they build for watches." The techniques are
 * pinned here against synthetic traces with KNOWN heartbeats:
 * multi-ROI combining, heart-band filtering, motion-artifact
 * rejection, and the stabilization window. The truth law does not
 * move: a bad signal stays SEARCHING (bpm: null), never a number.
 */

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
}

function trace(
  hz: number,
  seed: number,
  opts: { seconds?: number; fps?: number; noiseAmp?: number; gain?: number } = {},
): RoiSample[] {
  const { seconds = 12, fps = 30, noiseAmp = 1.5, gain = 1 } = opts;
  const rand = lcg(seed);
  const out: RoiSample[] = [];
  const frames = Math.floor(seconds * fps);
  for (let i = 0; i < frames; i++) {
    const t = (i / fps) * 1000;
    const phase = 2 * Math.PI * hz * (t / 1000);
    const drift = 4 * Math.sin(2 * Math.PI * 0.05 * (t / 1000));
    out.push({
      t,
      r: 150 + gain * 2.0 * Math.sin(phase) + drift + rand() * noiseAmp,
      g: 128 + gain * 6.0 * Math.sin(phase) + drift + rand() * noiseAmp,
      b: 110 + gain * 1.0 * Math.sin(phase) + drift + rand() * noiseAmp,
    });
  }
  return out;
}

function noiseTrace(seed: number, seconds = 12, fps = 30): RoiSample[] {
  const rand = lcg(seed);
  return Array.from({ length: Math.floor(seconds * fps) }, (_, i) => ({
    t: (i / fps) * 1000,
    r: 150 + rand() * 8,
    g: 128 + rand() * 8,
    b: 110 + rand() * 8,
  }));
}

function motionSeries(m: number, seconds = 12, fps = 30): MotionSample[] {
  return Array.from({ length: Math.floor(seconds * fps) }, (_, i) => ({
    t: (i / fps) * 1000,
    m,
  }));
}

describe("multi-ROI estimation with bandpass filtering", () => {
  it("three clean patches agree: a 1.2 Hz pulse reads ~72 BPM with good quality", () => {
    const est = estimatePulseFromRois([trace(1.2, 11), trace(1.2, 22), trace(1.2, 33)]);
    expect(est.bpm).not.toBeNull();
    expect(Math.abs(est.bpm! - 72)).toBeLessThanOrEqual(3);
    expect(est.quality).toBeGreaterThanOrEqual(0.6);
  });

  it("one drowned patch cannot kill the reading — the good patches carry it", () => {
    const est = estimatePulseFromRois([
      trace(1.5, 44),
      noiseTrace(55),
      trace(1.5, 66),
    ]);
    expect(est.bpm).not.toBeNull();
    expect(Math.abs(est.bpm! - 90)).toBeLessThanOrEqual(3);
  });

  it("pure noise on every patch stays unread — no invented number", () => {
    const est = estimatePulseFromRois([noiseTrace(1), noiseTrace(2), noiseTrace(3)]);
    expect(est.quality).toBeLessThan(0.35);
  });
});

describe("motion-artifact rejection", () => {
  it("a window drowned in motion earns no reading, however clean the colors look", () => {
    const est = estimatePulseFromRois([trace(1.2, 77)], {
      motion: motionSeries(0.2),
    });
    expect(est.bpm).toBeNull();
    expect(est.quality).toBe(0);
  });

  it("the same clean trace with still frames reads normally", () => {
    const est = estimatePulseFromRois([trace(1.2, 77)], {
      motion: motionSeries(0.001),
    });
    expect(est.bpm).not.toBeNull();
    expect(Math.abs(est.bpm! - 72)).toBeLessThanOrEqual(3);
  });
});

describe("stabilization window", () => {
  const at = 100_000;
  const mk = (bpm: number, quality = 0.8, ageMs = 0): TimedReading => ({
    bpm,
    quality,
    at: at - ageMs,
  });

  it("three agreeing readings produce the agreed (median) number", () => {
    const stable = stabilizeReading([mk(71), mk(73), mk(72), mk(74)], at);
    expect(stable).not.toBeNull();
    expect(stable!.bpm).toBeGreaterThanOrEqual(71);
    expect(stable!.bpm).toBeLessThanOrEqual(73);
    expect(stable!.quality).toBeGreaterThan(0);
  });

  it("two readings are not a heart rate yet", () => {
    expect(stabilizeReading([mk(72), mk(72)], at)).toBeNull();
  });

  it("readings that disagree with each other never stabilize", () => {
    expect(stabilizeReading([mk(55), mk(95), mk(140)], at)).toBeNull();
  });

  it("weak-quality readings do not count toward agreement", () => {
    expect(stabilizeReading([mk(72, 0.2), mk(72, 0.2), mk(72, 0.2)], at)).toBeNull();
  });

  it("stale readings fall out of the window", () => {
    expect(
      stabilizeReading([mk(72, 0.8, 9_000), mk(72, 0.8, 9_000), mk(72, 0.8, 9_000)], at),
    ).toBeNull();
  });
});

describe("searching carries the live signal quality", () => {
  it("the summary line shows the quality percentage while searching", () => {
    expect(
      pulseSummary({
        presence: true,
        motion: "still",
        pulse: { state: "searching", quality: 0.42 },
      }),
    ).toBe("Presence: yes · Motion: still · Pulse: searching… (signal quality 42%)");
  });
});
