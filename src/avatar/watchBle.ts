/**
 * THE WATCH PIPE (Part 20, as amended 2026-11-21) — the watch does
 * NOT connect to the computer. It stays Bluetooth-paired to his
 * PHONE (for calls), and its health data flows when the watch's app
 * is in use. So the pickup lives on the phone side:
 *
 *   watch → (Bluetooth) → phone → Augie opened on the phone →
 *   (his own network / Tailscale) → the Augie core on the Parrot.
 *
 * What the phone's web layer can actually do, honestly:
 * - Web Bluetooth can read the STANDARD BLE heart-rate service
 *   (0x180D) directly — IF the watch exposes it and the browser
 *   supports Web Bluetooth (Chrome on Android: yes; iOS Safari: no).
 * - Da Fit watches are app-centric: their rich data lives in the Da
 *   Fit app. Some models expose the standard HR service; many route
 *   everything through the app, and what Da Fit syncs onward into
 *   Health Connect varies by model/app version — heart rate may or
 *   may not land there. The native companion (Ghost Protocol One,
 *   Part 23) reads Health Connect where the web cannot.
 * - NEVER display a number that did not come from the watch.
 */

/** Standard BLE heart-rate service + measurement characteristic. */
export const HEART_RATE_SERVICE = "heart_rate";
export const HEART_RATE_MEASUREMENT = "heart_rate_measurement";

/** Parse a heart_rate_measurement characteristic value (BLE spec). */
export function parseHeartRateMeasurement(view: DataView): number | null {
  if (view.byteLength < 2) return null;
  const flags = view.getUint8(0);
  const is16Bit = (flags & 0x01) !== 0;
  const bpm = is16Bit ? view.getUint16(1, true) : view.getUint8(1);
  if (!Number.isFinite(bpm) || bpm <= 0 || bpm > 250) return null;
  return bpm;
}

export type WatchSource = "ble-heart-rate-service";

export interface WatchReading {
  at: number;
  bpm: number;
  source: WatchSource;
}
