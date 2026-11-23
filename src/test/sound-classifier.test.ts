import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDIO_WASM_ROOT,
  SoundSegmentRecorder,
  YAMNET_MODEL_PATH,
  YAMNET_SAMPLE_RATE,
  YAMNET_WINDOW_SAMPLES,
  bestClassifierHit,
  padToWindow,
  resampleToYamnet,
  type ClassifierResultLike,
} from "@/avatar/soundClassifier";
import {
  HUMAN_CLASS_LABELS,
  buildEntry,
  decideLabel,
  soundAlertLine,
  teachSound,
  fingerprintOf,
  type SoundFeatures,
} from "@/avatar/soundWatch";

/**
 * SOUND WATCH v2 — THE REAL CLASSIFIER (2026-11-23, the Captain's
 * approval of @mediapipe/tasks-audio). These pins hold: YAMNet's
 * best hit feeds the SAME decideLabel law as v1 (threshold, human
 * alerts, library outranks), the segment plumbing is honest math,
 * and the model + wasm live INSIDE the bundle — offline law: the
 * classifier must work with the grid down, so the files ship.
 */

function result(...cats: { label: string; score: number }[]): ClassifierResultLike {
  return {
    classifications: [
      { categories: cats.map((c) => ({ categoryName: c.label, displayName: c.label, score: c.score })) },
    ],
  };
}

describe("bestClassifierHit — reading YAMNet's answer", () => {
  it("picks the single best category across chunks and heads", () => {
    const hit = bestClassifierHit([
      result({ label: "Silence", score: 0.4 }, { label: "Speech", score: 0.62 }),
      result({ label: "Dog", score: 0.61 }),
    ]);
    expect(hit).toEqual({ label: "Speech", score: 0.62 });
  });

  it("prefers the display name and skips empty or non-finite categories", () => {
    const hit = bestClassifierHit([
      {
        classifications: [
          {
            categories: [
              { categoryName: "/m/09x0r", displayName: "Speech", score: 0.5 },
              { categoryName: "", displayName: "", score: 0.99 },
              { categoryName: "Dog", displayName: "Dog", score: Number.NaN },
            ],
          },
        ],
      },
    ]);
    expect(hit).toEqual({ label: "Speech", score: 0.5 });
  });

  it("no results at all means no hit — never a fabricated label", () => {
    expect(bestClassifierHit(null)).toBeNull();
    expect(bestClassifierHit([])).toBeNull();
    expect(bestClassifierHit([result()])).toBeNull();
  });
});

describe("the label law with a real classifier behind it", () => {
  const features: SoundFeatures = {
    rms: 0.2,
    dbfs: -14,
    centroidHz: 1200,
    dominantHz: 1000,
    bandLow: 0.1,
    bandLowMid: 0.3,
    bandMid: 0.5,
    bandHigh: 0.1,
    flatness: 0.3,
    zcr: 0.05,
  };
  const print = fingerprintOf(features);

  it("every human class in the Captain's set alerts when confident", () => {
    for (const label of ["Speech", "Footsteps", "Shout", "Yell", "Screaming", "Whispering", "Conversation"]) {
      expect(HUMAN_CLASS_LABELS.has(label)).toBe(true);
      const decision = decideLabel({ label, score: 0.9 }, print, []);
      expect(decision.human).toBe(true);
      expect(decision.alert).toBe(true);
    }
  });

  it("a confident non-human class labels without alerting (animal stays information)", () => {
    const decision = decideLabel({ label: "Dog", score: 0.95 }, print, []);
    expect(decision.source).toBe("classifier");
    expect(decision.label).toBe("Dog");
    expect(decision.human).toBe(false);
    expect(decision.alert).toBe(false);
  });

  it("his library name still outranks a confident YAMNet label", () => {
    const library = teachSound([], "my clap", print, 1000, "lib-1");
    const decision = decideLabel({ label: "Clapping", score: 0.99 }, print, library);
    expect(decision.source).toBe("library");
    expect(decision.label).toBe("my clap");
  });

  it("the alert line names the sound, the person, and the estimate", () => {
    const sound = { at: 5000, durationMs: 800, peakDb: -10, fingerprint: print, dominantHz: 1000 };
    const entry = buildEntry("e1", sound, decideLabel({ label: "Speech", score: 0.9 }, print, []));
    const line = soundAlertLine(entry);
    expect(line).toContain("Speech");
    expect(line).toContain("person");
    expect(line).toContain("estimate");
  });
});

describe("segment plumbing — resample and record", () => {
  it("resamples 48 kHz down to YAMNet's 16 kHz at the right length", () => {
    const input = new Float32Array(48_000).fill(0.25);
    const out = resampleToYamnet(input, 48_000);
    expect(out.length).toBe(YAMNET_SAMPLE_RATE);
    expect(out[0]).toBeCloseTo(0.25);
    expect(resampleToYamnet(new Float32Array(0), 48_000).length).toBe(0);
    const passthrough = resampleToYamnet(new Float32Array([1, 2, 3]), YAMNET_SAMPLE_RATE);
    expect([...passthrough]).toEqual([1, 2, 3]);
  });

  it("pads a short clip up to exactly one YAMNet window", () => {
    const padded = padToWindow(new Float32Array(100).fill(0.5));
    expect(padded.length).toBe(YAMNET_WINDOW_SAMPLES);
    expect(padded[99]).toBeCloseTo(0.5);
    expect(padded[100]).toBe(0);
  });

  it("the recorder returns exactly the requested slice of the stream", () => {
    const recorder = new SoundSegmentRecorder(1000); // 1 sample per ms
    const chunk = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) chunk[i] = i;
    recorder.push(chunk, 10_000); // covers [9000, 10000]
    const slice = recorder.segment(9_500, 9_600);
    expect(slice).not.toBeNull();
    expect(slice!.length).toBe(100);
    expect(slice![0]).toBe(500);
    expect(recorder.segment(100, 200)).toBeNull();
    recorder.reset();
    expect(recorder.segment(9_500, 9_600)).toBeNull();
  });
});

describe("offline law — the classifier ships inside the bundle", () => {
  it("the YAMNet model file is in public/ at its real size", () => {
    const model = join(process.cwd(), "public", YAMNET_MODEL_PATH);
    expect(existsSync(model)).toBe(true);
    // The official float32 YAMNet bundle is 4,126,810 bytes.
    expect(statSync(model).size).toBe(4_126_810);
  });

  it("the audio wasm runtime is vendored next to the vision wasm", () => {
    for (const file of ["audio_wasm_internal.wasm", "audio_wasm_module_internal.wasm"]) {
      const path = join(process.cwd(), "public", AUDIO_WASM_ROOT, file);
      expect(existsSync(path)).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(100_000);
    }
  });
});
