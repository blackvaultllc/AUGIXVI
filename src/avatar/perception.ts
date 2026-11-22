/**
 * PERCEPTION CUES (Part 25, operator order 2026-11-21) — PURE module.
 *
 * Reads CUES from the signals Pulse already senses — face landmark
 * geometry and the microphone stream — and phrases them as cues:
 * "cues suggest: …". Hard rules, in the design and here:
 *
 * - Cues are NOT conclusions. A wide mouth is "smile-like", never
 *   "he is happy". Nothing here reads a mind.
 * - Expression is NOT identity. No recognition, no identification,
 *   no templates — geometry ratios only, computed live and dropped.
 * - Nothing is stored. The caller renders the sentence for the live
 *   moment and keeps no history of it.
 *
 * Landmark indices are the standard MediaPipe 468-point face mesh.
 */

export type LandmarkPoint = { x: number; y: number };

function dist(a: LandmarkPoint, b: LandmarkPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function at(landmarks: readonly LandmarkPoint[], i: number): LandmarkPoint {
  return landmarks[i] ?? { x: 0, y: 0 };
}

/** Eye aspect ratio: vertical opening over horizontal width. */
function eyeAspectRatio(landmarks: readonly LandmarkPoint[], idx: number[]): number {
  const [cornerA, cornerB, topA, bottomA, topB, bottomB] = idx.map((i) => at(landmarks, i!));
  const width = dist(cornerA!, cornerB!);
  if (width === 0) return 0;
  return (dist(topA!, bottomA!) + dist(topB!, bottomB!)) / (2 * width);
}

const RIGHT_EYE = [33, 133, 159, 145, 158, 153];
const LEFT_EYE = [362, 263, 386, 374, 385, 380];

/** Expression cues from one frame's landmarks. Empty when unsure. */
export function expressionCues(landmarks: readonly LandmarkPoint[]): string[] {
  if (landmarks.length < 300) return [];
  const faceW = dist(at(landmarks, 234), at(landmarks, 454));
  const faceH = dist(at(landmarks, 10), at(landmarks, 152));
  if (faceW === 0 || faceH === 0) return [];
  const cues: string[] = [];

  const mouthRatio = dist(at(landmarks, 61), at(landmarks, 291)) / faceW;
  if (mouthRatio > 0.42) cues.push("mouth wide — smile-like");
  else if (mouthRatio < 0.29) cues.push("mouth narrow");
  const mouthOpen = dist(at(landmarks, 13), at(landmarks, 14)) / faceH;
  if (mouthOpen > 0.055) cues.push("mouth open");

  const ear = (eyeAspectRatio(landmarks, RIGHT_EYE) + eyeAspectRatio(landmarks, LEFT_EYE)) / 2;
  if (ear > 0.21) cues.push("eyes open");
  else if (ear < 0.13) cues.push("eyes nearly closed");

  const browGap = dist(at(landmarks, 55), at(landmarks, 285)) / faceW;
  const browToEye =
    (dist(at(landmarks, 55), at(landmarks, 159)) + dist(at(landmarks, 285), at(landmarks, 386))) /
    2 /
    faceH;
  if (browGap < 0.155 && browToEye < 0.085) cues.push("brows drawn together — tension-like");
  else if (browToEye > 0.135) cues.push("brows raised");

  return cues;
}

export type VoiceCues = { pitchHz: number | null; energy: number; cues: string[] };

/** Fundamental-frequency estimate by autocorrelation (human range). */
export function estimatePitch(samples: Float32Array, sampleRate: number): number | null {
  const minPeriod = Math.floor(sampleRate / 400);
  const maxPeriod = Math.floor(sampleRate / 70);
  let bestPeriod = -1;
  let bestCorr = 0;
  for (let period = minPeriod; period <= maxPeriod && period < samples.length / 2; period++) {
    let corr = 0;
    for (let i = 0; i < samples.length - period; i++) {
      corr += samples[i]! * samples[i + period]!;
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestPeriod = period;
    }
  }
  if (bestPeriod <= 0) return null;
  return Math.round(sampleRate / bestPeriod);
}

/** Voice cues from one time-domain buffer. Quiet room = no cues. */
export function voiceCues(samples: Float32Array, sampleRate: number): VoiceCues {
  if (samples.length === 0) return { pitchHz: null, energy: 0, cues: [] };
  let sum = 0;
  let crossings = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i]! * samples[i]!;
    if (i > 0 && (samples[i]! >= 0) !== (samples[i - 1]! >= 0)) crossings++;
  }
  const energy = Math.sqrt(sum / samples.length);
  if (energy < 0.01) return { pitchHz: null, energy, cues: [] };
  const pitchHz = estimatePitch(samples, sampleRate);
  const cues: string[] = [];
  if (pitchHz !== null) {
    if (pitchHz < 110) cues.push(`voice low (~${pitchHz} Hz)`);
    else if (pitchHz > 200) cues.push(`voice high (~${pitchHz} Hz)`);
    else cues.push(`voice mid-range (~${pitchHz} Hz)`);
  }
  if (energy > 0.12) cues.push("voice loud");
  const zcr = crossings / samples.length;
  if (zcr > 0.14) cues.push("pace quick");
  else if (zcr < 0.05 && pitchHz !== null) cues.push("pace slow");
  return { pitchHz, energy, cues };
}

/** The one sentence the window shows — or null when there is nothing honest to say. */
export function perceptionSentence(face: string[], voice: string[]): string | null {
  const all = [...face, ...voice];
  if (all.length === 0) return null;
  return `Cues suggest: ${all.join(" · ")}`;
}
