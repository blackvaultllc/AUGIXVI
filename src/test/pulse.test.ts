import { describe, expect, it } from "vitest";
import {
  dominantFrequency,
  estimatePulse,
  frameMotion,
  motionLabel,
  pulseSummary,
  type RoiSample,
} from "@/avatar/pulse";

/**
 * PULSE MATH (2026-11-21) — the truth rule, tested. The estimator is fed
 * synthetic face-color traces with a KNOWN heartbeat baked in and must
 * recover it; fed noise or a flat trace it must refuse to read (bpm:
 * null / low quality) instead of inventing a number. The microphone
 * helper is fed a synthetic spectrum with a known tone.
 */

/** Deterministic pseudo-noise so the tests never flake. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
}

function syntheticPulseTrace(hz: number, seconds = 12, fps = 30, noiseAmp = 1.5): RoiSample[] {
  const rand = lcg(42);
  const out: RoiSample[] = [];
  const frames = Math.floor(seconds * fps);
  for (let i = 0; i < frames; i++) {
    const t = (i / fps) * 1000;
    const phase = 2 * Math.PI * hz * (t / 1000);
    // Blood-volume pulse shows strongest in green, weaker in red/blue,
    // plus a slow illumination drift and per-frame noise.
    const drift = 4 * Math.sin(2 * Math.PI * 0.05 * (t / 1000));
    out.push({
      t,
      r: 150 + 2.0 * Math.sin(phase) + drift + rand() * noiseAmp,
      g: 128 + 6.0 * Math.sin(phase) + drift + rand() * noiseAmp,
      b: 110 + 1.0 * Math.sin(phase) + drift + rand() * noiseAmp,
    });
  }
  return out;
}

describe("rPPG heart-rate estimation (POS)", () => {
  it("recovers a synthetic 1.2 Hz pulse as ~72 BPM with a good signal", () => {
    const est = estimatePulse(syntheticPulseTrace(1.2));
    expect(est.bpm).not.toBeNull();
    expect(Math.abs(est.bpm! - 72)).toBeLessThanOrEqual(3);
    expect(est.quality).toBeGreaterThanOrEqual(0.6);
    expect(est.waveform.length).toBeGreaterThan(50);
  });

  it("recovers a synthetic 1.5 Hz pulse as ~90 BPM", () => {
    const est = estimatePulse(syntheticPulseTrace(1.5));
    expect(est.bpm).not.toBeNull();
    expect(Math.abs(est.bpm! - 90)).toBeLessThanOrEqual(3);
  });

  it("refuses to read a flat trace — no heartbeat is not a number", () => {
    const flat: RoiSample[] = Array.from({ length: 360 }, (_, i) => ({
      t: (i / 30) * 1000,
      r: 150,
      g: 128,
      b: 110,
    }));
    const est = estimatePulse(flat);
    expect(est.bpm).toBeNull();
    expect(est.quality).toBe(0);
  });

  it("does not call pure noise a good signal", () => {
    const rand = lcg(7);
    const noise: RoiSample[] = Array.from({ length: 360 }, (_, i) => ({
      t: (i / 30) * 1000,
      r: 150 + rand() * 6,
      g: 128 + rand() * 6,
      b: 110 + rand() * 6,
    }));
    const est = estimatePulse(noise);
    // Noise may throw up a spurious peak, but never a confident one —
    // the UI only prints a number when quality clears the weak bar.
    expect(est.quality).toBeLessThan(0.6);
  });

  it("refuses a window shorter than the minimum observation time", () => {
    const est = estimatePulse(syntheticPulseTrace(1.2, 3));
    expect(est.bpm).toBeNull();
  });
});

describe("microphone dominant frequency", () => {
  it("finds a synthetic 468.75 Hz tone (bin-centered at 48 kHz / 2048)", () => {
    const fftSize = 2048;
    const sampleRate = 48000;
    const bins = fftSize / 2;
    const data = new Uint8Array(bins);
    const peakBin = 20; // 20 * 48000/2048 = 468.75 Hz exactly
    data[peakBin] = 255;
    data[peakBin - 1] = 120;
    data[peakBin + 1] = 120;
    const dom = dominantFrequency(data, sampleRate, fftSize);
    expect(dom).not.toBeNull();
    expect(Math.abs(dom!.hz - 469)).toBeLessThanOrEqual(4);
    expect(dom!.strength).toBeGreaterThan(0.9);
  });

  it("returns null for a quiet room (nothing above the floor)", () => {
    const data = new Uint8Array(1024).fill(3);
    expect(dominantFrequency(data, 48000, 2048)).toBeNull();
  });
});

describe("frame motion", () => {
  it("is zero for identical frames and grows with change", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 40]);
    expect(frameMotion(a, a)).toBe(0);
    const b = new Uint8ClampedArray([10, 20, 30, 140]);
    expect(frameMotion(a, b)).toBeGreaterThan(0);
    expect(motionLabel(0)).toBe("still");
    expect(motionLabel(0.01)).toBe("low");
    expect(motionLabel(0.04)).toBe("moderate");
    expect(motionLabel(0.2)).toBe("high");
  });
});

describe("pulse summary line", () => {
  it("composes the session line with an honest estimate label", () => {
    expect(
      pulseSummary({
        presence: true,
        motion: "low",
        pulse: { state: "reading", bpm: 72.4, quality: 0.9 },
      }),
    ).toBe("Presence: yes · Motion: low · Pulse: 72 BPM (estimate, good signal)");
  });

  it("says unavailable with the reason instead of a number", () => {
    expect(
      pulseSummary({
        presence: false,
        motion: "still",
        pulse: { state: "unavailable", reason: "no face in view" },
      }),
    ).toBe("Presence: no · Motion: still · Pulse: unavailable — no face in view");
  });

  it("labels a weak signal as weak", () => {
    expect(
      pulseSummary({
        presence: true,
        motion: "moderate",
        pulse: { state: "reading", bpm: 65, quality: 0.4 },
      }),
    ).toBe("Presence: yes · Motion: moderate · Pulse: 65 BPM (estimate, weak signal)");
  });
});
