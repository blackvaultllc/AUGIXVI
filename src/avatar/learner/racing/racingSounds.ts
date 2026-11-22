/**
 * RACING SOUNDS (Part 16, owner order 2026-11-21) — kid-friendly tones
 * generated in-app with WebAudio. No external files, no downloads.
 * Three sounds, exactly the ones he named: speed up, slow down, finish.
 * Gentle sine/triangle blips — nothing loud, nothing startling, and a
 * mute that STICKS (localStorage), because her rules are no strobing,
 * no pressure, and sounds she can turn off.
 */

export const RACING_MUTED_KEY = "augi.racing.muted.v1";

export function racingMuted(): boolean {
  try {
    return window.localStorage.getItem(RACING_MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setRacingMuted(muted: boolean) {
  try {
    window.localStorage.setItem(RACING_MUTED_KEY, muted ? "1" : "0");
  } catch {
    // Private mode: the toggle still works for this session.
  }
}

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  ac: AudioContext,
  freqFrom: number,
  freqTo: number,
  startAt: number,
  seconds: number,
  type: OscillatorType = "sine",
  peak = 0.12,
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const t0 = ac.currentTime + startAt;
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t0 + seconds);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + seconds + 0.05);
}

/** Right answer / NOS: a happy rising zoom. */
export function playSpeedUp() {
  if (racingMuted()) return;
  const ac = audioContext();
  if (!ac) return;
  tone(ac, 420, 880, 0, 0.22, "triangle", 0.14);
  tone(ac, 660, 1180, 0.07, 0.2, "sine", 0.08);
}

/** Wrong answer: a soft falling "aww" — kind, never a buzzer. */
export function playSlowDown() {
  if (racingMuted()) return;
  const ac = audioContext();
  if (!ac) return;
  tone(ac, 520, 240, 0, 0.3, "sine", 0.11);
}

/** Crossing the finish: a short happy arpeggio. */
export function playFinish() {
  if (racingMuted()) return;
  const ac = audioContext();
  if (!ac) return;
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => tone(ac, freq, freq, i * 0.11, 0.22, "triangle", 0.12));
}
