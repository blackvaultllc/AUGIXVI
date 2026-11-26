/**
 * VOICE LAB — client-side view of the core's voice doorway
 * (owner order 2026-11-26). The lab the Captain was promised now
 * has a wire: GET /api/voice reads the catalog, the models this
 * core really has, and the choice saved in the core; POST sets the
 * choice; a preview is a /api/say line with an explicit voiceId —
 * the same synthesis path the construct speaks through, with one
 * voice named for that line only.
 *
 * This module is the pure half: the view shape and its parser, so
 * a malformed answer can never render as a voice that isn't real.
 */
import type { ConstructVoice } from "./voiceSettings";

export interface VoiceLabEntryView {
  voice: ConstructVoice;
  factLine: string;
  installed: boolean;
  isDefault: boolean;
  isChosen: boolean;
}

export interface VoiceLabView {
  entries: VoiceLabEntryView[];
  chosenVoiceId: string | null;
  speaking: { voiceId: string | null; factLine: string | null; note: string };
}

/** The line a Preview speaks — Anubis naming himself, addressing Zero. */
export const VOICE_PREVIEW_LINE = "Anubis, at your command, Zero. This is the voice you are hearing.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseVoice(value: unknown): ConstructVoice | null {
  if (!isRecord(value)) return null;
  const { id, model, label, description, pitchFactor, deep } = value;
  if (
    typeof id !== "string" ||
    typeof model !== "string" ||
    typeof label !== "string" ||
    typeof description !== "string" ||
    typeof pitchFactor !== "number" ||
    typeof deep !== "boolean"
  ) {
    return null;
  }
  return { id, model, label, description, pitchFactor, deep };
}

export function parseVoiceLabView(raw: unknown): VoiceLabView | null {
  if (!isRecord(raw) || !Array.isArray(raw["entries"]) || !isRecord(raw["speaking"])) {
    return null;
  }
  const entries: VoiceLabEntryView[] = [];
  for (const entry of raw["entries"]) {
    if (!isRecord(entry)) return null;
    const voice = parseVoice(entry["voice"]);
    if (!voice || typeof entry["factLine"] !== "string") return null;
    entries.push({
      voice,
      factLine: entry["factLine"],
      installed: entry["installed"] === true,
      isDefault: entry["isDefault"] === true,
      isChosen: entry["isChosen"] === true,
    });
  }
  const speaking = raw["speaking"];
  if (typeof speaking["note"] !== "string") return null;
  return {
    entries,
    chosenVoiceId: typeof raw["chosenVoiceId"] === "string" ? raw["chosenVoiceId"] : null,
    speaking: {
      voiceId: typeof speaking["voiceId"] === "string" ? speaking["voiceId"] : null,
      factLine: typeof speaking["factLine"] === "string" ? speaking["factLine"] : null,
      note: speaking["note"],
    },
  };
}
