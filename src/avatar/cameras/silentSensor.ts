/**
 * MONTU SILENT SENSOR — the pure core (owner orders 2026-11-26,
 * voice call ~13:45 CST: "the motion detectors don't have any
 * way to communicate… I can test out the IEM system to see when
 * it picks up that specific level of sound so that way the
 * camera outside when it hears it, it can articulate that with
 * the value of the alarm in the back of the building" — and:
 * "name it the War God name, with silent sensor after his
 * name").
 *
 * The PIR motion sensors at the back of the property cannot
 * talk to anything. Their SIREN can be heard. So the sound
 * becomes the signal: a hearing-armed outside camera's ear
 * catches the siren, the hearing pipeline (cameraPresence
 * runtime) matches it against the profile the Captain enrolled
 * under this name, and the match — confirmed by a SECOND
 * hearing, the Second Look this house applies to everything —
 * is logged by Sector Watch as a back motion sensor tripping,
 * cross-examined against what the camera sees, and carried to
 * the Captain through the notifications path.
 *
 * THE DOCTRINE, same as Sound Watch's (he names it, it is
 * kept; unknowns stay UNCLASSIFIED):
 *   · There is exactly ONE profile, and its name is fixed:
 *     "Montu Silent Sensor". It exists only because the
 *     Captain ran his test, heard the candidate the system
 *     kept, and said "that was the siren — learn it."
 *   · An unmatched loud sound is never called the siren. It
 *     is kept as a CANDIDATE (fingerprint + level + which
 *     camera heard it) for him to judge — nothing more.
 *   · A first match is a DRAFT. Only a second match at the
 *     same camera inside the confirm window makes a trip.
 *
 * THE HONESTY BOUND (in the code and in every UI surface):
 * a camera microphone is NOT a calibrated sound-level meter.
 * What the system records is the level AS THAT CAMERA HEARD
 * IT — a relative level in the camera's own scale (dBFS).
 * The reference table below is published knowledge (typical
 * dB SPL ranges near the sound) used to INTERPRET what a
 * camera hears; it is never a measurement, and nothing in
 * this module converts a camera's dBFS into a dB SPL claim.
 * There is deliberately no such function here.
 *
 * Plain TS, no I/O — the runtime listens, this module decides.
 */
import {
  FINGERPRINT_DIM,
  LIBRARY_MATCH_THRESHOLD,
  cosineSimilarity,
  type DetectedSound,
  type DetectorFrame,
  computeFeatures,
  fingerprintOf,
} from "../soundWatch";

/** The one name this profile ever carries — the War God's. */
export const SILENT_SENSOR_NAME = "Montu Silent Sensor";

/** Watch-log id prefix for a confirmed trip — the inbox derivation keys on it. */
export const SILENT_SENSOR_TRIP_ID_PREFIX = "silent-trip-";
/** Watch-log id prefix for a first (unconfirmed) hearing. */
export const SILENT_SENSOR_DRAFT_ID_PREFIX = "silent-draft-";

/**
 * The honesty bound, word for word, shown wherever this
 * feature speaks: in the Cameras window card and the manual.
 */
export const SILENT_SENSOR_HONESTY_NOTE =
  "A camera microphone is not a calibrated sound-level meter. The levels kept here are the level as that camera heard it, in the camera's own scale (dBFS) — never a true sound-pressure (dB SPL) measurement. The reference table is published knowledge — typical ranges near the sound — used to interpret what a camera hears. It is not a reading from any camera, and no camera reading is ever converted into a dB SPL claim.";

/* ------------------------------------------------------------------ */
/* The reference table — the system's seeded sound-level knowledge     */
/* ------------------------------------------------------------------ */

export interface SoundLevelReference {
  id: string;
  /** The class of sound, in plain words. */
  label: string;
  /** Typical published range, dB SPL near the sound. Knowledge, not a reading. */
  lowDb: number;
  highDb: number;
  /** Where the range stands: distance/setup the published values assume. */
  note: string;
}

/** What the table IS — printed above it wherever it is shown. */
export const SOUND_LEVEL_REFERENCE_BASIS =
  "Reference knowledge: typical published sound levels (dB SPL), measured near the sound in the sources' own setups. This table teaches the system what loud means in the world. It is not measured by any camera, and a camera's own level is never read off it as a fact.";

/**
 * The seeded table (the Captain's order, 2026-11-26: "add any
 * default calculation dB level of alarm sound so that way the
 * system already has the knowledge of understanding the dB
 * levels of the sounds of alarms, to humans talking, to maybe
 * screaming… everything we can add to it"). Standard published
 * reference ranges, labeled as what they are.
 */
export const SOUND_LEVEL_REFERENCE: SoundLevelReference[] = [
  {
    id: "alarm-siren",
    label: "Alarm siren — smoke alarm, burglar alarm, motion-sensor siren",
    lowDb: 85,
    highDb: 110,
    note: "A smoke alarm is rated 85 dB at 3 m; sirens close up run louder. The loudest class a house normally makes.",
  },
  {
    id: "glass-breaking",
    label: "Glass breaking",
    lowDb: 90,
    highDb: 105,
    note: "A sharp burst, loud for a second or two, then gone.",
  },
  {
    id: "screaming",
    label: "Screaming or shouting",
    lowDb: 80,
    highDb: 100,
    note: "A shout is around 80–90 dB at 1 m; a full scream can pass 100 dB close up.",
  },
  {
    id: "dog-barking",
    label: "Dog barking",
    lowDb: 80,
    highDb: 95,
    note: "Measured a few metres from the dog; bigger dogs sit lower in pitch, not lower in level.",
  },
  {
    id: "raised-voice",
    label: "Raised voice — an argument",
    lowDb: 70,
    highDb: 85,
    note: "Well above conversation, below a shout.",
  },
  {
    id: "doorbell",
    label: "Doorbell or chime",
    lowDb: 70,
    highDb: 80,
    note: "A short, tonal sound, made to be heard through a house.",
  },
  {
    id: "conversation",
    label: "Normal conversation",
    lowDb: 55,
    highDb: 65,
    note: "The standard reference: ordinary speech at about 1 m sits near 60 dB.",
  },
  {
    id: "television",
    label: "Television at a normal volume",
    lowDb: 60,
    highDb: 70,
    note: "From the seat watching it.",
  },
  {
    id: "whisper",
    label: "Whisper",
    lowDb: 25,
    highDb: 35,
    note: "At about 1 m — near the bottom of what a room's ear can pick out.",
  },
  {
    id: "quiet-room",
    label: "A quiet room at night",
    lowDb: 25,
    highDb: 35,
    note: "The floor most indoor sounds rise from.",
  },
];

/** One table row as a plain line — the shape the UI lists. */
export function soundLevelReferenceLine(row: SoundLevelReference): string {
  return `${row.label}: typically ${row.lowDb}–${row.highDb} dB (reference range, near the sound). ${row.note}`;
}

/* ------------------------------------------------------------------ */
/* The profile + the candidate — what the core record keeps            */
/* ------------------------------------------------------------------ */

/**
 * The enrolled siren: the fingerprint of the sound the
 * Captain confirmed, which camera taught it, and the level
 * as THAT camera heard it (dBFS — its own scale, see the
 * honesty bound). Numbers only — no audio is ever kept.
 */
export interface SilentSensorProfile {
  fingerprint: number[];
  enrolledAt: number;
  cameraId: string;
  cameraName: string;
  /** Peak level of the teaching sound, dBFS as the teaching camera heard it. */
  peakDbfs: number;
}

/**
 * A loud sound a camera heard that matched nothing — kept
 * for the Captain's judgment. If it was his siren test, he
 * enrolls it and it becomes the profile. Until then it is
 * a candidate and is called nothing.
 */
export interface SilentSensorCandidate {
  fingerprint: number[];
  at: number;
  cameraId: string;
  cameraName: string;
  /** Peak level, dBFS as that camera heard it. */
  peakDbfs: number;
  durationMs: number;
}

export interface SilentSensorState {
  profile: SilentSensorProfile | null;
  candidate: SilentSensorCandidate | null;
  /** When the last confirmed trip fired (the cooldown stands on it). */
  lastTripAt: number | null;
}

export function emptySilentSensorState(): SilentSensorState {
  return { profile: null, candidate: null, lastTripAt: null };
}

/* ------------------------------ sanitizers ------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function cleanString(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function cleanTime(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

function cleanDbfs(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= -100 && v <= 0 ? v : null;
}

function isFingerprint(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === FINGERPRINT_DIM &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function sanitizeSilentSensorProfile(v: unknown): SilentSensorProfile | null {
  if (!isRecord(v)) return null;
  const cameraId = cleanString(v["cameraId"], 64);
  const enrolledAt = cleanTime(v["enrolledAt"]);
  const peakDbfs = cleanDbfs(v["peakDbfs"]);
  if (!isFingerprint(v["fingerprint"]) || !cameraId || enrolledAt === null || peakDbfs === null) {
    return null;
  }
  return {
    fingerprint: [...v["fingerprint"]],
    enrolledAt,
    cameraId,
    cameraName: cleanString(v["cameraName"], 80) ?? "Camera",
    peakDbfs,
  };
}

export function sanitizeSilentSensorCandidate(v: unknown): SilentSensorCandidate | null {
  if (!isRecord(v)) return null;
  const cameraId = cleanString(v["cameraId"], 64);
  const at = cleanTime(v["at"]);
  const peakDbfs = cleanDbfs(v["peakDbfs"]);
  if (!isFingerprint(v["fingerprint"]) || !cameraId || at === null || peakDbfs === null) {
    return null;
  }
  return {
    fingerprint: [...v["fingerprint"]],
    at,
    cameraId,
    cameraName: cleanString(v["cameraName"], 80) ?? "Camera",
    peakDbfs,
    durationMs:
      typeof v["durationMs"] === "number" && Number.isFinite(v["durationMs"]) && v["durationMs"] >= 0
        ? v["durationMs"]
        : 0,
  };
}

export function sanitizeSilentSensorState(v: unknown): SilentSensorState {
  if (!isRecord(v)) return emptySilentSensorState();
  return {
    profile: sanitizeSilentSensorProfile(v["profile"]),
    candidate: sanitizeSilentSensorCandidate(v["candidate"]),
    lastTripAt: cleanTime(v["lastTripAt"]),
  };
}

/* ------------------------------------------------------------------ */
/* Matching + the candidate call                                       */
/* ------------------------------------------------------------------ */

/**
 * How a candidate earns its place: LOUD as the camera heard
 * it and SUSTAINED — a siren wails; a door slam does not.
 * Anything quieter or shorter is an ordinary sound event and
 * is none of this feature's business.
 */
export const SILENT_SENSOR_CANDIDATE_MIN_PEAK_DBFS = -30;
export const SILENT_SENSOR_CANDIDATE_MIN_DURATION_MS = 500;

export function isSilentSensorCandidateSound(sound: DetectedSound): boolean {
  return (
    sound.peakDb >= SILENT_SENSOR_CANDIDATE_MIN_PEAK_DBFS &&
    sound.durationMs >= SILENT_SENSOR_CANDIDATE_MIN_DURATION_MS
  );
}

/** The candidate a detected sound becomes, under the camera that heard it. */
export function candidateFromSound(
  sound: DetectedSound,
  cameraId: string,
  cameraName: string,
): SilentSensorCandidate {
  return {
    fingerprint: [...sound.fingerprint],
    at: sound.at,
    cameraId,
    cameraName,
    peakDbfs: sound.peakDb,
    durationMs: sound.durationMs,
  };
}

/** He says "that was the siren" → the candidate becomes the profile. */
export function enrollProfileFromCandidate(
  candidate: SilentSensorCandidate,
  enrolledAt: number,
): SilentSensorProfile {
  return {
    fingerprint: [...candidate.fingerprint],
    enrolledAt,
    cameraId: candidate.cameraId,
    cameraName: candidate.cameraName,
    peakDbfs: candidate.peakDbfs,
  };
}

/**
 * The similarity of a heard sound to the enrolled siren, or
 * null when there is no profile — no profile, no match claim,
 * ever. The match line is Sound Watch's own library line.
 */
export function silentSensorSimilarity(
  fingerprint: number[],
  profile: SilentSensorProfile | null,
): number | null {
  if (!profile) return null;
  return cosineSimilarity(fingerprint, profile.fingerprint);
}

export function isSilentSensorMatch(similarity: number | null): boolean {
  return similarity !== null && similarity >= LIBRARY_MATCH_THRESHOLD;
}

/* ------------------------------------------------------------------ */
/* The Second Look for a sound — first hearing, then the trip          */
/* ------------------------------------------------------------------ */

/** A second matching hearing inside this window confirms the first. */
export const SILENT_SENSOR_CONFIRM_WINDOW_MS = 120_000;
/** After a trip, this long passes before another trip can fire. */
export const SILENT_SENSOR_TRIP_COOLDOWN_MS = 10 * 60_000;

export interface SilentSensorPending {
  cameraId: string;
  at: number;
}

export type SilentSensorMatchOutcome =
  /** First match: a draft. The pending hearing now stands. */
  | { outcome: "first-hearing"; pending: SilentSensorPending }
  /** Second match inside the window: the trip is confirmed. */
  | { outcome: "trip"; pending: null }
  /** A trip already fired inside the cooldown: noted, not re-raised. */
  | { outcome: "cooldown"; pending: null };

/**
 * Decide what one MATCHING hearing means, standing on the
 * pending first hearing and the last trip. Pure: the runtime
 * keeps the pending in memory and lastTripAt on the record.
 */
export function silentSensorOnMatch(input: {
  pending: SilentSensorPending | null;
  lastTripAt: number | null;
  cameraId: string;
  now: number;
}): SilentSensorMatchOutcome {
  const { pending, lastTripAt, cameraId, now } = input;
  if (lastTripAt !== null && now - lastTripAt < SILENT_SENSOR_TRIP_COOLDOWN_MS) {
    return { outcome: "cooldown", pending: null };
  }
  if (
    pending &&
    pending.cameraId === cameraId &&
    now - pending.at <= SILENT_SENSOR_CONFIRM_WINDOW_MS
  ) {
    return { outcome: "trip", pending: null };
  }
  return { outcome: "first-hearing", pending: { cameraId, at: now } };
}

/* ------------------------------------------------------------------ */
/* The words — every line names its camera and keeps the bound         */
/* ------------------------------------------------------------------ */

/**
 * A level as a camera heard it, in words that cannot be
 * misread as a calibrated measurement: the number is dBFS,
 * the camera's own scale, and the sentence says so.
 */
export function heardLevelText(peakDbfs: number): string {
  return `peak ${Math.round(peakDbfs)} dBFS — the level as that camera heard it, in the camera's own scale (not a calibrated dB SPL measurement)`;
}

/** FIRST HEARING (a draft, logged as one — never a trip). */
export function silentSensorDraftText(cameraName: string, peakDbfs: number): string {
  return `${cameraName}: a sound matched the ${SILENT_SENSOR_NAME} profile — a FIRST hearing, logged as a draft. If the siren keeps sounding and matches again, the second hearing confirms it as a trip. (${heardLevelText(peakDbfs)}.)`;
}

/** THE TRIP — what Sector Watch logs when the second hearing confirms. */
export function silentSensorTripText(cameraName: string, peakDbfs: number): string {
  return `${SILENT_SENSOR_NAME}: ${cameraName} heard the sound enrolled as the back motion sensors' siren, and heard it again — two hearings, so it stands confirmed: a back motion sensor has tripped. Heard by ${cameraName}; no other camera is claimed to have heard it. (${heardLevelText(peakDbfs)}.)`;
}

/** The sound tool's cross-examination reading for a trip. */
export function silentSensorSoundReading(cameraName: string, peakDbfs: number): string {
  return `${cameraName}'s ear matched the enrolled ${SILENT_SENSOR_NAME} siren profile twice inside the confirm window (${heardLevelText(peakDbfs)}) — the sound is a library match to the Captain's own enrolled siren, not a guess`;
}

/* ------------------------------------------------------------------ */
/* From raw samples to detector frames — the measured-features road    */
/*                                                                     */
/* The same road Sound Watch walks in the window (computeFeatures →   */
/* fingerprint → SoundEventDetector), fed from a camera chunk's PCM   */
/* samples on the core. A small radix-2 FFT stands in for the         */
/* analyser node; fingerprints are self-consistent within this road,  */
/* and enrollment and matching both walk it, so a profile always      */
/* meets the same kind of fingerprint it was taught from.             */
/* ------------------------------------------------------------------ */

export const SILENT_SENSOR_FFT_SIZE = 1024;

/** Iterative radix-2 FFT magnitude spectrum (first half), pure. */
export function fftMagnitudes(samples: ArrayLike<number>): Float32Array {
  const n = SILENT_SENSOR_FFT_SIZE;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  // Bit-reversed copy, Hann-windowed.
  let j = 0;
  for (let i = 0; i < n; i++) {
    const idx = i < samples.length ? i : 0;
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    re[j] = (samples[idx] ?? 0) * hann;
    let m = n >> 1;
    while (m >= 1 && (j & m) !== 0) {
      j &= ~m;
      m >>= 1;
    }
    j |= m;
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const angle = (-2 * Math.PI) / size;
    for (let base = 0; base < n; base += size) {
      for (let k = 0; k < half; k++) {
        const wr = Math.cos(angle * k);
        const wi = Math.sin(angle * k);
        const a = base + k;
        const b = a + half;
        const xr = re[b]! * wr - im[b]! * wi;
        const xi = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
      }
    }
  }
  const out = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    out[i] = Math.sqrt(re[i]! * re[i]! + im[i]! * im[i]!) / (n / 2);
  }
  return out;
}

/**
 * Slice PCM samples into detector frames on the window's own
 * cadence (~100 ms hop): measured features + fingerprint per
 * frame, timestamps laid back from the chunk's end. Pure.
 */
export function soundFramesFromSamples(
  samples: Float32Array,
  sampleRate: number,
  endAtMs: number,
): DetectorFrame[] {
  if (samples.length < SILENT_SENSOR_FFT_SIZE || sampleRate <= 0) return [];
  const hop = Math.max(1, Math.round(sampleRate / 10));
  const totalMs = (samples.length / sampleRate) * 1000;
  const startMs = endAtMs - totalMs;
  const frames: DetectorFrame[] = [];
  for (let offset = 0; offset + SILENT_SENSOR_FFT_SIZE <= samples.length; offset += hop) {
    const slice = samples.subarray(offset, offset + SILENT_SENSOR_FFT_SIZE);
    const mags = fftMagnitudes(slice);
    const freqDb = new Float32Array(mags.length);
    for (let i = 0; i < mags.length; i++) {
      const mag = mags[i] ?? 0;
      freqDb[i] = mag > 0 ? Math.max(-100, Math.min(0, 20 * Math.log10(mag))) : -100;
    }
    const features = computeFeatures(slice, freqDb, sampleRate);
    frames.push({
      t: Math.round(startMs + (offset / sampleRate) * 1000),
      dbfs: features.dbfs,
      fingerprint: fingerprintOf(features),
      dominantHz: features.dominantHz,
    });
  }
  return frames;
}
