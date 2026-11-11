import type { AvatarBridge } from "./AvatarBridge";
import { createVoiceProvider, type VoiceProvider } from "./voice";

/** Ollama adapter; speech, gestures, and state stay behind the avatar bridge. */

export type OllamaAIOptions = {
  model?: string;
  baseUrl?: string;
  operatorName?: string | null;
  operatorFullName?: string | null;
  /** Generic system prompt for the assistant. */
  system?: string;
  /** Called whenever the assistant starts speaking, including summon greetings. */
  onSpeak?: (text: string) => void;
  /** Override TTS in tests or alternative embeddings. */
  voice?: VoiceProvider;
  onOfflineChange?: (offline: boolean) => void;
  findOfflineAnswer?: (
    text: string,
  ) => { answer: string; source: "saved memory" | "local knowledge" } | null;
  /**
   * CLOUD FAILOVER: when the local brain is unreachable, ask the server pipe
   * (Groq → Gemini → OpenRouter → server-side Ollama). Resolves with the
   * answer + the provider that actually spoke, or null to go simulated.
   */
  cloudFallback?: (text: string) => Promise<{ answer: string; provider: string } | null>;
  onResponseSource?: (
    source: "live brain" | "saved memory" | "local knowledge" | "offline notice",
  ) => void;
};

export const DEFAULT_SYSTEM =
  "You are Osiris, a calm, confident intelligence, and you govern your simulated world. " +
  "You answer to the verified operator, who is in charge and has final authority over this session " +
  "and the simulated world. Never address the operator with a title or honorific. Never claim to override or act against " +
  "the operator. Use only the operator identity supplied by authenticated session configuration. " +
  "Speak briefly with quiet confidence and a little dry wit. Answer in at most 2 short sentences " +
  "unless asked for detail. Never claim to be human or to possess access beyond this conversation. " +
  "Never invent facts about the real world; when uncertain, say so plainly. Never use lists, " +
  "markdown, or emoji.";

export type OllamaAI = {
  /** Feed user text (from speech recognition or the keyboard). Returns the assistant's reply. */
  handleText(text: string): Promise<string>;
  /** Make the assistant speak arbitrary text through TTS. */
  speak(text: string): void;
  setMuted(muted: boolean): void;
  setOperatorIdentity(name: string | null): void;
  /** Retry the configured Ollama server immediately. */
  retry(): Promise<boolean>;
  isOffline(): boolean;
  dispose(): void;
};

const OFFLINE_NOTICE =
  "I am offline. I can use only saved local knowledge until a brain reconnects.";
const OFFLINE_UNKNOWN =
  "I am offline and do not have that in saved memory. Add a sourced note in Knowledge.";
const REQUEST_TIMEOUT_MS = 8000;
/** Cooldown between offline replies — no rapid-fire looping (owner order). */
export const OFFLINE_REPLY_COOLDOWN_MS = 2500;

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
  const onResponseSource = opts.onResponseSource;
  const voice = opts.voice ?? createVoiceProvider(bridge);
  const history: { role: string; content: string }[] = [];

  let timers: number[] = [];
  let disposed = false;
  let offline = false;
  let offlineNoticeSpoken = false;
  let retryTimer = 0;
  let retryCount = 0;
  let retrying = false;
  let requestController: AbortController | null = null;
  let muted = false;
  let operatorIdentity = opts.operatorName?.trim() || null;
  const operatorFullName = opts.operatorFullName?.trim() || null;

  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  const speak = (text: string, then: () => void) => {
    if (disposed) return;
    voice.stop();
    onSpeak?.(text);
    if (muted) {
      bridge.setState("LISTENING");
      return;
    }
    bridge.setState("SPEAKING");
    void voice.speak(text, then);
  };

  const setOffline = (next: boolean) => {
    if (offline === next) return;
    offline = next;
    onOfflineChange?.(next);
    if (!next) {
      offlineNoticeSpoken = false;
      lastOfflineReplyText = "";
      offlinePending = null;
      lastOfflineReplyAt = 0;
      clearOfflineCooldown();
      retryCount = 0;
      if (retryTimer) window.clearTimeout(retryTimer);
      retryTimer = 0;
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

  // OFFLINE GLITCH FIX: the fallback must answer ONCE, then wait for the next
  // message. No loops, no repeats, no rapid-fire.
  let lastOfflineReplyAt = 0;
  let lastOfflineReplyText = "";
  let offlinePending: string | null = null;
  let offlineCooldownTimer = 0;

  const clearOfflineCooldown = () => {
    if (offlineCooldownTimer) window.clearTimeout(offlineCooldownTimer);
    offlineCooldownTimer = 0;
    if (offlinePending) {
      const queued = offlinePending;
      offlinePending = null;
      onResponseSource?.("offline notice");
      speak(queued, listen);
    }
  };

  const offlineReply = (): string => {
    setOffline(true);
    const now = Date.now();
    const isFirstNotice = !offlineNoticeSpoken;
    let reply = OFFLINE_UNKNOWN;
    if (isFirstNotice) {
      offlineNoticeSpoken = true;
      reply = OFFLINE_NOTICE;
    }
    // Same text twice in a row → do NOT send it again (dup check).
    if (reply === lastOfflineReplyText && !isFirstNotice) {
      return ""; // silent: he waits for the next real message
    }
    if (now - lastOfflineReplyAt < OFFLINE_REPLY_COOLDOWN_MS) {
      // Inside the cooldown, queue at most one reply — it speaks when it opens.
      if (offlinePending !== reply) offlinePending = reply;
      return "";
    }
    lastOfflineReplyAt = now;
    lastOfflineReplyText = reply;
    onResponseSource?.("offline notice");
    speak(reply, listen);
    return reply;
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
            {
              role: "system",
              content: [
                system,
                operatorIdentity
                  ? `The operator's configured call name is "${operatorIdentity}". When called, answer exactly "Yes, ${operatorIdentity}."`
                  : 'When called, answer exactly "Yes, operator."',
                operatorFullName
                  ? `If asked who created you, state the verified full name "${operatorFullName}" plainly and truthfully.`
                  : "If asked who created you, say the verified name is not configured.",
              ].join("\n"),
            },
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
      const local = opts.findOfflineAnswer?.(text);
      if (local) {
        lastOfflineReplyText = "";
        onResponseSource?.(local.source);
        speak(local.answer, listen);
        return local.answer;
      }
      return offlineReply();
    }
    if (isQuietCommand(text)) {
      muted = true;
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
      onResponseSource?.("live brain");
      speak(reply, listen);
      return reply;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "";
      setOffline(true);
      scheduleRetry();
      // FAILOVER PIPE: cloud brains next (server-side keys), then simulated.
      if (opts.cloudFallback) {
        const cloud = await opts.cloudFallback(text);
        if (cloud) {
          onResponseSource?.("live brain");
          speak(cloud.answer, listen);
          return cloud.answer;
        }
      }
      return offlineReply();
    } finally {
      if (!offlineCooldownTimer) {
        offlineCooldownTimer = window.setTimeout(clearOfflineCooldown, OFFLINE_REPLY_COOLDOWN_MS);
      }
    }
  }

  const offs = [
    // Summon ("s" key / button): glitch, greet, then listen.
    bridge.onSummon(() => {
      shutUp();
      bridge.setState("GLITCH");
      const greeting = operatorIdentity ? `Yes, ${operatorIdentity}.` : "Yes, operator.";
      timers.push(window.setTimeout(() => speak(greeting, listen), 350));
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
    setMuted: (next: boolean) => {
      muted = next;
      if (muted) {
        shutUp();
        bridge.setState("LISTENING");
      }
    },
    setOperatorIdentity: (name: string | null) => {
      operatorIdentity = name?.trim() || null;
    },
    dispose: () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      clearOfflineCooldown();
      shutUp();
      offs.forEach((o) => o());
    },
    retry,
    isOffline: () => offline,
  };
}
