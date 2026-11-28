import { describe, expect, it } from "vitest";
import {
  BINARY_BLINK_FLASH_MS,
  blinkByte,
  eyeOpeningRects,
} from "@/avatar/binaryBlink";
import { ANUBIS_FEATURES } from "@/avatar/LivingPortrait";

/**
 * THE BINARY BLINK (owner design 2026-11-27 ~23:10 CST): the
 * lid blink is REMOVED for Anubis — his eyes shine gold at
 * rest, and his blink is one byte: eight 0/1 characters
 * flashing inside BOTH eyes for about a second, clipped
 * strictly inside the eye OPENINGS of his fixed portrait,
 * never over the skin. These pins hold the geometry and the
 * byte law: the openings are calibrated to this portrait
 * (face.webp — see binaryBlink.ts), the flash rectangles sit
 * strictly inside the old lid footprint so the byte can
 * never paint over skin, and a byte is always exactly eight
 * 0/1 characters, the same in both eyes (the render pins
 * that half in living-portrait.test.tsx).
 */
describe("blinkByte — one byte, eight characters", () => {
  it("is always exactly eight 0/1 characters", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(blinkByte(Math.random)).toMatch(/^[01]{8}$/);
    }
  });

  it("reads the random source bit by bit", () => {
    expect(blinkByte(() => 0.99)).toBe("11111111");
    expect(blinkByte(() => 0.01)).toBe("00000000");
    let call = 0;
    expect(blinkByte(() => (call++ % 2 === 0 ? 0.9 : 0.1))).toBe("10101010");
  });

  it("the flash stands about a second", () => {
    expect(BINARY_BLINK_FLASH_MS).toBe(1000);
  });
});

describe("eyeOpeningRects — calibrated to this portrait, inside the eyes", () => {
  it("Anubis's openings are the calibrated ones (6.6 x 4.5 on the fixed centers)", () => {
    expect(ANUBIS_FEATURES.eyeOpenW).toBe(6.6);
    expect(ANUBIS_FEATURES.eyeOpenH).toBe(4.5);
    const rects = eyeOpeningRects(ANUBIS_FEATURES);
    // Corner = center − half the opening: (42.3, 39.6) / (57.7, 39.8).
    expect(rects.left.width).toBe(6.6);
    expect(rects.left.height).toBe(4.5);
    expect(rects.left.left).toBeCloseTo(39.0, 6);
    expect(rects.left.top).toBeCloseTo(37.35, 6);
    expect(rects.right.width).toBe(6.6);
    expect(rects.right.height).toBe(4.5);
    expect(rects.right.left).toBeCloseTo(54.4, 6);
    expect(rects.right.top).toBeCloseTo(37.55, 6);
  });

  it("each opening sits STRICTLY inside its lid footprint — the byte never touches skin", () => {
    const rects = eyeOpeningRects(ANUBIS_FEATURES);
    for (const side of ["left", "right"] as const) {
      const open = rects[side];
      const center = side === "left" ? ANUBIS_FEATURES.leftEye : ANUBIS_FEATURES.rightEye;
      const lidLeft = center.x - ANUBIS_FEATURES.eyeW / 2;
      const lidTop = center.y - ANUBIS_FEATURES.eyeH / 2;
      expect(open.width).toBeLessThan(ANUBIS_FEATURES.eyeW);
      expect(open.height).toBeLessThan(ANUBIS_FEATURES.eyeH);
      expect(open.left).toBeGreaterThan(lidLeft);
      expect(open.left + open.width).toBeLessThan(lidLeft + ANUBIS_FEATURES.eyeW);
      expect(open.top).toBeGreaterThan(lidTop);
      expect(open.top + open.height).toBeLessThan(lidTop + ANUBIS_FEATURES.eyeH);
    }
  });

  it("a map without an opening size falls back to the lid footprint itself", () => {
    const rects = eyeOpeningRects({
      leftEye: { x: 40, y: 40 },
      rightEye: { x: 60, y: 40 },
      eyeW: 8,
      eyeH: 5,
    });
    expect(rects.left).toEqual({ left: 36, top: 37.5, width: 8, height: 5 });
    expect(rects.right).toEqual({ left: 56, top: 37.5, width: 8, height: 5 });
  });
});
