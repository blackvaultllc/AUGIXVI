import { describe, expect, it } from "vitest";
import {
  CLASSIFIER_CONFIDENCE_THRESHOLD,
  FINGERPRINT_DIM,
  SoundEventDetector,
  buildEntry,
  computeFeatures,
  cosineSimilarity,
  decideLabel,
  distanceBandForDb,
  distanceBandText,
  fingerprintOf,
  forgetSound,
  loadSoundLibrary,
  matchLibrary,
  recordLibraryHit,
  rmsToDbfs,
  saveSoundLibrary,
  setLibraryAlert,
  teachSound,
  type DetectorFrame,
  type SoundFeatures,
  type SoundLibraryEntry,
  type StorageLike,
} from "@/avatar/soundWatch";

/**
 * SOUND WATCH (2026-11-23) — the room's ear + the Pokédex doctrine.
 * These pins hold the truth rules: UNCLASSIFIED is never forced into
 * a label, distance is always a labeled estimate, no entry carries a
 * direction or audio, and a sound the Captain names is known by his
 * name from then on.
 */

function features(overrides: Partial<SoundFeatures> = {}): SoundFeatures {
  return {
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
    ...overrides,
  };
}

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

const PRINT_A = fingerprintOf(features());
const PRINT_B = fingerprintOf(
  features({ bandLow: 0.9, bandLowMid: 0.05, bandMid: 0.03, bandHigh: 0.02, centroidHz: 120, dominantHz: 90, flatness: 0.1, zcr: 0.01 }),
);

describe("levels and distance", () => {
  it("converts RMS to dBFS and floors silence", () => {
    expect(rmsToDbfs(1)).toBe(0);
    expect(rmsToDbfs(0.1)).toBeCloseTo(-20);
    expect(rmsToDbfs(0)).toBe(-100);
  });

  it("bands distance by level and always labels it an estimate", () => {
    expect(distanceBandForDb(-8)).toBe("NEAR");
    expect(distanceBandForDb(-25)).toBe("MID");
    expect(distanceBandForDb(-50)).toBe("FAR");
    for (const band of ["NEAR", "MID", "FAR"] as const) {
      expect(distanceBandText(band)).toContain("estimate");
    }
  });
});

describe("measured features", () => {
  it("finds the dominant frequency and its band from a synthetic spectrum", () => {
    const sampleRate = 48000;
    const bins = 1025;
    const freq = new Float32Array(bins).fill(-100);
    const binHz = sampleRate / 2 / bins;
    const peakBin = Math.round(1000 / binHz);
    freq[peakBin] = -30;
    const time = new Float32Array(2048);
    for (let i = 0; i < time.length; i++) time[i] = 0.4 * Math.sin((2 * Math.PI * 1000 * i) / sampleRate);
    const f = computeFeatures(time, freq, sampleRate);
    expect(f.dominantHz).toBeCloseTo(peakBin * binHz, -1);
    expect(f.bandMid).toBeGreaterThan(0.99);
    expect(f.dbfs).toBeGreaterThan(-12);
    expect(f.dbfs).toBeLessThan(-6);
  });

  it("fingerprints are unit-length vectors of the fixed dimension", () => {
    const p = fingerprintOf(features());
    expect(p).toHaveLength(FINGERPRINT_DIM);
    const norm = Math.sqrt(p.reduce((a, v) => a + v * v, 0));
    expect(norm).toBeCloseTo(1);
    expect(cosineSimilarity(p, p)).toBeCloseTo(1);
    expect(cosineSimilarity(PRINT_A, PRINT_B)).toBeLessThan(0.9);
  });
});

describe("event detector", () => {
  function frame(t: number, dbfs: number): DetectorFrame {
    return { t, dbfs, fingerprint: PRINT_A, dominantHz: 1000 };
  }

  it("stays silent in a quiet room and reports one burst as one event", () => {
    const det = new SoundEventDetector();
    for (let i = 0; i < 20; i++) expect(det.feed(frame(i * 100, -70))).toBeNull();
    let found = null;
    for (let i = 20; i < 30; i++) found = det.feed(frame(i * 100, -10)) ?? found;
    expect(found).toBeNull(); // still open while loud
    for (let i = 30; i < 40 && !found; i++) found = det.feed(frame(i * 100, -70));
    expect(found).not.toBeNull();
    expect(found!.peakDb).toBe(-10);
    expect(found!.durationMs).toBeGreaterThanOrEqual(700);
    expect(found!.fingerprint).toHaveLength(FINGERPRINT_DIM);
  });

  it("a steady hum near the floor does not become an event", () => {
    const det = new SoundEventDetector();
    let events = 0;
    for (let i = 0; i < 100; i++) {
      if (det.feed(frame(i * 100, -55))) events++;
    }
    expect(events).toBe(0);
  });
});

describe("the label decision — the Pokédex rules", () => {
  it("a classifier hit under the confidence threshold is UNCLASSIFIED, never the nearest label", () => {
    const decision = decideLabel(
      { label: "Speech", score: CLASSIFIER_CONFIDENCE_THRESHOLD - 0.01 },
      PRINT_A,
      [],
    );
    expect(decision.source).toBe("unclassified");
    expect(decision.label).toBeNull();
  });

  it("a confident person-class hit is labeled, human, and alerting", () => {
    const decision = decideLabel({ label: "Footsteps", score: 0.9 }, PRINT_A, []);
    expect(decision.source).toBe("classifier");
    expect(decision.label).toBe("Footsteps");
    expect(decision.human).toBe(true);
    expect(decision.alert).toBe(true);
  });

  it("no classifier and no library match means UNCLASSIFIED with no label", () => {
    const decision = decideLabel(null, PRINT_A, []);
    expect(decision.source).toBe("unclassified");
    expect(decision.label).toBeNull();
    expect(decision.confidence).toBeNull();
  });

  it("once he names it, a similar fingerprint is reported under HIS name as a library match", () => {
    const library = teachSound([], "neighbor's dog", PRINT_A, 1000, "lib-1");
    const similar = PRINT_A.map((v, i) => v + (i % 2 === 0 ? 0.01 : -0.01));
    const decision = decideLabel(null, similar, library);
    expect(decision.source).toBe("library");
    expect(decision.label).toBe("neighbor's dog");
    expect(decision.libraryId).toBe("lib-1");
    // His name outranks even a confident generic classifier label.
    const overClassifier = decideLabel({ label: "Dog", score: 0.99 }, similar, library);
    expect(overClassifier.source).toBe("library");
    expect(overClassifier.label).toBe("neighbor's dog");
    // A different sound stays unknown.
    expect(decideLabel(null, PRINT_B, library).source).toBe("unclassified");
    expect(matchLibrary(PRINT_B, library)).toBeNull();
  });

  it("library entries he flags raise alerts; hits are counted; forgetting works", () => {
    let library = teachSound([], "gate hinge", PRINT_A, 1000, "lib-1");
    library = setLibraryAlert(library, "lib-1", true);
    expect(decideLabel(null, PRINT_A, library).alert).toBe(true);
    library = recordLibraryHit(library, "lib-1");
    expect(library[0]!.hits).toBe(1);
    expect(forgetSound(library, "lib-1")).toHaveLength(0);
    expect(teachSound(library, "   ", PRINT_A, 0, "lib-2")).toBe(library);
  });
});

describe("log entries — what is kept, and what never is", () => {
  const sound = {
    at: 5000,
    durationMs: 800,
    peakDb: -10,
    fingerprint: PRINT_A,
    dominantHz: 1000,
  };

  it("entries carry labels, levels, times and fingerprints — no direction, no audio", () => {
    const entry = buildEntry("e1", sound, decideLabel(null, PRINT_A, []));
    expect(entry.source).toBe("unclassified");
    expect(entry.label).toBeNull();
    expect(entry.distanceIsEstimate).toBe(true);
    expect(entry.distanceBand).toBe("NEAR");
    const keys = Object.keys(entry);
    for (const banned of ["direction", "bearing", "azimuth", "audio", "samples", "recording"]) {
      expect(keys).not.toContain(banned);
    }
    expect(JSON.stringify(entry)).not.toContain("direction");
    expect(entry.fingerprint).toHaveLength(FINGERPRINT_DIM);
    expect(entry.fingerprint.every((v) => typeof v === "number")).toBe(true);
  });

  it("the stored library holds names and fingerprint numbers only — no audio anywhere", () => {
    const storage = memoryStorage();
    const library = teachSound([], "HVAC rattle", PRINT_A, 1000, "lib-1");
    saveSoundLibrary(storage, library);
    const raw = [...storage.map.values()].join("");
    expect(raw).not.toContain("audio");
    expect(raw).not.toContain("direction");
    const loaded = loadSoundLibrary(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.name).toBe("HVAC rattle");
    expect(Object.keys(loaded[0]!).sort()).toEqual(
      ["alert", "createdAt", "fingerprint", "hits", "id", "name"].sort(),
    );
    const reloaded: SoundLibraryEntry[] = loaded;
    expect(reloaded[0]!.fingerprint).toEqual(PRINT_A);
  });

  it("a corrupt library file loads as empty, never as garbage", () => {
    const storage = memoryStorage();
    storage.setItem("augi.soundwatch.library.v1", "{not json");
    expect(loadSoundLibrary(storage)).toEqual([]);
    storage.setItem("augi.soundwatch.library.v1", JSON.stringify([{ id: 7, name: "x" }]));
    expect(loadSoundLibrary(storage)).toEqual([]);
  });
});
