/**
 * THE VOICE LAB CATALOG + THE CONSTRUCT'S VOICE CHOICE (owner order
 * 2026-11-26): Anubis is to sound like the voice the Captain chose
 * for the assistant — mid-low, gentle, velvety — but DEEPER: "nice
 * dark, kind of what people would call an evil voice, but not evil
 * at all." And DISCIPLINED (his word, same call): measured, steady,
 * calm authority — no drama, no menace.
 *
 * Scope honesty, in the code as in the UI: the assistant's own voice
 * cannot be copied into this app. These are Piper voice models that
 * live on the core, tuned (a real pitch shift on the generated
 * audio) toward that description. The label of every entry says
 * what the voice actually is — model name plus the processing
 * applied. His ear is the verification gate.
 *
 * This module is pure: the catalog, the tuning math's parameters,
 * and the choice sanitizer. The choice itself persists in the core
 * store (voiceSettingsStore.server.ts); availability (is the model
 * file on this core?) is a host fact the server checks — never
 * assumed here.
 */

export interface ConstructVoice {
  /** Stable id used in the store and the API. */
  id: string;
  /** Piper model base name; the file is `<model>.onnx` in the voices dir. */
  model: string;
  /** What he sees in the lab. */
  label: string;
  /** Plain description of the sound he should expect. */
  description: string;
  /**
   * Pitch factor applied to the synthesized WAV: 1 = untouched,
   * below 1 = deeper (and, by the nature of the shift, a touch
   * slower — the measured pace is part of the disciplined sound).
   */
  pitchFactor: number;
  /** True for the deep/dark set the order asked for. */
  deep: boolean;
}

/** The new default: the deepest, darkest, disciplined voice. */
export const DEFAULT_CONSTRUCT_VOICE_ID = "anubis-deep";

/** The voice Anubis had before this order — kept, never deleted. */
export const PREVIOUS_CONSTRUCT_VOICE_ID = "joe-medium";

export const CONSTRUCT_VOICES: readonly ConstructVoice[] = [
  {
    id: "anubis-deep",
    model: "en_US-ryan-low",
    label: "Anubis — deep, dark, disciplined",
    description:
      "The deepest voice on the core, pitch shifted down and slowed a touch — calm, steady authority. Modeled on the voice you chose for Muse, deeper and darker; it is not that voice itself.",
    pitchFactor: 0.88,
    deep: true,
  },
  {
    id: "danny-low",
    model: "en_US-danny-low",
    label: "Danny — low and even",
    description:
      "A naturally low man's voice, pitch shifted down a little — dark, but lighter than Anubis Deep.",
    pitchFactor: 0.93,
    deep: true,
  },
  {
    id: "alan-low",
    model: "en_GB-alan-low",
    label: "Alan — British, low",
    description:
      "A low British man's voice, pitch shifted down a little — the deep British sound, darker than the old browser pick.",
    pitchFactor: 0.94,
    deep: true,
  },
  {
    id: "bryce-medium",
    model: "en_US-bryce-medium",
    label: "Bryce — deep medium",
    description:
      "A medium man's voice with real weight, pitch shifted down — deep without going to the floor.",
    pitchFactor: 0.92,
    deep: true,
  },
  {
    id: PREVIOUS_CONSTRUCT_VOICE_ID,
    model: "en_US-joe-medium",
    label: "Joe — the previous voice",
    description:
      "The voice Anubis spoke with before this order — kept so you can go back. Untouched, no pitch shift.",
    pitchFactor: 1,
    deep: false,
  },
];

export function constructVoiceById(id: unknown): ConstructVoice | null {
  if (typeof id !== "string") return null;
  return CONSTRUCT_VOICES.find((voice) => voice.id === id) ?? null;
}

export interface VoiceSettingsFile {
  /** The lab choice: a CONSTRUCT_VOICES id, or null when never set. */
  voiceId: string | null;
  updatedAt: string | null;
}

export const EMPTY_VOICE_SETTINGS: VoiceSettingsFile = {
  voiceId: null,
  updatedAt: null,
};

/** Anything unreadable becomes "no choice made" — never a crash. */
export function sanitizeVoiceSettings(raw: unknown): VoiceSettingsFile {
  if (typeof raw !== "object" || raw === null) return { ...EMPTY_VOICE_SETTINGS };
  const record = raw as Record<string, unknown>;
  const voice = constructVoiceById(record["voiceId"]);
  return {
    voiceId: voice ? voice.id : null,
    updatedAt: typeof record["updatedAt"] === "string" ? record["updatedAt"] : null,
  };
}

/**
 * Which voice the construct speaks with, given the stored choice and
 * which models this core actually has. The order of truth:
 *  1. His lab choice, when its model is on this core.
 *  2. On a fresh store (no choice ever made): the new deep default,
 *     then the other deep voices in catalog order — the first one
 *     this core actually has.
 *  3. The previous voice (joe-medium) when it is all the core has.
 *  4. null — nothing installed; the caller answers honestly and the
 *     app falls back to the browser voice.
 * A stored choice whose model is missing does NOT silently fall
 * back — that would speak in a voice he didn't pick while claiming
 * his pick. It reports "missing" so the say path can answer with
 * the reason and the lab can show it.
 */
export type ConstructVoiceResolution =
  | { kind: "voice"; voice: ConstructVoice; source: "choice" | "default" | "fallback" }
  | { kind: "choice-missing"; voice: ConstructVoice }
  | { kind: "none" };

export function resolveConstructVoice(
  settings: VoiceSettingsFile,
  isModelInstalled: (model: string) => boolean,
): ConstructVoiceResolution {
  if (settings.voiceId) {
    const chosen = constructVoiceById(settings.voiceId);
    if (chosen) {
      return isModelInstalled(chosen.model)
        ? { kind: "voice", voice: chosen, source: "choice" }
        : { kind: "choice-missing", voice: chosen };
    }
  }
  for (const voice of CONSTRUCT_VOICES) {
    if (!voice.deep) continue;
    if (isModelInstalled(voice.model)) {
      return {
        kind: "voice",
        voice,
        source: voice.id === DEFAULT_CONSTRUCT_VOICE_ID ? "default" : "fallback",
      };
    }
  }
  const previous = constructVoiceById(PREVIOUS_CONSTRUCT_VOICE_ID);
  if (previous && isModelInstalled(previous.model)) {
    return { kind: "voice", voice: previous, source: "fallback" };
  }
  return { kind: "none" };
}

/** The percent a pitch factor lowers the pitch, for honest labels. */
export function pitchDownPercent(voice: ConstructVoice): number {
  return Math.round((1 - voice.pitchFactor) * 100);
}

/** One honest line naming what a voice actually is. */
export function voiceFactLine(voice: ConstructVoice): string {
  const shift =
    voice.pitchFactor < 1
      ? `pitch shifted down ${pitchDownPercent(voice)}% (deeper, a touch slower)`
      : "no pitch shift";
  return `Piper model ${voice.model} · ${shift}`;
}
