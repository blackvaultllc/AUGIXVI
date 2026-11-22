import { beforeEach, describe, expect, it } from "vitest";
import {
  DEVICES_STORAGE_KEY,
  loadRegistry,
  removeDevice,
  saveRegistry,
  updateDevice,
  upsertDevice,
  canControl,
  controlSurface,
  formatControlsText,
  formatPortsText,
  parseControlsText,
  parsePortsText,
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

describe("device mastery — the first-contact map (doctrine update 2026-11-21)", () => {
  const base = {
    id: "drone-1",
    displayName: "Folding drone (with remote)",
    kind: "drone",
    transport: "wifi-ap",
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

  it("holds address, protocol, ports, and the control map — junk is dropped", () => {
    const profile = sanitizeProfile({
      ...base,
      address: "192.168.0.1",
      protocol: "UDP app protocol",
      ports: [
        { port: 7099, protocol: "udp", service: "app control" },
        { port: 0 },
        { port: 70000 },
        { port: "554" },
      ],
      controls: [
        { label: "Take off", kind: "command", detail: "UDP packet to the hotspot", verified: true },
        { label: "", kind: "command", detail: "no label — dropped", verified: false },
        { label: "Left stick — pitch", kind: "stick", detail: "app protocol channel 2" },
      ],
    });
    expect(profile?.kind).toBe("drone");
    expect(profile?.address).toBe("192.168.0.1");
    expect(profile?.protocol).toBe("UDP app protocol");
    expect(profile?.ports).toEqual([{ port: 7099, protocol: "udp", service: "app control" }]);
    expect(profile?.controls).toHaveLength(2);
    expect(profile?.controls?.[1]?.verified).toBe(false);
  });

  it("form text round-trips: ports and controls parse and re-format", () => {
    const ports = parsePortsText("7099 | udp | app control\n554 | tcp | rtsp");
    expect(ports).toHaveLength(2);
    expect(formatPortsText(ports)).toContain("7099 | udp | app control");
    const controls = parseControlsText(
      "Take off | command | UDP packet | verified\nLand | command | UDP packet",
    );
    expect(controls?.[0]?.verified).toBe(true);
    expect(controls?.[1]?.verified).toBe(false);
    expect(formatControlsText(controls)).toContain("Take off | command | UDP packet | verified");
  });

  it("the control surface obeys the Permission Law gate exactly", () => {
    const controls = [
      { id: "c1", label: "Take off", kind: "command" as const, detail: "UDP packet", verified: true },
      { id: "c2", label: "Flip", kind: "command" as const, detail: "guessed frame", verified: false },
    ];
    const ungranted = sanitizeProfile({ ...base, controls });
    expect(controlSurface(ungranted!).state).toBe("not-granted");

    const ownerOnly = sanitizeProfile({ ...base, controls, ownerConfirmed: true });
    expect(controlSurface(ownerOnly!).state).toBe("not-granted");

    const granted = sanitizeProfile({
      ...base,
      controls,
      ownerConfirmed: true,
      controlGranted: true,
    });
    const surface = controlSurface(granted!);
    expect(surface.state).toBe("granted");
    if (surface.state === "granted") {
      expect(surface.usable.map((c) => c.label)).toEqual(["Take off"]);
      expect(surface.unproven.map((c) => c.label)).toEqual(["Flip"]);
    }
  });
});
