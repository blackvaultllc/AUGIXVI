import type { AvatarState } from "./AvatarBridge";

/**
 * THE EYES (owner order 2026-11-21): the single glowing dot on his face
 * is gone — he has TWO eyes now. They flash with his speech and their
 * COLOR carries his state/emotion. The mapping (kept small and tasteful
 * on purpose — five states, five colors, no rainbow):
 *
 *   IDLE      calm cyan      — at rest, watchful
 *   LISTENING emerald green  — attention on the operator
 *   THINKING  violet         — processing
 *   SPEAKING  warm gold      — his voice; brightness rides the speech level
 *   GLITCH    red-orange     — alert / warning
 *
 * A summons (alertBoost) does not change the color family; it pushes
 * brightness up — the same eyes, hotter.
 *
 * "Flash" never means strobe: the pulse is the smoothed speech level
 * itself (attack ~14/s, release ~7/s exponential approach), so the eyes
 * swell and settle with his voice instead of blinking on and off.
 * Plain module, no three.js — unit-testable per the repo's avatar rules.
 */

export type EyeColor = { r: number; g: number; b: number };

const EYE_COLORS: Record<AvatarState, EyeColor> = {
  IDLE: { r: 0.35, g: 0.85, b: 1.0 },
  LISTENING: { r: 0.3, g: 1.0, b: 0.55 },
  THINKING: { r: 0.62, g: 0.45, b: 1.0 },
  SPEAKING: { r: 1.0, g: 0.72, b: 0.25 },
  GLITCH: { r: 1.0, g: 0.3, b: 0.15 },
};

/** The eye color for a state — see the mapping table above. */
export function eyeColorFor(state: AvatarState): EyeColor {
  return EYE_COLORS[state];
}

/**
 * Base eye brightness (a multiplier on the color) before the speech
 * pulse is added. Speaking rides the live speech level; a summons
 * (alertBoost 0..1) heats any state up.
 */
export function eyeBrightnessFor(state: AvatarState, speechLevel: number, alertBoost = 0): number {
  let base: number;
  switch (state) {
    case "LISTENING":
      base = 1.0;
      break;
    case "THINKING":
      base = 0.95;
      break;
    case "SPEAKING":
      base = 1.0 + Math.max(0, Math.min(1, speechLevel)) * 0.9;
      break;
    case "GLITCH":
      base = 1.25;
      break;
    default:
      base = 0.85;
  }
  return base + Math.max(0, Math.min(1, alertBoost)) * 0.5;
}

/**
 * Smooth pulse step: exponential approach toward the target with a fast
 * attack and a slower release, so brightness follows the envelope of
 * his voice. The per-step change is bounded by the rate — at 60fps a
 * full swing takes several frames, which is what keeps it a pulse and
 * not a strobe.
 */
export function smoothEyePulse(previous: number, target: number, dt: number): number {
  const rate = target > previous ? 14 : 7;
  const step = 1 - Math.exp(-rate * Math.max(0, dt));
  return previous + (target - previous) * step;
}
