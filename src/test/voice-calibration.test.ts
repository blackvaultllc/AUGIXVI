import { describe, expect, it, vi } from "vitest";
import {
  LocalEar,
  type EarDeps,
  type EarEvents,
  type RecorderLike,
  type VoiceRejection,
} from "@/avatar/localEar";
import {
  VOICE_CALIBRATION_KEY,
  createVoiceGateVerifier,
  loadVoiceCalibrationPrefs,
  saveVoiceCalibrationPrefs,
} from "@/avatar/voiceCalibration";

/**
 * VOICE CALIBRATION GATE (2026-11-21) — the contract that matters:
 * with a verifier installed in the ear, a spoken phrase that is not
 * the operator's voice NEVER becomes a transcript (so it can never
 * become a command), a check that cannot run fails closed the same
 * way, and with no verifier the ear behaves exactly as it did before
 * calibration existed. All proven with fakes — no microphone, no
 * speech service.
 */

class FakeRecorder implements RecorderLike {
  mimeType = "audio/webm";
  ondataavailable: RecorderLike["ondataavailable"] = null;
  onstop: RecorderLike["onstop"] = null;
  start = vi.fn(() => undefined);
  stop = vi.fn(() => {
    this.ondataavailable?.({ data: new Blob(["clip"], { type: "audio/webm" }) });
    this.onstop?.();
  });
}

function makeHarness(overrides: Partial<EarDeps> = {}) {
  const events: EarEvents & {
    transcripts: string[];
    errors: string[];
    rejections: VoiceRejection[];
  } = {
    transcripts: [],
    errors: [],
    rejections: [],
    onTranscript: (text) => events.transcripts.push(text),
    onError: (message) => events.errors.push(message),
    onVoiceRejected: (rejection) => events.rejections.push(rejection),
  };
  let tickCb: (() => void) | null = null;
  let nowValue = 0;
  // Speech (level 0.2) for 1s, then silence: one full phrase.
  const levels = [...Array(10).fill(0.2), ...Array(30).fill(0)];
  let levelIndex = 0;
  const recorder = new FakeRecorder();
  const stream = {
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream;
  const deps: EarDeps = {
    getUserMedia: vi.fn(async () => stream),
    createRecorder: () => recorder,
    createLevelMonitor: () => ({
      level: () => levels[Math.min(levelIndex++, levels.length - 1)] ?? 0,
      stop: vi.fn(),
    }),
    transcribe: vi.fn(async () => ({ text: "Osiris, open the cube." })),
    setIntervalFn: (cb) => {
      tickCb = cb;
      return 1;
    },
    clearIntervalFn: () => {
      tickCb = null;
    },
    now: () => nowValue,
    ...overrides,
  };
  const ear = new LocalEar(events, deps);
  return {
    ear,
    events,
    deps,
    /** Speak one phrase: run the poll until the ear settles it. */
    async speakPhrase() {
      await ear.start();
      for (let i = 0; i < 45; i += 1) {
        nowValue += 100;
        tickCb?.();
      }
      await flush();
    },
  };
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("voice calibration gate in the local ear", () => {
  it("lets a verified voice through to transcription, as before", async () => {
    const { ear, events, deps, speakPhrase } = makeHarness();
    const verifier = vi.fn(async () => ({ match: true, score: 0.82 }));
    ear.setVoiceVerifier(verifier);
    await speakPhrase();
    expect(verifier).toHaveBeenCalledTimes(1);
    expect(verifier).toHaveBeenCalledWith(expect.any(Blob));
    expect(deps.transcribe).toHaveBeenCalledTimes(1);
    expect(events.transcripts).toEqual(["Osiris, open the cube."]);
    expect(events.rejections).toEqual([]);
    ear.dispose();
  });

  it("blocks a stranger's voice: no transcript, no transcription, one rejection", async () => {
    const { ear, events, deps, speakPhrase } = makeHarness();
    ear.setVoiceVerifier(async () => ({ match: false, score: 0.21 }));
    await speakPhrase();
    expect(events.transcripts).toEqual([]);
    expect(deps.transcribe).not.toHaveBeenCalled();
    expect(events.rejections).toEqual([{ reason: "mismatch", score: 0.21 }]);
    expect(ear.currentState).toBe("idle");
    ear.dispose();
  });

  it("fails closed when the check itself cannot run (service down)", async () => {
    const { ear, events, deps, speakPhrase } = makeHarness();
    ear.setVoiceVerifier(async () => {
      throw new Error("Local speech service is not running.");
    });
    await speakPhrase();
    expect(events.transcripts).toEqual([]);
    expect(deps.transcribe).not.toHaveBeenCalled();
    expect(events.rejections).toEqual([{ reason: "unavailable", score: null }]);
    ear.dispose();
  });

  it("with no verifier installed the ear is exactly the old ear", async () => {
    const { ear, events, speakPhrase } = makeHarness();
    await speakPhrase();
    expect(events.transcripts).toEqual(["Osiris, open the cube."]);
    expect(events.rejections).toEqual([]);
    ear.dispose();
  });

  it("clearing the verifier reopens the ear (calibration switched off)", async () => {
    const { ear, events, speakPhrase } = makeHarness();
    ear.setVoiceVerifier(async () => ({ match: false, score: 0.1 }));
    ear.setVoiceVerifier(null);
    await speakPhrase();
    expect(events.transcripts).toEqual(["Osiris, open the cube."]);
    expect(events.rejections).toEqual([]);
    ear.dispose();
  });
});

describe("voice gate verifier (app side)", () => {
  const clip = new Blob(["clip"], { type: "audio/webm" });

  function fetchReturning(payload: Record<string, unknown>, ok = true) {
    return vi.fn(async () => ({
      ok,
      status: ok ? 200 : 503,
      json: async () => payload,
    })) as unknown as typeof fetch;
  }

  it("passes a matching verdict through with its score", async () => {
    const verify = createVoiceGateVerifier(
      () => 0.5,
      fetchReturning({ enrolled: true, match: true, score: 0.77, threshold: 0.5 }),
    );
    await expect(verify(clip)).resolves.toEqual({ match: true, score: 0.77 });
  });

  it("treats 'not enrolled' as a failed check, never a pass", async () => {
    const verify = createVoiceGateVerifier(
      () => 0.5,
      fetchReturning({ enrolled: false, match: false, score: null, threshold: 0.5 }),
    );
    await expect(verify(clip)).rejects.toThrow(/no voiceprint is enrolled/i);
  });

  it("propagates a service failure so the ear fails closed", async () => {
    const verify = createVoiceGateVerifier(
      () => 0.5,
      fetchReturning({ error: "Local speech service is not running." }, false),
    );
    await expect(verify(clip)).rejects.toThrow(/not running/i);
  });
});

describe("voice calibration preferences", () => {
  function fakeStorage() {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      map,
    };
  }

  it("defaults to OFF at the balanced threshold", () => {
    const storage = fakeStorage();
    expect(loadVoiceCalibrationPrefs(storage)).toEqual({
      enabled: false,
      threshold: 0.5,
    });
  });

  it("round-trips a saved preference", () => {
    const storage = fakeStorage();
    saveVoiceCalibrationPrefs({ enabled: true, threshold: 0.62 }, storage);
    expect(storage.map.get(VOICE_CALIBRATION_KEY)).toContain('"enabled":true');
    expect(loadVoiceCalibrationPrefs(storage)).toEqual({
      enabled: true,
      threshold: 0.62,
    });
  });

  it("clamps the threshold into the honest range", () => {
    const storage = fakeStorage();
    saveVoiceCalibrationPrefs({ enabled: true, threshold: 0.99 }, storage);
    expect(loadVoiceCalibrationPrefs(storage).threshold).toBe(0.8);
    saveVoiceCalibrationPrefs({ enabled: true, threshold: 0.01 }, storage);
    expect(loadVoiceCalibrationPrefs(storage).threshold).toBe(0.3);
  });

  it("falls back to defaults on corrupt storage", () => {
    const storage = fakeStorage();
    storage.map.set(VOICE_CALIBRATION_KEY, "{not json");
    expect(loadVoiceCalibrationPrefs(storage)).toEqual({
      enabled: false,
      threshold: 0.5,
    });
  });
});
