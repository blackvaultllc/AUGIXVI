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

  it("stops speech and returns to listening when user speech starts", () => {
    const bridge = new AvatarBridge();
    const voice = { speak: vi.fn(), stop: vi.fn() };
    const ai = attachOllamaAI(bridge, { voice });

    ai.speak("I am still speaking.");
    voice.stop.mockClear();
    bridge.setSpeechLevel(0.7);
    bridge.emitUserSpeechStart();

    expect(voice.stop).toHaveBeenCalledOnce();
    expect(bridge.state).toBe("LISTENING");
    expect(bridge.speechLevel).toBe(0);
    ai.dispose();
  });

  it("aborts an in-flight Ollama request when user speech starts", async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = init.signal ?? undefined;
          requestSignal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const bridge = new AvatarBridge();
    const voice = { speak: vi.fn(), stop: vi.fn() };
    const ai = attachOllamaAI(bridge, { voice });
    const response = ai.handleText("Hold on");

    bridge.emitUserSpeechStart();

    await expect(response).resolves.toBe("");
    expect(requestSignal?.aborted).toBe(true);
    expect(voice.speak).not.toHaveBeenCalled();
    expect(bridge.state).toBe("LISTENING");
    ai.dispose();
  });

  it("uses the default Ollama settings and original AUGI personality", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: { content: "At your service." } }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const ai = attachOllamaAI(new AvatarBridge(), {
      voice: { speak: vi.fn(), stop: vi.fn() },
    });

    await ai.handleText("Hello");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      model: string;
      messages: { role: string; content: string }[];
    };
    expect(request.model).toBe("llama3.1:8b");
    expect(request.messages[0]?.content).toContain("You are AUGI, a living holographic AI.");
    ai.dispose();
  });

  it("uses the offline reply when Ollama cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const voice = { speak: vi.fn(), stop: vi.fn() };
    const ai = attachOllamaAI(new AvatarBridge(), { voice });

    await expect(ai.handleText("Hello")).resolves.toBe(
      "My mind is offline. Check the Ollama server.",
    );
    expect(voice.speak).toHaveBeenCalledWith(
      "My mind is offline. Check the Ollama server.",
      expect.any(Function),
    );
    ai.dispose();
  });
});
