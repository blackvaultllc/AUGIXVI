import type { AvatarState } from "./AvatarBridge";

export type Params = {
  breath: number;
  tight: number;
  core: number;
  white: number;
  contour: number;
  flare: number;
  drift: number;
  glitch: number;
};

export function targetParams(s: AvatarState, speech: number): Params {
  switch (s) {
    case "LISTENING":
      return {
        breath: 0.6,
        tight: 1,
        core: 1.4,
        white: 0.1,
        contour: 0.4,
        flare: 0.2,
        drift: 0.3,
        glitch: 0,
      };
    case "THINKING":
      return {
        breath: 0.4,
        tight: 0.6,
        core: 1.2,
        white: 0.8,
        contour: 2.5,
        flare: 0.1,
        drift: 0.5,
        glitch: 0.05,
      };
    case "SPEAKING":
      return {
        breath: 0.5,
        tight: 0.4,
        core: 1 + speech * 1.5,
        white: 0.2,
        contour: 0.6,
        flare: speech,
        drift: 0.6,
        glitch: 0,
      };
    case "GLITCH":
      return {
        breath: 0.3,
        tight: 0,
        core: 1.6,
        white: 0.5,
        contour: 1.5,
        flare: 0.6,
        drift: 1.5,
        glitch: 1,
      };
    default:
      return {
        breath: 1,
        tight: 0,
        core: 0.8,
        white: 0,
        contour: 0.25,
        flare: 0,
        drift: 1,
        glitch: 0,
      };
  }
}

/** Critically damped spring step toward target. */
export function spring(
  x: number,
  v: number,
  target: number,
  k: number,
  dt: number,
): [number, number] {
  const c = 2 * Math.sqrt(k);
  const a = k * (target - x) - c * v;
  v += a * dt;
  x += v * dt;
  return [x, v];
}

export function intensityLabel(level: number): "LOW" | "MED" | "HIGH" {
  return level < 0.33 ? "LOW" : level < 0.66 ? "MED" : "HIGH";
}
