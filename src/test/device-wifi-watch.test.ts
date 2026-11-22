import { beforeEach, describe, expect, it } from "vitest";
import { loadRegistry, upsertDevice, type DeviceProfile } from "@/avatar/devices/deviceRegistry";
import { runPresenceCheck, wifiScanFromWatcherState } from "@/avatar/devices/presence";
import {
  WATCH_GRACE_MS,
  buildScanState,
  presentNetworks,
  sanitizeSightings,
  sanitizeSsids,
  watcherActive,
  type SightingsReport,
} from "@/avatar/devices/wifiWatch";

/**
 * WI-FI WATCH (2026-11-21) — the Parrot-side ear. The watcher sweeps
 * the air with nmcli and reports sightings to the local server; the
 * client reads them back as a scan and feeds the same presence
 * pipeline as any real scan. These tests pin the pure logic: the
 * grace window, watcher freshness, payload sanitation, and the
 * scan-state → presence application with synthetic sightings.
 */
function wand(overrides: Partial<DeviceProfile> = {}): DeviceProfile {
  return {
    id: "wand-1",
    displayName: "Magic Wand",
    kind: "camera",
    transport: "wifi-ap",
    externalId: "",
    ssid: "SOFTISH-1851",
    activationSsid: "SOFTISH-1851",
    beaconRole: true,
    source: "manual",
    declaredServices: [],
    capabilities: [],
    limitations: [],
    batteryLevel: null,
    measured: {},
    presence: "unknown",
    presenceEvents: [],
    firstSeen: 1000,
    lastSeen: 1000,
    ...overrides,
  };
}

const sightings = (at: number, rssi = -54): SightingsReport => ({
  at,
  tool: "nmcli",
  networks: [{ ssid: "SOFTISH-1851", rssi }],
});

describe("wi-fi watch logic", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sanitizes the watch-list: trims, dedupes, drops junk", () => {
    expect(sanitizeSsids([" SOFTISH-1851 ", "SOFTISH-1851", "", 42, null, "OTHER-NET"])).toEqual([
      "SOFTISH-1851",
      "OTHER-NET",
    ]);
    expect(sanitizeSsids("nope")).toEqual([]);
  });

  it("sanitizes sightings: clamps RSSI, drops malformed rows", () => {
    const report = sanitizeSightings(
      {
        at: 5000,
        tool: "nmcli",
        networks: [
          { ssid: "SOFTISH-1851", rssi: -54 },
          { ssid: "TOO-LOUD", rssi: 30 },
          { ssid: "", rssi: -40 },
          { ssid: "NO-RSSI" },
          "garbage",
        ],
      },
      9999,
    );
    expect(report?.at).toBe(5000);
    expect(report?.networks).toEqual([
      { ssid: "SOFTISH-1851", rssi: -54 },
      { ssid: "TOO-LOUD" },
      { ssid: "NO-RSSI" },
    ]);
    expect(sanitizeSightings(null, 1)).toBeNull();
  });

  it("grace window: a sighting stays present briefly, then lapses", () => {
    const report = sightings(10_000);
    expect(presentNetworks(report, 10_000 + WATCH_GRACE_MS - 1)).toHaveLength(1);
    expect(presentNetworks(report, 10_000 + WATCH_GRACE_MS + 1)).toEqual([]);
    expect(presentNetworks(null, 10_000)).toEqual([]);
  });

  it("watcher counts active only while its last scan is fresh", () => {
    expect(watcherActive(10_000, 10_000 + 60_000)).toBe(true);
    expect(watcherActive(10_000, 10_000 + 90_000)).toBe(false);
    expect(watcherActive(null, 10_000)).toBe(false);
  });

  it("builds the scan-state view: watcher, present networks, grace", () => {
    const state = buildScanState(
      {
        watchlist: ["SOFTISH-1851"],
        sightings: sightings(50_000),
        lastScanAt: 50_000,
        tool: "nmcli",
      },
      55_000,
    );
    expect(state.watcher).toMatchObject({ active: true, tool: "nmcli" });
    expect(state.watcher?.watchedSsids).toEqual(["SOFTISH-1851"]);
    expect(state.networks).toEqual([{ ssid: "SOFTISH-1851", rssi: -54 }]);
    const quiet = buildScanState(
      { watchlist: [], sightings: null, lastScanAt: null, tool: null },
      55_000,
    );
    expect(quiet.watcher).toBeNull();
    expect(quiet.networks).toEqual([]);
  });

  it("scan-state maps to an available scan only while the watcher is active", () => {
    const live = buildScanState(
      {
        watchlist: ["SOFTISH-1851"],
        sightings: sightings(50_000),
        lastScanAt: 50_000,
        tool: "nmcli",
      },
      55_000,
    );
    const scan = wifiScanFromWatcherState(live, 55_000);
    expect(scan?.available).toBe(true);
    if (scan?.available) {
      expect(scan.networks).toEqual([{ ssid: "SOFTISH-1851", rssi: -54 }]);
    }
    // No watcher at all → null (caller gives the canonical answer).
    expect(wifiScanFromWatcherState({ watcher: null, networks: [] }, 55_000)).toBeNull();
    expect(wifiScanFromWatcherState(null, 55_000)).toBeNull();
    // A watcher that went quiet → unavailable, honestly stale.
    const stale = wifiScanFromWatcherState(
      { watcher: { active: false, lastScanAt: 1000, tool: "nmcli", watchedSsids: [] }, networks: [] },
      500_000,
    );
    expect(stale?.available).toBe(false);
    if (stale && !stale.available) expect(stale.reason).toContain("not reported a fresh scan");
  });

  it("a synthetic watcher sighting flips the wand ACTIVE via scan and fires activation", () => {
    const start = upsertDevice([], wand());
    const state = buildScanState(
      {
        watchlist: ["SOFTISH-1851"],
        sightings: sightings(60_000, -54),
        lastScanAt: 60_000,
        tool: "nmcli",
      },
      61_000,
    );
    const scan = wifiScanFromWatcherState(state, 61_000);
    expect(scan?.available).toBe(true);
    if (!scan?.available) throw new Error("scan should be available");
    const { devices, activated } = runPresenceCheck(start, scan, 61_000);
    expect(devices[0]?.presence).toBe("active");
    expect(devices[0]?.lastSeenRssi).toBe(-54);
    expect(devices[0]?.presenceEvents.at(-1)).toMatchObject({ kind: "appeared", via: "scan" });
    expect(activated.map((d) => d.id)).toEqual(["wand-1"]);
    expect(loadRegistry()[0]?.presence).toBe("active");
  });

  it("after the grace window the same pipeline flips the wand GONE", () => {
    const start = upsertDevice([], wand({ presence: "active" }));
    const later = 60_000 + WATCH_GRACE_MS + 30_000;
    const state = buildScanState(
      {
        watchlist: ["SOFTISH-1851"],
        sightings: sightings(60_000),
        lastScanAt: later - 5_000,
        tool: "nmcli",
      },
      later,
    );
    const scan = wifiScanFromWatcherState(state, later);
    if (!scan?.available) throw new Error("watcher still active; scan should be available");
    expect(scan.networks).toEqual([]);
    const { devices } = runPresenceCheck(start, scan, later);
    expect(devices[0]?.presence).toBe("gone");
    expect(devices[0]?.presenceEvents.at(-1)).toMatchObject({ kind: "disappeared", via: "scan" });
  });
});
