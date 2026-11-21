import { beforeEach, describe, expect, it } from "vitest";
import { loadRegistry, upsertDevice, type DeviceProfile } from "@/avatar/devices/deviceRegistry";
import {
  WAND_GREETING,
  applyScanToRegistry,
  recordPresenceEvent,
  rssiTrend,
  scanWifiEnvironment,
  watchedSsid,
} from "@/avatar/devices/presence";

/**
 * WAND-PRESENCE ACTIVATION (2026-11-21) — a registered activation SSID
 * appearing means the device is ON; disappearing means off/gone. A
 * beacon/wand-role device flipping to active is the activation that
 * fires the greeting. RSSI is logged every sighting and read as
 * strength + trend only. The web scan boundary is honestly
 * unavailable — it records nothing.
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

describe("wand presence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("the greeting is his exact words", () => {
    expect(WAND_GREETING).toBe("Sir, do you need any help or anything like that.");
  });

  it("watches the activation SSID, falling back to the broadcast SSID", () => {
    expect(watchedSsid(wand())).toBe("SOFTISH-1851");
    expect(watchedSsid(wand({ activationSsid: undefined }))).toBe("SOFTISH-1851");
    expect(watchedSsid(wand({ activationSsid: undefined, ssid: undefined }))).toBeNull();
  });

  it("a scan sighting flips the wand ACTIVE, logs RSSI, and fires activation", () => {
    const { devices, activated } = applyScanToRegistry(
      [wand()],
      [{ ssid: "SOFTISH-1851", rssi: -48 }],
      5000,
    );
    expect(devices[0]?.presence).toBe("active");
    expect(devices[0]?.lastSeenRssi).toBe(-48);
    expect(devices[0]?.lastSeen).toBe(5000);
    expect(devices[0]?.presenceEvents).toHaveLength(1);
    expect(devices[0]?.presenceEvents[0]).toMatchObject({
      kind: "appeared",
      rssi: -48,
      via: "scan",
    });
    expect(activated.map((d) => d.id)).toEqual(["wand-1"]);
  });

  it("a repeat scan while active logs the new strength but does not re-fire the greeting", () => {
    const first = applyScanToRegistry([wand()], [{ ssid: "SOFTISH-1851", rssi: -48 }], 5000);
    const second = applyScanToRegistry(first.devices, [{ ssid: "SOFTISH-1851", rssi: -61 }], 6000);
    expect(second.devices[0]?.presenceEvents).toHaveLength(2);
    expect(second.devices[0]?.lastSeenRssi).toBe(-61);
    expect(second.activated).toEqual([]);
  });

  it("disappearance flips the wand to GONE", () => {
    const first = applyScanToRegistry([wand()], [{ ssid: "SOFTISH-1851", rssi: -48 }], 5000);
    const second = applyScanToRegistry(first.devices, [{ ssid: "SOMEONE-ELSE", rssi: -70 }], 9000);
    expect(second.devices[0]?.presence).toBe("gone");
    expect(second.devices[0]?.presenceEvents.at(-1)).toMatchObject({ kind: "disappeared" });
  });

  it("non-wand devices appear without activating Augie", () => {
    const plain = wand({ id: "plain-1", beaconRole: undefined, displayName: "Spare hotspot cam" });
    const { devices, activated } = applyScanToRegistry(
      [plain],
      [{ ssid: "SOFTISH-1851", rssi: -50 }],
      5000,
    );
    expect(devices[0]?.presence).toBe("active");
    expect(activated).toEqual([]);
  });

  it("manual sightings record events and persist", () => {
    const start = upsertDevice([], wand());
    const { devices, activated } = recordPresenceEvent(start, "wand-1", {
      kind: "appeared",
      at: 7000,
      rssi: -55,
      via: "manual",
    });
    expect(activated?.id).toBe("wand-1");
    expect(loadRegistry()[0]?.presence).toBe("active");
    expect(devices[0]?.presenceEvents[0]?.via).toBe("manual");
  });

  it("the web scan boundary is unavailable and records nothing", async () => {
    upsertDevice([], wand());
    const result = await scanWifiEnvironment(1234);
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toContain("cannot scan Wi-Fi");
    expect(loadRegistry()[0]?.presenceEvents).toEqual([]);
    expect(loadRegistry()[0]?.presence).toBe("unknown");
  });

  it("RSSI trend reads weakening as the battery-fade signal — strength and trend only", () => {
    const fading = wand({
      presenceEvents: [
        { kind: "appeared", at: 1, rssi: -40, via: "scan" },
        { kind: "appeared", at: 2, rssi: -44, via: "scan" },
        { kind: "appeared", at: 3, rssi: -58, via: "scan" },
        { kind: "appeared", at: 4, rssi: -66, via: "scan" },
      ],
    });
    expect(rssiTrend(fading)).toBe("weakening");
    const closer = wand({
      presenceEvents: [
        { kind: "appeared", at: 1, rssi: -70, via: "scan" },
        { kind: "appeared", at: 2, rssi: -52, via: "scan" },
      ],
    });
    expect(rssiTrend(closer)).toBe("strengthening");
    expect(rssiTrend(wand())).toBe("not enough data");
    const steady = wand({
      presenceEvents: [
        { kind: "appeared", at: 1, rssi: -50, via: "scan" },
        { kind: "appeared", at: 2, rssi: -51, via: "scan" },
      ],
    });
    expect(rssiTrend(steady)).toBe("steady");
  });
});
