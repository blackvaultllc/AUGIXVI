import { describe, expect, it } from "vitest";
import { ANUBIS_FEATURES, BLACK_HATTER_FEATURES, MONTU_FEATURES } from "@/avatar/LivingPortrait";
import {
  averageRgb,
  lidGradientFromSamples,
  lidSamplePoints,
  lidSamplePointsForEye,
  shadeRgb,
} from "@/avatar/lidColor";

/**
 * LID COLOR FROM THE PORTRAIT ITSELF (owner order 2026-11-22): a
 * blinking face's eyelid wears that face's own colors, sampled from
 * its own artwork — never one shared tint. These tests pin the
 * math: where the samples land, how they average, and that three
 * different faces' territories yield three different gradients.
 */
describe("lid sample points", () => {
  it("samples the strip above each eye and its corners — the lid's own territory", () => {
    const points = lidSamplePointsForEye(ANUBIS_FEATURES, ANUBIS_FEATURES.leftEye);
    expect(points).toHaveLength(5);
    for (const point of points) {
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(100);
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(100);
    }
    // The strip rides ABOVE the eye, never on the eye itself.
    const above = points.slice(0, 3);
    for (const point of above) expect(point.y).toBeLessThan(ANUBIS_FEATURES.leftEye.y);
  });

  it("covers both eyes of every living face", () => {
    for (const features of [ANUBIS_FEATURES, BLACK_HATTER_FEATURES, MONTU_FEATURES]) {
      expect(lidSamplePoints(features)).toHaveLength(10);
    }
  });

  it("derives from the map: a moved eye moves its sample strip with it", () => {
    const moved = { ...MONTU_FEATURES, leftEye: { x: 30, y: 60 } };
    const points = lidSamplePointsForEye(moved, moved.leftEye);
    expect(points[1]).toEqual({ x: 30, y: 60 - MONTU_FEATURES.eyeH * 0.95 });
  });
});

describe("lid gradient from samples", () => {
  it("averages samples into the base tone", () => {
    expect(
      averageRgb([
        { r: 200, g: 160, b: 60 },
        { r: 100, g: 80, b: 20 },
      ]),
    ).toEqual({ r: 150, g: 120, b: 40 });
    expect(averageRgb([])).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("shades toward light and dark with channels clamped", () => {
    expect(shadeRgb({ r: 200, g: 100, b: 40 }, 1.3)).toEqual({ r: 255, g: 130, b: 52 });
    expect(shadeRgb({ r: 200, g: 100, b: 40 }, 0.5)).toEqual({ r: 100, g: 50, b: 20 });
  });

  it("builds the lid gradient in the authored shape — lit top, own tone, shaded edge", () => {
    const gradient = lidGradientFromSamples([{ r: 220, g: 179, b: 74 }]); // Anubis gold
    expect(gradient).toBe(
      "radial-gradient(ellipse at 50% 35%, rgb(255, 233, 96) 0%, rgb(220, 179, 74) 70%, rgb(128, 104, 43) 100%)",
    );
  });

  it("different faces' colors yield different lids — no shared tint", () => {
    const gold = lidGradientFromSamples([{ r: 220, g: 179, b: 74 }]);
    const skin = lidGradientFromSamples([{ r: 107, g: 74, b: 48 }]);
    const feather = lidGradientFromSamples([{ r: 30, g: 38, b: 58 }]);
    expect(gold).not.toBe(skin);
    expect(skin).not.toBe(feather);
    expect(feather).not.toBe(gold);
    // Montu's dark feather stays dark — his blink is a dark lid, not gold.
    expect(feather).toContain("rgb(30, 38, 58)");
  });

  it("no samples, no gradient — the authored fallback stands", () => {
    expect(lidGradientFromSamples([])).toBeNull();
  });
});
