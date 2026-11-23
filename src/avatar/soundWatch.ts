/**
 * SOUND WATCH — Augie's environmental ear (owner order 2026-11-23:
 * a "ninja ability" for patrol — hear everything in the room, break
 * down what it is, say roughly how close it is).
 *
 * This module is the pure core: measured sound features, the event
 * detector, the label decision, and the Captain's personal SOUND
 * LIBRARY (the Pokédex doctrine, owner order 2026-11-23):
 *
 *   - A sound the system cannot place is UNCLASSIFIED — a first-class
 *     result, never forced into a nearest label.
 *   - Every unclassified event keeps its FINGERPRINT (measured sound
 *     features — numbers, never raw audio).
 *   - When the Captain names an unknown, the name + fingerprint join
 *     his library, stored locally. Future matches are reported under
 *     HIS name, marked as library matches.
 *
 * TRUTH RULES (pinned by tests):
 *   - Distance is an ESTIMATE from loudness, always labeled as one.
 *     Loudness is not range.
 *   - Direction is NEVER produced: one microphone cannot give a
 *     bearing, and no entry carries one.
 *   - No raw audio is stored anywhere: entries and library rows hold
 *     labels, levels, times and fingerprint numbers only.
 *   - A classifier hit under the confidence threshold is treated as
 *     no hit at all — UNCLASSIFIED, not the nearest label.
 *
 * ENGINE NOTE (v2): the built-in classifier is YAMNet (Google's
 * audio model, 521 AudioSet classes) via the Captain-approved
 * @mediapipe/tasks-audio runtime. Model + wasm are vendored into
 * the app bundle (public/mediapipe/), so it classifies ON-DEVICE
 * with no network at runtime. Its labels feed ClassifierHit into
 * the same label decision below; the Captain's library still
 * outranks it, and under the confidence threshold a hit is no hit.
 * Measured-feature detection and fingerprints are unchanged: the
 * detector finds the events, YAMNet names what it can, the library
 * names what he taught, the rest stays UNCLASSIFIED.
 */

export type DistanceBand = "NEAR" | "MID" | "FAR";
export type SoundLabelSource = "classifier" | "library" | "unclassified";

/** Distance is an estimate from loudness — the UI must say so. */
export const DISTANCE_ESTIMATE_NOTE =
  "Distance is an estimate from loudness only — loudness is not range. A quiet sound up close can read the same as a loud one far away.";

/** One microphone, no bearing — stated in the panel, never faked. */
export const DIRECTION_NOTE =
  "One microphone cannot tell direction — direction needs more than one microphone. Sound Watch never guesses a bearing.";

export const SOUND_WATCH_PRIVACY_NOTE =
  "Sound is analyzed on this device, in this window. Nothing is recorded and no audio is stored — the log keeps labels, levels, times, and sound fingerprints (numbers), never sound itself.";

export const SOUND_WATCH_ENGINE_NOTE =
  "Built-in classifier: YAMNet — Google's audio model (521 sound classes), running on this device from files inside the app, so it works with no internet. A sound it reads confidently gets its label and the confidence is shown; under the line it stays UNCLASSIFIED — it never guesses a name. Your library names still outrank its labels.";

/** The Captain's script for an unknown, in his own framing. */
export function unknownSoundLine(count: number): string {
  return count === 1
    ? "Sir, I don't understand what that is — it's on the to-classify list. Name it and I'll know it next time."
    : `Sir, ${count} sounds I don't understand yet — they're on the to-classify list. Name one and I'll know it next time.`;
}

/* ------------------------------------------------------------------ */
/* Levels                                                              */
/* ------------------------------------------------------------------ */

/** RMS (0..1) → dBFS, floored at −100. */
export function rmsToDbfs(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0) return -100;
  return Math.max(-100, 20 * Math.log10(rms));
}

/** Meter fill fraction for a dBFS reading (−60 floor → 0, 0 → 1). */
export function meterFraction(dbfs: number): number {
  return Math.min(1, Math.max(0, (dbfs + 60) / 60));
}

/**
 * Rough distance band from a peak level. These thresholds are a
 * patrol heuristic for a typical laptop/phone mic at default gain —
 * an ESTIMATE, labeled everywhere it is shown.
 */
export function distanceBandForDb(peakDb: number): DistanceBand {
  if (peakDb >= -16) return "NEAR";
  if (peakDb >= -34) return "MID";
  return "FAR";
}

export function distanceBandText(band: DistanceBand): string {
  return `${band} — estimate`;
}

/* ------------------------------------------------------------------ */
/* Measured features + fingerprints                                    */
/* ------------------------------------------------------------------ */

export interface SoundFeatures {
  rms: number;
  dbfs: number;
  /** Spectral centroid in Hz (where the energy sits). */
  centroidHz: number;
  /** Strongest single frequency in Hz. */
  dominantHz: number;
  /** Energy ratios (0..1) in four bands; they sum to ~1. */
  bandLow: number; // < 250 Hz
  bandLowMid: number; // 250–1000 Hz
  bandMid: number; // 1000–4000 Hz
  bandHigh: number; // >= 4000 Hz
  /** Spectral flatness 0..1 (0 = tonal, 1 = noise-like). */
  flatness: number;
  /** Zero-crossing rate of the time-domain frame, 0..1. */
  zcr: number;
}

const MIN_HZ = 40;

/**
 * Measure one frame. `timeDomain` is the raw waveform (−1..1);
 * `freqDb` is an FFT magnitude spectrum in dB (analyser-style,
 * e.g. −100..−30) with `sampleRate` the audio context's rate.
 * Pure: synthetic arrays in, features out.
 */
export function computeFeatures(
  timeDomain: ArrayLike<number>,
  freqDb: ArrayLike<number>,
  sampleRate: number,
): SoundFeatures {
  const n = timeDomain.length;
  let sumSq = 0;
  let crossings = 0;
  for (let i = 0; i < n; i++) {
    const v = timeDomain[i] ?? 0;
    sumSq += v * v;
    if (i > 0) {
      const prev = timeDomain[i - 1] ?? 0;
      if ((v >= 0 && prev < 0) || (v < 0 && prev >= 0)) crossings++;
    }
  }
  const rms = n > 0 ? Math.sqrt(sumSq / n) : 0;
  const zcr = n > 1 ? crossings / (n - 1) : 0;

  const bins = freqDb.length;
  const nyquist = sampleRate / 2;
  const binHz = bins > 0 ? nyquist / bins : 0;
  let totalPower = 0;
  let weighted = 0;
  let low = 0;
  let lowMid = 0;
  let mid = 0;
  let high = 0;
  let domPower = -1;
  let domHz = 0;
  let logSum = 0;
  let powerCount = 0;
  for (let i = 0; i < bins; i++) {
    const hz = i * binHz;
    if (hz < MIN_HZ) continue;
    const db = freqDb[i] ?? -100;
    const power = Math.pow(10, db / 10);
    totalPower += power;
    weighted += hz * power;
    logSum += Math.log(power + 1e-12);
    powerCount++;
    if (hz < 250) low += power;
    else if (hz < 1000) lowMid += power;
    else if (hz < 4000) mid += power;
    else high += power;
    if (power > domPower) {
      domPower = power;
      domHz = hz;
    }
  }
  const ratio = (p: number) => (totalPower > 0 ? p / totalPower : 0);
  const arithMean = powerCount > 0 ? totalPower / powerCount : 0;
  const geoMean = powerCount > 0 ? Math.exp(logSum / powerCount) : 0;
  return {
    rms,
    dbfs: rmsToDbfs(rms),
    centroidHz: totalPower > 0 ? weighted / totalPower : 0,
    dominantHz: domHz,
    bandLow: ratio(low),
    bandLowMid: ratio(lowMid),
    bandMid: ratio(mid),
    bandHigh: ratio(high),
    flatness: arithMean > 0 ? Math.min(1, geoMean / arithMean) : 0,
    zcr,
  };
}

/** Fingerprint layout: 4 band ratios, centroid, flatness, zcr, dominant. */
export const FINGERPRINT_DIM = 8;

/** Hz → 0..1 on a log scale (40 Hz → 0, ~16 kHz → 1). */
function logHzNorm(hz: number): number {
  if (!Number.isFinite(hz) || hz <= MIN_HZ) return 0;
  const v = Math.log2(hz / MIN_HZ) / Math.log2(16000 / MIN_HZ);
  return Math.min(1, Math.max(0, v));
}

/** A feature frame's fingerprint: a unit-length vector of measures. */
export function fingerprintOf(features: SoundFeatures): number[] {
  const raw = [
    features.bandLow,
    features.bandLowMid,
    features.bandMid,
    features.bandHigh,
    logHzNorm(features.centroidHz),
    Math.min(1, Math.max(0, features.flatness)),
    Math.min(1, Math.max(0, features.zcr * 4)),
    logHzNorm(features.dominantHz),
  ];
  const norm = Math.sqrt(raw.reduce((acc, v) => acc + v * v, 0));
  if (norm <= 0) return raw.map(() => 0);
  return raw.map((v) => v / norm);
}

/** Cosine similarity of two fingerprint vectors (−1..1). */
export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na <= 0 || nb <= 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function averageFingerprints(prints: number[][]): number[] {
  if (prints.length === 0) return new Array(FINGERPRINT_DIM).fill(0);
  const out = new Array(FINGERPRINT_DIM).fill(0) as number[];
  for (const p of prints) {
    for (let i = 0; i < FINGERPRINT_DIM; i++) out[i] = (out[i] ?? 0) + (p[i] ?? 0);
  }
  const norm = Math.sqrt(out.reduce((acc, v) => acc + v * v, 0));
  if (norm <= 0) return out;
  return out.map((v) => v / norm);
}

/* ------------------------------------------------------------------ */
/* Event detector — when does a stretch of sound become ONE event?     */
/* ------------------------------------------------------------------ */

export interface DetectorFrame {
  /** Epoch ms. */
  t: number;
  dbfs: number;
  fingerprint: number[];
  dominantHz: number;
}

export interface DetectedSound {
  at: number;
  durationMs: number;
  peakDb: number;
  fingerprint: number[];
  dominantHz: number;
}

const ONSET_RISE_DB = 12;
const MIN_ONSET_DB = -52;
const CLOSE_DROP_DB = 6;
const ONSET_FRAMES = 2; // ~200 ms at the window's 100 ms tick
const CLOSE_FRAMES = 5; // ~500 ms of quiet ends an event
const MAX_EVENT_MS = 20_000;
const MIN_EVENT_MS = 150;

/**
 * Feed measured frames; get back a DetectedSound when one completes.
 * The ambient floor adapts slowly while the room is quiet, so a
 * steady hum does not become an endless event — a RISE above the
 * room is what counts.
 */
export class SoundEventDetector {
  private floorDb = -58;
  private loudFrames = 0;
  private quietFrames = 0;
  private active: {
    startedAt: number;
    lastLoudAt: number;
    peakDb: number;
    prints: number[][];
    domSum: number;
    domCount: number;
  } | null = null;

  reset(): void {
    this.floorDb = -58;
    this.loudFrames = 0;
    this.quietFrames = 0;
    this.active = null;
  }

  feed(frame: DetectorFrame): DetectedSound | null {
    const onsetDb = Math.max(this.floorDb + ONSET_RISE_DB, MIN_ONSET_DB);
    if (!this.active) {
      if (frame.dbfs >= onsetDb) {
        this.loudFrames++;
        if (this.loudFrames >= ONSET_FRAMES) {
          this.active = {
            startedAt: frame.t - (ONSET_FRAMES - 1) * 100,
            lastLoudAt: frame.t,
            peakDb: frame.dbfs,
            prints: [frame.fingerprint],
            domSum: frame.dominantHz,
            domCount: 1,
          };
          this.loudFrames = 0;
          this.quietFrames = 0;
        }
      } else {
        this.loudFrames = 0;
        // Adapt to the room only while it is quieter than an onset.
        this.floorDb = this.floorDb * 0.97 + frame.dbfs * 0.03;
      }
      return null;
    }
    const active = this.active;
    active.prints.push(frame.fingerprint);
    active.domSum += frame.dominantHz;
    active.domCount++;
    if (frame.dbfs > active.peakDb) active.peakDb = frame.dbfs;
    if (frame.dbfs >= onsetDb - CLOSE_DROP_DB) {
      active.lastLoudAt = frame.t;
      this.quietFrames = 0;
    } else {
      this.quietFrames++;
    }
    const tooLong = frame.t - active.startedAt >= MAX_EVENT_MS;
    if (this.quietFrames >= CLOSE_FRAMES || tooLong) {
      this.active = null;
      this.quietFrames = 0;
      const durationMs = active.lastLoudAt - active.startedAt;
      if (durationMs < MIN_EVENT_MS) return null;
      return {
        at: active.startedAt,
        durationMs,
        peakDb: active.peakDb,
        fingerprint: averageFingerprints(active.prints),
        dominantHz: active.domCount > 0 ? active.domSum / active.domCount : 0,
      };
    }
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* The Captain's sound library — the Pokédex                           */
/* ------------------------------------------------------------------ */

export interface SoundLibraryEntry {
  id: string;
  /** The Captain's own name for this sound. */
  name: string;
  fingerprint: number[];
  createdAt: number;
  /** How many later events have matched this entry. */
  hits: number;
  /** The Captain's call: matching sounds raise a visible alert. */
  alert: boolean;
}

export const SOUND_LIBRARY_KEY = "augi.soundwatch.library.v1";
export const LIBRARY_MATCH_THRESHOLD = 0.9;

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function isFingerprint(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === FINGERPRINT_DIM &&
    value.every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

/** Load + validate the library. Corrupt rows are dropped, never trusted. */
export function loadSoundLibrary(storage: StorageLike | null): SoundLibraryEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SOUND_LIBRARY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: SoundLibraryEntry[] = [];
    for (const row of parsed) {
      if (typeof row !== "object" || row === null) continue;
      const r = row as Record<string, unknown>;
      if (
        typeof r["id"] === "string" &&
        typeof r["name"] === "string" &&
        r["name"].trim() !== "" &&
        isFingerprint(r["fingerprint"]) &&
        typeof r["createdAt"] === "number"
      ) {
        out.push({
          id: r["id"],
          name: r["name"],
          fingerprint: r["fingerprint"],
          createdAt: r["createdAt"],
          hits: typeof r["hits"] === "number" ? r["hits"] : 0,
          alert: r["alert"] === true,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function saveSoundLibrary(storage: StorageLike | null, library: SoundLibraryEntry[]): void {
  if (!storage) return;
  try {
    storage.setItem(SOUND_LIBRARY_KEY, JSON.stringify(library));
  } catch {
    /* storage full/blocked — the in-memory library still works */
  }
}

/** Best library match for a fingerprint, or null under the threshold. */
export function matchLibrary(
  fingerprint: number[],
  library: SoundLibraryEntry[],
): { entry: SoundLibraryEntry; similarity: number } | null {
  let best: { entry: SoundLibraryEntry; similarity: number } | null = null;
  for (const entry of library) {
    const similarity = cosineSimilarity(fingerprint, entry.fingerprint);
    if (similarity >= LIBRARY_MATCH_THRESHOLD && (!best || similarity > best.similarity)) {
      best = { entry, similarity };
    }
  }
  return best;
}

/** He names it → it's learned. Returns the new library (input untouched). */
export function teachSound(
  library: SoundLibraryEntry[],
  name: string,
  fingerprint: number[],
  at: number,
  id: string,
): SoundLibraryEntry[] {
  const clean = name.trim();
  if (clean === "" || !isFingerprint(fingerprint)) return library;
  return [
    ...library,
    { id, name: clean, fingerprint: [...fingerprint], createdAt: at, hits: 0, alert: false },
  ];
}

export function recordLibraryHit(library: SoundLibraryEntry[], id: string): SoundLibraryEntry[] {
  return library.map((entry) =>
    entry.id === id ? { ...entry, hits: entry.hits + 1 } : entry,
  );
}

export function forgetSound(library: SoundLibraryEntry[], id: string): SoundLibraryEntry[] {
  return library.filter((entry) => entry.id !== id);
}

export function setLibraryAlert(
  library: SoundLibraryEntry[],
  id: string,
  alert: boolean,
): SoundLibraryEntry[] {
  return library.map((entry) => (entry.id === id ? { ...entry, alert } : entry));
}

/* ------------------------------------------------------------------ */
/* The label decision                                                  */
/* ------------------------------------------------------------------ */

/** A built-in classifier's best guess (null when no classifier runs). */
export interface ClassifierHit {
  label: string;
  score: number;
}

/** Under this, a classifier hit is NO hit — never a forced label. */
export const CLASSIFIER_CONFIDENCE_THRESHOLD = 0.3;

/** Classifier labels (YAMNet/AudioSet names) that mean a person. */
export const HUMAN_CLASS_LABELS: ReadonlySet<string> = new Set([
  "Speech",
  "Male speech, man speaking",
  "Female speech, woman speaking",
  "Child speech, kid speaking",
  "Conversation",
  "Narration, monologue",
  "Shout",
  "Yell",
  "Screaming",
  "Whispering",
  "Footsteps",
  "Clapping",
  "Laughter",
  "Singing",
]);

export interface LabelDecision {
  source: SoundLabelSource;
  /** Null exactly when source is "unclassified". */
  label: string | null;
  confidence: number | null;
  libraryId: string | null;
  /** A person-class sound (classifier labels only — never guessed). */
  human: boolean;
  /** Raise this one visibly: a person, or a library entry he flagged. */
  alert: boolean;
}

/**
 * Decide what a detected sound is called. The Captain's library
 * outranks the built-in classifier (his name for a thing is the name
 * that matters on his patrol); a classifier hit counts only at or
 * over the confidence threshold; otherwise UNCLASSIFIED.
 */
export function decideLabel(
  hit: ClassifierHit | null,
  fingerprint: number[],
  library: SoundLibraryEntry[],
): LabelDecision {
  const match = matchLibrary(fingerprint, library);
  if (match) {
    return {
      source: "library",
      label: match.entry.name,
      confidence: match.similarity,
      libraryId: match.entry.id,
      human: false,
      alert: match.entry.alert,
    };
  }
  if (hit && hit.score >= CLASSIFIER_CONFIDENCE_THRESHOLD && hit.label.trim() !== "") {
    const human = HUMAN_CLASS_LABELS.has(hit.label);
    return {
      source: "classifier",
      label: hit.label,
      confidence: hit.score,
      libraryId: null,
      human,
      alert: human,
    };
  }
  return {
    source: "unclassified",
    label: null,
    confidence: null,
    libraryId: null,
    human: false,
    alert: false,
  };
}

/* ------------------------------------------------------------------ */
/* Log entries                                                         */
/* ------------------------------------------------------------------ */

export interface SoundEventEntry {
  id: string;
  at: number;
  /** Null when UNCLASSIFIED. */
  label: string | null;
  source: SoundLabelSource;
  confidence: number | null;
  peakDb: number;
  distanceBand: DistanceBand;
  /** Always true — the type itself refuses an unlabeled distance. */
  distanceIsEstimate: true;
  durationMs: number;
  /** Measured character only: numbers, never an identity claim. */
  character: string;
  fingerprint: number[];
  alert: boolean;
  // NOTE: no direction/bearing field exists, by design. No audio
  // field exists either — fingerprints are numbers, not sound.
}

function roundHz(hz: number): string {
  if (hz >= 1000) return `${(hz / 1000).toFixed(1).replace(/\.0$/, "")} kHz`;
  return `${Math.round(hz)} Hz`;
}

/** A plain measured description: peak, strongest frequency, length. */
export function characterLine(sound: DetectedSound): string {
  const seconds = (sound.durationMs / 1000).toFixed(1).replace(/\.0$/, "");
  return `peak ${Math.round(sound.peakDb)} dB · strongest around ${roundHz(sound.dominantHz)} · ${seconds}s`;
}

export function buildEntry(
  id: string,
  sound: DetectedSound,
  decision: LabelDecision,
): SoundEventEntry {
  return {
    id,
    at: sound.at,
    label: decision.label,
    source: decision.source,
    confidence: decision.confidence,
    peakDb: sound.peakDb,
    distanceBand: distanceBandForDb(sound.peakDb),
    distanceIsEstimate: true,
    durationMs: sound.durationMs,
    character: characterLine(sound),
    fingerprint: sound.fingerprint,
    alert: decision.alert,
  };
}

/** Display name for an entry: his name, the classifier's, or the honest gap. */
export function entryTitle(entry: SoundEventEntry): string {
  if (entry.source === "unclassified") return "UNCLASSIFIED";
  return entry.label ?? "UNCLASSIFIED";
}

/**
 * The line a raised alert speaks/shows through the stage's notify +
 * god pop-up path. Names the sound, says person when the classifier
 * placed it in a human class, and keeps the distance an estimate.
 */
export function soundAlertLine(entry: SoundEventEntry): string {
  const title = entryTitle(entry);
  const kind =
    entry.source === "classifier"
      ? "Sound Watch — a person sound"
      : "Sound Watch — a sound you flagged";
  return `${kind}: ${title} · ${distanceBandText(entry.distanceBand)} · ${entry.character}`;
}
