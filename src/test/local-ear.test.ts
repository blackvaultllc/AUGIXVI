import { describe, expect, it, vi } from "vitest";
import {
  LocalEar,
  micErrorMessage,
  pickRecorderMimeType,
  type EarDeps,
  type EarEvents,
  type RecorderLike,
} from "@/avatar/localEar";

/**
 * The local ear's contract, proven with fakes (no real microphone):
 *  - a denied mic is an on-screen sentence, never a silent flip-off;
 *  - listening STAYS on through silence until a phrase lands or the
 *    operator clicks again — the old cloud recognizer died instantly;
 *  - speech followed by a beat of silence is transcribed and delivered;
 *  - a down speech service surfaces its own words.
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

function makeHarness(
  overrides: Partial<EarDeps> = {},
  monitorLevels: number[] = [0],
) {
  const events: EarEvents & {
    transcripts: string[];
    errors: string[];
    states: string[];
  } = {
    transcripts: [],
    errors: [],
    states: [],
    onTranscript: (text) => events.transcripts.push(text),
    onError: (message) => events.errors.push(message),
    onState: (state) => events.states.push(state),
  };
  let tickCb: (() => void) | null = null;
  let nowValue = 0;
  let levelIndex = 0;
  const recorder = new FakeRecorder();
  const stream = {
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream;
  const deps: EarDeps = {
    getUserMedia: vi.fn(async () => stream),
    createRecorder: () => recorder,
    createLevelMonitor: () => ({
      level: () => monitorLevels[Math.min(levelIndex++, monitorLevels.length - 1)] ?? 0,
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
    recorder,
    /** Advance the fake clock one 100ms tick and run the ear's poll. */
    tick(ms = 100) {
      nowValue += ms;
      tickCb?.();
    },
  };
}

async function flush() {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("local ear", () => {
  it("surfaces a denied microphone in words instead of dying silently", async () => {
    const denied = new Error("Permission denied");
    denied.name = "NotAllowedError";
    const { ear, events } = makeHarness({
      getUserMedia: vi.fn(async () => {
        throw denied;
      }),
    });
    await ear.start();
    expect(events.errors).toHaveLength(1);
    expect(events.errors[0]).toContain("Microphone unavailable: permission was denied");
    expect(events.states).toEqual(["starting", "error"]);
    expect(ear.currentState).toBe("error");
    expect(events.transcripts).toEqual([]);
  });

  it("keeps listening through silence — no instant flip-off", async () => {
    const { ear, events, tick } = makeHarness({}, [0]);
    await ear.start();
    expect(ear.currentState).toBe("listening");
    for (let i = 0; i < 50; i += 1) tick(); // five silent seconds
    expect(ear.currentState).toBe("listening");
    expect(events.errors).toEqual([]);
    expect(events.transcripts).toEqual([]);
    ear.dispose();
  });

  it("transcribes a phrase once speech gives way to a beat of silence", async () => {
    // 5 loud ticks (speech), then quiet: the phrase should end itself.
    const levels = [0.6, 0.6, 0.6, 0.6, 0.6, ...Array(30).fill(0)];
    const { ear, events, deps, tick } = makeHarness({}, levels);
    await ear.start();
    for (let i = 0; i < 25; i += 1) tick();
    await flush();
    expect(deps.transcribe).toHaveBeenCalledTimes(1);
    expect(events.transcripts).toEqual(["Osiris, open the cube."]);
    expect(events.errors).toEqual([]);
    expect(ear.currentState).toBe("idle");
  });

  it("transcribes on a manual stop after speech", async () => {
    const { ear, events, deps, tick } = makeHarness({}, [0.6]);
    await ear.start();
    for (let i = 0; i < 5; i += 1) tick();
    ear.stop();
    await flush();
    expect(deps.transcribe).toHaveBeenCalledTimes(1);
    expect(events.transcripts).toEqual(["Osiris, open the cube."]);
  });

  it("surfaces the speech service's own words when it is down", async () => {
    const down = new Error(
      "Local speech service is not running. Start the augie-stt service on this machine, then click the mic again.",
    );
    const levels = [0.6, 0.6, 0.6, 0.6, 0.6, ...Array(30).fill(0)];
    const { ear, events, tick } = makeHarness(
      { transcribe: vi.fn(async () => Promise.reject(down)) },
      levels,
    );
    await ear.start();
    for (let i = 0; i < 25; i += 1) tick();
    await flush();
    expect(events.transcripts).toEqual([]);
    expect(events.errors).toEqual([down.message]);
    expect(ear.currentState).toBe("error");
  });

  it("says so when sound was heard but no words could be made out", async () => {
    const levels = [0.6, 0.6, 0.6, 0.6, 0.6, ...Array(30).fill(0)];
    const { ear, events, tick } = makeHarness(
      { transcribe: vi.fn(async () => ({ text: "   " })) },
      levels,
    );
    await ear.start();
    for (let i = 0; i < 25; i += 1) tick();
    await flush();
    expect(events.transcripts).toEqual([]);
    expect(events.errors[0]).toContain("couldn't make out any words");
  });
});

describe("mic error wording", () => {
  it("names a missing microphone", () => {
    const missing = new Error("no device");
    missing.name = "NotFoundError";
    expect(micErrorMessage(missing)).toContain("no microphone was found");
  });

  it("names a busy microphone", () => {
    const busy = new Error("in use");
    busy.name = "NotReadableError";
    expect(micErrorMessage(busy)).toContain("another app may be using it");
  });
});

describe("recorder mime choice", () => {
  it("prefers opus webm and falls back in order", () => {
    expect(pickRecorderMimeType(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickRecorderMimeType((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecorderMimeType(() => false)).toBe("");
  });
});
