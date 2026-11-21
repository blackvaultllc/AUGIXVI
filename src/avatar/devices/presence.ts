/**
 * WAND-PRESENCE ACTIVATION (operator order 2026-11-21).
 *
 * Doctrine: a registered device's activation SSID appearing in the
 * Wi-Fi environment means the device is ON and present — the physical
 * key. Its disappearance means off/gone. For a beacon/wand-role
 * device (his otoscope, the "Magic Wand", SOFTISH-1851), appearing
 * ACTIVATES Augie, and Augie greets him — his words: "Sir, do you
 * need any help or anything like that."
 *
 * Detection runs two ways: a periodic check (every 15 minutes or
 * sooner) and on demand ("check Wi-Fi signals"). This module holds
 * the scan boundary and the pure registry logic a scan feeds. The
 * boundary is honest: a web app has NO Wi-Fi scanning API, so
 * scanWifiEnvironment() reports unavailable here and records nothing —
 * the local/native Augie build can supply a real scanner behind the
 * same boundary without changing the logic.
 *
 * Signal strength is logged on every detection because it is data
 * twice over: it reads proximity (stronger = closer) AND, on this
 * cheap unregulated hardware, battery state — as the wand's battery
 * dies its signal weakens before it vanishes. It is shown as strength
 * and trend ONLY: never converted to a fake precise distance, never
 * to a fake battery percentage.
 */
import {
  MAX_PRESENCE_EVENTS,
  saveRegistry,
  type DeviceProfile,
  type PresenceEvent,
} from "./deviceRegistry";

/** The greeting Augie speaks when the wand activates him. His words. */
export const WAND_GREETING = "Sir, do you need any help or anything like that.";

/** His spec: a periodic presence check every 15 minutes or sooner. */
export const PRESENCE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

export type WifiNetworkSighting = { ssid: string; rssi?: number };

export type WifiScanResult =
  | { available: true; networks: WifiNetworkSighting[]; at: number }
  | { available: false; reason: string; at: number };

const SCAN_UNAVAILABLE_REASON =
  "This web app cannot scan Wi-Fi networks — browsers expose no Wi-Fi scanning API. No scan was performed and nothing was faked.";

/**
 * Scan the Wi-Fi environment. In this web build the honest answer is
 * unavailable; a local/native build replaces this implementation with
 * a real scanner returning the same shape.
 */
export async function scanWifiEnvironment(now: number = Date.now()): Promise<WifiScanResult> {
  return { available: false, reason: SCAN_UNAVAILABLE_REASON, at: now };
}

/** The SSID Augie watches for on this device, if any. */
export function watchedSsid(device: DeviceProfile): string | null {
  return device.activationSsid ?? device.ssid ?? null;
}

function appendEvent(device: DeviceProfile, event: PresenceEvent): DeviceProfile {
  return {
    ...device,
    presenceEvents: [...device.presenceEvents, event].slice(-MAX_PRESENCE_EVENTS),
  };
}

/**
 * Record one detection event on a device and persist. Returns the new
 * list plus whether this event ACTIVATED Augie (a beacon/wand-role
 * device flipping from not-active to active — the moment the greeting
 * fires).
 */
export function recordPresenceEvent(
  devices: DeviceProfile[],
  id: string,
  event: PresenceEvent,
): { devices: DeviceProfile[]; activated: DeviceProfile | null } {
  let activated: DeviceProfile | null = null;
  const next = devices.map((device) => {
    if (device.id !== id) return device;
    let updated = appendEvent(device, event);
    if (event.kind === "appeared") {
      const wasActive = device.presence === "active";
      updated = {
        ...updated,
        presence: "active",
        lastSeen: event.at,
        lastSeenRssi: event.rssi ?? device.lastSeenRssi,
      };
      if (!wasActive && device.beaconRole) activated = updated;
    } else {
      updated = { ...updated, presence: device.presence === "active" ? "gone" : device.presence };
    }
    return updated;
  });
  saveRegistry(next);
  return { devices: next, activated };
}

/**
 * Feed one real scan into the registry: watched devices whose SSID is
 * in the scan appear (event + RSSI logged); watched devices that were
 * active and are absent have disappeared. Returns the new list and
 * any wand activations the greeting should fire for. Pure registry
 * logic — a native scanner and the tests both drive it.
 */
export function applyScanToRegistry(
  devices: DeviceProfile[],
  networks: WifiNetworkSighting[],
  now: number,
): { devices: DeviceProfile[]; activated: DeviceProfile[] } {
  let current = devices;
  const activated: DeviceProfile[] = [];
  const seen = new Map(networks.map((n) => [n.ssid, n]));

  for (const device of devices) {
    const ssid = watchedSsid(device);
    if (!ssid) continue;
    const sighting = seen.get(ssid);
    if (sighting) {
      if (device.presence !== "active") {
        const result = recordPresenceEvent(current, device.id, {
          kind: "appeared",
          at: now,
          rssi: sighting.rssi,
          via: "scan",
        });
        current = result.devices;
        if (result.activated) activated.push(result.activated);
      } else if (sighting.rssi !== undefined && sighting.rssi !== device.lastSeenRssi) {
        // Still present, new strength reading — log it: the trend is
        // the battery/proximity signal, so sightings are data even
        // without a state flip.
        const result = recordPresenceEvent(current, device.id, {
          kind: "appeared",
          at: now,
          rssi: sighting.rssi,
          via: "scan",
        });
        current = result.devices;
      }
    } else if (device.presence === "active") {
      const result = recordPresenceEvent(current, device.id, {
        kind: "disappeared",
        at: now,
        via: "scan",
      });
      current = result.devices;
    }
  }
  return { devices: current, activated };
}

export type RssiTrend = "strengthening" | "weakening" | "steady" | "not enough data";

/**
 * Trend of a device's recorded signal strengths, oldest → newest.
 * Compares the mean of the older half with the mean of the newer
 * half; a swing under 3 dB is "steady" (radio noise, not signal).
 * Strength and trend only — never a distance, never a battery %.
 */
export function rssiTrend(device: DeviceProfile): RssiTrend {
  const readings = device.presenceEvents
    .map((e) => e.rssi)
    .filter((r): r is number => typeof r === "number");
  if (readings.length < 2) return "not enough data";
  const mid = Math.floor(readings.length / 2);
  const older = readings.slice(0, mid || 1);
  const newer = readings.slice(mid || 1);
  if (!older.length || !newer.length) return "not enough data";
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const delta = mean(newer) - mean(older);
  if (delta >= 3) return "strengthening";
  if (delta <= -3) return "weakening";
  return "steady";
}
