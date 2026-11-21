import { describe, expect, it } from "vitest";
import {
  describeGattService,
  normalizeUuid,
  uuidFromAssignedNumber,
} from "@/avatar/devices/gattCatalog";
import {
  bleLimitations,
  suggestKind,
  summarizeServices,
  toDeclaredService,
} from "@/avatar/devices/deviceRegistry";

/**
 * DEVICE CAPABILITY MAPPING (2026-11-21) — the whole adopted catalog
 * maps to plain language; anything outside it stays in the honest
 * "custom — needs mapping" bucket and is never guessed at.
 */
describe("GATT catalog mapping", () => {
  it("normalizes every UUID spelling to the same key", () => {
    const full = uuidFromAssignedNumber(0x180d);
    expect(normalizeUuid("180d")).toBe(full);
    expect(normalizeUuid("0x180D")).toBe(full);
    expect(normalizeUuid("0000180d")).toBe(full);
    expect(normalizeUuid(full.toUpperCase())).toBe(full);
  });

  it("maps the health family", () => {
    expect(describeGattService("180d")?.capability).toBe("can measure heart rate");
    expect(describeGattService("1810")?.capability).toBe("can measure blood pressure");
    expect(describeGattService("1808")?.capability).toBe("can measure blood glucose");
    expect(describeGattService("1809")?.capability).toBe("can measure body temperature");
    expect(describeGattService("181d")?.capability).toBe("can measure body weight");
    expect(describeGattService("1822")?.capability).toContain("blood oxygen");
    expect(describeGattService("181f")?.capability).toContain("continuously");
  });

  it("maps fitness, input, battery, device info, environment, time, location, alerts", () => {
    expect(describeGattService("1814")?.capability).toContain("running speed");
    expect(describeGattService("1816")?.capability).toContain("cycling speed");
    expect(describeGattService("1818")?.capability).toContain("cycling power");
    expect(describeGattService("1826")?.capability).toContain("gym equipment");
    expect(describeGattService("1812")?.capability).toContain("input device");
    expect(describeGattService("180f")?.capability).toBe("battery level readable");
    expect(describeGattService("180a")?.capability).toContain("firmware readable");
    expect(describeGattService("181a")?.capability).toContain("environment");
    expect(describeGattService("1805")?.capability).toContain("current time");
    expect(describeGattService("1819")?.capability).toContain("location");
    expect(describeGattService("1811")?.capability).toContain("phone alerts");
    expect(describeGattService("1802")?.capability).toContain("find-me");
  });

  it("maps the LE Audio family for headsets", () => {
    expect(describeGattService("184e")?.capability).toContain("LE Audio");
    expect(describeGattService("1848")?.capability).toContain("playback controls");
    expect(describeGattService("184b")?.capability).toContain("phone calls");
    expect(describeGattService("184d")?.capability).toContain("microphone");
    expect(describeGattService("1844")?.capability).toContain("volume");
    expect(describeGattService("1850")?.capability).toContain("LE Audio playback capabilities");
    expect(describeGattService("1854")?.capability).toContain("hearing-aid");
  });

  it("maps documented vendor serial channels by name", () => {
    const nordic = describeGattService("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    expect(nordic?.name).toContain("Nordic UART");
    expect(nordic?.capability).toContain("serial data channel");
    expect(describeGattService("ffe0")?.capability).toContain("serial data channel");
  });

  it("leaves unknown and custom services unmapped — never guessed", () => {
    expect(describeGattService("1234")).toBeNull();
    expect(describeGattService("f000aa45-0451-4000-b000-000000000000")).toBeNull();
    expect(describeGattService("0000fff9-0000-1000-8000-00805f9b34fb")).toBeNull();
  });

  it("infrastructure services are named but claim no capability", () => {
    const ga = describeGattService("1800");
    expect(ga?.name).toBe("Generic Access");
    expect(ga?.capability).toBeNull();
  });
});

describe("service summarization", () => {
  it("derives capabilities only from exposed services, deduped", () => {
    const services = [
      toDeclaredService("180d", []),
      toDeclaredService("180f", []),
      toDeclaredService("180f", []),
      toDeclaredService("180a", []),
    ];
    const { capabilities, customServices } = summarizeServices(services);
    expect(capabilities).toEqual([
      "can measure heart rate",
      "battery level readable",
      "manufacturer, model and firmware readable",
    ]);
    expect(customServices).toEqual([]);
  });

  it("puts custom services in the honest bucket", () => {
    const services = [
      toDeclaredService("180d", []),
      toDeclaredService("f000aa45-0451-4000-b000-000000000000", []),
    ];
    const { capabilities, customServices } = summarizeServices(services);
    expect(capabilities).toEqual(["can measure heart rate"]);
    expect(customServices).toHaveLength(1);
    expect(customServices[0]?.known).toBe(false);
    expect(customServices[0]?.name).toBeNull();
  });

  it("suggests kinds from what was exposed", () => {
    expect(suggestKind([toDeclaredService("184e", [])])).toBe("headset");
    expect(suggestKind([toDeclaredService("1812", [])])).toBe("controller");
    expect(suggestKind([toDeclaredService("180d", [])])).toBe("fitness-band");
    expect(suggestKind([toDeclaredService("1810", [])])).toBe("medical");
    expect(suggestKind([toDeclaredService("181a", [])])).toBe("sensor");
    expect(suggestKind([])).toBe("other");
  });

  it("flags the classic-audio blind spot for headsets profiled over BLE", () => {
    const limits = bleLimitations({
      kind: "headset",
      declaredServices: [toDeclaredService("180f", [])],
    });
    expect(limits.join(" ")).toContain("A2DP/HFP");
    const leAudio = bleLimitations({
      kind: "headset",
      declaredServices: [toDeclaredService("184e", [])],
    });
    expect(leAudio).toEqual([]);
  });

  it("says plainly when a connection exposed nothing", () => {
    expect(bleLimitations({ kind: "other", declaredServices: [] }).join(" ")).toContain(
      "no services",
    );
  });
});
