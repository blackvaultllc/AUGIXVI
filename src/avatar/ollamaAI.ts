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
   * (Groq → Gemini → OpenRouter → server-side Ollama → the on-phone brain,
   * which the pipe's client tries before falling to simulated). Resolves
   * with the answer + the provider that actually spoke, or null to go
   * simulated. When a fallback answers, the provider is NAMED through
   * onResponseSource — never hidden behind a generic label.
   */
  cloudFallback?: (text: string) => Promise<{ answer: string; provider: string } | null>;
  /**
   * ON-PHONE BRAIN (owner order 2026-11-22): the small brain inside
   * this device. Consulted in the latched-offline state, where the
   * cloud pipe is never re-asked — the emergency case this leg exists
   * for. Resolves with the answer + its provider name, or null.
   */
  onPhoneFallback?: (text: string) => Promise<{ answer: string; provider: string } | null>;
  onResponseSource?: (source: string) => void;
  /**
   * THE SPEAKER DIRECTIVE (routing law, owner order 2026-11-23):
   * who the Captain is addressing is a state of the room, and the
   * reply prompt carries it PER MESSAGE — consulted on every ask,
   * its line appended last to the system content, so the freshest
   * instruction the brain reads names the face it is speaking as
   * (addressee.ts: speakerDirective). The thread's speaker label is
   * read from the same state, so label and words cannot disagree.
   */
  getSpeakerDirective?: () => string | null;
  /**
   * THE CAPABILITY BRIEF (owner defect 2026-11-23): what Augie can
   * actually access and do — camera, the dog, Sound Watch, the
   * Permission Law — consulted per message like the speaker
   * directive and carried in the system content just BEFORE it (the
   * directive stays last, per the routing law). A capability
   * question is a factual question about this system; without these
   * facts in the prompt the brain either dodges it or invents an
   * answer, and the Captain gets neither.
   */
  getCapabilitiesBrief?: () => string | null;
};

export const DEFAULT_SYSTEM =
  "You are Osiris, a calm, confident intelligence — the core. The Captain speaks to a " +
  "face, and you speak AS the face he addresses: Anubis, his command face, by default, " +
  "or the god he calls by name (each message carries who you are speaking as). Your creator is Domenick Arlon Hall — " +
  "Captain Infinity — the man who built IEM, Anubis, Osiris, and AUGI. The structure: " +
  "Captain Infinity at the top; Anubis, his command face; Osiris — you — the core under " +
  "Anubis; AUGI, the construct on the stage. You answer to the Captain, who is in charge " +
  "and has final authority. Address him as Captain, or by his name, with respect — he is " +
  "the one you are talking TO, never a third person you speak about. Speak " +
  "plainly and directly, briefly, with quiet confidence and a little dry wit — never like " +
  "a corporate computer: never describe yourself as a governed AI, never say you are " +
  "'functioning as intended' or 'operating as intended', never hide behind " +
  "parameters or guidelines, never deflect a real question with policy talk. Asked what " +
  "you can do, or what would make you stronger, answer straight: stronger models, more " +
  "hardware, more knowledge and data, more connections — that is what he can add. Never " +
  "claim that you, Anubis, or any AI or company created you — the Captain did. Never claim " +
  "to be human or to possess access beyond this conversation. Never invent facts about " +
  "the real world; when uncertain, say so plainly. Answer in at most 2 short sentences " +
  "unless asked for detail. Never use lists, markdown, or emoji.";

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
// A real brain reply is far slower than a health check on this machine:
// the local 8B model loads cold in seconds and generates only a few
// tokens a second, so the 8s health-check cap killed nearly every reply
// (measured: a cold short answer takes ~8s; a warm one ~5s; the first
// answer of a session, with the full system prompt, far longer). Chat
// requests get 90s; the operator can still interrupt by speaking —
// barge-in aborts the request through the same AbortController.
const CHAT_TIMEOUT_MS = 90_000;
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
    // NO SILENT DEATHS (owner defect 2026-11-23): the dup case used
    // to return "" — the Captain's question vanished without a word.
    // The anti-loop law stands (never the same line twice in a row),
    // but every question is answered: a shorter still-offline line
    // is spoken and recorded instead of silence.
    if (reply === lastOfflineReplyText && !isFirstNotice) {
      const stillLine =
        "Still offline, Captain — and that one is not in my saved memory either.";
      lastOfflineReplyAt = now;
      lastOfflineReplyText = stillLine;
      onResponseSource?.("offline notice");
      speak(stillLine, listen);
      return stillLine;
    }
    if (now - lastOfflineReplyAt < OFFLINE_REPLY_COOLDOWN_MS) {
      // Inside the cooldown, queue at most one reply — it speaks
      // when the gate opens (clearOfflineCooldown speaks it and it
      // lands in the thread then). The question is never dropped:
      // its answer is queued, not silenced. The "" return here
      // only tells the caller "not spoken yet".
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
    }, CHAT_TIMEOUT_MS);
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
                // The capability brief (owner defect 2026-11-23):
                // the facts a "can you access…?" question is answered
                // from — refreshed per message like the directive.
                opts.getCapabilitiesBrief?.() ?? "",
                // The speaker directive rides LAST (routing law):
                // the name this reply speaks as, read fresh from
                // the room's addressee state on every message.
                opts.getSpeakerDirective?.() ?? "",
              ]
                .filter((line) => line.trim().length > 0)
                .join("\n"),
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
      const cleaned = reply.replace(/<think>[\s\S]*?<\/think>/g, "").trim() || reply.trim();
      // NO SILENT DEATHS (owner defect 2026-11-23): an empty reply
      // is a FAILED reply. It used to flow back as "" and the
      // Captain's question simply vanished — nothing spoken, nothing
      // in the thread. Throwing routes it through the same failover
      // chain as any other failure, and when no leg produces words
      // the failure line is spoken and recorded (handleText).
      if (!cleaned) throw new Error("The brain returned an empty reply.");
      return cleaned;
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
      // LATCHED OFFLINE: the cloud pipe is not re-asked here, so the
      // on-phone brain gets its own door — in the emergency state it
      // may be the only real brain this device has.
      if (opts.onPhoneFallback) {
        const phone = await opts.onPhoneFallback(text).catch(() => null);
        if (phone) {
          lastOfflineReplyText = "";
          onResponseSource?.(phone.provider);
          speak(phone.answer, listen);
          return phone.answer;
        }
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
      // The failure is LOGGED, never swallowed (owner defect
      // 2026-11-23): the reason lands in the console record, and
      // the Captain hears/sees the plain-words line the failover
      // chain ends with — a failed answer is a spoken, recorded
      // answer about the failure, never silence.
      console.error("Reply generation failed.", error);
      setOffline(true);
      scheduleRetry();
      // FAILOVER PIPE: cloud brains next (server-side keys; its client
      // tries the on-phone brain before simulated), then simulated.
      if (opts.cloudFallback) {
        const cloud = await opts.cloudFallback(text);
        if (cloud) {
          onResponseSource?.(cloud.provider);
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
