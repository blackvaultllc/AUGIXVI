import { beforeEach, describe, expect, it } from "vitest";
import {
  DEVICES_STORAGE_KEY,
  loadRegistry,
  removeDevice,
  saveRegistry,
  updateDevice,
  upsertDevice,
  canControl,
  sanitizeProfile,
  type DeviceProfile,
} from "@/avatar/devices/deviceRegistry";

/**
 * DEVICE REGISTRY (2026-11-21) — add / update / remove, persisted in
 * this browser, surviving reload, and corrupt storage never crashes
 * the sector or invents a device.
 */
function sample(overrides: Partial<DeviceProfile> = {}): DeviceProfile {
  return {
    id: "device-1",
    displayName: "Test Watch",
    kind: "watch",
    transport: "ble",
    externalId: "ble-id-1",
    source: "ble-profile",
    declaredServices: [],
    capabilities: ["can measure heart rate"],
    limitations: [],
    batteryLevel: 72,
    measured: {},
    presence: "unknown",
    presenceEvents: [],
    firstSeen: 1000,
    lastSeen: 2000,
    ...overrides,
  };
}

describe("device registry", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty and round-trips a saved registry", () => {
    expect(loadRegistry()).toEqual([]);
    saveRegistry([sample()]);
    const loaded = loadRegistry();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.displayName).toBe("Test Watch");
    expect(loaded[0]?.batteryLevel).toBe(72);
  });

  it("upsert adds, then replaces by id keeping firstSeen", () => {
    let list = upsertDevice([], sample());
    expect(list).toHaveLength(1);
    list = upsertDevice(list, sample({ displayName: "Renamed", lastSeen: 3000 }));
    expect(list).toHaveLength(1);
    expect(list[0]?.displayName).toBe("Renamed");
    expect(list[0]?.firstSeen).toBe(1000);
    expect(list[0]?.lastSeen).toBe(3000);
    expect(loadRegistry()[0]?.displayName).toBe("Renamed");
  });

  it("update patches one device and persists", () => {
    let list = upsertDevice([], sample());
    list = upsertDevice(
      list,
      sample({ id: "device-2", displayName: "Otoscope", transport: "wifi", source: "manual" }),
    );
    list = updateDevice(list, "device-2", { measured: { streamFps: 25, latencyMs: 180 } });
    const otoscope = loadRegistry().find((d) => d.id === "device-2");
    expect(otoscope?.measured.streamFps).toBe(25);
    expect(otoscope?.measured.latencyMs).toBe(180);
    expect(list).toHaveLength(2);
  });

  it("remove deletes and persists", () => {
    let list = upsertDevice([], sample());
    list = removeDevice(list, "device-1");
    expect(list).toEqual([]);
    expect(loadRegistry()).toEqual([]);
  });

  it("corrupt or foreign storage loads as empty — nothing invented", () => {
    localStorage.setItem(DEVICES_STORAGE_KEY, "{not json");
    expect(loadRegistry()).toEqual([]);
    localStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify([{ nope: true }, 42, null]));
    expect(loadRegistry()).toEqual([]);
    localStorage.setItem(
      DEVICES_STORAGE_KEY,
      JSON.stringify([sample({ batteryLevel: 900 as unknown as number })]),
    );
    // Out-of-range battery is dropped to null, not clamped into a lie.
    expect(loadRegistry()[0]?.batteryLevel).toBeNull();
  });

  it("Wi-Fi-AP devices keep their broadcast SSID as their presented identity", () => {
    upsertDevice(
      [],
      sample({
        id: "device-ap",
        displayName: "Otoscope",
        kind: "camera",
        transport: "wifi-ap",
        source: "manual",
        ssid: "SOFTISH-1851",
        activationSsid: "SOFTISH-1851",
        beaconRole: true,
        lastSeenRssi: -52,
        placement: "glasses-mounted",
        placementNote: "forward eye",
        measured: { streamType: "MJPEG over its own Wi-Fi hotspot" },
      }),
    );
    const loaded = loadRegistry();
    expect(loaded[0]?.transport).toBe("wifi-ap");
    expect(loaded[0]?.ssid).toBe("SOFTISH-1851");
    expect(loaded[0]?.placement).toBe("glasses-mounted");
    expect(loaded[0]?.placementNote).toBe("forward eye");
    expect(loaded[0]?.activationSsid).toBe("SOFTISH-1851");
    expect(loaded[0]?.beaconRole).toBe(true);
    expect(loaded[0]?.lastSeenRssi).toBe(-52);
    // Stream address stays absent until measured — never invented.
    expect(loaded[0]?.measured.streamAddress).toBeUndefined();
  });

  it("manual entries keep unmeasured fields absent", () => {
    const list = upsertDevice(
      [],
      sample({
        id: "device-m",
        source: "manual",
        transport: "wifi",
        measured: {},
        batteryLevel: null,
      }),
    );
    const loaded = loadRegistry();
    expect(loaded[0]?.measured).toEqual({});
    expect(list[0]?.batteryLevel).toBeNull();
  });
});

describe("the Permission Law flags (Part 29)", () => {
  it("default to NO control: absent flags mean observation only", () => {
    const profile = sanitizeProfile({
      id: "d1",
      displayName: "Test",
      kind: "other",
      transport: "wifi",
      externalId: "",
      presence: "unknown",
      presenceEvents: [],
      source: "manual",
      declaredServices: [],
      capabilities: [],
      limitations: [],
      batteryLevel: null,
      measured: {},
      firstSeen: 1,
      lastSeen: 1,
    });
    expect(profile?.ownerConfirmed).toBeUndefined();
    expect(profile?.controlGranted).toBeUndefined();
    expect(profile && canControl(profile)).toBe(false);
  });

  it("control requires BOTH flags — either one alone is not enough", () => {
    const base = {
      id: "d2",
      displayName: "Test",
      kind: "other",
      transport: "wifi",
      externalId: "",
      presence: "unknown",
      presenceEvents: [],
      source: "manual",
      declaredServices: [],
      capabilities: [],
      limitations: [],
      batteryLevel: null,
      measured: {},
      firstSeen: 1,
      lastSeen: 1,
    };
    const ownerOnly = sanitizeProfile({ ...base, ownerConfirmed: true });
    const grantOnly = sanitizeProfile({ ...base, controlGranted: true });
    const both = sanitizeProfile({ ...base, ownerConfirmed: true, controlGranted: true });
    expect(ownerOnly && canControl(ownerOnly)).toBe(false);
    expect(grantOnly && canControl(grantOnly)).toBe(false);
    expect(both && canControl(both)).toBe(true);
  });
});
