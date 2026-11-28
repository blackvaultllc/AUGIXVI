import { afterEach, describe, expect, it, vi } from "vitest";
import { AvatarBridge } from "@/avatar/AvatarBridge";

const { requestElevenLabsAudio } = vi.hoisted(() => ({
  requestElevenLabsAudio: vi.fn(),
}));

vi.mock("@/avatar/elevenlabs.server", () => ({ requestElevenLabsAudio }));

import { createVoiceProvider } from "@/avatar/voice";
import {
  loadSpeechVolume,
  pickSpeechVoice,
  saveSpeechVolume,
  speechAudioGain,
} from "@/avatar/speechVoice";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("voice provider", () => {
  it("uses browser speech when no ElevenLabs voice is configured", async () => {
    const speak = vi.fn();
    const speech = { speak, cancel: vi.fn() };
    class MockUtterance {
      rate = 1;
      pitch = 1;
      constructor(readonly text: string) {}
    }
    vi.stubGlobal("speechSynthesis", speech);
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    const provider = createVoiceProvider(new AvatarBridge(), { voiceId: "" });

    await provider.speak("Fallback voice.", vi.fn());

    expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: "Fallback voice." }));
    expect(requestElevenLabsAudio).not.toHaveBeenCalled();
    provider.stop();
  });
});

describe("the gods' voice — British, male, loud (owner order 2026-11-22)", () => {
  const fakeVoice = (name: string, lang: string) =>
    ({ name, lang }) as SpeechSynthesisVoice;

  const VOICES = [
    fakeVoice("Microsoft Zira - English (United States)", "en-US"),
    fakeVoice("Google US English", "en-US"),
    fakeVoice("Google UK English Female", "en-GB"),
    fakeVoice("Google UK English Male", "en-GB"),
    fakeVoice("Microsoft David - English (United States)", "en-US"),
  ];

  it("picks the deeper British man's voice over the default woman's voice", () => {
    expect(pickSpeechVoice(VOICES)?.name).toBe("Google UK English Male");
  });

  it("a KNOWN man's voice outranks a British voice whose gender is unknown (pass 7)", () => {
    // His phone's failure (owner order 2026-11-27 ~23:03 CST):
    // an unknown-gender British voice can be a woman's, and it
    // used to outrank a voice known to be a man's. The known man
    // wins now.
    const picked = pickSpeechVoice([
      fakeVoice("Google UK English", "en-GB"),
      fakeVoice("Microsoft David - English (United States)", "en-US"),
    ]);
    expect(picked?.name).toBe("Microsoft David - English (United States)");
  });

  it("never gives a god a woman's voice — 'female' is not read as 'male'", () => {
    const picked = pickSpeechVoice([
      fakeVoice("Google UK English Female", "en-GB"),
      fakeVoice("Microsoft David - English (United States)", "en-US"),
    ]);
    expect(picked?.name).toBe("Microsoft David - English (United States)");
  });

  it("a female speaker gets a woman's voice — and never a man's", () => {
    expect(pickSpeechVoice(VOICES, "female")?.name).toBe("Google UK English Female");
    expect(
      pickSpeechVoice([fakeVoice("Google UK English Male", "en-GB")], "female"),
    ).toBeNull();
  });

  it("browser speech speaks with the picked voice at full volume by default", async () => {
    const speak = vi.fn();
    const speech = { speak, cancel: vi.fn(), getVoices: () => VOICES };
    class MockUtterance {
      rate = 1;
      pitch = 1;
      volume = 0;
      voice: SpeechSynthesisVoice | null = null;
      constructor(readonly text: string) {}
    }
    vi.stubGlobal("speechSynthesis", speech);
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    const provider = createVoiceProvider(new AvatarBridge(), { voiceId: "" });

    await provider.speak("The gods speak.", vi.fn());

    const utterance = speak.mock.calls[0]?.[0] as MockUtterance;
    expect(utterance.voice?.name).toBe("Google UK English Male");
    expect(utterance.volume).toBe(1);
    // DEEP (owner order 2026-11-27 ~23:03 CST, pass 7): the male
    // pitch stepped 0.8 → 0.6 — "a deep male voice", not the
    // robotic near-neutral he heard.
    expect(utterance.pitch).toBe(0.6);
    provider.stop();
  });

  it("his volume level persists, defaults to full, and drives the audio gain", () => {
    localStorage.removeItem("augi.avatar.speech-volume.v1");
    expect(loadSpeechVolume()).toBe(1);
    expect(speechAudioGain()).toBeGreaterThan(1);
    saveSpeechVolume(0.4);
    expect(loadSpeechVolume()).toBe(0.4);
    expect(speechAudioGain(0.4)).toBeCloseTo(0.6);
    localStorage.removeItem("augi.avatar.speech-volume.v1");
  });
});
