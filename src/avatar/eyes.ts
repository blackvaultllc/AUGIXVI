import type { AvatarState } from "./AvatarBridge";

/**
 * THE EYES (owner orders 2026-11-21, RED order 2026-11-22): the single
 * glowing dot on his face is gone — he has TWO eyes now. They flash
 * with his speech and their COLOR carries his state/emotion.
 *
 * THE RED ORDER (2026-11-22): the Captain could not see the old
 * colors, so the eyes are BLOODSHOT RED in every state — visibility
 * is the point. The family stays red; the states stay distinct by
 * shade and heat, the way bloodshot eyes deepen:
 *
 *   IDLE      deep bloodshot red — at rest, watchful
 *   LISTENING ember red          — attention on the operator
 *   THINKING  crimson-magenta    — processing (the one shade that
 *                                  leans toward the vein)
 *   SPEAKING  hot red-orange     — his voice; brightness rides the
 *                                  speech level
 *   GLITCH    alarm red          — alert / warning, the hottest base
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
  IDLE: { r: 0.85, g: 0.1, b: 0.08 },
  LISTENING: { r: 1.0, g: 0.16, b: 0.1 },
  THINKING: { r: 0.9, g: 0.08, b: 0.28 },
  SPEAKING: { r: 1.0, g: 0.28, b: 0.08 },
  GLITCH: { r: 1.0, g: 0.05, b: 0.05 },
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
      base = 0.95;
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
