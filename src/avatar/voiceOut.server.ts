/**
 * THE VOICE LAB DOORWAY — the settings half of the voice repair
 * (owner order 2026-11-26). GET reads the lab's truth from the
 * core: the catalog, which models this core actually has, the
 * stored choice, and the voice that would speak right now. POST
 * sets the choice — validated against the catalog and against the
 * models really on this core — and persists it in the core store,
 * where the say path (piper.server.ts) reads it on every line.
 *
 * Before this doorway existed there was no way to set a voice at
 * all: the lab the Captain was promised had no wire to the speech
 * path. This is the wire.
 */
import { existsSync } from "node:fs";
import { piperVoiceModelPath } from "./piper.server";
import {
  CONSTRUCT_VOICES,
  DEFAULT_CONSTRUCT_VOICE_ID,
  constructVoiceById,
  resolveConstructVoice,
  voiceFactLine,
  type ConstructVoice,
} from "./voiceSettings";
import {
  getVoiceSettingsStore,
  type VoiceSettingsStore,
} from "./voiceSettingsStore.server";

export interface VoiceLabEntry {
  voice: ConstructVoice;
  factLine: string;
  installed: boolean;
  isDefault: boolean;
  isChosen: boolean;
}

export interface VoiceLabView {
  entries: VoiceLabEntry[];
  chosenVoiceId: string | null;
  /** The voice a spoken line would use right now, and why. */
  speaking: { voiceId: string | null; factLine: string | null; note: string };
}

export interface VoiceOutDeps {
  store: VoiceSettingsStore | null;
  isModelInstalled: (model: string) => boolean;
}

export async function defaultVoiceOutDeps(): Promise<VoiceOutDeps> {
  const env = process.env;
  return {
    store: await getVoiceSettingsStore(),
    isModelInstalled: (model) => existsSync(piperVoiceModelPath(model, env)),
  };
}

export async function readVoiceLab(deps: VoiceOutDeps): Promise<VoiceLabView> {
  const settings = deps.store
    ? await deps.store.read()
    : { voiceId: null, updatedAt: null };
  const resolution = resolveConstructVoice(settings, deps.isModelInstalled);
  const chosenVoiceId = settings.voiceId;
  const entries = CONSTRUCT_VOICES.map((voice) => ({
    voice,
    factLine: voiceFactLine(voice),
    installed: deps.isModelInstalled(voice.model),
    isDefault: voice.id === DEFAULT_CONSTRUCT_VOICE_ID,
    isChosen: voice.id === chosenVoiceId,
  }));
  const speaking =
    resolution.kind === "voice"
      ? {
          voiceId: resolution.voice.id,
          factLine: voiceFactLine(resolution.voice),
          note:
            resolution.source === "choice"
              ? "Speaking in your Voice Lab choice."
              : resolution.source === "default"
                ? "Speaking in the standing default — no Voice Lab choice made yet."
                : "Speaking in the first voice this core has, until the deeper models are installed.",
        }
      : resolution.kind === "choice-missing"
        ? {
            voiceId: null,
            factLine: null,
            note: `Your chosen voice (${resolution.voice.model}) is not on this core yet — spoken lines fall back to the browser voice until its model is installed.`,
          }
        : {
            voiceId: null,
            factLine: null,
            note: "No Piper voice model is installed on this core — spoken lines use the browser voice here.",
          };
  return { entries, chosenVoiceId, speaking };
}

export type SetVoiceResult =
  | { ok: true; view: VoiceLabView }
  | { ok: false; reason: string };

export async function setVoiceChoice(
  deps: VoiceOutDeps,
  voiceId: unknown,
): Promise<SetVoiceResult> {
  const voice = constructVoiceById(voiceId);
  if (!voice) {
    return { ok: false, reason: "That voice is not in the Voice Lab catalog." };
  }
  if (!deps.isModelInstalled(voice.model)) {
    return {
      ok: false,
      reason: `The ${voice.label} voice (Piper model ${voice.model}) is not on this core yet — its model file has not been installed, so it cannot be chosen until it is.`,
    };
  }
  if (!deps.store) {
    return {
      ok: false,
      reason: "This host has no core store (no node filesystem), so the choice cannot be saved here.",
    };
  }
  await deps.store.update((file) => ({
    ...file,
    voiceId: voice.id,
    updatedAt: new Date().toISOString(),
  }));
  return { ok: true, view: await readVoiceLab(deps) };
}

export async function handleVoiceLabGet(): Promise<Response> {
  const view = await readVoiceLab(await defaultVoiceOutDeps());
  return Response.json(view);
}

export async function handleVoiceLabPost(request: Request): Promise<Response> {
  let voiceId: unknown;
  try {
    const body = (await request.json()) as { voiceId?: unknown };
    voiceId = body.voiceId;
  } catch {
    return Response.json(
      { error: "Expected a JSON body with a voiceId field." },
      { status: 400 },
    );
  }
  const result = await setVoiceChoice(await defaultVoiceOutDeps(), voiceId);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 400 });
  }
  return Response.json(result.view);
}
