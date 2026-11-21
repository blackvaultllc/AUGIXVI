import { beforeEach, describe, expect, it } from "vitest";
import { HEARTBEAT_PERIOD_MS, breathCycleAt } from "@/avatar/heartbeat";
import type { DeviceProfile } from "@/avatar/devices/deviceRegistry";
import {
  HEARTBEAT_CHECK_DIVIDER,
  WAND_GREETING,
  createHeartbeatCheckPacer,
  getPresenceWatch,
  notePresenceCheck,
  resetPresenceWatch,
  runPresenceCheck,
  type WifiScanResult,
} from "@/avatar/devices/presence";

/**
 * HEARTBEAT-PACED PRESENCE (follow-up order 2026-11-21) — Augie's
 * heartbeat (one beat per breath cycle of the body, ≈5.24 s) paces
 * the Wi-Fi presence check while he is on stage, replacing the
 * 15-minute timer. These tests pin the pacing (checks on the
 * divider, never faster than the floor), the no-spam rule for the
 * unavailable state (reported once per state change, never per
 * check), and that a real scan delivered on a heartbeat check still
 * flips the wand and fires the activation the greeting speaks.
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

const unavailable = (at: number): WifiScanResult => ({
  available: false,
  reason: "cannot scan Wi-Fi here",
  at,
});

describe("Augie's heartbeat", () => {
  it("one beat is one full breath cycle of the body, about 5.24 s", () => {
    expect(HEARTBEAT_PERIOD_MS).toBeGreaterThan(5_200);
    expect(HEARTBEAT_PERIOD_MS).toBeLessThan(5_300);
    expect(breathCycleAt(0)).toBe(0);
    expect(breathCycleAt(HEARTBEAT_PERIOD_MS / 1000 - 0.01)).toBe(0);
    expect(breathCycleAt(HEARTBEAT_PERIOD_MS / 1000 + 0.01)).toBe(1);
    expect(breathCycleAt((HEARTBEAT_PERIOD_MS / 1000) * 3 + 0.01)).toBe(3);
  });
});

describe("heartbeat check pacer", () => {
  it("checks fire on the divider beat, not on every beat", () => {
    const pacer = createHeartbeatCheckPacer();
    const period = HEARTBEAT_PERIOD_MS;
    const firedAt: number[] = [];
    for (let beat = 1; beat <= HEARTBEAT_CHECK_DIVIDER * 2; beat++) {
      if (pacer.beat(beat * period)) firedAt.push(beat);
    }
    expect(firedAt).toEqual([HEARTBEAT_CHECK_DIVIDER, HEARTBEAT_CHECK_DIVIDER * 2]);
    expect(pacer.beatsSeen).toBe(HEARTBEAT_CHECK_DIVIDER * 2);
    expect(pacer.checksDue).toBe(2);
    // The cadence lands in the 30–60 s of stage time the order asks for.
    const cadenceMs = HEARTBEAT_CHECK_DIVIDER * HEARTBEAT_PERIOD_MS;
    expect(cadenceMs).toBeGreaterThanOrEqual(30_000);
    expect(cadenceMs).toBeLessThanOrEqual(60_000);
  });

  it("never checks faster than the 10-second floor, even on a fast heartbeat", () => {
    const pacer = createHeartbeatCheckPacer(1, 10_000);
    expect(pacer.beat(0)).toBe(true);
    expect(pacer.beat(5_000)).toBe(false);
    expect(pacer.beat(9_999)).toBe(false);
    // The blocked check stays due and fires on the next beat past the floor.
    expect(pacer.beat(10_000)).toBe(true);
  });
});

describe("heartbeat presence checks", () => {
  beforeEach(() => {
    localStorage.clear();
    resetPresenceWatch();
  });

  it("unavailable scans on the heartbeat record nothing and report once per state change", () => {
    const devices = [wand()];
    const changes: boolean[] = [];
    for (const at of [10_000, 52_000, 94_000]) {
      const result = runPresenceCheck(devices, unavailable(at), at);
      expect(result.devices).toBe(devices);
      expect(result.activated).toEqual([]);
      changes.push(notePresenceCheck(result.scan, "heartbeat", false).availabilityChanged);
    }
    // No presence events were recorded from scans that never happened.
    expect(devices[0]?.presenceEvents).toEqual([]);
    expect(devices[0]?.presence).toBe("unknown");
    // The unavailable state was reported on the first check only —
    // the heartbeat does not re-report it every ≈42 s.
    expect(changes).toEqual([true, false, false]);
    const watch = getPresenceWatch();
    expect(watch.checksRun).toBe(3);
    expect(watch.lastCheckAt).toBe(94_000);
    expect(watch.lastCheckVia).toBe("heartbeat");
    expect(watch.scanAvailable).toBe(false);
  });

  it("a synthetic scan delivered on a heartbeat check flips the wand and fires the greeting path", () => {
    const pacer = createHeartbeatCheckPacer(2);
    const scan: WifiScanResult = {
      available: true,
      networks: [{ ssid: "SOFTISH-1851", rssi: -48 }],
      at: 50_000,
    };
    // First beat: no check due yet, nothing happens.
    expect(pacer.beat(HEARTBEAT_PERIOD_MS)).toBe(false);
    // Second beat: the check runs and the scan lands.
    expect(pacer.beat(HEARTBEAT_PERIOD_MS * 2)).toBe(true);
    const { devices, activated } = runPresenceCheck([wand()], scan, scan.at);
    notePresenceCheck(scan, "heartbeat", true);
    expect(devices[0]?.presence).toBe("active");
    expect(devices[0]?.lastSeenRssi).toBe(-48);
    // The activation list is what the stage turns into the greeting.
    expect(activated.map((d) => d.displayName)).toEqual(["Magic Wand"]);
    expect(WAND_GREETING).toBe("Sir, do you need any help or anything like that.");
    expect(getPresenceWatch().scanAvailable).toBe(true);
    expect(getPresenceWatch().lastRegistryChanged).toBe(true);
  });
});
