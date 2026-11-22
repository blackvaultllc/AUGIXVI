import type { AvatarBridge } from "./AvatarBridge";
import { configureSpeechUtterance } from "./speechVoice";

/**
 * The stand-in's fallback lines (owner order 2026-11-22): the
 * generic assistant fillers ("Processing complete", "Standing by
 * for your next command") are GONE. Even the stand-in addresses
 * him as the Captain, in the respect forms — no canned assistant
 * phrasing anywhere in god speech.
 */
const REPLIES = [
  "I hear you, Captain. It is being seen to.",
  "Understood, Captain. I stand ready for your next word.",
  "Noted, Captain. Speak on, if you wish.",
];

/** Stand-in AI: replace with real STT/LLM/TTS by calling the same bridge methods. */
export function attachSimulatedAI(
  bridge: AvatarBridge,
  options: { subscribeToBridge?: boolean } = {},
) {
  let timers: number[] = [];
  let raf = 0;
  let alive = true;
  let userTalking = false;
  const clear = () => {
    timers.forEach(clearTimeout);
    timers = [];
    cancelAnimationFrame(raf);
    window.speechSynthesis?.cancel();
  };
  const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));

  const speak = (text: string, then: () => void) => {
    bridge.setState("SPEAKING");
    const dur = 600 + text.length * 55;
    const t0 = performance.now();
    try {
      const u = new SpeechSynthesisUtterance(text);
      // The gods' voice, same as the real provider: the deeper
      // British man's voice at his volume level (speechVoice.ts).
      configureSpeechUtterance(u);
      window.speechSynthesis.speak(u);
    } catch {
      /* no TTS */
    }
    // simulated amplitude (syllable envelope) — real TTS: bridge.connectAudioSource(node)
    const loop = () => {
      const e = performance.now() - t0;
      if (!alive) return;
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
  // Spoken/typed text arrives through handleText. The ear itself is the
  // local offline recognizer (localEar.ts → /api/transcribe →
  // faster-whisper on this machine); the browser's cloud SpeechRecognition
  // was removed — it died silently on Linux Chromium and needed the
  // internet Augie is built to survive without.
  const handleText = (text: string) => {
    if (isPresentCommand(text)) {
      clear();
      bridge.present("file");
      speak("Bringing it into view, Captain.", listen);
      return true;
    }
    if (/\b(put (it )?away|close (it|the file)|dismiss)\b/i.test(text)) {
      clear();
      bridge.present(null);
      speak("It is done, Captain.", listen);
      return true;
    }
    return false;
  };
  const listen = () => {
    bridge.setState("LISTENING");
    later(8000, () => bridge.state === "LISTENING" && !userTalking && bridge.setState("IDLE"));
  };

  const offs =
    options.subscribeToBridge === false
      ? []
      : [
          bridge.onSummon(() => {
            clear();
            bridge.setState("GLITCH");
            later(350, () => speak("I am listening, Captain.", listen));
          }),
          bridge.onUserSpeechStart(() => {
            userTalking = true;
            // Barge-in: the user started talking — stop the avatar mid-sentence and listen.
            if (
              bridge.state === "SPEAKING" ||
              bridge.state === "THINKING" ||
              bridge.state === "GLITCH"
            ) {
              clear(); // cancels speechSynthesis, pending timers, and the amplitude loop
              bridge.setSpeechLevel(0);
              listen();
            } else {
              timers.forEach(clearTimeout);
              timers = [];
            }
          }),
          bridge.onUserSpeechEnd(() => {
            userTalking = false;
            if (bridge.state !== "LISTENING") return;
            bridge.setState("THINKING");
            later(1600, () =>
              speak(REPLIES[Math.floor(Math.random() * REPLIES.length)] ?? REPLIES[0]!, () =>
                bridge.setState("IDLE"),
              ),
            );
          }),
        ];
  return {
    handleText,
    speak: (text: string) => {
      clear();
      speak(text, listen);
    },
    dispose: () => {
      alive = false;
      clear();
      offs.forEach((o) => o());
    },
  };
}

/** "Hey, I'm going to front this file" / "show me the file" / "bring up the document". */
export function isPresentCommand(text: string): boolean {
  return /\b(front|show|bring|pull|present|open|hold)\b.*\b(file|document|doc|this|it)\b/i.test(
    text,
  );
}
