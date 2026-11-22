/**
 * WI-FI WATCH STORE — node-only, server-side.
 *
 * The local server's half of the wand-presence loop (operator order
 * 2026-11-21): the Devices window syncs the registry's activation
 * SSIDs here (the watch-list), the Parrot's watcher service reads
 * that list and posts its sightings here, and the client's presence
 * checks read the result back through /api/devices/scan-state.
 *
 * State lives in one small JSON file kept with the operator's other
 * protected local state (~/.local/share/augie/, the same directory
 * and pattern as the gate log and the local operator registry).
 * Writes are serialized on a promise chain — no read-modify-write
 * races between the window's sync and the watcher's reports.
 *
 * This is a LOCAL desktop server feature. Where there is no node
 * filesystem (the Cloudflare Worker build), the store is
 * unavailable, the endpoints report no watcher, sightings are
 * refused, and the web app keeps its honest "browsers cannot scan"
 * answer — the public site is a different surface.
 */
import {
  buildScanState,
  sanitizeSightings,
  sanitizeSsids,
  type ScanStateView,
  type SightingsReport,
} from "./wifiWatch";

type WatchFs = typeof import("node:fs/promises");

type WatchFile = {
  watchlist: { ssids: string[]; updatedAt: number };
  sightings: SightingsReport | null;
  /** Ghost Protocol One's latest report (Part 23) — kept apart from
   * the Parrot watcher's own report; scan-state merges the two. */
  phoneSightings: SightingsReport | null;
  watcher: { lastScanAt: number | null; tool: string | null };
};

const EMPTY_FILE: WatchFile = {
  watchlist: { ssids: [], updatedAt: 0 },
  sightings: null,
  phoneSightings: null,
  watcher: { lastScanAt: null, tool: null },
};

class FileWatchStore {
  private tail: Promise<void> = Promise.resolve();
  private cache: WatchFile | null = null;

  constructor(
    private readonly fs: WatchFs,
    private readonly filePath: string,
  ) {}

  private async load(): Promise<WatchFile> {
    if (this.cache) return this.cache;
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      const record =
        typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
      const watchlist =
        typeof record["watchlist"] === "object" && record["watchlist"] !== null
          ? (record["watchlist"] as Record<string, unknown>)
          : {};
      const watcher =
        typeof record["watcher"] === "object" && record["watcher"] !== null
          ? (record["watcher"] as Record<string, unknown>)
          : {};
      this.cache = {
        watchlist: {
          ssids: sanitizeSsids(watchlist["ssids"]),
          updatedAt: typeof watchlist["updatedAt"] === "number" ? watchlist["updatedAt"] : 0,
        },
        sightings: sanitizeSightings(record["sightings"], Date.now()),
        phoneSightings: sanitizeSightings(record["phoneSightings"], Date.now()),
        watcher: {
          lastScanAt: typeof watcher["lastScanAt"] === "number" ? watcher["lastScanAt"] : null,
          tool: typeof watcher["tool"] === "string" ? watcher["tool"] : null,
        },
      };
    } catch {
      this.cache = structuredClone(EMPTY_FILE);
    }
    return this.cache;
  }

  private async persist(): Promise<void> {
    if (!this.cache) return;
    await this.fs.writeFile(this.filePath, JSON.stringify(this.cache, null, 2), "utf8");
  }

  private mutate<T>(fn: (state: WatchFile) => T): Promise<T> {
    const result = this.tail.then(async () => {
      const state = await this.load();
      const out = fn(state);
      await this.persist();
      return out;
    });
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async setWatchlist(ssids: string[]): Promise<void> {
    await this.mutate((state) => {
      state.watchlist = { ssids, updatedAt: Date.now() };
    });
  }

  async getWatchlist(): Promise<{ ssids: string[]; watcher: WatchFile["watcher"] }> {
    const state = await this.load();
    return { ssids: state.watchlist.ssids, watcher: state.watcher };
  }

  async recordSightings(report: SightingsReport): Promise<void> {
    await this.mutate((state) => {
      state.sightings = report;
      state.watcher = { lastScanAt: report.at, tool: report.tool };
    });
  }

  async recordPhoneSightings(report: SightingsReport): Promise<void> {
    await this.mutate((state) => {
      state.phoneSightings = report;
    });
  }

  async scanState(now: number): Promise<ScanStateView> {
    const state = await this.load();
    return buildScanState(
      {
        watchlist: state.watchlist.ssids,
        sightings: state.sightings,
        phoneSightings: state.phoneSightings,
        lastScanAt: state.watcher.lastScanAt,
        tool: state.watcher.tool,
      },
      now,
    );
  }
}

export interface WifiWatchStore {
  setWatchlist(ssids: string[]): Promise<void>;
  getWatchlist(): Promise<{ ssids: string[]; watcher: { lastScanAt: number | null; tool: string | null } }>;
  recordSightings(report: SightingsReport): Promise<void>;
  recordPhoneSightings(report: SightingsReport): Promise<void>;
  scanState(now: number): Promise<ScanStateView>;
}

export async function createWifiWatchStore(filePath: string): Promise<WifiWatchStore | null> {
  try {
    const fs = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await fs.mkdir(dirname(filePath), { recursive: true });
    return new FileWatchStore(fs, filePath);
  } catch {
    return null;
  }
}

let storePromise: Promise<WifiWatchStore | null> | null = null;

function getStore(): Promise<WifiWatchStore | null> {
  storePromise ??= (() => {
    const home = process.env["HOME"]?.trim();
    if (!home) return Promise.resolve(null);
    return createWifiWatchStore(`${home}/.local/share/augie/wifi-watch.json`);
  })();
  return storePromise;
}

/** Replace the watch-list with the registry's current activation SSIDs. */
export async function setWifiWatchlist(ssids: string[]): Promise<boolean> {
  const store = await getStore();
  if (!store) return false;
  await store.setWatchlist(sanitizeSsids(ssids));
  return true;
}

/** The current watch-list plus what the server knows of the watcher. */
export async function getWifiWatchlist(): Promise<{
  available: boolean;
  ssids: string[];
  watcher: { lastScanAt: number | null; tool: string | null };
}> {
  const store = await getStore();
  if (!store) return { available: false, ssids: [], watcher: { lastScanAt: null, tool: null } };
  const { ssids, watcher } = await store.getWatchlist();
  return { available: true, ssids, watcher };
}

/** Record one watcher sightings report. False where the store is unavailable. */
export async function recordWifiSightings(report: SightingsReport): Promise<boolean> {
  const store = await getStore();
  if (!store) return false;
  await store.recordSightings(report);
  return true;
}

/** Record one Ghost Protocol One sightings report. False where unavailable. */
export async function recordPhoneWifiSightings(report: SightingsReport): Promise<boolean> {
  const store = await getStore();
  if (!store) return false;
  await store.recordPhoneSightings(report);
  return true;
}

/** The scan-state view for the client's presence checks. */
export async function getWifiScanState(now: number): Promise<ScanStateView & { available: boolean }> {
  const store = await getStore();
  if (!store) {
    return { available: false, watcher: null, networks: [], graceMs: 0 };
  }
  const state = await store.scanState(now);
  return { available: true, ...state };
}
