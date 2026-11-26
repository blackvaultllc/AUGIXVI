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
  /** The voice's own gender — a goddess is never handed a man's voice by default. */
  gender: "male" | "female";
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
    gender: "male",
  },
  {
    id: "danny-low",
    model: "en_US-danny-low",
    label: "Danny — low and even",
    description:
      "A naturally low man's voice, pitch shifted down a little — dark, but lighter than Anubis Deep.",
    pitchFactor: 0.93,
    deep: true,
    gender: "male",
  },
  {
    id: "alan-low",
    model: "en_GB-alan-low",
    label: "Alan — British, low",
    description:
      "A low British man's voice, pitch shifted down a little — the deep British sound, darker than the old browser pick.",
    pitchFactor: 0.94,
    deep: true,
    gender: "male",
  },
  {
    id: "bryce-medium",
    model: "en_US-bryce-medium",
    label: "Bryce — deep medium",
    description:
      "A medium man's voice with real weight, pitch shifted down — deep without going to the floor.",
    pitchFactor: 0.92,
    deep: true,
    gender: "male",
  },
  {
    id: PREVIOUS_CONSTRUCT_VOICE_ID,
    model: "en_US-joe-medium",
    label: "Joe — the previous voice",
    description:
      "The voice Anubis spoke with before this order — kept so you can go back. Untouched, no pitch shift.",
    pitchFactor: 1,
    deep: false,
    gender: "male",
  },
  {
    id: "kathleen-low",
    model: "en_US-kathleen-low",
    label: "Kathleen — low, dignified",
    description:
      "A low woman's voice, calm and dignified at its natural pitch — the standing voice of the goddesses of the waters and the dark.",
    pitchFactor: 1,
    deep: false,
    gender: "female",
  },
  {
    id: "amy-medium",
    model: "en_US-amy-medium",
    label: "Amy — clear and warm",
    description:
      "A clear woman's voice, warm and present — the standing voice of Hauhet, infinity without end.",
    pitchFactor: 1,
    deep: false,
    gender: "female",
  },
  {
    id: "jenny-dioco",
    model: "en_GB-jenny_dioco-medium",
    label: "Jenny — British, composed",
    description:
      "A composed British woman's voice — the standing voice of Amunet, the hidden one.",
    pitchFactor: 1,
    deep: false,
    gender: "female",
  },
];

export function constructVoiceById(id: unknown): ConstructVoice | null {
  if (typeof id !== "string") return null;
  return CONSTRUCT_VOICES.find((voice) => voice.id === id) ?? null;
}

export interface VoiceSettingsFile {
  /** The lab choice for ANUBIS: a CONSTRUCT_VOICES id, or null when never set. */
  voiceId: string | null;
  /**
   * The lab's per-god assignments for the OTHER gods: god id ->
   * catalog voice id. Absent god = his standing assignment
   * (GOD_VOICES below). Optional in the type so older stored
   * files and callers stay valid; the sanitizer always fills it.
   */
  godVoices?: Record<string, string>;
  updatedAt: string | null;
}

export const EMPTY_VOICE_SETTINGS: VoiceSettingsFile = {
  voiceId: null,
  godVoices: {},
  updatedAt: null,
};

/** Anything unreadable becomes "no choice made" — never a crash. */
export function sanitizeVoiceSettings(raw: unknown): VoiceSettingsFile {
  if (typeof raw !== "object" || raw === null) return { ...EMPTY_VOICE_SETTINGS };
  const record = raw as Record<string, unknown>;
  const voice = constructVoiceById(record["voiceId"]);
  const godVoices: Record<string, string> = {};
  const rawGods = record["godVoices"];
  if (typeof rawGods === "object" && rawGods !== null) {
    for (const [godId, voiceId] of Object.entries(rawGods as Record<string, unknown>)) {
      // Only a real god and a real catalog voice survive.
      if (godVoiceSpec(godId) && constructVoiceById(voiceId)) {
        godVoices[godId] = voiceId as string;
      }
    }
  }
  return {
    voiceId: voice ? voice.id : null,
    godVoices,
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

/* ------------------------------------------------------------------ */
/* EVERY GOD HAS A VOICE (owner expansion 2026-11-26 ~12:51 CST):     */
/* "make sure ALL his gods have a good voice — even the female gods." */
/*                                                                    */
/* The standing assignments. Honest labeling law: a god's voice is    */
/* a real Piper model plus, where marked, a pitch shift — the shift   */
/* is processing on that model, never a different person, and the     */
/* lab shows it as such. There are not fourteen distinct Piper        */
/* models worth having on the core, so gods share models at          */
/* different pitches; each row says exactly what it is. A goddess     */
/* is always handed a woman's voice. He can reassign any god in       */
/* the Voice Lab; the assignment is saved in the core store and       */
/* the standing row is what speaks until he does.                     */
/* ------------------------------------------------------------------ */

export interface GodVoiceSpec {
  godId: string;
  name: string;
  gender: "male" | "female";
  /** Standing assignment: a CONSTRUCT_VOICES id. */
  voiceId: string;
  /** The pitch this god speaks at (1 = the model's natural pitch). */
  pitchFactor: number;
  /** Why this voice is his/hers — plain words for the lab. */
  note: string;
}

export const GOD_VOICES: readonly GodVoiceSpec[] = [
  { godId: "anubis", name: "Anubis", gender: "male", voiceId: "anubis-deep", pitchFactor: 0.88, note: "The deep, dark, disciplined voice — his standing assignment is the Voice Lab choice itself." },
  { godId: "osiris", name: "Osiris", gender: "male", voiceId: "danny-low", pitchFactor: 0.95, note: "Low and even — the still voice of the core." },
  { godId: "montu", name: "Montu", gender: "male", voiceId: "alan-low", pitchFactor: 0.92, note: "British and clipped — the war god on watch." },
  { godId: "horus", name: "Horus", gender: "male", voiceId: "bryce-medium", pitchFactor: 1, note: "Clear and upright — the falcon at his natural pitch." },
  { godId: "horusec", name: "Horusec", gender: "male", voiceId: "danny-low", pitchFactor: 1, note: "The Danny voice at its natural pitch — near Horus, a different seat." },
  { godId: "nu", name: "Nu", gender: "male", voiceId: "anubis-deep", pitchFactor: 0.96, note: "The primeval waters — the Ryan model near its natural depth (Anubis speaks in it shifted deepest)." },
  { godId: "heh", name: "Heh", gender: "male", voiceId: "alan-low", pitchFactor: 1, note: "Infinity — Alan at his natural pitch, even and endless." },
  { godId: "kek", name: "Kek", gender: "male", voiceId: "danny-low", pitchFactor: 0.9, note: "Darkness — Danny shifted deepest of his seats." },
  { godId: "amun", name: "Amun", gender: "male", voiceId: "bryce-medium", pitchFactor: 0.94, note: "The hidden one — Bryce with a quiet weight." },
  { godId: "amun-ra", name: "Amun-Ra", gender: "male", voiceId: "anubis-deep", pitchFactor: 0.92, note: "Amun joined with Ra — the Ryan model, second only to Anubis in depth." },
  { godId: "naunet", name: "Naunet", gender: "female", voiceId: "kathleen-low", pitchFactor: 1, note: "The waters' other face — Kathleen at her natural low pitch." },
  { godId: "hauhet", name: "Hauhet", gender: "female", voiceId: "amy-medium", pitchFactor: 0.97, note: "Infinity without end — Amy, deepened a touch." },
  { godId: "kauket", name: "Kauket", gender: "female", voiceId: "kathleen-low", pitchFactor: 0.94, note: "Darkness — Kathleen deepened; the same model as Naunet at a different shift, labeled as such." },
  { godId: "amunet", name: "Amunet", gender: "female", voiceId: "jenny-dioco", pitchFactor: 1, note: "The hidden one — Jenny, British and composed, unshifted." },
];

export function godVoiceSpec(godId: unknown): GodVoiceSpec | null {
  if (typeof godId !== "string") return null;
  return GOD_VOICES.find((spec) => spec.godId === godId) ?? null;
}

export interface GodVoiceResolution {
  spec: GodVoiceSpec;
  voice: ConstructVoice;
  pitchFactor: number;
  source: "standing" | "assigned";
}

/**
 * A god's effective voice: his lab assignment when one is saved
 * (the assigned catalog voice at ITS OWN catalog pitch), else his
 * standing assignment (the spec's voice at the spec's pitch).
 * Anubis is NOT resolved here — his voice is the construct choice
 * (resolveConstructVoice), the lab's first row.
 */
export function resolveGodVoice(
  godId: string,
  settings: VoiceSettingsFile,
): GodVoiceResolution | null {
  const spec = godVoiceSpec(godId);
  if (!spec || godId === "anubis") return null;
  const assignedId = settings.godVoices?.[godId];
  const assigned = assignedId ? constructVoiceById(assignedId) : null;
  if (assigned) {
    return { spec, voice: assigned, pitchFactor: assigned.pitchFactor, source: "assigned" };
  }
  const standing = constructVoiceById(spec.voiceId);
  if (!standing) return null;
  return { spec, voice: standing, pitchFactor: spec.pitchFactor, source: "standing" };
}

/** One honest line naming what a god's voice actually is. */
export function godVoiceFactLine(resolution: GodVoiceResolution): string {
  const { voice, pitchFactor } = resolution;
  const shift =
    pitchFactor < 1
      ? `pitch shifted down ${Math.round((1 - pitchFactor) * 100)}% (deeper, a touch slower)`
      : "no pitch shift";
  return `Piper model ${voice.model} · ${shift}`;
}
