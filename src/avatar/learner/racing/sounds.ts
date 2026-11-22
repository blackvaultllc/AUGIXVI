/**
 * RACING SOUNDS (Part 16) — small, kind, synthesized sounds: no
 * audio files, no downloads, nothing startling. A right answer
 * rises, a wrong answer gently falls, NOS zooms, the finish gets a
 * little fanfare. Kids' rules hold: soft volume, short notes, and
 * a Sound off switch that sticks (localStorage).
 *
 * Everything no-ops safely where WebAudio does not exist (tests,
 * old browsers) — a silent game is a working game.
 */

export type RaceSound = "speed-up" | "slow-down" | "zoom" | "finish" | "pit";

const MUTE_KEY = "augi.racing.muted.v1";

export function racingMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setRacingMuted(muted: boolean): void {
  try {
    globalThis.localStorage?.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // A failed save never blocks the game.
  }
}

type Note = { freq: number; at: number; dur: number };

/** The note plan per sound — exported so tests can pin the shapes. */
export const SOUND_NOTES: Record<RaceSound, Note[]> = {
  "speed-up": [
    { freq: 523.25, at: 0, dur: 0.09 },
    { freq: 783.99, at: 0.08, dur: 0.12 },
  ],
  "slow-down": [
    { freq: 392.0, at: 0, dur: 0.1 },
    { freq: 329.63, at: 0.09, dur: 0.14 },
  ],
  zoom: [
    { freq: 440.0, at: 0, dur: 0.07 },
    { freq: 587.33, at: 0.06, dur: 0.07 },
    { freq: 880.0, at: 0.12, dur: 0.12 },
  ],
  finish: [
    { freq: 523.25, at: 0, dur: 0.1 },
    { freq: 659.25, at: 0.09, dur: 0.1 },
    { freq: 783.99, at: 0.18, dur: 0.1 },
    { freq: 1046.5, at: 0.27, dur: 0.18 },
  ],
  pit: [
    { freq: 659.25, at: 0, dur: 0.08 },
    { freq: 659.25, at: 0.12, dur: 0.12 },
  ],
};

let ctx: AudioContext | null = null;

export function playRaceSound(kind: RaceSound): void {
  if (racingMuted()) return;
  try {
    const AC: typeof AudioContext | undefined =
      globalThis.AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    for (const note of SOUND_NOTES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.0001, now + note.at);
      gain.gain.exponentialRampToValueAtTime(0.12, now + note.at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + note.at);
      osc.stop(now + note.at + note.dur + 0.02);
    }
  } catch {
    // Sound is a garnish — it never breaks the race.
  }
}
