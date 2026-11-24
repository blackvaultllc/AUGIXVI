import { describe, expect, it } from "vitest";
import {
  DESKTOP_RENDER_CAPS,
  PHONE_RENDER_CAPS,
  isPhoneClassDevice,
  renderCapsFor,
} from "@/avatar/deviceProfile";

/**
 * PHONE PERFORMANCE PASS (owner order 2026-11-24 ~10:00 EST): Augie
 * runs rough on the phone. Phone-class devices build the particle
 * buffer at a capped count, cap the pixel ratio lower, and let the
 * adaptive governor step further down. Desktop keeps exactly the
 * pre-existing profile — 120K ceiling, 1.75 pixel ratio, 15K floor.
 */
describe("device render profile", () => {
  it("classifies a mobile user agent as phone-class at any width", () => {
    expect(
      isPhoneClassDevice({
        innerWidth: 1200,
        maxTouchPoints: 5,
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36",
      }),
    ).toBe(true);
    expect(
      isPhoneClassDevice({
        innerWidth: 390,
        maxTouchPoints: 5,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      }),
    ).toBe(true);
  });

  it("classifies a small touch screen as phone-class even without a mobile UA", () => {
    expect(
      isPhoneClassDevice({ innerWidth: 390, maxTouchPoints: 5, userAgent: "Mozilla/5.0" }),
    ).toBe(true);
  });

  it("does NOT mistake a narrow desktop window for a phone", () => {
    expect(
      isPhoneClassDevice({
        innerWidth: 500,
        maxTouchPoints: 0,
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
      }),
    ).toBe(false);
  });

  it("keeps wide touch screens (tablets) on the desktop profile", () => {
    expect(
      isPhoneClassDevice({
        innerWidth: 1024,
        maxTouchPoints: 10,
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
      }),
    ).toBe(false);
  });

  it("phone caps: 45K particle ceiling, 8K governor floor, 1.5 pixel ratio", () => {
    const caps = renderCapsFor({
      innerWidth: 390,
      maxTouchPoints: 5,
      userAgent: "Mozilla/5.0 (Linux; Android 14) Mobile",
    });
    expect(caps).toEqual(PHONE_RENDER_CAPS);
    expect(caps.particleCap).toBe(45_000);
    expect(caps.particleFloor).toBe(8_000);
    expect(caps.pixelRatioCap).toBe(1.5);
  });

  it("desktop caps are the pre-existing behavior, unchanged", () => {
    const caps = renderCapsFor({
      innerWidth: 1920,
      maxTouchPoints: 0,
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/130",
    });
    expect(caps).toEqual(DESKTOP_RENDER_CAPS);
    expect(caps.particleCap).toBe(Number.POSITIVE_INFINITY);
    expect(caps.particleFloor).toBe(15_000);
    expect(caps.pixelRatioCap).toBe(1.75);
  });
});
