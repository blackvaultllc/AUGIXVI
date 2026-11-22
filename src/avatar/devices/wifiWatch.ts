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

/** Which scanner reported a sighting (Part 31 — the signal map's provenance). */
export type SightingSource = "parrot-watcher" | "phone";

/**
 * One present network WITH its provenance: which scanner saw it and
 * when that scanner's report was made. The merged `networks` list
 * below deliberately stays source-less for the presence pipeline;
 * this detail list is what the Signal Map shows, so a sighting is
 * never presented without the scanner that actually reported it.
 */
export type SightingDetail = SightingNetwork & {
  source: SightingSource;
  /** Epoch ms of the report this sighting came from. */
  seenAt: number;
};

/** The full answer of GET /api/devices/scan-state. */
export type ScanStateView = {
  watcher: WatcherView | null;
  /** Watched networks present within the grace window. */
  networks: SightingNetwork[];
  /** Present networks with per-scanner provenance (Part 31). */
  sightings: SightingDetail[];
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

export function buildScanState(
  input: {
    watchlist: string[];
    sightings: SightingsReport | null;
    lastScanAt: number | null;
    tool: string | null;
    /**
     * A second scanner's latest report — Ghost Protocol One on the
     * owner's phone (Part 23). The Parrot's own watcher stays the
     * primary source; the phone extends Augie's ears to wherever the
     * owner is standing. Each report is judged by its own age, and
     * the union is what presence sees.
     */
    phoneSightings?: SightingsReport | null;
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
    networks: mergePresentNetworks(
      presentNetworks(input.sightings, now),
      presentNetworks(input.phoneSightings ?? null, now),
    ),
    sightings: mergeSightingDetails(
      detailSightings(input.sightings, "parrot-watcher", now),
      detailSightings(input.phoneSightings ?? null, "phone", now),
    ),
    graceMs: WATCH_GRACE_MS,
  };
}

/** One report's present networks, stamped with their scanner + report time. */
function detailSightings(
  report: SightingsReport | null,
  source: SightingSource,
  now: number,
): SightingDetail[] {
  return presentNetworks(report, now).map((net) => ({ ...net, source, seenAt: report!.at }));
}

/**
 * Union of two detail lists. A network seen by both scanners keeps
 * BOTH entries — provenance is the point; nothing is merged away.
 * Sorted newest first.
 */
export function mergeSightingDetails(
  a: SightingDetail[],
  b: SightingDetail[],
): SightingDetail[] {
  return [...a, ...b].sort((x, y) => y.seenAt - x.seenAt);
}

/** Union of two present-network lists; per SSID the stronger rssi wins. */
export function mergePresentNetworks(
  a: SightingNetwork[],
  b: SightingNetwork[],
): SightingNetwork[] {
  const bySsid = new Map<string, SightingNetwork>();
  for (const net of [...a, ...b]) {
    const existing = bySsid.get(net.ssid);
    if (!existing) {
      bySsid.set(net.ssid, net);
      continue;
    }
    const best =
      net.rssi !== undefined && (existing.rssi === undefined || net.rssi > existing.rssi)
        ? net
        : existing;
    bySsid.set(net.ssid, best);
  }
  return [...bySsid.values()];
}
