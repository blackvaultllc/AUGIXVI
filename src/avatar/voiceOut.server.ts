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
  GOD_VOICES,
  constructVoiceById,
  godVoiceFactLine,
  godVoiceSpec,
  resolveConstructVoice,
  resolveGodVoice,
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
  /** Every god's voice (owner expansion 2026-11-26): standing or as assigned. */
  gods: GodLabEntry[];
}

export interface GodLabEntry {
  godId: string;
  name: string;
  gender: "male" | "female";
  note: string;
  /** The catalog voice this god speaks in right now. */
  voiceId: string;
  voiceLabel: string;
  factLine: string;
  installed: boolean;
  source: "standing" | "assigned" | "choice" | "default" | "fallback";
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
  const gods: GodLabEntry[] = GOD_VOICES.map((spec) => {
    if (spec.godId === "anubis") {
      // Anubis's row IS the construct choice resolved above.
      if (resolution.kind === "voice") {
        return {
          godId: spec.godId,
          name: spec.name,
          gender: spec.gender,
          note: spec.note,
          voiceId: resolution.voice.id,
          voiceLabel: resolution.voice.label,
          factLine: voiceFactLine(resolution.voice),
          installed: deps.isModelInstalled(resolution.voice.model),
          source: resolution.source,
        };
      }
      const standing = constructVoiceById(spec.voiceId);
      return {
        godId: spec.godId,
        name: spec.name,
        gender: spec.gender,
        note: spec.note,
        voiceId: spec.voiceId,
        voiceLabel: standing?.label ?? spec.voiceId,
        factLine: standing ? voiceFactLine(standing) : "",
        installed: false,
        source: "standing" as const,
      };
    }
    const godResolution = resolveGodVoice(spec.godId, settings);
    if (!godResolution) {
      return {
        godId: spec.godId,
        name: spec.name,
        gender: spec.gender,
        note: spec.note,
        voiceId: spec.voiceId,
        voiceLabel: spec.voiceId,
        factLine: "",
        installed: false,
        source: "standing" as const,
      };
    }
    return {
      godId: spec.godId,
      name: spec.name,
      gender: spec.gender,
      note: spec.note,
      voiceId: godResolution.voice.id,
      voiceLabel: godResolution.voice.label,
      factLine: godVoiceFactLine(godResolution),
      installed: deps.isModelInstalled(godResolution.voice.model),
      source: godResolution.source,
    };
  });
  return { entries, chosenVoiceId, speaking, gods };
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

/**
 * Assign one god's voice (owner expansion 2026-11-26). Anubis's
 * assignment IS the main choice (setVoiceChoice's store field);
 * every other god's assignment stands in godVoices. Same honesty
 * as the main choice: a voice whose model is not on this core
 * cannot be assigned until it is installed.
 */
export async function setGodVoiceChoice(
  deps: VoiceOutDeps,
  godId: unknown,
  voiceId: unknown,
): Promise<SetVoiceResult> {
  const spec = godVoiceSpec(godId);
  if (!spec) {
    return { ok: false, reason: "That god is not in the roster of voices." };
  }
  if (spec.godId === "anubis") {
    return setVoiceChoice(deps, voiceId);
  }
  const voice = constructVoiceById(voiceId);
  if (!voice) {
    return { ok: false, reason: "That voice is not in the Voice Lab catalog." };
  }
  if (!deps.isModelInstalled(voice.model)) {
    return {
      ok: false,
      reason: `The ${voice.label} voice (Piper model ${voice.model}) is not on this core yet — its model file has not been installed, so ${spec.name} cannot be given it until it is.`,
    };
  }
  if (!deps.store) {
    return {
      ok: false,
      reason: "This host has no core store (no node filesystem), so the assignment cannot be saved here.",
    };
  }
  await deps.store.update((file) => ({
    ...file,
    godVoices: { ...(file.godVoices ?? {}), [spec.godId]: voice.id },
    updatedAt: new Date().toISOString(),
  }));
  return { ok: true, view: await readVoiceLab(deps) };
}

export async function handleVoiceLabPost(request: Request): Promise<Response> {
  let voiceId: unknown;
  let godId: unknown;
  try {
    const body = (await request.json()) as { voiceId?: unknown; godId?: unknown };
    voiceId = body.voiceId;
    godId = body.godId;
  } catch {
    return Response.json(
      { error: "Expected a JSON body with a voiceId field." },
      { status: 400 },
    );
  }
  const deps = await defaultVoiceOutDeps();
  const result =
    godId !== undefined
      ? await setGodVoiceChoice(deps, godId, voiceId)
      : await setVoiceChoice(deps, voiceId);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 400 });
  }
  return Response.json(result.view);
}
