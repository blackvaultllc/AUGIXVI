/**
 * PIPER VOICE-OUT (owner item, 2026-11-21) — Augie's local voice.
 * Piper is installed on the Parrot (~/augie-tools/piper, voice
 * en_US-joe-medium) but was never wired into the app; the app spoke
 * only through the browser's speechSynthesis (and ElevenLabs when
 * configured). This module is the wire: text in, WAV out, generated
 * ON this machine. Where Piper isn't installed (any other host), it
 * answers 503 honestly and the app falls back to the browser voice —
 * it never pretends to be Piper when it isn't.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function piperPaths(env: NodeJS.ProcessEnv = process.env) {
  const bin = env["AUGIE_PIPER_BIN"] ?? join(homedir(), "augie-tools", "piper");
  const model =
    env["AUGIE_PIPER_MODEL"] ??
    join(homedir(), "augie-tools", "piper-voices", "en_US-joe-medium.onnx");
  return { bin, model };
}

export function piperAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  const { bin, model } = piperPaths(env);
  return existsSync(bin) && existsSync(model);
}

const MAX_TEXT = 600;
const TIMEOUT_MS = 30_000;

export async function synthesizeWithPiper(
  text: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true; wav: Buffer } | { ok: false; reason: string }> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  if (!clean) return { ok: false, reason: "Nothing to say — the text was empty." };
  const { bin, model } = piperPaths(env);
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
    const wav = await readFile(outFile);
    if (wav.length <= 44) return { ok: false, reason: "Piper produced an empty file." };
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

export async function handleSayRequest(request: Request): Promise<Response> {
  let text = "";
  try {
    const body = (await request.json()) as { text?: string };
    text = typeof body.text === "string" ? body.text : "";
  } catch {
    return Response.json({ error: "Expected a JSON body with a text field." }, { status: 400 });
  }
  const result = await synthesizeWithPiper(text);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 503 });
  }
  return new Response(new Uint8Array(result.wav), {
    status: 200,
    headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
  });
}
