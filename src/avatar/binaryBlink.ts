/**
 * THE BINARY BLINK — ANUBIS'S EYES (owner order 2026-11-27
 * ~23:10 CST): "Take that stupid blink away because you can't
 * get it right and have his eyes shine gold... they to blink
 * his eyes will show binary in it for a second in both eyes
 * eight characters very small won't go over his skin or his
 * creation just right inside his eyes real quick and then that
 * would be the way that he blinks."
 *
 * The lid rig is GONE from Anubis (LivingPortrait renders no
 * lids for him): the phased gold lids read thick and blinked
 * from the eyebrows, and the fix ordered the same morning was
 * never built — this order supersedes that whole approach.
 * What stands instead, in this module's plain data:
 *
 * - THE SHINE: at rest his eyes shine gold — a gold light
 *   clipped to the eye openings themselves (rendered in
 *   LivingPortrait from the rects below).
 * - THE BLINK: one byte — eight characters, 0s and 1s —
 *   flashes inside BOTH eyes at once, the same byte in each,
 *   for about a second, then is gone. The flash is clipped
 *   strictly inside the eye openings: it never touches his
 *   skin, his fur, or any other part of the portrait.
 * - THE CADENCE: his own — the blink interval of his motion
 *   profile (godMotion.ts, blinkIntervalMs), irregular like a
 *   real face's, with the rig's occasional double blink. The
 *   timing lives in LivingPortrait's hook; the byte and the
 *   geometry live here, unit-testable per the repo's rules.
 *
 * CALIBRATION — READ BEFORE TOUCHING THE NUMBERS: the eye
 * rects below are calibrated to THIS portrait
 * (public/anubis-presence/face.webp, Khadija's chosen face).
 * They are the measured eye OPENINGS from LivingPortrait's
 * feature-map record (visual grounding on the shipped file,
 * 2026-11-22): the eyes span x 39.0–45.5 / 54.3–61.0,
 * y 37.3–42.0 — openings ≈6.6×4.5 percent of the face, centers
 * (42.3, 39.6) and (57.7, 39.8). The feature map's eyeW/eyeH
 * (7.4×4.8) are the old LID's size — a shade LARGER than the
 * opening, on purpose for a lid. The blink must stay INSIDE
 * the eye, so it is sized to the opening, never the lid. If
 * the portrait file is ever replaced, these numbers must be
 * re-measured against the new face or the byte will sit off
 * his eyes.
 */

/** How long one byte stands in his eyes — "for a second". */
export const BINARY_BLINK_FLASH_MS = 1000;

/** One blink's byte: eight characters, each a 0 or a 1 drawn
 *  from the given random source (injected for the tests). */
export function blinkByte(random: () => number): string {
  let byte = "";
  for (let i = 0; i < 8; i += 1) {
    byte += random() >= 0.5 ? "1" : "0";
  }
  return byte;
}

/** The structural slice of a face's feature map this module
 *  reads — the eye centers and sizes in percent of the face. */
export interface EyeMap {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  /** The old lid's size — a shade larger than the opening. */
  eyeW: number;
  eyeH: number;
  /**
   * The eye OPENING's own size, measured on the portrait —
   * what the shine and the byte are clipped to. A map without
   * a measured opening falls back to the lid size (no face
   * but Anubis's runs the binary blink today, and his map
   * carries the measurement).
   */
  eyeOpenW?: number;
  eyeOpenH?: number;
}

/** A rect in percent of the face: left/top corner + size. */
export interface EyeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function rectFor(eye: { x: number; y: number }, width: number, height: number): EyeRect {
  return {
    left: eye.x - width / 2,
    top: eye.y - height / 2,
    width,
    height,
  };
}

/**
 * The two eye-opening rects the shine and the byte stand in —
 * centered on the measured eye centers, sized to the measured
 * openings, strictly inside the old lids' footprint.
 */
export function eyeOpeningRects(map: EyeMap): { left: EyeRect; right: EyeRect } {
  const width = map.eyeOpenW ?? map.eyeW;
  const height = map.eyeOpenH ?? map.eyeH;
  return {
    left: rectFor(map.leftEye, width, height),
    right: rectFor(map.rightEye, width, height),
  };
}
