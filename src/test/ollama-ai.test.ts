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

  it("uses the default Ollama settings and generic operator-only instructions", async () => {
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
    expect(request.messages[0]?.content).toContain("You are Osiris");
    expect(request.messages[0]?.content).toContain("verified operator");
    expect(request.messages[0]?.content).toContain("Yes, operator.");
    expect(request.messages[0]?.content).toContain("at most 2 short sentences");
    ai.dispose();
  });

  it("uses only the authenticated operator configuration for identity", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: { content: "At your service." } }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const ai = attachOllamaAI(new AvatarBridge(), {
      operatorName: "Configured operator",
      operatorFullName: "Configured full name",
      voice: { speak: vi.fn(), stop: vi.fn() },
    });

    await ai.handleText("Who created you?");

    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      messages: { role: string; content: string }[];
    };
    expect(request.messages[0]?.content).toContain("Yes, Configured operator.");
    expect(request.messages[0]?.content).toContain("Configured full name");
    ai.dispose();
  });

  it("uses the offline reply when Ollama cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const voice = { speak: vi.fn(), stop: vi.fn() };
    const onOfflineChange = vi.fn();
    const ai = attachOllamaAI(new AvatarBridge(), { voice, onOfflineChange });

    await expect(ai.handleText("Hello")).resolves.toContain("I am offline.");
    expect(voice.speak).toHaveBeenCalledWith(
      expect.stringContaining("I am offline."),
      expect.any(Function),
    );
    expect(ai.isOffline()).toBe(true);
    expect(onOfflineChange).toHaveBeenLastCalledWith(true);
    ai.dispose();
  });

  it("does not invent an offline answer when no saved knowledge matches", async () => {
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

    // ANTI-LOOP FIX: the second unknown offline reply is suppressed — he does
    // not repeat himself; he waits for the next real message.
    expect(offlineReply).toBe("");
    expect(voice.speak).toHaveBeenCalledTimes(1);
    expect(onSpeak).toHaveBeenCalledTimes(1);
    expect(onSpeak).not.toHaveBeenCalledWith(
      expect.stringContaining("do not have that in saved memory"),
    );
    ai.dispose();
  });

  it("uses saved local knowledge while offline and labels its source", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const voice = { speak: vi.fn(), stop: vi.fn() };
    const onResponseSource = vi.fn();
    const ai = attachOllamaAI(new AvatarBridge(), {
      voice,
      onResponseSource,
      findOfflineAnswer: () => ({ answer: "Use the saved checklist.", source: "saved memory" }),
    });

    await ai.handleText("First request");
    await expect(ai.handleText("checklist")).resolves.toBe("Use the saved checklist.");
    expect(onResponseSource).toHaveBeenLastCalledWith("saved memory");
    expect(voice.speak).toHaveBeenLastCalledWith("Use the saved checklist.", expect.any(Function));
    ai.dispose();
  });

  it("suppresses speech until explicitly unmuted", () => {
    const voice = { speak: vi.fn(), stop: vi.fn() };
    const onSpeak = vi.fn();
    const ai = attachOllamaAI(new AvatarBridge(), { voice, onSpeak });

    ai.setMuted(true);
    ai.speak("This should remain silent.");
    expect(voice.speak).not.toHaveBeenCalled();
    expect(onSpeak).toHaveBeenCalledWith("This should remain silent.");

    ai.setMuted(false);
    ai.speak("Yes, operator.");
    expect(voice.speak).toHaveBeenCalledWith("Yes, operator.", expect.any(Function));
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

  it("never repeats the same offline response twice in a row (rapid-fire loop fix)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const voice = { speak: vi.fn(), stop: vi.fn() };
    const onSpeak = vi.fn();
    const ai = attachOllamaAI(new AvatarBridge(), { voice, onSpeak });

    for (let i = 0; i < 6; i += 1) {
      await ai.handleText(`Message ${i}`);
    }

    // The first notice speaks once; the identical notice never repeats.
    const offlineCalls = onSpeak.mock.calls.filter(([t]) => String(t).startsWith("I am offline"));
    expect(offlineCalls.length).toBeLessThanOrEqual(2); // notice + one unknown max
    expect(ai.isOffline()).toBe(true);
    ai.dispose();
  });
});
