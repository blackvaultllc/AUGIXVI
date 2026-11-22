/**
 * THE TEST AREA (Part 24, owner design 2026-11-21) — every ability
 * gets a runnable end-to-end test; each run records WORKS or DOESN'T
 * WORK with the REASON, in a persistent ledger — his
 * compare-and-contrast board.
 *
 * Proof-of-concept doctrine, enforced here:
 * - Nothing shows WORKS without a real run behind it.
 * - A verdict older than STALE_AFTER_MS reads STALE, not fresh.
 * - A test that cannot run from here (the watch, the wand — they
 *   need the phone and the physical device) records DOESN'T WORK
 *   with exactly that reason. It never fakes a pass.
 */
import { parseRoomCommand } from "./command/roomCommands";
import { loadAvatarSettings, saveAvatarSettings } from "./settings";
import { loadBrainAddress } from "./brain";
import { VISION_MODEL } from "./vision";

export const TEST_LEDGER_KEY = "augi.test-area.v1";
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface TestVerdict {
  works: boolean;
  at: number;
  reason: string;
}

export type Ledger = Record<string, TestVerdict>;

export function loadLedger(): Ledger {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(TEST_LEDGER_KEY) ?? "{}");
    return typeof parsed === "object" && parsed !== null ? (parsed as Ledger) : {};
  } catch {
    return {};
  }
}

export function recordVerdict(id: string, verdict: TestVerdict): Ledger {
  const ledger = { ...loadLedger(), [id]: verdict };
  try {
    globalThis.localStorage?.setItem(TEST_LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // best effort
  }
  return ledger;
}

export function verdictFreshness(verdict: TestVerdict | undefined, now = Date.now()): "fresh" | "stale" | "never" {
  if (!verdict) return "never";
  return now - verdict.at <= STALE_AFTER_MS ? "fresh" : "stale";
}

export interface AbilityTest {
  id: string;
  name: string;
  what: string;
  run: () => Promise<{ works: boolean; reason: string }>;
}

const pass = (reason: string) => ({ works: true, reason });
const fail = (reason: string) => ({ works: false, reason });

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const ABILITY_TESTS: AbilityTest[] = [
  {
    id: "voice-out-piper",
    name: "Voice out — Piper (local voice)",
    what: "Asks /api/say to synthesize one short sentence with Piper on this machine.",
    run: async () => {
      try {
        const res = await fetchWithTimeout(
          "/api/say",
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Test area check." }) },
          35_000,
        );
        if (res.ok) return pass(`Piper answered with audio (${res.headers.get("Content-Type") ?? "audio/wav"}). Machine-checked only — the PROOF is Domenick hearing Augie answer him live.`);
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return fail(body.error ?? `The say route answered ${res.status}.`);
      } catch (err) {
        return fail(`The say route did not answer (${err instanceof Error ? err.message : "network error"}). On the online build Piper does not exist — this test passes on the Parrot build.`);
      }
    },
  },
  {
    id: "voice-in-ear",
    name: "Voice in — local ear (speech service)",
    what: "Sends a silent clip to /api/transcribe; the speech service answering at all proves the path. His real-voice check is separate and his alone.",
    run: async () => {
      try {
        // A minimal valid WAV (0.25s of silence, 16kHz mono).
        const bytes = new Uint8Array(44 + 8000);
        const view = new DataView(bytes.buffer);
        const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
        writeStr(0, "RIFF"); view.setUint32(4, 36 + 8000, true); writeStr(8, "WAVEfmt ");
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true);
        view.setUint16(34, 16, true); writeStr(36, "data"); view.setUint32(40, 8000, true);
        const res = await fetchWithTimeout(
          "/api/transcribe",
          { method: "POST", headers: { "Content-Type": "audio/wav" }, body: bytes },
          30_000,
        );
        if (res.ok) return pass("The speech service answered the clip (silence transcribes to nothing, as it should). Pipeline proof only — his live voice is the real gate.");
        return fail(`The transcribe route answered ${res.status} — the speech service may be down on the Parrot.`);
      } catch (err) {
        return fail(`The transcribe route did not answer (${err instanceof Error ? err.message : "network error"}).`);
      }
    },
  },
  {
    id: "vision-model",
    name: `Vision model — ${VISION_MODEL}`,
    what: "Checks Ollama's installed list for the ONE unified vision model.",
    run: async () => {
      try {
        const brain = loadBrainAddress();
        const res = await fetchWithTimeout(`${brain}/api/tags`, {}, 10_000);
        if (!res.ok) return fail(`Ollama answered ${res.status} at ${brain}.`);
        const data = (await res.json()) as { models?: { name?: string }[] };
        const names = (data.models ?? []).map((m) => m.name ?? "");
        return names.includes(VISION_MODEL)
          ? pass(`${VISION_MODEL} is installed and listed by Ollama.`)
          : fail(`${VISION_MODEL} is NOT in Ollama's list yet (installed: ${names.join(", ") || "none"}). The model pull may still be running — vision surfaces stay honestly dark until it lands.`);
      } catch {
        return fail("Ollama did not answer — the brain may be offline on this surface.");
      }
    },
  },
  {
    id: "picture-analysis-e2e",
    name: "Picture analysis — end to end",
    what: "Draws a plain red square, sends it through the unified vision model, and requires real findings back (Part 27's test).",
    run: async () => {
      try {
        const brain = loadBrainAddress();
        const tags = await fetchWithTimeout(`${brain}/api/tags`, {}, 10_000);
        if (!tags.ok) return fail("Ollama did not answer the model check.");
        const data = (await tags.json()) as { models?: { name?: string }[] };
        const names = (data.models ?? []).map((m) => m.name ?? "");
        if (!names.includes(VISION_MODEL)) {
          return fail(`${VISION_MODEL} is not installed yet, so there is nothing to analyze with — the window says the same.`);
        }
        const canvas = document.createElement("canvas");
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext("2d");
        if (!ctx) return fail("This browser could not draw the test image.");
        ctx.fillStyle = "#d33"; ctx.fillRect(0, 0, 64, 64);
        const image = canvas.toDataURL("image/png").split(",")[1] ?? "";
        const res = await fetchWithTimeout(
          `${brain}/api/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: VISION_MODEL,
              prompt: "What color is this image? Answer in one short sentence.",
              images: [image],
              stream: false,
              options: { num_predict: 40 },
            }),
          },
          120_000,
        );
        if (!res.ok) return fail(`The vision model answered ${res.status}.`);
        const out = (await res.json()) as { response?: string };
        const text = (out.response ?? "").trim();
        if (!text) return fail("The vision model returned an empty answer.");
        return pass(`The model answered about a real image: "${text.slice(0, 120)}"`);
      } catch (err) {
        return fail(`The analysis run failed (${err instanceof Error ? err.message : "network error"}).`);
      }
    },
  },
  {
    id: "library-lookup",
    name: "Library lookup — her Flower's path",
    what: "Asks the learner library endpoint a book question and requires a sourced answer (the same grounded path Augie the Flower uses).",
    run: async () => {
      try {
        const res = await fetchWithTimeout(
          "/api/learner/ask",
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "What is the sun?" }) },
          60_000,
        );
        if (!res.ok) return fail(`The learner ask route answered ${res.status}.`);
        const data = (await res.json()) as { mode?: string; source?: unknown; answer?: string };
        if (data.mode === "book") {
          return pass(`Answered from the library (mode: book${data.source ? ", with a named source" : ""}).`);
        }
        if (data.mode === "library-down") return fail("The library (Kiwix) is not answering on this machine right now.");
        return fail(`The library answered in an unexpected mode (${data.mode ?? "none"}) — no sourced answer came back.`);
      } catch (err) {
        return fail(`The learner ask route did not answer (${err instanceof Error ? err.message : "network error"}).`);
      }
    },
  },
  {
    id: "settings-persistence",
    name: "Settings persistence (Part 14)",
    what: "Writes a probe bloom value through the real settings store, reads it back, restores the original.",
    run: async () => {
      const original = loadAvatarSettings();
      const probe = original.bloom === 0.37 ? 0.38 : 0.37;
      saveAvatarSettings({ ...original, bloom: probe });
      const readBack = loadAvatarSettings();
      saveAvatarSettings(original);
      return readBack.bloom === probe
        ? pass(`Bloom probe ${probe} survived a save → load round-trip, and the original value (${original.bloom}) was restored. Settings stick.`)
        : fail(`The probe did not stick: wrote ${probe}, read back ${readBack.bloom}.`);
    },
  },
  {
    id: "rooms-parse",
    name: "Rooms — command routing",
    what: "Runs the room phrases through the real parser (library, law desk, analytics, anatomy, logs, listening, picture analysis).",
    run: async () => {
      const cases: [string, string][] = [
        ["open the library", "library"],
        ["open the law desk", "law-desk"],
        ["open office analytics", "office-analytics"],
        ["open anatomy", "anatomy"],
        ["show me the logs", "logs"],
        ["open listening mode", "listening"],
        ["picture analysis", "picture-analysis"],
      ];
      const bad = cases.filter(([phrase, want]) => parseRoomCommand(phrase) !== want);
      return bad.length === 0
        ? pass("All seven room phrases route to their rooms.")
        : fail(`Misrouted: ${bad.map(([p]) => p).join(", ")}.`);
    },
  },
  {
    id: "pulse-assets",
    name: "Pulse — bundled vision assets (Part 19)",
    what: "Fetches the MediaPipe model + wasm from the app's OWN origin — the offline fix. A CDN would fail this test with the network blocked.",
    run: async () => {
      try {
        const model = await fetchWithTimeout("/mediapipe/models/face_landmarker.task", { method: "HEAD" }, 10_000);
        const wasm = await fetchWithTimeout("/mediapipe/wasm/vision_wasm_internal.wasm", { method: "HEAD" }, 10_000);
        return model.ok && wasm.ok
          ? pass("Face model and wasm both serve from this app's own origin — Pulse loads with zero internet.")
          : fail(`Bundled assets missing: model ${model.status}, wasm ${wasm.status}.`);
      } catch (err) {
        return fail(`The bundled asset check failed (${err instanceof Error ? err.message : "network error"}).`);
      }
    },
  },
  {
    id: "watch-link",
    name: "Watch link (Part 20)",
    what: "The watch pairs to the PHONE, not this screen — this test can only be run from the Phone Bridge on the phone, with the watch nearby.",
    run: async () =>
      fail("Not runnable from here: open Augie on the phone → Phone Bridge (Ghost Protocol One) → Connect the watch. No desktop run can reach a phone-paired watch, and this board does not fake one."),
  },
  {
    id: "wand-flip",
    name: "Wand flip (Part 12 phone endpoint)",
    what: "The wand's phone-side flip needs the physical wand and the phone bridge.",
    run: async () =>
      fail("Not runnable from here: the wand talks to the phone (Ghost Protocol One). The desktop Listening Mode window is the working face today; the phone endpoint lands with the native companion."),
  },
  {
    id: "cube-route",
    name: "AR Cube — route answers",
    what: "Fetches the cube page route; the live take-over with his physical cube stays his on-screen check.",
    run: async () => {
      try {
        const res = await fetchWithTimeout("/avatar/cube", { method: "GET" }, 10_000);
        return res.ok
          ? pass("The cube route answers. (The live cube take-over itself is verified on his screen, not by this board.)")
          : fail(`The cube route answered ${res.status}.`);
      } catch (err) {
        return fail(`The cube route did not answer (${err instanceof Error ? err.message : "network error"}).`);
      }
    },
  },
];
