import { afterEach, describe, expect, it, vi } from "vitest";
import { AvatarBridge } from "@/avatar/AvatarBridge";
import { attachOllamaAI } from "@/avatar/ollamaAI";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Ollama AI speech notifications", () => {
  it("reports every spoken reply to the interface", () => {
    const onSpeak = vi.fn();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const ai = attachOllamaAI(new AvatarBridge(), { onSpeak });

    ai.speak("I am ready.");

    expect(onSpeak).toHaveBeenCalledWith("I am ready.");
    ai.dispose();
  });
});
