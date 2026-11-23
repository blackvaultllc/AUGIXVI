/**
 * PULSE — the math behind Augie's pulse sense (operator order
 * 2026-11-21: "read heartbeats and frequencies in the area — detect a
 * human by their pulsation").
 *
 * Pure functions only — no DOM, no camera, no three.js — so every
 * number this module produces is unit-testable (see
 * src/test/pulse.test.ts). The window component feeds it real samples;
 * this module never invents a reading: too little data, a flat signal,
 * or a peak that does not stand out of the noise all come back as
 * "no reading" (bpm: null) or a low quality score, and the UI shows
 * UNAVAILABLE / SEARCHING instead of a made-up number. That is the
 * operator's truth rule, enforced in the math.
 *
 * Heart rate uses the POS method (Wang et al., "Algorithmic Principles
 * of Remote PPG", 2017) on the mean RGB of a face region of interest:
 * temporally normalize each channel, project onto the two POS axes
 * (G−B and G+B−2R), combine by their standard-deviation ratio, then
 * find the dominant frequency in the human heart band by FFT.
 */

export type RoiSample = { t: number; r: number; g: number; b: number };

export type PulseEstimate = {
  /** Beats per minute, or null when no honest reading exists. */
  bpm: number | null;
  /** 0..1 — how far the heart-band peak stands out of the noise. */
  quality: number;
  /** Detrended pulse waveform (normalized ~[-1, 1]) for the sparkline. */
  waveform: number[];
};

/** Human heart band for the peak search: 42–180 BPM. */
export const HEART_BAND_HZ = { min: 0.7, max: 3.0 } as const;
/** Minimum observation window before any reading is attempted. */
export const MIN_WINDOW_MS = 6_000;
/** Quality at/above which the UI may call the signal "good". */
export const GOOD_QUALITY = 0.6;
/** Quality at/above which the UI may show a number at all. */
export const WEAK_QUALITY = 0.35;
/**
 * Motion-artifact rejection (tightening round, 2026-11-23): a frame
 * whose motion EMA is at/above the "high" label is a frame where
 * movement swamps the skin-color signal. Samples taken in such frames
 * are discarded before estimation; if more than half the window had
 * to be discarded, there is no honest reading in what is left.
 */
export const MOTION_REJECT_LEVEL = 0.06;
export const MOTION_REJECT_MAX_FRACTION = 0.5;

function mean(values: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < values.length; i++) s += values[i]!;
  return values.length ? s / values.length : 0;
}

function std(values: ArrayLike<number>, m: number): number {
  let s = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i]! - m;
    s += d * d;
  }
  return values.length ? Math.sqrt(s / values.length) : 0;
}

/** Resample irregularly-timed RGB traces onto a uniform time grid. */
function resample(samples: RoiSample[]): { r: Float64Array; g: Float64Array; b: Float64Array; dt: number } | null {
  const n = samples.length;
  if (n < 8) return null;
  const t0 = samples[0]!.t;
  const t1 = samples[n - 1]!.t;
  const span = t1 - t0;
  if (span < MIN_WINDOW_MS) return null;
  const intervals: number[] = [];
  for (let i = 1; i < n; i++) intervals.push(samples[i]!.t - samples[i - 1]!.t);
  intervals.sort((a, b) => a - b);
  const dt = intervals[Math.floor(intervals.length / 2)] || 33;
  if (!(dt > 0) || dt > 250) return null; // slower than 4 fps cannot carry a pulse
  const count = Math.floor(span / dt) + 1;
  const r = new Float64Array(count);
  const g = new Float64Array(count);
  const b = new Float64Array(count);
  let j = 0;
  for (let i = 0; i < count; i++) {
    const t = t0 + i * dt;
    while (j < n - 2 && samples[j + 1]!.t < t) j++;
    const a = samples[j]!;
    const c = samples[j + 1]!;
    const f = c.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (c.t - a.t))) : 0;
    r[i] = a.r + (c.r - a.r) * f;
    g[i] = a.g + (c.g - a.g) * f;
    b[i] = a.b + (c.b - a.b) * f;
  }
  return { r, g, b, dt };
}

/** Iterative radix-2 FFT power spectrum of a real signal (zero-padded). */
function fftPower(signal: Float64Array, size: number): Float64Array {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  re.set(signal.subarray(0, Math.min(signal.length, size)));
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= size; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < size; i += len) {
      let cwr = 1;
      let cwi = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k]!;
        const ui = im[i + k]!;
        const vr = re[i + k + len / 2]! * cwr - im[i + k + len / 2]! * cwi;
        const vi = re[i + k + len / 2]! * cwi + im[i + k + len / 2]! * cwr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr;
        cwr = nwr;
      }
    }
  }
  const power = new Float64Array(size / 2);
  for (let k = 0; k < size / 2; k++) power[k] = re[k]! * re[k]! + im[k]! * im[k]!;
  return power;
}

/** Iterative radix-2 complex FFT (forward or inverse), in place. */
function fftComplex(re: Float64Array, im: Float64Array, invert: boolean): void {
  const size = re.length;
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= size; len <<= 1) {
    const ang = ((invert ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < size; i += len) {
      let cwr = 1;
      let cwi = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k]!;
        const ui = im[i + k]!;
        const vr = re[i + k + len / 2]! * cwr - im[i + k + len / 2]! * cwi;
        const vi = re[i + k + len / 2]! * cwi + im[i + k + len / 2]! * cwr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr;
        cwr = nwr;
      }
    }
  }
  if (invert) {
    for (let i = 0; i < size; i++) {
      re[i] = re[i]! / size;
      im[i] = im[i]! / size;
    }
  }
}

/**
 * Zero-phase bandpass around the heart band: FFT the signal, keep
 * only bins inside HEART_BAND_HZ, inverse-FFT back. Everything the
 * pulse is not — slow illumination drift below the band, jitter and
 * compression noise above it — is removed before the peak search,
 * which is what the serious implementations (and watch firmware, at
 * its own scale) do before trusting a number.
 */
function bandpassHeartBand(signal: Float64Array, dt: number): Float64Array {
  const n = signal.length;
  let size = 1;
  while (size < n) size <<= 1;
  size = Math.min(size, 16384);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  re.set(signal.subarray(0, Math.min(n, size)));
  fftComplex(re, im, false);
  const fs = 1000 / dt;
  for (let k = 0; k < size; k++) {
    const freq = k <= size / 2 ? (k * fs) / size : ((k - size) * fs) / size;
    if (Math.abs(freq) < HEART_BAND_HZ.min || Math.abs(freq) > HEART_BAND_HZ.max) {
      re[k] = 0;
      im[k] = 0;
    }
  }
  fftComplex(re, im, true);
  return re.slice(0, n);
}

/**
 * Peak search inside the heart band on a (Hann-windowed, zero-padded)
 * power spectrum. Returns the interpolated BPM and the SNR quality
 * (0..1), or null when no peak stands in the band.
 */
function bandPeak(
  signal: Float64Array,
  dt: number,
): { bpm: number; quality: number } | null {
  const n = signal.length;
  const windowed = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    windowed[i] = signal[i]! * w;
  }
  let size = 1;
  while (size < n * 4) size <<= 1;
  size = Math.min(size, 16384);
  const power = fftPower(windowed, size);
  const fs = 1000 / dt;
  const binHz = fs / size;
  const kMin = Math.max(1, Math.ceil(HEART_BAND_HZ.min / binHz));
  const kMax = Math.min(power.length - 2, Math.floor(HEART_BAND_HZ.max / binHz));
  if (kMax <= kMin) return null;
  let kPeak = -1;
  let pPeak = 0;
  const band: number[] = [];
  for (let k = kMin; k <= kMax; k++) {
    band.push(power[k]!);
    if (power[k]! > pPeak) {
      pPeak = power[k]!;
      kPeak = k;
    }
  }
  if (kPeak < 0 || pPeak <= 0) return null;
  band.sort((a, b2) => a - b2);
  const noise = band[Math.floor(band.length / 2)]! + 1e-12;
  const snr = pPeak / noise;
  const quality = Math.min(1, Math.max(0, (snr - 2) / 18));
  const lp = (k: number) => Math.log(power[k]! + 1e-12);
  const denom = lp(kPeak - 1) - 2 * lp(kPeak) + lp(kPeak + 1);
  const shift = denom !== 0 ? 0.5 * (lp(kPeak - 1) - lp(kPeak + 1)) / denom : 0;
  const hz = (kPeak + Math.max(-0.5, Math.min(0.5, shift))) * binHz;
  return { bpm: hz * 60, quality };
}

/** POS projection of one ROI's resampled traces — the pulse signal. */
function posSignal(grid: { r: Float64Array; g: Float64Array; b: Float64Array }): Float64Array | null {
  const { r, g, b } = grid;
  const n = g.length;
  const mr = mean(r);
  const mg = mean(g);
  const mb = mean(b);
  if (mr <= 0 || mg <= 0 || mb <= 0) return null;
  const s1 = new Float64Array(n);
  const s2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const rn = r[i]! / mr;
    const gn = g[i]! / mg;
    const bn = b[i]! / mb;
    s1[i] = gn - bn;
    s2[i] = gn + bn - 2 * rn;
  }
  const sd1 = std(s1, mean(s1));
  const sd2 = std(s2, mean(s2));
  const h = new Float64Array(n);
  const alpha = sd2 > 1e-9 ? sd1 / sd2 : 0;
  for (let i = 0; i < n; i++) h[i] = s1[i]! + alpha * s2[i]!;
  return detrend(h);
}

function detrend(values: Float64Array): Float64Array {
  const n = values.length;
  const out = new Float64Array(n);
  if (n < 2) return out;
  // Least-squares straight line, subtracted.
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += values[i]!;
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - mx) * (values[i]! - my);
    den += (i - mx) * (i - mx);
  }
  const slope = den > 0 ? num / den : 0;
  const intercept = my - slope * mx;
  for (let i = 0; i < n; i++) out[i] = values[i]! - (slope * i + intercept);
  return out;
}

/** One motion reading, timestamp-aligned with the ROI samples. */
export type MotionSample = { t: number; m: number };

export type EstimateOptions = {
  /** Frame-motion readings over the same window (motion rejection). */
  motion?: readonly MotionSample[];
};

/** Drop samples taken while motion swamped the signal. */
function rejectMotionSamples(
  samples: RoiSample[],
  motion: readonly MotionSample[],
): { kept: RoiSample[]; rejectedFraction: number } {
  if (!motion.length || !samples.length) return { kept: samples, rejectedFraction: 0 };
  let j = 0;
  let rejected = 0;
  const kept: RoiSample[] = [];
  for (const s of samples) {
    while (j < motion.length - 1 && motion[j + 1]!.t <= s.t) j++;
    const near = motion[j]!;
    const m = Math.abs(near.t - s.t) <= 150 ? near.m : 0;
    if (m >= MOTION_REJECT_LEVEL) rejected++;
    else kept.push(s);
  }
  return { kept, rejectedFraction: rejected / samples.length };
}

/**
 * Estimate heart rate from one or more face-ROI color traces
 * (tightening round, 2026-11-23 — the watch-firmware discipline,
 * adapted to a phone camera):
 *
 *   MULTI-ROI — each region of interest (forehead, both cheeks) gets
 *   its own POS projection; the projections are combined weighted by
 *   their own measured quality, sign-aligned first, so one bad patch
 *   of skin cannot drag the reading and three patches average the
 *   sensor noise down.
 *   BANDPASS — every projection is filtered to the heart band before
 *   the peak search (see bandpassHeartBand).
 *   MOTION REJECTION — samples from frames where motion swamped the
 *   signal are discarded; a window that is mostly discarded earns no
 *   reading at all.
 *
 * Returns bpm: null when the window is too short, the signal is
 * flat, or nothing in the heart band rises above the noise — never
 * a guess.
 */
export function estimatePulseFromRois(
  rois: readonly RoiSample[][],
  options: EstimateOptions = {},
): PulseEstimate {
  const empty: PulseEstimate = { bpm: null, quality: 0, waveform: [] };
  const motion = options.motion ?? [];
  const parts: { signal: Float64Array; dt: number; quality: number }[] = [];
  for (const samples of rois) {
    if (!samples.length) continue;
    const { kept, rejectedFraction } = rejectMotionSamples(samples, motion);
    if (rejectedFraction > MOTION_REJECT_MAX_FRACTION) continue;
    const grid = resample(kept);
    if (!grid) continue;
    const raw = posSignal(grid);
    if (!raw) continue;
    if (std(raw, 0) < 1e-7) continue; // flat — nothing beating here
    const signal = bandpassHeartBand(raw, grid.dt);
    const peak = bandPeak(signal, grid.dt);
    parts.push({ signal, dt: grid.dt, quality: peak ? peak.quality : 0 });
  }
  if (!parts.length) return empty;

  // Combine: the strongest ROI is the phase reference; every other
  // projection is sign-aligned to it, then quality-weighted in.
  const n = Math.min(...parts.map((p) => p.signal.length));
  if (n < 8) return empty;
  const ref = parts.reduce((a, b) => (b.quality > a.quality ? b : a));
  const combined = new Float64Array(n);
  let weightSum = 0;
  for (const part of parts) {
    let corr = 0;
    for (let i = 0; i < n; i++) corr += part.signal[i]! * ref.signal[i]!;
    const sign = corr < 0 ? -1 : 1;
    const w = 0.15 + part.quality;
    weightSum += w;
    for (let i = 0; i < n; i++) combined[i] = combined[i]! + sign * w * part.signal[i]!;
  }
  if (weightSum <= 0 || std(combined, 0) < 1e-9) return empty;
  for (let i = 0; i < n; i++) combined[i] = combined[i]! / weightSum;

  const peak = bandPeak(combined, ref.dt);
  if (!peak) return empty;

  // Sparkline: the combined pulse, normalized, last ~8 seconds.
  const fs = 1000 / ref.dt;
  const maxAbs = Math.max(...Array.from(combined, (v) => Math.abs(v)));
  const tail = Math.min(combined.length, Math.round(8 * fs));
  const waveform: number[] = [];
  for (let i = combined.length - tail; i < combined.length; i++) {
    waveform.push(maxAbs > 0 ? combined[i]! / maxAbs : 0);
  }
  return { bpm: Math.round(peak.bpm * 10) / 10, quality: peak.quality, waveform };
}

/** Single-ROI convenience — the original estimator's call shape. */
export function estimatePulse(samples: RoiSample[]): PulseEstimate {
  return estimatePulseFromRois([samples]);
}

export type TimedReading = { bpm: number; quality: number; at: number };

/**
 * STABILIZATION (tightening round): a number is only SHOWN once
 * recent estimates agree with each other — at least 3 readings inside
 * the last 6 seconds within ±4 BPM of their median, each clearing the
 * weak-quality bar. Until then the UI stays SEARCHING: a single lucky
 * frame is not a heart rate, and a number that jumps around is worse
 * than no number. Returns the agreed (median) BPM and the mean
 * quality of the agreeing readings, or null.
 */
export function stabilizeReading(
  history: readonly TimedReading[],
  now: number,
): { bpm: number; quality: number } | null {
  const recent = history.filter((h) => now - h.at <= 6_000 && h.quality >= WEAK_QUALITY);
  if (recent.length < 3) return null;
  const sorted = [...recent].sort((a, b) => a.bpm - b.bpm);
  const median = sorted[Math.floor(sorted.length / 2)]!.bpm;
  const agreeing = recent.filter((h) => Math.abs(h.bpm - median) <= 4);
  if (agreeing.length < 3) return null;
  const quality = agreeing.reduce((s, h) => s + h.quality, 0) / agreeing.length;
  return { bpm: Math.round(median), quality };
}

/**
 * Dominant frequency in an analyser's byte frequency data. Returns
 * null when nothing rises above the floor (a quiet room has no honest
 * dominant frequency). Strength is 0..1 relative to full scale.
 */
export function dominantFrequency(
  data: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
  minMagnitude = 32,
): { hz: number; strength: number } | null {
  if (data.length < 4 || fftSize <= 0 || sampleRate <= 0) return null;
  let kPeak = -1;
  let vPeak = 0;
  for (let k = 2; k < data.length; k++) {
    if (data[k]! > vPeak) {
      vPeak = data[k]!;
      kPeak = k;
    }
  }
  if (kPeak < 0 || vPeak < minMagnitude) return null;
  const binHz = sampleRate / fftSize;
  let hz = kPeak * binHz;
  // Parabolic interpolation on magnitude for a finer readout.
  const a = data[kPeak - 1] ?? 0;
  const c = data[kPeak + 1] ?? 0;
  const denom = a - 2 * vPeak + c;
  if (denom !== 0) {
    const shift = 0.5 * (a - c) / denom;
    hz = (kPeak + Math.max(-0.5, Math.min(0.5, shift))) * binHz;
  }
  return { hz: Math.round(hz), strength: vPeak / 255 };
}

/** Mean absolute difference between two same-size grayscale frames, 0..1. */
export function frameMotion(prev: ArrayLike<number>, curr: ArrayLike<number>): number {
  const n = Math.min(prev.length, curr.length);
  if (n === 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs(curr[i]! - prev[i]!);
  return s / n / 255;
}

export type MotionLabel = "still" | "low" | "moderate" | "high";

export function motionLabel(motion: number): MotionLabel {
  if (motion < 0.004) return "still";
  if (motion < 0.02) return "low";
  if (motion < 0.06) return "moderate";
  return "high";
}

export type PulseReadout =
  | { state: "reading"; bpm: number; quality: number }
  | { state: "searching"; quality?: number }
  | { state: "unavailable"; reason: string };

/** The one-line session summary under the panes — what Augie can say. */
export function pulseSummary(input: {
  presence: boolean | null;
  motion: MotionLabel | null;
  pulse: PulseReadout;
}): string {
  const presence =
    input.presence === null ? "Presence: —" : `Presence: ${input.presence ? "yes" : "no"}`;
  const motion = input.motion === null ? "Motion: —" : `Motion: ${input.motion}`;
  let pulse: string;
  if (input.pulse.state === "reading") {
    const signal = input.pulse.quality >= GOOD_QUALITY ? "good signal" : "weak signal";
    pulse = `Pulse: ${Math.round(input.pulse.bpm)} BPM (estimate, ${signal})`;
  } else if (input.pulse.state === "searching") {
    pulse =
      input.pulse.quality !== undefined
        ? `Pulse: searching… (signal quality ${Math.round(input.pulse.quality * 100)}%)`
        : "Pulse: searching…";
  } else {
    pulse = `Pulse: unavailable — ${input.pulse.reason}`;
  }
  return `${presence} · ${motion} · ${pulse}`;
}
