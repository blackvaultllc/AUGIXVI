/**
 * SIGNAL MAP — the shaping logic (Part 31, operator order 2026-11-21).
 *
 * The browser NEVER scans. This module takes what the core's scanners
 * actually reported (the Parrot's Wi-Fi watcher + Ghost Protocol One
 * phone reports, merged server-side into the scan-state view) plus the
 * device registry, and shapes the map: registered devices with their
 * up/down state, signal, last-seen and reporting scanner; unregistered
 * networks in a separate, plainly-labeled section.
 *
 * Activation (the Batman-signal doctrine): a registered device whose
 * latest recorded "appeared" event is fresh is marked SIGNAL UP —
 * the moment its signal came up is the summons. The mark derives from
 * the registry's own presence events; nothing is inferred from air
 * the scanners did not report.
 *
 * Pure and unit-testable; the window lives in SignalMapWindow.tsx.
 */
import type { DeviceProfile } from "./devices/deviceRegistry";
import type { ScanStateView, SightingDetail } from "./devices/wifiWatch";

/** An "appeared" event fresher than this still reads as the activation moment. */
export const ACTIVATION_FRESH_MS = 150_000;

export type SignalRow = {
  deviceId: string;
  name: string;
  ssid: string | null;
  up: boolean;
  /** Strongest reported signal for the SSID, dBm, when any scanner gave one. */
  rssi: number | null;
  /** Epoch ms of the freshest report carrying this SSID, or of its last event. */
  lastSeenAt: number | null;
  /** Scanners that reported it in the current view: "Parrot watcher" / "phone". */
  sources: string[];
  beaconRole: boolean;
  /** True when its signal has just come up — the activation event. */
  signalUp: boolean;
};

export type UnknownNetwork = {
  ssid: string;
  rssi: number | null;
  lastSeenAt: number | null;
  sources: string[];
};

export type SignalMapModel = {
  /** reporting: a scanner is fresh. silent: store answers, no fresh scan. unavailable: no store here. */
  scannerState: "reporting" | "silent" | "unavailable";
  registered: SignalRow[];
  unknown: UnknownNetwork[];
};

function deviceSsid(device: DeviceProfile): string | null {
  return device.activationSsid ?? device.ssid ?? null;
}

function sourceLabel(source: SightingDetail["source"]): string {
  return source === "parrot-watcher" ? "Parrot watcher" : "phone (Ghost Protocol One)";
}

function strongest(details: SightingDetail[]): number | null {
  let best: number | null = null;
  for (const d of details) {
    if (d.rssi !== undefined && (best === null || d.rssi > best)) best = d.rssi;
  }
  return best;
}

export function buildSignalMap(
  input: {
    available: boolean;
    view: ScanStateView | null;
    devices: DeviceProfile[];
  },
  now: number,
): SignalMapModel {
  if (!input.available || !input.view) {
    return { scannerState: "unavailable", registered: [], unknown: [] };
  }
  const view = input.view;
  const scannerState = view.watcher?.active ? "reporting" : "silent";

  const bySsid = new Map<string, SightingDetail[]>();
  for (const detail of view.sightings) {
    const list = bySsid.get(detail.ssid) ?? [];
    list.push(detail);
    bySsid.set(detail.ssid, list);
  }

  const registeredSsids = new Set<string>();
  const registered: SignalRow[] = input.devices.map((device) => {
    const ssid = deviceSsid(device);
    if (ssid) registeredSsids.add(ssid);
    const details = ssid ? (bySsid.get(ssid) ?? []) : [];
    const up = details.length > 0;
    const lastEvent = device.presenceEvents[device.presenceEvents.length - 1];
    const lastAppeared = [...device.presenceEvents]
      .reverse()
      .find((e) => e.kind === "appeared");
    const freshestReport = details.length
      ? Math.max(...details.map((d) => d.seenAt))
      : null;
    return {
      deviceId: device.id,
      name: device.displayName,
      ssid,
      up,
      rssi: strongest(details) ?? device.lastSeenRssi ?? null,
      lastSeenAt: freshestReport ?? lastEvent?.at ?? null,
      sources: [...new Set(details.map((d) => sourceLabel(d.source)))],
      beaconRole: device.beaconRole === true,
      signalUp:
        up && lastAppeared !== undefined && now - lastAppeared.at <= ACTIVATION_FRESH_MS,
    };
  });

  const unknown: UnknownNetwork[] = [...bySsid.entries()]
    .filter(([ssid]) => !registeredSsids.has(ssid))
    .map(([ssid, details]) => ({
      ssid,
      rssi: strongest(details),
      lastSeenAt: Math.max(...details.map((d) => d.seenAt)),
      sources: [...new Set(details.map((d) => sourceLabel(d.source)))],
    }))
    .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));

  return { scannerState, registered, unknown };
}

/** "just now", "3 min ago", "2 h ago" — for last-seen labels. */
export function relativeSeen(at: number | null, now: number): string {
  if (at === null) return "never recorded";
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ago`;
}
