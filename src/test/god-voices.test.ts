/**
 * EVERY GOD HAS A VOICE (owner expansion 2026-11-26 ~12:51 CST):
 * per-god voice assignments across the whole roster — goddesses
 * in women's voices, every assignment labeled by its real model
 * and pitch shift — plus the serious-speech classification
 * (repair proposals and update-apply requests are spoken to
 * Zero; routine system entries stay silent text) and the lab's
 * per-god preview + assignment wiring.
 */
import { readFileSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import {
  CONSTRUCT_VOICES,
  GOD_VOICES,
  constructVoiceById,
  godVoiceSpec,
  resolveGodVoice,
  sanitizeVoiceSettings,
  type VoiceSettingsFile,
} from "@/avatar/voiceSettings";
import { handleSayRequest } from "@/avatar/piper.server";
import {
  handleVoiceLabPost,
  readVoiceLab,
  setGodVoiceChoice,
  type VoiceOutDeps,
} from "@/avatar/voiceOut.server";
import {
  isSeriousSystemEntry,
  seriousSpeechLine,
} from "@/avatar/seriousSpeech";
import { VoiceLabPanel } from "@/avatar/VoiceLabPanel";
import type { AnubisNotification } from "@/avatar/cameras/anubisInbox";

/* ------------------------------ fixtures ------------------------------ */

function makeWav(frames: number, sampleRate = 22050): Buffer {
  const dataBytes = frames * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);
  return buf;
}
const RAW_FRAMES = 4410;
const RAW_WAV = makeWav(RAW_FRAMES);

function makeStore(initial?: Partial<VoiceSettingsFile>) {
  let file: VoiceSettingsFile = sanitizeVoiceSettings(initial ?? {});
  return {
    dataDirectory: "/tmp/god-voices-test",
    read: async () => file,
    update: async (fn: (f: VoiceSettingsFile) => VoiceSettingsFile) => {
      file = fn(file);
      return file;
    },
    current: () => file,
  };
}

/* The real say path, end to end (the voice-lab.test.ts harness):
 * a fake Piper binary script that copies a fixture WAV to the
 * output path, model "installation" as the .onnx file's presence,
 * the real core store on disk, and the real HTTP handlers — so a
 * god line spoken here went through everything production runs. */
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

async function spokenWav(response: Response): Promise<Buffer> {
  return Buffer.from(await response.arrayBuffer());
}

beforeEach(async () => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  root = await mkdtemp(join(tmpdir(), "augie-god-voices-"));
  modelsDir = join(root, "voices");
  const binDir = join(root, "bin");
  const storeDir = join(root, "store");
  await mkdir(modelsDir, { recursive: true });
  await mkdir(binDir, { recursive: true });
  await mkdir(storeDir, { recursive: true });
  const binPath = join(binDir, "piper");
  await writeFile(binPath, FAKE_PIPER);
  await chmod(binPath, 0o755);
  const fixturePath = join(root, "fixture.wav");
  await writeFile(fixturePath, RAW_WAV);
  process.env["AUGIE_PIPER_BIN"] = binPath;
  process.env["AUGIE_PIPER_VOICES_DIR"] = modelsDir;
  process.env["AUGIE_VOICE_DIR"] = storeDir;
  process.env["FAKE_PIPER_FIXTURE"] = fixturePath;
  delete process.env["AUGIE_PIPER_MODEL"];
  for (const voice of CONSTRUCT_VOICES) await installModel(voice.model);
});

afterEach(async () => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

function entry(partial: Partial<AnubisNotification>): AnubisNotification {
  return {
    id: "ntf-x",
    at: 1,
    kind: "system",
    title: "",
    text: "",
    sourceEventId: "ev",
    cameraId: "",
    cameraName: "",
    still: "",
    reasoning: "",
    read: false,
    ...partial,
  };
}

/* ------------------------------ the roster ---------------------------- */

describe("the roster of god voices", () => {
  it("covers the whole house: his five gods, the eight, and Amun-Ra", () => {
    const ids = GOD_VOICES.map((g) => g.godId);
    expect(ids).toEqual([
      "anubis", "osiris", "montu", "horus", "horusec",
      "nu", "heh", "kek", "amun", "amun-ra",
      "naunet", "hauhet", "kauket", "amunet",
    ]);
    for (const spec of GOD_VOICES) {
      expect(constructVoiceById(spec.voiceId), spec.godId).not.toBeNull();
      expect(spec.pitchFactor).toBeGreaterThanOrEqual(0.85);
      expect(spec.pitchFactor).toBeLessThanOrEqual(1);
    }
  });

  it("the goddesses of the eight stand in women's voices", () => {
    for (const godId of ["naunet", "hauhet", "kauket", "amunet"]) {
      const resolution = resolveGodVoice(godId, sanitizeVoiceSettings({}));
      expect(resolution, godId).not.toBeNull();
      expect(resolution!.voice.gender, godId).toBe("female");
      expect(resolution!.spec.gender, godId).toBe("female");
    }
  });

  it("Anubis's standing spec is the deep, dark, disciplined voice", () => {
    const spec = godVoiceSpec("anubis");
    expect(spec?.voiceId).toBe("anubis-deep");
    expect(spec?.pitchFactor).toBe(0.88);
    // Anubis resolves through the construct choice, not this helper.
    expect(resolveGodVoice("anubis", sanitizeVoiceSettings({}))).toBeNull();
  });

  it("a lab assignment wins for its god — at the assigned voice's own pitch", () => {
    const settings = sanitizeVoiceSettings({ godVoices: { osiris: "bryce-medium" } });
    const resolution = resolveGodVoice("osiris", settings);
    expect(resolution?.source).toBe("assigned");
    expect(resolution?.voice.id).toBe("bryce-medium");
    expect(resolution?.pitchFactor).toBe(constructVoiceById("bryce-medium")!.pitchFactor);
  });

  it("the sanitizer keeps only real gods with real voices", () => {
    const settings = sanitizeVoiceSettings({
      godVoices: { montu: "alan-low", zeus: "alan-low", kek: "not-a-voice" },
    });
    expect(settings.godVoices).toEqual({ montu: "alan-low" });
  });
});

/* --------------------------- the say path ----------------------------- */

describe("the speech path speaks for each god", () => {
  it("Montu speaks in Alan, shifted to Montu's own pitch", async () => {
    const response = await handleSayRequest(
      sayRequest({ text: "On watch.", godId: "montu" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Augie-Voice")).toBe("montu/alan-low");
    const wav = await spokenWav(response);
    expect(wav.readUInt32LE(40) / 2).toBe(Math.round(RAW_FRAMES / 0.92));
  });

  it("Naunet speaks in Kathleen at her natural pitch — no shift", async () => {
    const response = await handleSayRequest(
      sayRequest({ text: "The waters are still.", godId: "naunet" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Augie-Voice")).toBe("naunet/kathleen-low");
    const wav = await spokenWav(response);
    expect(wav.readUInt32LE(40) / 2).toBe(RAW_FRAMES);
  });

  it("Kauket shares Naunet's model at a deeper shift — and says so", { timeout: 30000 }, async () => {
    const naunet = await handleSayRequest(
      sayRequest({ text: "Still waters.", godId: "naunet" }),
    );
    const kauket = await handleSayRequest(
      sayRequest({ text: "Dark waters.", godId: "kauket" }),
    );
    expect(naunet.status).toBe(200);
    expect(kauket.status).toBe(200);
    expect(kauket.headers.get("X-Augie-Voice")).toBe("kauket/kathleen-low");
    const naunetWav = await spokenWav(naunet);
    const kauketWav = await spokenWav(kauket);
    expect(kauketWav.length).toBeGreaterThan(naunetWav.length);
    expect(godVoiceSpec("kauket")?.note).toContain("same model as Naunet");
  });

  it("an unknown god is refused plainly; a missing model names the god and the model", async () => {
    const unknown = await handleSayRequest(
      sayRequest({ text: "Speak.", godId: "zeus" }),
    );
    expect(unknown.status).toBe(503);
    const unknownBody = (await unknown.json()) as { error: string };
    expect(unknownBody.error).toContain("Unknown god");

    await rm(join(modelsDir, "en_GB-jenny_dioco-medium.onnx"), { force: true });
    const missing = await handleSayRequest(
      sayRequest({ text: "Speak.", godId: "amunet" }),
    );
    expect(missing.status).toBe(503);
    const missingBody = (await missing.json()) as { error: string };
    expect(missingBody.error).toContain("Amunet");
    expect(missingBody.error).toContain("en_GB-jenny_dioco-medium");
  });

  it("PER-GOD DISCONNECT TEST: a voice assigned in the lab is the voice the say path speaks for that god", async () => {
    const post = await handleVoiceLabPost(
      labPost({ godId: "osiris", voiceId: "bryce-medium" }),
    );
    expect(post.status).toBe(200);

    const spoken = await handleSayRequest(
      sayRequest({ text: "The core is steady.", godId: "osiris" }),
    );
    expect(spoken.status).toBe(200);
    expect(spoken.headers.get("X-Augie-Voice")).toBe("osiris/bryce-medium");
  });

  it("assigning Anubis through the gods writes the main choice — one store, one truth", async () => {
    const store = makeStore();
    const deps: VoiceOutDeps = { store, isModelInstalled: () => true };
    const set = await setGodVoiceChoice(deps, "anubis", "danny-low");
    expect(set.ok).toBe(true);
    expect(store.current().voiceId).toBe("danny-low");
  });

  it("the lab view carries every god with an honest fact line", async () => {
    const view = await readVoiceLab({
      store: makeStore(),
      isModelInstalled: () => true,
    });
    expect(view.gods).toHaveLength(14);
    const naunet = view.gods.find((g) => g.godId === "naunet");
    expect(naunet?.factLine).toContain("en_US-kathleen-low");
    expect(naunet?.source).toBe("standing");
    const anubis = view.gods.find((g) => g.godId === "anubis");
    expect(anubis?.voiceId).toBe("anubis-deep");
    expect(anubis?.source).toBe("default");
  });
});

/* --------------------------- serious speech --------------------------- */

describe("serious things are spoken; routine things stay silent", () => {
  it("a repair proposal and an update-apply request are serious", () => {
    expect(isSeriousSystemEntry(entry({ title: "System — a repair was proposed" }))).toBe(true);
    expect(isSeriousSystemEntry(entry({ title: "System — an update was requested" }))).toBe(true);
  });

  it("update checks, test results, suggestions and captures are NOT spoken", () => {
    expect(isSeriousSystemEntry(entry({ title: "System — an update check ran" }))).toBe(false);
    expect(isSeriousSystemEntry(entry({ title: "System — a test result was recorded" }))).toBe(false);
    expect(
      isSeriousSystemEntry(
        entry({ kind: "suggestion", title: "System — a repair was proposed" }),
      ),
    ).toBe(false);
  });

  it("the spoken line addresses Zero and carries the recorded words", () => {
    const line = seriousSpeechLine(
      entry({
        title: "System — a repair was proposed",
        text: "A repair was proposed for the voice store. Awaiting your word.",
      }),
    );
    expect(line.startsWith("Zero. ")).toBe(true);
    expect(line).toContain("A repair was proposed for the core.");
    expect(line).toContain("voice store");
    expect(line).not.toContain("Captain");
  });
});

/* ------------------------------ the panel ----------------------------- */

const PANEL_VIEW = {
  entries: CONSTRUCT_VOICES.map((voice) => ({
    voice,
    factLine: `Piper model ${voice.model}`,
    installed: true,
    isDefault: voice.id === "anubis-deep",
    isChosen: false,
  })),
  chosenVoiceId: null,
  speaking: { voiceId: "anubis-deep", factLine: "Piper model en_US-ryan-low", note: "note" },
  gods: GOD_VOICES.map((spec) => {
    const voice = constructVoiceById(spec.voiceId)!;
    return {
      godId: spec.godId,
      name: spec.name,
      gender: spec.gender,
      note: spec.note,
      voiceId: spec.voiceId,
      voiceLabel: voice.label,
      factLine: `Piper model ${voice.model}`,
      installed: true,
      source: spec.godId === "anubis" ? "default" : "standing",
    };
  }),
};

describe("VoiceLabPanel — the gods' voices", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let sayBodies: Record<string, unknown>[];

  beforeEach(() => {
    sayBodies = [];
    fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (url === "/api/voice" && init?.method === "POST") {
        return { ok: true, status: 200, json: async () => PANEL_VIEW };
      }
      if (url === "/api/voice") {
        return { ok: true, status: 200, json: async () => PANEL_VIEW };
      }
      if (url === "/api/say") {
        sayBodies.push(JSON.parse(init?.body ?? "{}") as Record<string, unknown>);
        return {
          ok: true,
          status: 200,
          blob: async () => new Blob([new Uint8Array(RAW_WAV)], { type: "audio/wav" }),
        };
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    URL.createObjectURL = vi.fn(() => "blob:god-preview");
    URL.revokeObjectURL = vi.fn();
    HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
  });

  it("renders a row for every god, goddesses included", { timeout: 30000 }, async () => {
    render(createElement(VoiceLabPanel));
    expect(await screen.findByText("The voices of the gods", undefined, { timeout: 15000 })).toBeTruthy();
    for (const name of ["Osiris", "Montu", "Horus", "Naunet", "Hauhet", "Kauket", "Amunet", "Amun-Ra"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it("previewing a god speaks through the say path with his godId, addressed to Zero", { timeout: 30000 }, async () => {
    render(createElement(VoiceLabPanel));
    await screen.findByText("The voices of the gods", undefined, { timeout: 15000 });
    const montuRow = screen.getByText("Montu").closest("li")!;
    const previewBtn = [...montuRow.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Preview"),
    )!;
    fireEvent.click(previewBtn);
    await waitFor(() => expect(sayBodies.length).toBe(1), { timeout: 10000 });
    expect(sayBodies[0]?.["godId"]).toBe("montu");
    expect(String(sayBodies[0]?.["text"])).toContain("Zero");
  });

  it("assigning a god posts the god assignment to the core doorway", { timeout: 30000 }, async () => {
    render(createElement(VoiceLabPanel));
    await screen.findByText("The voices of the gods", undefined, { timeout: 15000 });
    const osirisRow = screen.getByText("Osiris").closest("li")!;
    const select = osirisRow.querySelector("select")!;
    fireEvent.change(select, { target: { value: "bryce-medium" } });
    const assignBtn = [...osirisRow.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Assign to Osiris"),
    )!;
    fireEvent.click(assignBtn);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          (call) =>
            call[0] === "/api/voice" &&
            (call[1] as { body?: string })?.body ===
              JSON.stringify({ godId: "osiris", voiceId: "bryce-medium" }),
        ),
      ).toBe(true),
    );
  });
});

/* --------------------------- manual honesty --------------------------- */

describe("the manual covers the gods' voices", () => {
  it("the in-app manual entry names the per-god lab and the Zero address law", () => {
    const text = readFileSync(
      join(process.cwd(), "src/avatar/manualContent.ts"),
      "utf8",
    );
    const start = text.indexOf('id: "voice-lab"');
    expect(start).toBeGreaterThan(-1);
    const section = text.slice(start, start + 6000);
    expect(section).toContain("voices of the gods");
    expect(section).toContain("Zero");
  });
});
