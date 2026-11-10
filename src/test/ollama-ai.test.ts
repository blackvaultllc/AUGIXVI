import { afterEach, describe, expect, it, vi } from "vitest";
import { AvatarBridge } from "@/avatar/AvatarBridge";
import { attachOllamaAI, getOllamaRetryDelay } from "@/avatar/ollamaAI";

afterEach(() => {
  vi.useRealTimers();
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
    expect(request.messages[0]?.content).toContain("You are Osiris, AUGI's sovereign intelligence");
    expect(request.messages[0]?.content).toContain("at most 2 short sentences");
    ai.dispose();
  });

  it("uses the offline reply when Ollama cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const voice = { speak: vi.fn(), stop: vi.fn() };
    const onOfflineChange = vi.fn();
    const ai = attachOllamaAI(new AvatarBridge(), { voice, onOfflineChange });

    await expect(ai.handleText("Hello")).resolves.toBe(
      "My mind is offline. Check the Ollama server.",
    );
    expect(voice.speak).toHaveBeenCalledWith(
      "My mind is offline. Check the Ollama server.",
      expect.any(Function),
    );
    expect(ai.isOffline()).toBe(true);
    expect(onOfflineChange).toHaveBeenLastCalledWith(true);
    ai.dispose();
  });

  it("uses simulated offline replies without repeating the offline notice", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    class MockUtterance {
      rate = 1;
      pitch = 1;
      constructor(readonly text: string) {}
    }
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });
    const voice = { speak: vi.fn(), stop: vi.fn() };
    const onSpeak = vi.fn();
    const ai = attachOllamaAI(new AvatarBridge(), { voice, onSpeak });

    await ai.handleText("First request");
    const offlineReply = await ai.handleText("Second request");

    expect(offlineReply).toMatch(/^Offline mode\./);
    expect(voice.speak).toHaveBeenCalledOnce();
    expect(onSpeak).toHaveBeenCalledTimes(2);
    expect(onSpeak).not.toHaveBeenLastCalledWith("My mind is offline. Check the Ollama server.");
    ai.dispose();
  });

  it("recovers through Retry and uses capped exponential backoff", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(new Response("", { status: 200 })),
    );
    const onOfflineChange = vi.fn();
    const ai = attachOllamaAI(new AvatarBridge(), {
      voice: { speak: vi.fn(), stop: vi.fn() },
      onOfflineChange,
    });

    await ai.handleText("Hello");
    await expect(ai.retry()).resolves.toBe(true);

    expect(ai.isOffline()).toBe(false);
    expect(onOfflineChange.mock.calls).toEqual([[true], [false]]);
    expect([0, 1, 2, 3, 4, 5, 6].map(getOllamaRetryDelay)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ]);
    ai.dispose();
  });
});
