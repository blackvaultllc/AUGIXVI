import type { AvatarBridge } from "./AvatarBridge";

const REPLIES = [
  "I hear you. Processing complete.",
  "Understood. Standing by for your next command.",
  "Interesting. Tell me more.",
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
      u.rate = 0.95;
      u.pitch = 0.8;
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
  // Browser speech recognition (where supported) to catch "show/bring/front this file".
  type Rec = {
    continuous: boolean;
    interimResults: boolean;
    onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
    onend: () => void;
    start: () => void;
    stop: () => void;
  };
  const W = window as unknown as {
    SpeechRecognition?: new () => Rec;
    webkitSpeechRecognition?: new () => Rec;
  };
  const RecCtor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  let rec: Rec | null = null;
  const handleText = (text: string) => {
    if (isPresentCommand(text)) {
      clear();
      bridge.present("file");
      speak("Bringing it into view.", listen);
      return true;
    }
    if (/\b(put (it )?away|close (it|the file)|dismiss)\b/i.test(text)) {
      clear();
      bridge.present(null);
      speak("Done.", listen);
      return true;
    }
    return false;
  };
  const startRec = () => {
    if (!RecCtor || rec) return;
    try {
      rec = new RecCtor();
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e) => {
        const r = e.results[0]?.[0];
        if (r) handleText(r.transcript);
      };
      rec.onend = () => {
        rec = null;
      };
      rec.start();
    } catch {
      rec = null;
    }
  };
  const listen = () => {
    bridge.setState("LISTENING");
    if (options.subscribeToBridge !== false) startRec();
    later(8000, () => bridge.state === "LISTENING" && !userTalking && bridge.setState("IDLE"));
  };

  const offs =
    options.subscribeToBridge === false
      ? []
      : [
          bridge.onSummon(() => {
            clear();
            bridge.setState("GLITCH");
            later(350, () => speak("What do you want?", listen));
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
            if (rec) return; // recognition result will decide
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
      rec?.stop();
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
