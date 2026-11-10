import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarBridge } from "@/avatar/AvatarBridge";
import { attachSimulatedAI } from "@/avatar/simulatedAI";
import { SnapDetector } from "@/avatar/snapDetector";
import { intensityLabel } from "@/avatar/stateParams";

const mk = (requireAudio = true) =>
  new SnapDetector({ sensitivity: 0.8, cooldownMs: 800, requireAudio });
const spike = (d: SnapDetector, t: number) => {
  d.pushHand(t - 20, 0.1);
  return d.pushHand(t, 1.5);
};

describe("snap detection", () => {
  it("fires only when hand spike and audio transient coincide", () => {
    const d = mk();
    expect(spike(d, 1000)).toBe(false);
    expect(d.pushAudioOnset(1050)).toBe(true);
  });
  it("ignores a hand spike with no audio when mic is required", () => {
    const d = mk();
    spike(d, 1000);
    expect(d.pushAudioOnset(1500)).toBe(false);
  });
  it("respects the 800ms cooldown", () => {
    const d = mk(false);
    expect(spike(d, 1000)).toBe(true);
    expect(spike(d, 1500)).toBe(false);
    expect(spike(d, 1900)).toBe(true);
  });
});

it("maps intensity labels", () => {
  expect([intensityLabel(0.1), intensityLabel(0.5), intensityLabel(0.9)]).toEqual([
    "LOW",
    "MED",
    "HIGH",
  ]);
});

import { isPresentCommand } from "@/avatar/simulatedAI";
describe("present command", () => {
  it("recognizes the user's phrasing", () => {
    expect(isPresentCommand("Hey, I'm going to front this file")).toBe(true);
    expect(isPresentCommand("show me the document")).toBe(true);
    expect(isPresentCommand("what's the weather")).toBe(false);
  });
});

describe("barge-in", () => {
  const speechSynthesisMock = { cancel: vi.fn(), speak: vi.fn() };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("speechSynthesis", speechSynthesisMock);
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
        rate = 1;
        pitch = 1;
      },
    );
    speechSynthesisMock.cancel.mockClear();
    speechSynthesisMock.speak.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("stops the avatar mid-sentence when the user starts talking", () => {
    const bridge = new AvatarBridge();
    const ai = attachSimulatedAI(bridge);
    ai.speak("This is a very long sentence that keeps going and going.");
    expect(bridge.state).toBe("SPEAKING");
    expect(speechSynthesisMock.speak).toHaveBeenCalledTimes(1);
    bridge.emitUserSpeechStart();
    expect(speechSynthesisMock.cancel).toHaveBeenCalled();
    expect(bridge.state).toBe("LISTENING");
    expect(bridge.speechLevel).toBe(0);
    ai.dispose();
  });

  it("listens and then answers once the user stops talking", () => {
    const bridge = new AvatarBridge();
    const ai = attachSimulatedAI(bridge);
    ai.speak("Blah blah blah.");
    bridge.emitUserSpeechStart();
    expect(bridge.state).toBe("LISTENING");
    bridge.emitUserSpeechEnd();
    expect(bridge.state).toBe("THINKING");
    vi.advanceTimersByTime(1600);
    expect(bridge.state).toBe("SPEAKING");
    ai.dispose();
  });

  it("cancels a pending reply when the user interrupts while it is thinking", () => {
    const bridge = new AvatarBridge();
    const ai = attachSimulatedAI(bridge);
    bridge.setState("LISTENING");
    bridge.emitUserSpeechStart();
    bridge.emitUserSpeechEnd();
    expect(bridge.state).toBe("THINKING");
    bridge.emitUserSpeechStart();
    expect(bridge.state).toBe("LISTENING");
    vi.advanceTimersByTime(1600);
    expect(bridge.state).toBe("LISTENING"); // the cancelled reply never fires
    ai.dispose();
  });

  it("does not go idle while the user is still talking", () => {
    const bridge = new AvatarBridge();
    const ai = attachSimulatedAI(bridge);
    ai.speak("Blah.");
    bridge.emitUserSpeechStart();
    vi.advanceTimersByTime(8000);
    expect(bridge.state).toBe("LISTENING");
    ai.dispose();
  });
});
