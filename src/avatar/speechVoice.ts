/**
 * THE GODS' VOICE (owner order 2026-11-22): the gods who speak on
 * this stage are MEN, and they speak in a man's voice — the deeper
 * BRITISH browser voice is the standing default, kept unless the
 * Captain changes it. A female voice is used only when the speaker
 * is actually female. The browser's out-of-the-box default (so
 * often a woman's voice) is never left to decide for them.
 *
 * LOUDNESS (same order): he could not hear the voice on his phone
 * with the phone's own volume at maximum. The utterance volume sits
 * at its maximum by default, and the app's own audio paths (Piper /
 * ElevenLabs playback) run through a gain stage turned up past
 * unity. His level lives in the Settings tab ("Voice volume") —
 * visible, his to set, never buried — and persists like the other
 * interface preferences.
 *
 * Pure selection logic over plain voice descriptors, so the pick is
 * unit-testable without a browser (avatar rules discipline).
 */

export type SpeechGender = "male" | "female";

/** The gain applied to app-generated speech audio at full volume. */
export const SPEECH_AUDIO_GAIN = 1.5;

export const SPEECH_VOLUME_KEY = "augi.avatar.speech-volume.v1";

function clamp01(value: unknown): number {
  const numeric =
    typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.min(1, Math.max(0, numeric));
}

/** His speech level, 0..1. Default is FULL — the order is louder. */
export function loadSpeechVolume(
  storage?: Pick<Storage, "getItem">,
): number {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(
      SPEECH_VOLUME_KEY,
    );
    if (raw == null) return 1;
    return clamp01(Number.parseFloat(raw));
  } catch {
    return 1;
  }
}

export function saveSpeechVolume(
  volume: number,
  storage?: Pick<Storage, "setItem">,
): void {
  try {
    (storage ?? globalThis.localStorage)?.setItem(
      SPEECH_VOLUME_KEY,
      String(clamp01(volume)),
    );
  } catch {
    /* a preference that cannot save must never break the stage */
  }
}

/** Gain for the app audio paths at a given volume level. */
export function speechAudioGain(volume: number = loadSpeechVolume()): number {
  return clamp01(volume) * SPEECH_AUDIO_GAIN;
}

type VoiceLike = Pick<SpeechSynthesisVoice, "name" | "lang">;

const FEMALE_NAME_HINTS = [
  "female",
  "zira",
  "samantha",
  "victoria",
  "karen",
  "moira",
  "tessa",
  "fiona",
  "serena",
  "kate",
  "hazel",
  "susan",
  "sonia",
  "libby",
  "aria",
  "jenny",
  "joana",
  "catherine",
  "allison",
  "ava",
  "emma",
];

const MALE_NAME_HINTS = [
  "male",
  "daniel",
  "george",
  "ryan",
  "arthur",
  "brian",
  "david",
  "james",
  "alex",
  "fred",
  "thomas",
  "christopher",
  "richard",
  "guy",
  "stefan",
  "mark",
];

function nameHints(name: string, hints: string[]): boolean {
  const lower = name.toLowerCase();
  return hints.some((hint) => lower.includes(hint));
}

function isFemaleVoice(voice: VoiceLike): boolean {
  // "female" is checked before "male" on purpose: the word
  // "female" contains "male", and a woman's voice must never be
  // picked for a god.
  return nameHints(voice.name, FEMALE_NAME_HINTS);
}

function isMaleVoice(voice: VoiceLike): boolean {
  if (isFemaleVoice(voice)) return false;
  return nameHints(voice.name, MALE_NAME_HINTS);
}

function isBritish(voice: VoiceLike): boolean {
  const lang = voice.lang.toLowerCase().replace("_", "-");
  return (
    lang.startsWith("en-gb") ||
    voice.name.toLowerCase().includes("uk english") ||
    voice.name.toLowerCase().includes("united kingdom")
  );
}

function isEnglish(voice: VoiceLike): boolean {
  return voice.lang.toLowerCase().replace("_", "-").startsWith("en");
}

/**
 * Pick the standing voice for a speaker. For the gods (male): the
 * deeper British man's voice first — a British voice whose name
 * does not read female outranks an unknown-gender British voice,
 * which outranks any English man's voice; the British default
 * stands even when no name gives the gender away, because its tone
 * is the deeper one he chose. For a female speaker: a woman's
 * voice or none — never a man's.
 */
export function pickSpeechVoice<T extends VoiceLike>(
  voices: readonly T[],
  gender: SpeechGender = "male",
): T | null {
  if (gender === "female") {
    return (
      voices.find((v) => isBritish(v) && isFemaleVoice(v)) ??
      voices.find((v) => isEnglish(v) && isFemaleVoice(v)) ??
      voices.find((v) => isFemaleVoice(v)) ??
      null
    );
  }
  return (
    voices.find((v) => isBritish(v) && isMaleVoice(v)) ??
    voices.find((v) => isBritish(v) && !isFemaleVoice(v)) ??
    voices.find((v) => isEnglish(v) && isMaleVoice(v)) ??
    voices.find((v) => isMaleVoice(v)) ??
    voices.find((v) => isBritish(v)) ??
    null
  );
}

let voiceCache: SpeechSynthesisVoice[] = [];

/** The browser's voice list, cached once the engine publishes it. */
export function currentSpeechVoices(): SpeechSynthesisVoice[] {
  try {
    const list = globalThis.speechSynthesis?.getVoices?.() ?? [];
    if (list.length) voiceCache = [...list];
  } catch {
    /* keep whatever the cache already holds */
  }
  return voiceCache;
}

/**
 * Warm the voice list early: engines publish their voices
 * asynchronously, and a first speak that asks too early gets an
 * empty list and falls back to the browser default — the exact
 * failure this module exists to prevent.
 */
export function warmSpeechVoices(): void {
  void currentSpeechVoices();
  try {
    globalThis.speechSynthesis?.addEventListener?.("voiceschanged", () => {
      void currentSpeechVoices();
    });
  } catch {
    /* older engines have no such event; speak-time reads still work */
  }
}

/**
 * Set an utterance up as a god's speech: the picked voice for the
 * speaker's gender, the deeper pitch for the gods, and his volume
 * level (full by default). Safe on any engine — where no matching
 * voice exists, pitch and volume still carry the order.
 */
export function configureSpeechUtterance(
  utterance: SpeechSynthesisUtterance,
  options: { gender?: SpeechGender; volume?: number } = {},
): void {
  const gender = options.gender ?? "male";
  utterance.rate = 0.95;
  utterance.pitch = gender === "male" ? 0.8 : 1;
  utterance.volume = clamp01(options.volume ?? loadSpeechVolume());
  const picked = pickSpeechVoice(currentSpeechVoices(), gender);
  if (picked) utterance.voice = picked;
}
