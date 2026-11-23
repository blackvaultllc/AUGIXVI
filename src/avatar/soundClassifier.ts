/**
 * SOUND CLASSIFIER — YAMNet on-device (owner-approved 2026-11-23:
 * the Captain approved the @mediapipe/tasks-audio package in the
 * main chat, ~06:37 CST, "everything needs to be completed 110%").
 *
 * The engine: Google's YAMNet model (521 AudioSet classes) running
 * through MediaPipe's AudioClassifier, entirely on this device.
 *
 * OFFLINE LAW: the model file and the wasm runtime are VENDORED
 * into the app bundle (public/mediapipe/) — classification never
 * fetches anything at runtime, so Sound Watch still knows a voice
 * from a dog with the grid down.
 *
 * COST LAW: classification runs ONCE per detected sound event, on
 * the event's own segment — never in a loop, never per frame. The
 * measured milliseconds of the last run are surfaced to the panel
 * so the cost is a fact, not a claim.
 *
 * PRIVACY: the segment lives in memory only, long enough to be
 * classified, and is never stored — the log keeps labels, levels,
 * times and fingerprint numbers (see soundWatch.ts).
 */
import type { ClassifierHit } from "./soundWatch";

/** Vendored model + runtime — same origin, no network at runtime. */
export const YAMNET_MODEL_PATH = "/mediapipe/yamnet.tflite";
export const AUDIO_WASM_ROOT = "/mediapipe/wasm";
/** YAMNet's native rate: every segment is resampled to this. */
export const YAMNET_SAMPLE_RATE = 16_000;
/** One YAMNet analysis window: 0.96 s. Shorter clips are padded. */
export const YAMNET_WINDOW_SAMPLES = 15_360;
/** Classify at most this much of a long event (its loudest heart). */
export const CLASSIFY_MAX_SECONDS = 10;

export type ClassifierState = "idle" | "loading" | "ready" | "failed";

/* ------------------------------------------------------------------ */
/* Pure helpers — pinned by tests                                      */
/* ------------------------------------------------------------------ */

export interface ClassifierCategoryLike {
  categoryName?: string;
  displayName?: string;
  score: number;
}

export interface ClassifierResultLike {
  classifications: { categories: ClassifierCategoryLike[] }[];
}

/**
 * The single best hit across every result chunk and category, or
 * null when the classifier said nothing at all. The confidence
 * threshold is NOT applied here — decideLabel owns that law.
 */
export function bestClassifierHit(
  results: readonly ClassifierResultLike[] | null | undefined,
): ClassifierHit | null {
  if (!results) return null;
  let best: ClassifierHit | null = null;
  for (const result of results) {
    for (const head of result.classifications ?? []) {
      for (const category of head.categories ?? []) {
        const label = (category.displayName || category.categoryName || "").trim();
        if (label === "" || !Number.isFinite(category.score)) continue;
        if (!best || category.score > (best.score ?? 0)) {
          best = { label, score: category.score };
        }
      }
    }
  }
  return best;
}

/** Linear-interpolation resample to YAMNet's 16 kHz. Pure. */
export function resampleToYamnet(samples: Float32Array, sampleRate: number): Float32Array {
  if (samples.length === 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return new Float32Array(0);
  }
  if (sampleRate === YAMNET_SAMPLE_RATE) return new Float32Array(samples);
  const ratio = sampleRate / YAMNET_SAMPLE_RATE;
  const outLength = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(samples.length - 1, lo + 1);
    const frac = pos - lo;
    out[i] = (samples[lo] ?? 0) * (1 - frac) + (samples[hi] ?? 0) * frac;
  }
  return out;
}

/** Pad a short clip up to one full YAMNet window with silence. */
export function padToWindow(samples: Float32Array): Float32Array {
  if (samples.length >= YAMNET_WINDOW_SAMPLES) return samples;
  const out = new Float32Array(YAMNET_WINDOW_SAMPLES);
  out.set(samples);
  return out;
}

/* ------------------------------------------------------------------ */
/* The event-segment recorder — memory only, never stored              */
/* ------------------------------------------------------------------ */

/**
 * A rolling buffer of the last seconds of microphone audio, held in
 * memory so a detected event's own segment can be classified after
 * the detector closes it. Nothing here is persisted anywhere.
 */
export class SoundSegmentRecorder {
  private chunks: { startMs: number; samples: Float32Array }[] = [];
  private totalMs = 0;
  private readonly maxSeconds: number;
  private readonly sampleRate: number;

  constructor(sampleRate: number, maxSeconds = 30) {
    this.sampleRate = sampleRate;
    this.maxSeconds = maxSeconds;
  }

  reset(): void {
    this.chunks = [];
    this.totalMs = 0;
  }

  /** Append one captured chunk; `endMs` is the epoch ms of its end. */
  push(samples: Float32Array, endMs: number): void {
    if (samples.length === 0) return;
    const durationMs = (samples.length / this.sampleRate) * 1000;
    this.chunks.push({ startMs: endMs - durationMs, samples: new Float32Array(samples) });
    this.totalMs += durationMs;
    while (this.totalMs > this.maxSeconds * 1000 && this.chunks.length > 1) {
      const dropped = this.chunks.shift();
      if (dropped) this.totalMs -= (dropped.samples.length / this.sampleRate) * 1000;
    }
  }

  /** The samples covering [startMs, endMs], or null if not held. */
  segment(startMs: number, endMs: number): Float32Array | null {
    if (this.chunks.length === 0 || endMs <= startMs) return null;
    const parts: Float32Array[] = [];
    for (const chunk of this.chunks) {
      const chunkEnd = chunk.startMs + (chunk.samples.length / this.sampleRate) * 1000;
      if (chunkEnd <= startMs || chunk.startMs >= endMs) continue;
      const from = Math.max(0, Math.round(((startMs - chunk.startMs) / 1000) * this.sampleRate));
      const to = Math.min(
        chunk.samples.length,
        Math.round(((endMs - chunk.startMs) / 1000) * this.sampleRate),
      );
      if (to > from) parts.push(chunk.samples.subarray(from, to));
    }
    if (parts.length === 0) return null;
    const total = parts.reduce((acc, p) => acc + p.length, 0);
    const out = new Float32Array(total);
    let offset = 0;
    for (const part of parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }
}

/* ------------------------------------------------------------------ */
/* The YAMNet engine                                                   */
/* ------------------------------------------------------------------ */

interface AudioClassifierLike {
  classify: (audioData: Float32Array, sampleRate?: number) => ClassifierResultLike[];
  close?: () => void;
}

export class YamnetClassifier {
  state: ClassifierState = "idle";
  private classifier: AudioClassifierLike | null = null;
  private loading: Promise<boolean> | null = null;

  /** Load model + wasm from the vendored bundle. Idempotent. */
  load(): Promise<boolean> {
    if (this.state === "ready") return Promise.resolve(true);
    if (this.loading) return this.loading;
    this.state = "loading";
    this.loading = (async () => {
      try {
        const { FilesetResolver, AudioClassifier } = await import("@mediapipe/tasks-audio");
        const fileset = await FilesetResolver.forAudioTasks(AUDIO_WASM_ROOT);
        this.classifier = (await AudioClassifier.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: YAMNET_MODEL_PATH },
          maxResults: 5,
        })) as unknown as AudioClassifierLike;
        this.state = "ready";
        return true;
      } catch {
        this.classifier = null;
        this.state = "failed";
        return false;
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  /**
   * Classify one event segment. Returns the best hit (threshold is
   * decideLabel's job) and the measured wall-clock cost, or null
   * when the engine is not ready or the segment is empty.
   */
  classifySegment(
    samples: Float32Array,
    sampleRate: number,
  ): { hit: ClassifierHit | null; ms: number } | null {
    if (this.state !== "ready" || !this.classifier || samples.length === 0) return null;
    const started = performance.now();
    const resampled = resampleToYamnet(samples, sampleRate);
    const capped =
      resampled.length > CLASSIFY_MAX_SECONDS * YAMNET_SAMPLE_RATE
        ? resampled.subarray(0, CLASSIFY_MAX_SECONDS * YAMNET_SAMPLE_RATE)
        : resampled;
    const results = this.classifier.classify(padToWindow(new Float32Array(capped)), YAMNET_SAMPLE_RATE);
    return { hit: bestClassifierHit(results), ms: performance.now() - started };
  }

  dispose(): void {
    try {
      this.classifier?.close?.();
    } catch {
      /* closing a wasm task is best-effort */
    }
    this.classifier = null;
    this.state = "idle";
  }
}
