import { describe, expect, it } from "vitest";
import { buildSignalMap, relativeSeen } from "@/avatar/signalMap";
import { buildScanState, type ScanStateView } from "@/avatar/devices/wifiWatch";
import type { DeviceProfile } from "@/avatar/devices/deviceRegistry";

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
  } as DeviceProfile;
}

const NOW = 100_000;

function viewWith(sightingsAt: number, phoneAt?: number): ScanStateView {
  return buildScanState(
    {
      watchlist: ["SOFTISH-1851"],
      sightings: {
        at: sightingsAt,
        tool: "nmcli",
        networks: [
          { ssid: "SOFTISH-1851", rssi: -65 },
          { ssid: "NeighborNet", rssi: -80 },
        ],
      },
      phoneSightings:
        phoneAt !== undefined
          ? { at: phoneAt, tool: "ghost-protocol-one", networks: [{ ssid: "SOFTISH-1851", rssi: -58 }] }
          : null,
      lastScanAt: sightingsAt,
      tool: "nmcli",
    },
    NOW,
  );
}

describe("signal map shaping (Part 31)", () => {
  it("splits registered from unknown and carries provenance per scanner", () => {
    const model = buildSignalMap(
      { available: true, view: viewWith(95_000, 98_000), devices: [wand()] },
      NOW,
    );
    expect(model.scannerState).toBe("reporting");
    expect(model.registered).toHaveLength(1);
    const row = model.registered[0]!;
    expect(row.up).toBe(true);
    expect(row.rssi).toBe(-58); // strongest report wins
    expect(row.sources).toEqual(
      expect.arrayContaining(["Parrot watcher", "phone (Ghost Protocol One)"]),
    );
    expect(model.unknown).toEqual([
      expect.objectContaining({ ssid: "NeighborNet", rssi: -80 }),
    ]);
  });

  it("marks SIGNAL UP only from a fresh recorded appeared event", () => {
    const fresh = wand({ presenceEvents: [{ kind: "appeared", at: 90_000, via: "scan" }] });
    const model = buildSignalMap({ available: true, view: viewWith(95_000), devices: [fresh] }, NOW);
    expect(model.registered[0]!.signalUp).toBe(true);

    const stale = wand({ presenceEvents: [{ kind: "appeared", at: 1_000, via: "scan" }] });
    const model2 = buildSignalMap(
      { available: true, view: viewWith(195_000), devices: [stale] },
      200_000,
    );
    expect(model2.registered[0]!.signalUp).toBe(false);
    expect(model2.registered[0]!.up).toBe(true);
  });

  it("a device absent from fresh reports reads down, with its last event as last-seen", () => {
    const gone = wand({
      presence: "gone",
      presenceEvents: [
        { kind: "appeared", at: 10_000, via: "scan" },
        { kind: "disappeared", at: 20_000, via: "scan" },
      ],
    });
    const oldView = buildScanState(
      { watchlist: ["SOFTISH-1851"], sightings: null, lastScanAt: 99_000, tool: "nmcli" },
      NOW,
    );
    const model = buildSignalMap({ available: true, view: oldView, devices: [gone] }, NOW);
    expect(model.registered[0]!.up).toBe(false);
    expect(model.registered[0]!.lastSeenAt).toBe(20_000);
    expect(model.registered[0]!.signalUp).toBe(false);
  });

  it("scanner states stay honest: unavailable store, silent watcher", () => {
    expect(buildSignalMap({ available: false, view: null, devices: [] }, NOW).scannerState).toBe(
      "unavailable",
    );
    const quiet = buildScanState(
      { watchlist: [], sightings: null, lastScanAt: 1_000, tool: "nmcli" },
      NOW,
    );
    expect(buildSignalMap({ available: true, view: quiet, devices: [] }, NOW).scannerState).toBe(
      "silent",
    );
  });

  it("scan-state sightings carry per-scanner provenance and report time", () => {
    const view = viewWith(95_000, 98_000);
    const wandSightings = view.sightings.filter((s) => s.ssid === "SOFTISH-1851");
    expect(wandSightings).toHaveLength(2);
    expect(wandSightings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "phone", seenAt: 98_000, rssi: -58 }),
        expect.objectContaining({ source: "parrot-watcher", seenAt: 95_000, rssi: -65 }),
      ]),
    );
  });

  it("relativeSeen reads plainly", () => {
    expect(relativeSeen(null, NOW)).toBe("never recorded");
    expect(relativeSeen(NOW - 5_000, NOW)).toBe("just now");
    expect(relativeSeen(NOW - 180_000, NOW)).toBe("3 min ago");
  });
});
