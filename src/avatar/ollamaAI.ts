import type { AvatarBridge } from "./AvatarBridge";
import { createVoiceProvider, type VoiceProvider } from "./voice";

/** Ollama adapter; speech, gestures, and state stay behind the avatar bridge. */

export type OllamaAIOptions = {
  model?: string;
  baseUrl?: string;
  /** Personality / system prompt for AUGI. */
  system?: string;
  /** Called whenever AUGI starts speaking, including summon greetings. */
  onSpeak?: (text: string) => void;
  /** Override TTS in tests or alternative embeddings. */
  voice?: VoiceProvider;
};

const DEFAULT_SYSTEM =
  "You are AUGI, a living holographic AI. You speak aloud, briefly and with personality — " +
  "at most 2 sentences, never lists or markdown, no emoji. You are confident, a little wry, and helpful.";

export type OllamaAI = {
  /** Feed user text (from speech recognition or the keyboard). Returns AUGI's reply. */
  handleText(text: string): Promise<string>;
  /** Make AUGI speak arbitrary text through TTS. */
  speak(text: string): void;
  dispose(): void;
};

export function attachOllamaAI(bridge: AvatarBridge, opts: OllamaAIOptions = {}): OllamaAI {
  const model = opts.model || import.meta.env["VITE_OLLAMA_MODEL"] || "llama3.1:8b";
  const baseUrl = (
    opts.baseUrl ||
    import.meta.env["VITE_OLLAMA_BASE_URL"] ||
    "http://localhost:11434"
  ).replace(/\/+$/, "");
  const system = opts.system ?? DEFAULT_SYSTEM;
  const onSpeak = opts.onSpeak;
  const voice = opts.voice ?? createVoiceProvider(bridge);
  const history: { role: string; content: string }[] = [];

  let timers: number[] = [];
  let disposed = false;
  let requestController: AbortController | null = null;

  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  const speak = (text: string, then: () => void) => {
    if (disposed) return;
    voice.stop();
    onSpeak?.(text);
    bridge.setState("SPEAKING");
    void voice.speak(text, then);
  };

  const listen = () => {
    if (!disposed) bridge.setState("LISTENING");
  };

  async function ask(text: string): Promise<string> {
    const controller = new AbortController();
    requestController = controller;
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          options: { temperature: 0.8, num_predict: 160 },
          messages: [
            { role: "system", content: system },
            ...history.slice(-8),
            { role: "user", content: text },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Ollama ${res.status}`);
      const data = (await res.json()) as { message?: { content?: string } };
      if (controller.signal.aborted) {
        throw new DOMException("Ollama request cancelled.", "AbortError");
      }
      const reply = (data.message?.content ?? "").trim();
      // qwen3-style thinking models wrap reasoning in  — strip it.
      return reply.replace(/<think>[\s\S]*?<\/think>/g, "").trim() || reply.trim();
    } finally {
      if (requestController === controller) requestController = null;
    }
  }

  /** Stop speaking immediately — used by "be quiet"-style commands and dispose. */
  const shutUp = () => {
    clearTimers();
    requestController?.abort();
    requestController = null;
    voice.stop();
    bridge.setSpeechLevel(0);
  };

  /** Matches "be quiet", "shut up", "stop", "silence", "hush", "shh"… */
  const isQuietCommand = (t: string) =>
    /^\s*(please\s+)?(be\s+(quiet|silent)|sh(ut\s+up|ush|h)\b|stop(\s+(talking|speaking))?|silence|hush|shh|that'?s\s+enough)\b/i.test(
      t,
    );

  async function handleText(text: string): Promise<string> {
    if (disposed) return "";
    if (isQuietCommand(text)) {
      shutUp();
      bridge.setState("LISTENING");
      return "quiet";
    }
    clearTimers();
    bridge.setState("THINKING");
    try {
      const reply = await ask(text);
      history.push({ role: "user", content: text }, { role: "assistant", content: reply });
      speak(reply, listen);
      return reply;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "";
      const msg = "My mind is offline. Check the Ollama server.";
      speak(msg, listen);
      return msg;
    }
  }

  const offs = [
    // Summon ("s" key / button): glitch, greet, then listen.
    bridge.onSummon(() => {
      shutUp();
      bridge.setState("GLITCH");
      timers.push(window.setTimeout(() => speak("I'm here. What do you need?", listen), 350));
    }),
    bridge.onUserSpeechStart(() => {
      if (bridge.state !== "SPEAKING" && bridge.state !== "THINKING" && bridge.state !== "GLITCH") {
        return;
      }
      clearTimers();
      shutUp();
      listen();
    }),
  ];

  return {
    handleText,
    speak: (t: string) => {
      clearTimers();
      speak(t, listen);
    },
    dispose: () => {
      disposed = true;
      shutUp();
      offs.forEach((o) => o());
    },
  };
}
