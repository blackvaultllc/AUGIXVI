import { afterEach, describe, expect, it, vi } from "vitest";
import { AvatarBridge } from "@/avatar/AvatarBridge";

const { requestElevenLabsAudio } = vi.hoisted(() => ({
  requestElevenLabsAudio: vi.fn(),
}));

vi.mock("@/avatar/elevenlabs.server", () => ({ requestElevenLabsAudio }));

import { createVoiceProvider } from "@/avatar/voice";

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
