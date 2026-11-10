import type { AvatarBridge } from "./AvatarBridge";

/**
 * Real AI brain for AUGI via a local Ollama server (http://localhost:11434).
 * Ollama allows browser origins by default (CORS), so the page can talk to it directly.
 *
 * Speech, gestures and state flow through the same bridge contract as simulatedAI,
 * so the avatar rendering code never changes.
 */

export type OllamaAIOptions = {
  model?: string;
  baseUrl?: string;
  /** Personality / system prompt for AUGI. */
  system?: string;
  /** Called whenever AUGI starts speaking, including summon greetings. */
  onSpeak?: (text: string) => void;
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
  const model = opts.model ?? "llama3.1:8b";
  const baseUrl = opts.baseUrl ?? "http://localhost:11434";
  const system = opts.system ?? DEFAULT_SYSTEM;
  const onSpeak = opts.onSpeak;
  const history: { role: string; content: string }[] = [];

  let timers: number[] = [];
  let raf = 0;
  let disposed = false;

  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
    cancelAnimationFrame(raf);
  };

  /** Drive speechLevel the same way simulatedAI does (fake syllable envelope). */
  const speak = (text: string, then: () => void) => {
    if (disposed) return;
    onSpeak?.(text);
    bridge.setState("SPEAKING");
    const dur = 600 + text.length * 55;
    const t0 = performance.now();
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.pitch = 0.8;
      window.speechSynthesis?.speak(u);
    } catch {
      /* no TTS available */
    }
    const loop = () => {
      if (disposed) return;
      const e = performance.now() - t0;
      if (e > dur) {
        bridge.setSpeechLevel(0);
        then();
        return;
      }
      const syl = Math.abs(Math.sin(e / 95)) * (0.5 + 0.5 * Math.sin(e / 410));
      bridge.setSpeechLevel(0.25 + syl * 0.75);
      raf = requestAnimationFrame(loop);
    };
    loop();
  };

  const listen = () => {
    if (!disposed) bridge.setState("LISTENING");
  };

  async function ask(text: string): Promise<string> {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const reply = (data.message?.content ?? "").trim();
    // qwen3-style thinking models wrap reasoning in  — strip it.
    return reply.replace(/<think>[\s\S]*?<\/think>/g, "").trim() || reply.trim();
  }

  /** Stop speaking immediately — used by "be quiet"-style commands and dispose. */
  const shutUp = () => {
    clearTimers();
    window.speechSynthesis?.cancel();
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
    } catch (e) {
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
