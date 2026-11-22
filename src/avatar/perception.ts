/**
 * PULSE PERCEPTION (Part 25, owner order 2026-11-21) — expression
 * cues from the face landmarks Pulse already tracks, read TOGETHER
 * with the room's audio cues (dominant pitch + energy), presented as
 * what the cues SUGGEST — never as fact about a person.
 *
 * HARD RULES (his standing law):
 * - Expression is NOT identity: no recognition, no identification,
 *   no name, ever. These are geometry ratios of a landmark set.
 * - Honest labels only: "cues suggest…" — estimates, not mind-reading.
 * - Local + live only: computed per tick, never stored.
 *
 * Landmark indices are the MediaPipe FaceLandmarker 478-point mesh.
 */

export interface ExpressionCues {
  /** 0..1 — mouth corners spread + lifted relative to the mouth center. */
  smile: number;
  /** 0..1 — brow height above the eyes (raised brows read high). */
  browRaise: number;
  /** 0..1 — inner brows drawn together/down (tension reads high). */
  browTension: number;
  /** 0..1 — eye openness (aspect ratio); near 0 = closed/blinking. */
  eyeOpen: number;
}

type Pt = { x: number; y: number };

const IDX = {
  mouthLeft: 61,
  mouthRight: 291,
  mouthTop: 13,
  mouthBottom: 14,
  browInnerLeft: 107,
  browInnerRight: 336,
  browLeft: 70,
  browRight: 300,
  eyeTopLeft: 159,
  eyeBottomLeft: 145,
  eyeTopRight: 386,
  eyeBottomRight: 374,
} as const;

function at(landmarks: readonly Pt[], index: number): Pt | null {
  return landmarks[index] ?? null;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function expressionCues(landmarks: readonly Pt[]): ExpressionCues | null {
  if (landmarks.length < 300) return null;
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const faceW = maxX - minX;
  const faceH = maxY - minY;
  if (faceW <= 0 || faceH <= 0) return null;

  const ml = at(landmarks, IDX.mouthLeft);
  const mr = at(landmarks, IDX.mouthRight);
  const mt = at(landmarks, IDX.mouthTop);
  const mb = at(landmarks, IDX.mouthBottom);
  const bil = at(landmarks, IDX.browInnerLeft);
  const bir = at(landmarks, IDX.browInnerRight);
  const bl = at(landmarks, IDX.browLeft);
  const br = at(landmarks, IDX.browRight);
  const etl = at(landmarks, IDX.eyeTopLeft);
  const ebl = at(landmarks, IDX.eyeBottomLeft);
  const etr = at(landmarks, IDX.eyeTopRight);
  const ebr = at(landmarks, IDX.eyeBottomRight);
  if (!ml || !mr || !mt || !mb || !bil || !bir || !bl || !br || !etl || !ebl || !etr || !ebr) {
    return null;
  }

  // Smile: mouth width vs face width, plus corners lifted above the
  // mouth's vertical center (image y grows downward).
  const mouthW = Math.abs(mr.x - ml.x) / faceW;
  const mouthCenterY = (mt.y + mb.y) / 2;
  const cornerLift = (mouthCenterY - (ml.y + mr.y) / 2) / faceH;
  const smile = clamp01((mouthW - 0.28) * 2.2 + cornerLift * 6);

  // Brows: height above the eye line, and the inner gap (tension).
  const browGapL = (etl.y - bl.y) / faceH;
  const browGapR = (etr.y - br.y) / faceH;
  const browRaise = clamp01(((browGapL + browGapR) / 2 - 0.04) * 7);
  const innerGap = Math.abs(bir.x - bil.x) / faceW;
  const browTension = clamp01((0.16 - innerGap) * 5 + (0.05 - (browGapL + browGapR) / 2) * 3);

  // Eyes: vertical opening relative to face height.
  const openL = Math.abs(ebl.y - etl.y) / faceH;
  const openR = Math.abs(ebr.y - etr.y) / faceH;
  const eyeOpen = clamp01(((openL + openR) / 2) * 9);

  return { smile, browRaise, browTension, eyeOpen };
}

export interface AudioCues {
  /** Dominant frequency in Hz, or null when the room is quiet. */
  dominantHz: number | null;
  /** 0..1 mean spectral energy. */
  energy: number;
}

/**
 * The combined read, in his required phrasing: observed cues and
 * what they suggest — an estimate, labeled as one.
 */
export function perceptionLines(cues: ExpressionCues | null, audio: AudioCues): string[] {
  const lines: string[] = [];
  if (!cues) {
    lines.push("No face cues right now — perception needs a face in frame.");
  } else {
    if (cues.smile > 0.55) lines.push("Cues suggest a smile — mouth corners spread and lifted.");
    else if (cues.smile > 0.3) lines.push("Cues suggest a slight smile.");
    if (cues.browTension > 0.55) {
      lines.push("Cues suggest brow tension — inner brows drawn together.");
    } else if (cues.browRaise > 0.6) {
      lines.push("Cues suggest raised brows — often surprise or emphasis.");
    }
    if (cues.eyeOpen < 0.25) lines.push("Cues suggest the eyes are closed or nearly closed.");
    else if (cues.eyeOpen < 0.5) lines.push("Cues suggest narrowed eyes.");
    if (lines.length === 0) lines.push("Cues suggest a neutral, relaxed expression.");
  }
  if (audio.dominantHz !== null) {
    const pitch =
      audio.dominantHz < 160 ? "low-pitched" : audio.dominantHz < 320 ? "mid-pitched" : "high-pitched";
    lines.push(
      `Audio cues: a ${pitch} sound dominates (~${Math.round(audio.dominantHz)} Hz) at ${audio.energy > 0.4 ? "strong" : audio.energy > 0.15 ? "moderate" : "soft"} energy.`,
    );
  } else {
    lines.push("Audio cues: the room is quiet right now.");
  }
  lines.push("Estimates from live cues only — not a reading of anyone's mind, and nothing is recorded.");
  return lines;
}
