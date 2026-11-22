/**
 * SPEAKER SEPARATION (Part 13, owner order 2026-11-21) — the
 * analytical side of the conversation is kept APART per voice:
 *
 * - The OPERATOR's voiceprint lives in the voice-calibration system
 *   (WeSpeaker, on the Parrot's speech service). It stays his alone.
 * - Any OTHER voice gets its own separate, clearly-labeled store —
 *   "Speaker 2", "Speaker 3" — presence/voiceprint data only.
 * - NO identity claims: no names guessed, no facial recognition, and
 *   another speaker's data is NEVER merged into the operator profile.
 *
 * This module is the app-side contract: label assignment + the
 * separate stores. The embedding math runs in the speech service
 * (speaker.py on the Parrot); what lands here is labels and counts,
 * kept apart by construction.
 */

export interface OtherSpeakerStore {
  label: string;
  /** Utterances attributed to this voice. */
  utterances: number;
  firstHeard: number;
  lastHeard: number;
}

export const OTHER_SPEAKERS_KEY = "augi.speaker-stores.others.v1";

export const OPERATOR_LABEL = "Operator";

/**
 * The label a transcribed line carries. The operator match comes from
 * the voice gate's verdict; anything else maps to an existing other
 * store when the speech service matched one, or the next fresh label.
 */
export function assignSpeakerLabel(
  isOperatorVoice: boolean,
  existingOthers: readonly OtherSpeakerStore[],
  matchedLabel?: string,
): string {
  if (isOperatorVoice) return OPERATOR_LABEL;
  if (matchedLabel && existingOthers.some((s) => s.label === matchedLabel)) {
    return matchedLabel;
  }
  return `Speaker ${existingOthers.length + 2}`;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadOtherSpeakers(): OtherSpeakerStore[] {
  const store = storage();
  if (!store) return [];
  try {
    const parsed: unknown = JSON.parse(store.getItem(OTHER_SPEAKERS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is OtherSpeakerStore =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as OtherSpeakerStore).label === "string" &&
        /^Speaker \d+$/.test((s as OtherSpeakerStore).label),
    );
  } catch {
    return [];
  }
}

/** Record an utterance against a label — the operator's label is
 *  refused here: his data never enters the other-speaker stores. */
export function recordOtherUtterance(label: string, at = Date.now()): OtherSpeakerStore[] {
  if (label === OPERATOR_LABEL || !/^Speaker \d+$/.test(label)) return loadOtherSpeakers();
  const others = loadOtherSpeakers();
  const found = others.find((s) => s.label === label);
  if (found) {
    found.utterances += 1;
    found.lastHeard = at;
  } else {
    others.push({ label, utterances: 1, firstHeard: at, lastHeard: at });
  }
  storage()?.setItem(OTHER_SPEAKERS_KEY, JSON.stringify(others));
  return others;
}

export function clearOtherSpeakers(): void {
  storage()?.removeItem(OTHER_SPEAKERS_KEY);
}
