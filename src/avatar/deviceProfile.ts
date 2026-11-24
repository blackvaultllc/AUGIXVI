/**
 * DEVICE RENDER PROFILE (owner order 2026-11-24 ~10:00 EST: Augie
 * "runs kind of rough on the phone" — steady the frame rate on
 * phone-class devices without gutting the desktop).
 *
 * The stage renderer was built desktop-first: a 120,000-particle
 * ceiling, a pixel-ratio cap of 1.75, and an adaptive governor whose
 * floor is 15,000 particles. On a phone GPU that floor is still a
 * heavy scene rendered through a bloom composer at near-retina
 * resolution — the roughness he feels. This module names the
 * phone-class caps in one place:
 *
 *   - the particle buffer is BUILT at the capped count (less memory,
 *     less vertex work from the first frame — not just drawn less);
 *   - the pixel ratio caps lower (fill-rate is the phone's scarcest
 *     resource, and the composer pays it three times per frame);
 *   - the adaptive governor may step DOWN further on a struggling
 *     phone instead of holding a desktop floor.
 *
 * Desktop values are exactly the pre-existing ones — nothing about
 * the desktop view changes. Plain TS with injectable inputs so the
 * classification is unit-testable (AGENTS.md avatar rule).
 */

export type RenderCaps = {
  /** Hard ceiling on the particle buffer size for this device class. */
  particleCap: number;
  /** Lowest particle count the adaptive governor may step down to. */
  particleFloor: number;
  /** Cap on window.devicePixelRatio for the stage renderer. */
  pixelRatioCap: number;
};

export const DESKTOP_RENDER_CAPS: RenderCaps = {
  particleCap: Number.POSITIVE_INFINITY,
  particleFloor: 15_000,
  pixelRatioCap: 1.75,
};

export const PHONE_RENDER_CAPS: RenderCaps = {
  particleCap: 45_000,
  particleFloor: 8_000,
  pixelRatioCap: 1.5,
};

export type DeviceClassInputs = {
  innerWidth: number;
  maxTouchPoints: number;
  userAgent: string;
};

const MOBILE_UA = /Android|iPhone|iPod|Mobile|Windows Phone/i;

/**
 * Phone-class = a handset, judged three ways so a narrow desktop
 * window is NOT mistaken for a phone: a mobile user agent, or a
 * small touch-first screen. Tablets (wide touch screens) keep the
 * desktop profile — they carry desktop-class GPUs and screens.
 */
export function isPhoneClassDevice(inputs: DeviceClassInputs): boolean {
  if (MOBILE_UA.test(inputs.userAgent)) return true;
  return inputs.innerWidth <= 640 && inputs.maxTouchPoints > 0;
}

export function renderCapsFor(inputs: DeviceClassInputs): RenderCaps {
  return isPhoneClassDevice(inputs) ? PHONE_RENDER_CAPS : DESKTOP_RENDER_CAPS;
}

/** The caps for the device this code is running on right now. */
export function currentRenderCaps(): RenderCaps {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return DESKTOP_RENDER_CAPS;
  }
  return renderCapsFor({
    innerWidth: window.innerWidth,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    userAgent: navigator.userAgent ?? "",
  });
}
