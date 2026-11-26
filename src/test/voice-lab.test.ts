import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CONSTRUCT_VOICES,
  DEFAULT_CONSTRUCT_VOICE_ID,
  resolveConstructVoice,
  sanitizeVoiceSettings,
  voiceFactLine,
} from "@/avatar/voiceSettings";
import { shiftWavPitch } from "@/avatar/wavPitch";
import { handleSayRequest } from "@/avatar/piper.server";
import {
  handleVoiceLabGet,
  handleVoiceLabPost,
} from "@/avatar/voiceOut.server";
import { handleLearnerSayRequest } from "@/avatar/learner/learnerSay.server";
import { createVoiceSettingsStore } from "@/avatar/voiceSettingsStore.server";

/**
 * THE VOICE LAB (owner order 2026-11-26) — the repair of the lab
 * that never connected. The load-bearing test is the one that
 * would have caught the old break: set a voice through the lab's
 * own doorway, then speak through the construct's real say path —
 * the SAME voice must come out, and it must still be the choice
 * after a fresh read of the core store (persistence, not memory).
 *
 * Piper is faked honestly: a script that copies a fixture WAV to
 * the output path, so synthesis runs the real server code end to
 * end; model "installation" is the presence of the .onnx file,
 * exactly the fact the production code checks.
 */

const FRAMES = 2205;

function makeWav(frames: number): Buffer {
  const dataLength = frames * 2;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(22050, 24);
  buffer.writeUInt32LE(22050 * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataLength, 40);
  for (let i = 0; i < frames; i += 1) {
    buffer.writeInt16LE(Math.round(Math.sin(i / 8) * 12000), 44 + i * 2);
  }
  return buffer;
}

const FAKE_PIPER = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const out = args[args.indexOf("--output_file") + 1];
process.stdin.resume();
process.stdin.on("end", () => {
  fs.copyFileSync(process.env.FAKE_PIPER_FIXTURE, out);
});
`;

let root = "";
let modelsDir = "";
let storeDir = "";
let fixturePath = "";
let fixture: Buffer;
const savedEnv: Record<string, string | undefined> = {};
const ENV_KEYS = [
  "AUGIE_PIPER_BIN",
  "AUGIE_PIPER_MODEL",
  "AUGIE_PIPER_VOICES_DIR",
  "AUGIE_VOICE_DIR",
  "FAKE_PIPER_FIXTURE",
];

async function installModel(model: string): Promise<void> {
  await writeFile(join(modelsDir, `${model}.onnx`), "fake-model");
}

async function removeModel(model: string): Promise<void> {
  await rm(join(modelsDir, `${model}.onnx`), { force: true });
}

function sayRequest(body: unknown): Request {
  return new Request("http://core.local/api/say", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function labPost(body: unknown): Request {
  return new Request("http://core.local/api/voice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  root = await mkdtemp(join(tmpdir(), "augie-voice-lab-"));
  modelsDir = join(root, "voices");
  storeDir = join(root, "store");
  await mkdir(modelsDir, { recursive: true });
  await mkdir(storeDir, { recursive: true });
  fixture = makeWav(FRAMES);
  fixturePath = join(root, "fixture.wav");
  await writeFile(fixturePath, fixture);
  const binPath = join(root, "piper");
  await writeFile(binPath, FAKE_PIPER);
  await chmod(binPath, 0o755);
  process.env["AUGIE_PIPER_BIN"] = binPath;
  process.env["AUGIE_PIPER_MODEL"] = join(modelsDir, "en_US-joe-medium.onnx");
  process.env["AUGIE_PIPER_VOICES_DIR"] = modelsDir;
  process.env["AUGIE_VOICE_DIR"] = storeDir;
  process.env["FAKE_PIPER_FIXTURE"] = fixturePath;
});

afterEach(async () => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  await rm(root, { recursive: true, force: true });
});

describe("the catalog and the choice sanitizer", () => {
  it("the standing default is the deep, dark, disciplined voice, with deep alternatives and the previous voice kept", () => {
    const deep = CONSTRUCT_VOICES.filter((voice) => voice.deep);
    expect(deep.length).toBeGreaterThanOrEqual(4);
    expect(DEFAULT_CONSTRUCT_VOICE_ID).toBe("anubis-deep");
    const anubis = CONSTRUCT_VOICES.find((voice) => voice.id === "anubis-deep");
    expect(anubis?.model).toBe("en_US-ryan-low");
    expect(anubis?.label).toMatch(/deep, dark, disciplined/i);
    expect(anubis?.pitchFactor).toBeLessThan(1);
    const previous = CONSTRUCT_VOICES.find((voice) => voice.id === "joe-medium");
    expect(previous?.model).toBe("en_US-joe-medium");
    expect(previous?.pitchFactor).toBe(1);
    for (const voice of CONSTRUCT_VOICES) {
      expect(voice.pitchFactor).toBeGreaterThanOrEqual(0.8);
      expect(voice.pitchFactor).toBeLessThanOrEqual(1);
      expect(voiceFactLine(voice)).toContain(voice.model);
    }
    expect(voiceFactLine(anubis!)).toMatch(/pitch shifted down 12%/);
  });

  it("sanitize keeps a real choice and drops anything else to 'no choice'", () => {
    expect(sanitizeVoiceSettings({ voiceId: "danny-low" }).voiceId).toBe("danny-low");
    expect(sanitizeVoiceSettings({ voiceId: "not-a-voice" }).voiceId).toBeNull();
    expect(sanitizeVoiceSettings(null).voiceId).toBeNull();
    expect(sanitizeVoiceSettings("danny-low").voiceId).toBeNull();
  });

  it("resolution: choice wins, a missing choice-model is reported (never silently swapped), fresh store takes the deep default then the first deep voice the core has", () => {
    const all = () => true;
    const none = () => false;
    expect(
      resolveConstructVoice({ voiceId: "danny-low", updatedAt: null }, all),
    ).toMatchObject({ kind: "voice", source: "choice" });
    expect(
      resolveConstructVoice({ voiceId: "danny-low", updatedAt: null }, (m) =>
        m.includes("joe"),
      ),
    ).toMatchObject({ kind: "choice-missing" });
    expect(resolveConstructVoice({ voiceId: null, updatedAt: null }, all)).toMatchObject({
      kind: "voice",
      source: "default",
      voice: { id: "anubis-deep" },
    });
    expect(
      resolveConstructVoice({ voiceId: null, updatedAt: null }, (m) => m.includes("danny")),
    ).toMatchObject({ kind: "voice", source: "fallback", voice: { id: "danny-low" } });
    expect(
      resolveConstructVoice({ voiceId: null, updatedAt: null }, (m) => m.includes("joe")),
    ).toMatchObject({ kind: "voice", source: "fallback", voice: { id: "joe-medium" } });
    expect(resolveConstructVoice({ voiceId: null, updatedAt: null }, none)).toEqual({
      kind: "none",
    });
  });
});

describe("the pitch shift", () => {
  it("deepens by lengthening: factor 0.88 yields floor(frames / 0.88) frames and truthful size fields", () => {
    const shifted = shiftWavPitch(fixture, 0.88);
    const expectedFrames = Math.floor(FRAMES / 0.88);
    expect(shifted.length).toBe(44 + expectedFrames * 2);
    expect(shifted.readUInt32LE(40)).toBe(expectedFrames * 2);
    expect(shifted.readUInt32LE(4)).toBe(36 + expectedFrames * 2);
    expect(shifted.toString("ascii", 0, 4)).toBe("RIFF");
  });

  it("factor 1 and non-WAV input pass through untouched", () => {
    expect(shiftWavPitch(fixture, 1)).toBe(fixture);
    const junk = Buffer.from("not a wav at all, just bytes");
    expect(shiftWavPitch(junk, 0.88)).toBe(junk);
  });
});

describe("the wire: lab choice → the construct's real speech path", () => {
  it("a fresh store speaks in the deep default, pitch-shifted", async () => {
    await installModel("en_US-ryan-low");
    await installModel("en_US-joe-medium");
    const res = await handleSayRequest(sayRequest({ text: "At your command, Zero." }));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Augie-Voice")).toBe("anubis-deep");
    const wav = Buffer.from(await res.arrayBuffer());
    expect(wav.length).toBe(44 + Math.floor(FRAMES / 0.88) * 2);
  });

  it("THE DISCONNECT TEST: a voice chosen in the lab is the voice the say path speaks in — and it persists in the core store", async () => {
    await installModel("en_US-ryan-low");
    await installModel("en_US-danny-low");
    await installModel("en_US-joe-medium");
    const chosen = await handleVoiceLabPost(labPost({ voiceId: "danny-low" }));
    expect(chosen.status).toBe(200);
    const view = (await chosen.json()) as { chosenVoiceId: string };
    expect(view.chosenVoiceId).toBe("danny-low");

    const res = await handleSayRequest(sayRequest({ text: "Report ready, Zero." }));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Augie-Voice")).toBe("danny-low");
    const wav = Buffer.from(await res.arrayBuffer());
    expect(wav.length).toBe(44 + Math.floor(FRAMES / 0.93) * 2);

    // Persistence is a fresh read of the file, not the handler's memory.
    const fresh = createVoiceSettingsStore(fsp, storeDir);
    expect((await fresh.read()).voiceId).toBe("danny-low");
    const onDisk = JSON.parse(await readFile(join(storeDir, "voice-settings.json"), "utf8")) as {
      voiceId: string;
    };
    expect(onDisk.voiceId).toBe("danny-low");
  });

  it("a preview synthesizes through the same say path with the named voice and leaves the stored choice untouched", async () => {
    await installModel("en_US-danny-low");
    await installModel("en_GB-alan-low");
    await handleVoiceLabPost(labPost({ voiceId: "danny-low" }));
    const res = await handleSayRequest(
      sayRequest({ text: "Anubis, at your command, Zero.", voiceId: "alan-low" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Augie-Voice")).toBe("alan-low");
    const fresh = createVoiceSettingsStore(fsp, storeDir);
    expect((await fresh.read()).voiceId).toBe("danny-low");
  });

  it("when the chosen voice's model leaves the core, the say path answers honestly instead of silently swapping voices", async () => {
    await installModel("en_US-danny-low");
    await handleVoiceLabPost(labPost({ voiceId: "danny-low" }));
    await removeModel("en_US-danny-low");
    const res = await handleSayRequest(sayRequest({ text: "Zero." }));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/en_US-danny-low/);
    expect(body.error).toMatch(/not on this core/);
  });

  it("the lab refuses a voice whose model is not on this core, and the GET view reports installation truthfully", async () => {
    await installModel("en_US-ryan-low");
    const refused = await handleVoiceLabPost(labPost({ voiceId: "bryce-medium" }));
    expect(refused.status).toBe(400);
    const body = (await refused.json()) as { error: string };
    expect(body.error).toMatch(/en_US-bryce-medium/);

    const view = (await (await handleVoiceLabGet()).json()) as {
      entries: Array<{ voice: { id: string }; installed: boolean; isDefault: boolean }>;
      speaking: { voiceId: string | null };
    };
    expect(view.speaking.voiceId).toBe("anubis-deep");
    expect(view.entries.find((e) => e.voice.id === "anubis-deep")?.installed).toBe(true);
    expect(view.entries.find((e) => e.voice.id === "anubis-deep")?.isDefault).toBe(true);
    expect(view.entries.find((e) => e.voice.id === "bryce-medium")?.installed).toBe(false);
  });

  it("a fresh store with only the previous voice installed speaks in it, unshifted", async () => {
    await installModel("en_US-joe-medium");
    const res = await handleSayRequest(sayRequest({ text: "Zero." }));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Augie-Voice")).toBe("joe-medium");
    const wav = Buffer.from(await res.arrayBuffer());
    expect(wav.equals(fixture)).toBe(true);
  });
});

describe("Khadija's side is untouched", () => {
  it("her say doorway still speaks the installed default with NO lab tuning, even while a deep choice is stored for Anubis", async () => {
    await installModel("en_US-joe-medium");
    await installModel("en_US-danny-low");
    await handleVoiceLabPost(labPost({ voiceId: "danny-low" }));
    const res = await handleLearnerSayRequest(
      new Request("http://learner.local/api/learner/say", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "Hello Khadija" }),
      }),
    );
    expect(res.status).toBe(200);
    const wav = Buffer.from(await res.arrayBuffer());
    expect(wav.equals(fixture)).toBe(true);
  });
});
