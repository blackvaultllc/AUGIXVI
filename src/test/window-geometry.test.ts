import { describe, expect, it } from "vitest";
import {
  WINDOW_MARGIN,
  clampWindowPosition,
  clampWindowSize,
} from "@/avatar/windows/windowGeometry";

/**
 * Window bounds (operator order 2026-11-21): a floating window must
 * always fit inside the viewport with clear margins — the AR Cube had
 * reopened at a persisted near-full-screen size and buried the stage
 * and the command box. These pin the pure clamp math the
 * FloatingWindow now applies on open, on resize, and on restore.
 */
describe("window geometry bounds", () => {
  it("keeps a size that already fits, unchanged", () => {
    expect(clampWindowSize(520, 600, 1024, 768)).toEqual({ w: 520, h: 600 });
  });

  it("caps an oversized window at the viewport minus margins on every side", () => {
    expect(clampWindowSize(4000, 3000, 1024, 768)).toEqual({
      w: 1024 - WINDOW_MARGIN * 2,
      h: 768 - WINDOW_MARGIN * 2,
    });
  });

  it("raises a too-small size to the window minimums", () => {
    expect(clampWindowSize(100, 50, 1024, 768)).toEqual({ w: 260, h: 140 });
  });

  it("fits the default AR Cube size into a phone-sized viewport", () => {
    expect(clampWindowSize(520, 600, 390, 844)).toEqual({
      w: 390 - WINDOW_MARGIN * 2,
      h: 600,
    });
  });

  it("keeps an in-bounds position unchanged", () => {
    expect(clampWindowPosition(120, 90, 520, 600, 1024, 768)).toEqual({ x: 120, y: 90 });
  });

  it("pulls an off-screen position back so the whole window is inside", () => {
    expect(clampWindowPosition(5000, 4000, 520, 600, 1024, 768)).toEqual({
      x: 1024 - 520 - 4,
      y: 768 - 600 - 4,
    });
  });

  it("pulls a negative position back to the edge", () => {
    expect(clampWindowPosition(-50, -50, 520, 600, 1024, 768)).toEqual({ x: 4, y: 4 });
  });

  it("centers nothing but leaves exactly the edge gap for a max-size window", () => {
    const size = clampWindowSize(4000, 3000, 1024, 768);
    expect(clampWindowPosition(120, 90, size.w, size.h, 1024, 768)).toEqual({
      x: 1024 - size.w - 4,
      y: 768 - size.h - 4,
    });
  });
});
