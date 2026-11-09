import type { AvatarBridge } from "./AvatarBridge";

const REPLIES = ["I hear you. Processing complete.", "Understood. Standing by for your next command.", "Interesting. Tell me more."];

/** Stand-in AI: replace with real STT/LLM/TTS by calling the same bridge methods. */
export function attachSimulatedAI(bridge: AvatarBridge) {
  let timers: number[] = []; let raf = 0; let alive = true;
  const clear = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); window.speechSynthesis?.cancel(); };
  const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));

  const speak = (text: string, then: () => void) => {
    bridge.setState("SPEAKING");
    const dur = 600 + text.length * 55; const t0 = performance.now();
    try { const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; u.pitch = 0.8; window.speechSynthesis.speak(u); } catch { /* no TTS */ }
    // simulated amplitude (syllable envelope) — real TTS: bridge.connectAudioSource(node)
    const loop = () => {
      const e = performance.now() - t0; if (!alive) return;
      if (e > dur) { bridge.setSpeechLevel(0); then(); return; }
      const syl = Math.abs(Math.sin(e / 95)) * (0.5 + 0.5 * Math.sin(e / 410)); bridge.setSpeechLevel(0.25 + syl * 0.75);
      raf = requestAnimationFrame(loop);
    };
    loop();
  };
  const listen = () => { bridge.setState("LISTENING"); later(8000, () => bridge.state === "LISTENING" && bridge.setState("IDLE")); };

  const offs = [
    bridge.onSummon(() => { clear(); bridge.setState("GLITCH"); later(350, () => speak("What do you want?", listen)); }),
    bridge.onUserSpeechStart(() => { timers.forEach(clearTimeout); timers = []; }),
    bridge.onUserSpeechEnd(() => {
      if (bridge.state !== "LISTENING") return;
      bridge.setState("THINKING");
      later(1600, () => speak(REPLIES[Math.floor(Math.random() * REPLIES.length)], () => bridge.setState("IDLE")));
    }),
  ];
  return { dispose: () => { alive = false; clear(); offs.forEach((o) => o()); }, speak: (t: string) => { clear(); speak(t, () => bridge.setState("IDLE")); } };
}
