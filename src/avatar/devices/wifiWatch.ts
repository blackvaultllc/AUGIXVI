/**
 * WI-FI WATCH — the shared shape of the local watcher's world
 * (operator order 2026-11-21, the follow-up that closes the loop:
 * "when I turn it on, AUGI notices on its own").
 *
 * The web app cannot scan Wi-Fi — that boundary stays honest. But
 * the LOCAL Augie build runs on Domenick's Parrot, and Linux scans
 * Wi-Fi natively. A small watcher service on the Parrot (nmcli)
 * sweeps the air on a steady cadence for the SSIDs the registry
 * watches (activation SSIDs), and reports sightings to the local
 * server. The server holds them here; the client's presence checks
 * (presence.ts) read them back through /api/devices/scan-state and
 * feed them into the same scan→registry pipeline as any real scan.
 *
 * This module is the pure, unit-testable core: payload sanitation,
 * the grace window (a watched SSID stays "present" for GRACE_MS
 * after its last sighting, so one missed scan cannot flap a device
 * off — disappearance means missing past the grace window), and
 * whether the watcher counts as active (a fresh scan within
 * STALE_MS). No I/O lives here.
 */

/** One network as the watcher saw it. rssi is dBm (negative). */
export type SightingNetwork = { ssid: string; rssi?: number };

/** One completed scan, as the watcher reports it to the server. */
export type SightingsReport = {
  at: number;
  /** The tool that produced the scan, e.g. "nmcli". */
  tool: string;
  networks: SightingNetwork[];
};

/** What the server knows about the watcher itself. */
export type WatcherView = {
  /** True when the last reported scan is fresh (within STALE_MS). */
  active: boolean;
  lastScanAt: number | null;
  tool: string | null;
  watchedSsids: string[];
};

/** The full answer of GET /api/devices/scan-state. */
export type ScanStateView = {
  watcher: WatcherView | null;
  /** Watched networks present within the grace window. */
  networks: SightingNetwork[];
  graceMs: number;
};

/**
 * A watched SSID stays present this long after its last sighting.
 * The watcher scans every ~20 s, so this tolerates a few missed or
 * cached scans before a device is declared gone — disappearance is
 * a conclusion, not a flicker.
 */
export const WATCH_GRACE_MS = 75_000;

/** The watcher counts as active when its last scan is this fresh. */
export const WATCHER_STALE_MS = 75_000;

const MAX_SSIDS = 64;
const MAX_NETWORKS = 256;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function cleanSsid(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed || trimmed.length > 64) return null;
  return trimmed;
}

/** Sanitize a watch-list payload: trimmed, de-duplicated SSIDs. */
export function sanitizeSsids(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const ssid = cleanSsid(item);
    if (ssid && !out.includes(ssid)) out.push(ssid);
    if (out.length >= MAX_SSIDS) break;
  }
  return out;
}

function cleanRssi(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= -120 && v <= 0 ? v : undefined;
}

/** Sanitize one watcher sightings report; null when unusable. */
export function sanitizeSightings(v: unknown, now: number): SightingsReport | null {
  if (!isRecord(v)) return null;
  const at = typeof v["at"] === "number" && Number.isFinite(v["at"]) ? v["at"] : now;
  const tool =
    typeof v["tool"] === "string" && v["tool"].trim() ? v["tool"].trim().slice(0, 32) : "unknown";
  const rawNetworks = Array.isArray(v["networks"]) ? v["networks"] : [];
  const networks: SightingNetwork[] = [];
  for (const item of rawNetworks) {
    if (!isRecord(item)) continue;
    const ssid = cleanSsid(item["ssid"]);
    if (!ssid) continue;
    const rssi = cleanRssi(item["rssi"]);
    networks.push(rssi !== undefined ? { ssid, rssi } : { ssid });
    if (networks.length >= MAX_NETWORKS) break;
  }
  return { at, tool, networks };
}

/**
 * The networks from the latest sightings that still count as
 * present: everything in the report, while the report itself is
 * within the grace window; nothing once it is older. (Sightings
 * arrive as whole scans, so presence is judged on the scan's age.)
 */
export function presentNetworks(
  sightings: SightingsReport | null,
  now: number,
  graceMs: number = WATCH_GRACE_MS,
): SightingNetwork[] {
  if (!sightings) return [];
  if (now - sightings.at > graceMs) return [];
  return sightings.networks;
}

/** Whether the watcher counts as active at `now`. */
export function watcherActive(
  lastScanAt: number | null,
  now: number,
  staleMs: number = WATCHER_STALE_MS,
): boolean {
  return lastScanAt !== null && now - lastScanAt <= staleMs;
}

/** Build the scan-state view the client consumes. */
export function buildScanState(
  input: {
    watchlist: string[];
    sightings: SightingsReport | null;
    lastScanAt: number | null;
    tool: string | null;
  },
  now: number,
): ScanStateView {
  return {
    watcher:
      input.lastScanAt === null && input.tool === null
        ? null
        : {
            active: watcherActive(input.lastScanAt, now),
            lastScanAt: input.lastScanAt,
            tool: input.tool,
            watchedSsids: input.watchlist,
          },
    networks: presentNetworks(input.sightings, now),
    graceMs: WATCH_GRACE_MS,
  };
}
