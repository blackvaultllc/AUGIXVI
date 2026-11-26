/**
 * PIPER VOICE-OUT (owner item, 2026-11-21) — Augie's local voice.
 * Piper is installed on the Parrot (~/augie-tools/piper) but was
 * never wired into the app; the app spoke only through the browser's
 * speechSynthesis (and ElevenLabs when configured). This module is
 * the wire: text in, WAV out, generated ON this machine. Where Piper
 * isn't installed (any other host), it answers 503 honestly and the
 * app falls back to the browser voice — it never pretends to be
 * Piper when it isn't.
 *
 * THE VOICE LAB BREAK, AND ITS REPAIR (owner order 2026-11-26):
 * a Voice Lab was promised to the Captain and he never heard a
 * different voice from it. Proven from this code as it stood: there
 * was NO wire for a choice to travel. The say request carried only
 * text; the model was whatever the AUGIE_PIPER_MODEL environment
 * variable (or the hardcoded en_US-joe-medium default) said on the
 * server; no store held a choice and no surface could set one. The
 * only voice controls in the app were a volume slider and the
 * hearing calibration (his voice IN, not the construct's voice OUT).
 * The repair: the choice lives in the core store
 * (voiceSettingsStore.server.ts), this handler resolves it on every
 * line the construct speaks — greetings, reports, readings, all of
 * them come through here — and an explicit voiceId in the request
 * (the lab's Preview) synthesizes through this exact same path with
 * that one voice, without touching the stored choice.
 *
 * KHADIJA'S SIDE IS NOT THIS PATH: her Flower speaks through
 * learnerSay.server.ts, which calls synthesizeWithPiper with no
 * voice spec and keeps the installed default (en_US-joe-medium),
 * untouched by the lab, exactly as the Captain confirmed it.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { shiftWavPitch } from "./wavPitch";
import {
  constructVoiceById,
  godVoiceFactLine,
  resolveConstructVoice,
  resolveGodVoice,
  voiceFactLine,
  type ConstructVoice,
} from "./voiceSettings";
import {
  getVoiceSettingsStore,
  type VoiceSettingsStore,
} from "./voiceSettingsStore.server";

export function piperPaths(env: NodeJS.ProcessEnv = process.env) {
  const bin = env["AUGIE_PIPER_BIN"] ?? join(homedir(), "augie-tools", "piper");
  const model =
    env["AUGIE_PIPER_MODEL"] ??
    join(homedir(), "augie-tools", "piper-voices", "en_US-joe-medium.onnx");
  return { bin, model };
}

/** Where a catalog voice's model file lives on this core. */
export function piperVoiceModelPath(
  model: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const dir =
    env["AUGIE_PIPER_VOICES_DIR"] ?? dirname(piperPaths(env).model);
  return join(dir, `${model}.onnx`);
}

export function piperAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  const { bin, model } = piperPaths(env);
  return existsSync(bin) && existsSync(model);
}

const MAX_TEXT = 600;
const TIMEOUT_MS = 30_000;

/** An explicit voice to synthesize with: a model file + its tuning. */
export interface PiperVoiceSpec {
  modelPath: string;
  pitchFactor: number;
}

export async function synthesizeWithPiper(
  text: string,
  env: NodeJS.ProcessEnv = process.env,
  voice?: PiperVoiceSpec,
): Promise<{ ok: true; wav: Buffer } | { ok: false; reason: string }> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  if (!clean) return { ok: false, reason: "Nothing to say — the text was empty." };
  const { bin } = piperPaths(env);
  const model = voice?.modelPath ?? piperPaths(env).model;
  if (!existsSync(bin) || !existsSync(model)) {
    return {
      ok: false,
      reason: `Piper is not installed on this host (looked for ${bin} and ${model}). The browser voice remains the fallback here.`,
    };
  }
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(join(tmpdir(), "augie-piper-"));
  const outFile = join(dir, "say.wav");
  let stderr = "";
  try {
    const code = await new Promise<number | null>((resolve) => {
      const child = spawn(bin, ["--model", model, "--output_file", outFile], {
        stdio: ["pipe", "ignore", "pipe"],
      });
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve(-1);
      }, TIMEOUT_MS);
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on("error", () => {
        clearTimeout(timer);
        resolve(-2);
      });
      child.on("close", (exitCode) => {
        clearTimeout(timer);
        resolve(exitCode);
      });
      child.stdin.write(clean);
      child.stdin.end();
    });
    if (code !== 0) {
      return {
        ok: false,
        reason: `Piper exited with code ${code ?? "?"}${stderr ? `: ${stderr.slice(0, 200)}` : ""} — no voice was produced.`,
      };
    }
    const raw = await readFile(outFile);
    if (raw.length <= 44) return { ok: false, reason: "Piper produced an empty file." };
    const wav =
      voice && voice.pitchFactor < 1 ? shiftWavPitch(raw, voice.pitchFactor) : raw;
    return { ok: true, wav };
  } catch (err) {
    return {
      ok: false,
      reason: `Piper failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export interface ConstructSpeechDeps {
  env: NodeJS.ProcessEnv;
  store: VoiceSettingsStore | null;
  isModelInstalled: (model: string) => boolean;
}

export async function defaultConstructSpeechDeps(): Promise<ConstructSpeechDeps> {
  const env = process.env;
  return {
    env,
    store: await getVoiceSettingsStore(),
    isModelInstalled: (model) => existsSync(piperVoiceModelPath(model, env)),
  };
}

export type ConstructSpeechResult =
  | { ok: true; wav: Buffer; voice: ConstructVoice | null; factLine: string }
  | { ok: false; reason: string };

/**
 * Speak as the construct: resolve the Voice Lab's choice from the
 * core store (or the one explicit voice a Preview asked for) and
 * synthesize through the same Piper path every spoken line uses.
 */
export async function synthesizeConstructSpeech(
  text: string,
  deps: ConstructSpeechDeps,
  explicitVoiceId?: string,
  godId?: string,
): Promise<ConstructSpeechResult> {
  // A NAMED GOD (owner expansion 2026-11-26): every god has his
  // own voice. A line spoken for a god other than Anubis resolves
  // that god's assignment — the lab's saved assignment when one
  // stands, else his standing voice — and synthesizes with it.
  // Anubis himself is the construct resolution below (his voice
  // IS the lab's main choice). A preview that names a candidate
  // voiceId still wins for that one line, for any god.
  if (godId !== undefined && godId !== "anubis" && explicitVoiceId === undefined) {
    const settings = deps.store
      ? await deps.store.read()
      : { voiceId: null, updatedAt: null };
    const resolution = resolveGodVoice(godId, settings);
    if (!resolution) {
      return { ok: false, reason: `Unknown god "${godId}" — no voice stands for that name.` };
    }
    if (!deps.isModelInstalled(resolution.voice.model)) {
      return {
        ok: false,
        reason: `${resolution.spec.name}'s voice (Piper model ${resolution.voice.model}) is not on this core yet — its model file has not been installed, so no line was spoken in it.`,
      };
    }
    const result = await synthesizeWithPiper(text, deps.env, {
      modelPath: piperVoiceModelPath(resolution.voice.model, deps.env),
      pitchFactor: resolution.pitchFactor,
    });
    return result.ok
      ? {
          ok: true,
          wav: result.wav,
          voice: resolution.voice,
          factLine: `${resolution.spec.name} · ${godVoiceFactLine(resolution)}`,
        }
      : result;
  }

  if (explicitVoiceId !== undefined) {
    const voice = constructVoiceById(explicitVoiceId);
    if (!voice) {
      return { ok: false, reason: `Unknown voice "${explicitVoiceId}" — it is not in the Voice Lab catalog.` };
    }
    if (!deps.isModelInstalled(voice.model)) {
      return {
        ok: false,
        reason: `The ${voice.label} voice (Piper model ${voice.model}) is not on this core yet — its model file has not been installed. Pick a voice marked "on this core" to hear Piper now.`,
      };
    }
    const result = await synthesizeWithPiper(text, deps.env, {
      modelPath: piperVoiceModelPath(voice.model, deps.env),
      pitchFactor: voice.pitchFactor,
    });
    return result.ok
      ? { ok: true, wav: result.wav, voice, factLine: voiceFactLine(voice) }
      : result;
  }

  const settings = deps.store
    ? await deps.store.read()
    : { voiceId: null, updatedAt: null };
  const resolution = resolveConstructVoice(settings, deps.isModelInstalled);
  if (resolution.kind === "choice-missing") {
    return {
      ok: false,
      reason: `Your chosen voice — ${resolution.voice.label} (Piper model ${resolution.voice.model}) — is not on this core yet, so no Piper line was spoken in it. Install the model or pick another voice in the Voice Lab.`,
    };
  }
  if (resolution.kind === "voice") {
    const result = await synthesizeWithPiper(text, deps.env, {
      modelPath: piperVoiceModelPath(resolution.voice.model, deps.env),
      pitchFactor: resolution.voice.pitchFactor,
    });
    return result.ok
      ? {
          ok: true,
          wav: result.wav,
          voice: resolution.voice,
          factLine: voiceFactLine(resolution.voice),
        }
      : result;
  }
  // No catalog model on this core: keep the old escape hatch — an
  // env-pointed Piper install outside the catalog still speaks,
  // unlabeled by the lab rather than mislabeled by it.
  const result = await synthesizeWithPiper(text, deps.env);
  return result.ok
    ? { ok: true, wav: result.wav, voice: null, factLine: `Piper model ${piperPaths(deps.env).model}` }
    : result;
}

export async function handleSayRequest(request: Request): Promise<Response> {
  let text = "";
  let voiceId: string | undefined;
  let godId: string | undefined;
  try {
    const body = (await request.json()) as { text?: string; voiceId?: string; godId?: string };
    text = typeof body.text === "string" ? body.text : "";
    voiceId = typeof body.voiceId === "string" ? body.voiceId : undefined;
    godId = typeof body.godId === "string" ? body.godId : undefined;
  } catch {
    return Response.json({ error: "Expected a JSON body with a text field." }, { status: 400 });
  }
  const result = await synthesizeConstructSpeech(
    text,
    await defaultConstructSpeechDeps(),
    voiceId,
    godId,
  );
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 503 });
  }
  return new Response(new Uint8Array(result.wav), {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "no-store",
      "X-Augie-Voice":
        godId && godId !== "anubis" && result.voice
          ? `${godId}/${result.voice.id}`
          : (result.voice?.id ?? "env"),
      "X-Augie-Voice-Fact": result.factLine,
    },
  });
}
