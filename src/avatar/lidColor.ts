/**
 * LID COLOR FROM THE PORTRAIT ITSELF (owner order 2026-11-22):
 * when a medallion face blinks, the eyelid that sweeps down must
 * wear THAT face's own colors — the gold of Anubis's fur, the skin
 * of the Black Hatter's brow, the dark feather of Montu's — never
 * one shared tint and never a guessed one. This module is the
 * plain-data half (repo rule: rules stay in plain TS, unit-
 * testable): where to sample around an eye, and how a handful of
 * sampled pixels becomes the lid's gradient. LivingPortrait.tsx
 * does the canvas sampling in the browser and feeds pixels here;
 * if sampling fails for any reason, the feature map's authored
 * gradient stands as the fallback.
 *
 * The sample points ride on the feature map (percent space): the
 * strip just above each eye and the eye's outer corners — the
 * surface the lid itself belongs to. Because the points derive
 * from the map, a corrected map automatically corrects the colors
 * sampled from it.
 */
import type { FaceFeatures } from "./LivingPortrait";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Percent-space points to sample for one eye's lid territory. */
export function lidSamplePointsForEye(
  features: FaceFeatures,
  eye: { x: number; y: number },
): { x: number; y: number }[] {
  const above = eye.y - features.eyeH * 0.95;
  const side = features.eyeW * 0.62;
  return [
    { x: eye.x - features.eyeW * 0.3, y: above },
    { x: eye.x, y: above },
    { x: eye.x + features.eyeW * 0.3, y: above },
    { x: eye.x - side, y: eye.y },
    { x: eye.x + side, y: eye.y },
  ];
}

/** Every sample point for a face — both eyes' lid territory. */
export function lidSamplePoints(features: FaceFeatures): { x: number; y: number }[] {
  return [
    ...lidSamplePointsForEye(features, features.leftEye),
    ...lidSamplePointsForEye(features, features.rightEye),
  ];
}

/** The plain average of sampled pixels — the lid's base tone. */
export function averageRgb(samples: readonly Rgb[]): Rgb {
  if (samples.length === 0) return { r: 0, g: 0, b: 0 };
  const total = samples.reduce(
    (acc, sample) => ({ r: acc.r + sample.r, g: acc.g + sample.g, b: acc.b + sample.b }),
    { r: 0, g: 0, b: 0 },
  );
  return {
    r: Math.round(total.r / samples.length),
    g: Math.round(total.g / samples.length),
    b: Math.round(total.b / samples.length),
  };
}

/** A tone scaled toward light (>1) or shade (<1), channels clamped. */
export function shadeRgb(color: Rgb, factor: number): Rgb {
  const scale = (value: number) => Math.min(255, Math.max(0, Math.round(value * factor)));
  return { r: scale(color.r), g: scale(color.g), b: scale(color.b) };
}

export function rgbCss(color: Rgb): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/**
 * The lid gradient from sampled pixels, in the same shape as the
 * authored gradients it replaces: lit at the top of the lid,
 * the face's own tone through the body, shade at the edge.
 */
export function lidGradientFromSamples(samples: readonly Rgb[]): string | null {
  if (samples.length === 0) return null;
  const base = averageRgb(samples);
  const light = shadeRgb(base, 1.3);
  const dark = shadeRgb(base, 0.58);
  return `radial-gradient(ellipse at 50% 35%, ${rgbCss(light)} 0%, ${rgbCss(base)} 70%, ${rgbCss(dark)} 100%)`;
}
