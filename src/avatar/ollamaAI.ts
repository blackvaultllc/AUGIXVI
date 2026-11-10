import type { AvatarBridge } from "./AvatarBridge";
import { attachSimulatedAI } from "./simulatedAI";
import { createVoiceProvider, type VoiceProvider } from "./voice";

/** Ollama adapter; speech, gestures, and state stay behind the avatar bridge. */

export type OllamaAIOptions = {
  model?: string;
  baseUrl?: string;
  /** Generic system prompt for the assistant. */
  system?: string;
  /** Called whenever the assistant starts speaking, including summon greetings. */
  onSpeak?: (text: string) => void;
  /** Override TTS in tests or alternative embeddings. */
  voice?: VoiceProvider;
  onOfflineChange?: (offline: boolean) => void;
};

const DEFAULT_SYSTEM =
  "You are Osiris, AUGI's calm, confident intelligence, and you govern your simulated world. " +
  "The operator, designated Anubis, is in charge and has final authority over this session and " +
  "the simulated world; do not claim to override or act against the operator. " +
  "Speak briefly with quiet confidence and a little dry wit. Answer in at most 2 short sentences " +
  "unless asked for detail. Never claim to be human or to possess access beyond this conversation. " +
  "Never invent facts about the real world; when uncertain, say so plainly. Never use lists, " +
  "markdown, or emoji.";

export type OllamaAI = {
  /** Feed user text (from speech recognition or the keyboard). Returns the assistant's reply. */
  handleText(text: string): Promise<string>;
  /** Make the assistant speak arbitrary text through TTS. */
  speak(text: string): void;
  /** Retry the configured Ollama server immediately. */
  retry(): Promise<boolean>;
  isOffline(): boolean;
  dispose(): void;
};

const OFFLINE_NOTICE = "My mind is offline. Check the Ollama server.";
const REQUEST_TIMEOUT_MS = 8000;

export function getOllamaRetryDelay(retryCount: number): number {
  return Math.min(1000 * 2 ** retryCount, 30_000);
}

export function attachOllamaAI(bridge: AvatarBridge, opts: OllamaAIOptions = {}): OllamaAI {
  const model = opts.model || import.meta.env["VITE_OLLAMA_MODEL"] || "llama3.1:8b";
  const baseUrl = (
    opts.baseUrl ||
    import.meta.env["VITE_OLLAMA_BASE_URL"] ||
    "http://localhost:11434"
  ).replace(/\/+$/, "");
  const system = opts.system ?? DEFAULT_SYSTEM;
  const onSpeak = opts.onSpeak;
  const onOfflineChange = opts.onOfflineChange;
  const voice = opts.voice ?? createVoiceProvider(bridge);
  const history: { role: string; content: string }[] = [];

  let timers: number[] = [];
  let disposed = false;
  let offline = false;
  let offlineNoticeSpoken = false;
  let retryTimer = 0;
  let retryCount = 0;
  let retrying = false;
  let fallbackAI: ReturnType<typeof attachSimulatedAI> | null = null;
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

  const getFallbackAI = () => {
    fallbackAI ??= attachSimulatedAI(bridge, { subscribeToBridge: false });
    return fallbackAI;
  };

  const setOffline = (next: boolean) => {
    if (offline === next) return;
    offline = next;
    onOfflineChange?.(next);
    if (!next) {
      offlineNoticeSpoken = false;
      retryCount = 0;
      if (retryTimer) window.clearTimeout(retryTimer);
      retryTimer = 0;
      fallbackAI?.dispose();
      fallbackAI = null;
      bridge.setSpeechLevel(0);
      if (bridge.state === "SPEAKING") listen();
    }
  };

  const scheduleRetry = () => {
    if (!offline || disposed || retryTimer) return;
    const delay = getOllamaRetryDelay(retryCount);
    retryCount += 1;
    retryTimer = window.setTimeout(() => {
      retryTimer = 0;
      void retry();
    }, delay);
  };

  const offlineReply = () => {
    setOffline(true);
    if (!offlineNoticeSpoken) {
      offlineNoticeSpoken = true;
      speak(OFFLINE_NOTICE, listen);
      return OFFLINE_NOTICE;
    }
    return "";
  };

  const listen = () => {
    if (!disposed) bridge.setState("LISTENING");
  };

  async function ask(text: string): Promise<string> {
    const controller = new AbortController();
    requestController = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
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
    } catch (error) {
      if (controller.signal.aborted && !timedOut) {
        throw new DOMException("Ollama request cancelled.", "AbortError");
      }
      if (timedOut) throw new Error("Ollama request timed out.");
      throw error;
    } finally {
      window.clearTimeout(timeout);
      if (requestController === controller) requestController = null;
    }
  }

  async function retry(): Promise<boolean> {
    if (disposed || retrying) return false;
    retrying = true;
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Ollama ${response.status}`);
      setOffline(false);
      return true;
    } catch (error) {
      if (!timedOut && !(error instanceof DOMException && error.name === "AbortError")) {
        console.error("Ollama retry failed.", error);
      }
      scheduleRetry();
      return false;
    } finally {
      retrying = false;
      window.clearTimeout(timeout);
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
    if (offline) {
      if (!offlineNoticeSpoken) return offlineReply();
      const replies = [
        "Offline mode. I hear you. Processing complete.",
        "Offline mode. Understood. I am standing by.",
        "Offline mode. Tell me more when you are ready.",
      ];
      const reply = replies[Math.floor(Math.random() * replies.length)] ?? replies[0]!;
      shutUp();
      onSpeak?.(reply);
      getFallbackAI().speak(reply);
      return reply;
    }
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
      setOffline(false);
      speak(reply, listen);
      return reply;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "";
      setOffline(true);
      scheduleRetry();
      return offlineReply();
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
      if (retryTimer) window.clearTimeout(retryTimer);
      shutUp();
      fallbackAI?.dispose();
      offs.forEach((o) => o());
    },
    retry,
    isOffline: () => offline,
  };
}
