import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GENERIC_HTTP_PROFILE,
  PRINTER_GCODE_PROFILE,
  gcodeFileLines,
  renderCommandLines,
  validateCommandValues,
} from "@/avatar/devices/commandProfiles";
import {
  allCommandProfiles,
  appendCommandLog,
  bindingCommands,
  createSimulatedHttpChannel,
  createSimulatedPrinterChannel,
  loadBindings,
  loadCommandLog,
  logForDevice,
  parsePrinterStatus,
  printGcode,
  resolveBindingProfile,
  saveBinding,
  sendDeviceCommand,
  type DeviceCommandBinding,
} from "@/avatar/devices/commandModule";
import type { DeviceProfile } from "@/avatar/devices/deviceRegistry";

/**
 * UNIVERSAL COMMAND MODULE (operator order 2026-11-23) — the send
 * engine, proven against SIMULATED peers: a fake Marlin printer that
 * keeps real state, and a fake HTTP device that records requests.
 * No hardware is touched anywhere in this file, and no test claims
 * a hardware success. The Permission Law refusal is pinned by the
 * peer's received-lines list staying EMPTY.
 */
function device(overrides: Partial<DeviceProfile> = {}): DeviceProfile {
  return {
    id: "device-printer",
    displayName: "Shop Printer",
    kind: "other",
    transport: "usb",
    externalId: "PRN-1",
    source: "manual",
    declaredServices: [],
    capabilities: [],
    limitations: [],
    batteryLevel: null,
    measured: {},
    presence: "unknown",
    presenceEvents: [],
    firstSeen: 1000,
    lastSeen: 2000,
    ownerConfirmed: true,
    controlGranted: true,
    ...overrides,
  };
}

const command = (id: string) => {
  const found = PRINTER_GCODE_PROFILE.commands.find((c) => c.id === id);
  if (!found) throw new Error(`no printer command ${id}`);
  return found;
};

describe("device command profiles — the configuration core", () => {
  it("ships two built-in profiles as data: the G-code printer and the generic HTTP device", () => {
    expect(PRINTER_GCODE_PROFILE.transport).toBe("usb-serial");
    expect(PRINTER_GCODE_PROFILE.baudRate).toBe(115200);
    expect(GENERIC_HTTP_PROFILE.transport).toBe("network-http");
    const names = PRINTER_GCODE_PROFILE.commands.map((c) => c.id);
    for (const id of ["home", "move", "heat-nozzle", "heat-bed", "status", "print-file", "pause", "cancel"]) {
      expect(names).toContain(id);
    }
  });

  it("adding a device class is adding a profile object — the registry resolves it with no engine change", () => {
    const binding: DeviceCommandBinding = {
      deviceId: "device-printer",
      profileId: "custom-device-printer",
      address: "",
      customProfile: {
        id: "custom-device-printer",
        name: "His own set",
        deviceClass: "A set the operator built",
        transport: "network-tcp",
        addressPattern: "",
        commands: [
          {
            id: "ping-it",
            name: "Ping it",
            help: "",
            params: [],
            payload: { kind: "lines", lines: ["PING"] },
          },
        ],
        setupSteps: [],
        safetyNotes: [],
        builtin: false,
      },
      extraCommands: [
        {
          id: "extra-1",
          name: "Extra",
          help: "",
          params: [],
          payload: { kind: "lines", lines: ["EXTRA"] },
        },
      ],
    };
    const profiles = allCommandProfiles({ [binding.deviceId]: binding });
    expect(profiles.map((p) => p.id)).toContain("custom-device-printer");
    const resolved = resolveBindingProfile(binding, profiles);
    expect(resolved?.name).toBe("His own set");
    expect(bindingCommands(binding, resolved!).map((c) => c.id)).toEqual(["ping-it", "extra-1"]);
  });

  it("bindings survive a save/load round trip through the store, sanitized", () => {
    saveBinding({
      deviceId: "device-printer",
      profileId: "printer-gcode",
      address: "the left USB port",
    });
    const loaded = loadBindings();
    expect(loaded["device-printer"]?.profileId).toBe("printer-gcode");
    expect(loaded["device-printer"]?.address).toBe("the left USB port");
  });
});

describe("G-code generation — the vocabulary, pinned line for line", () => {
  it("Home is exactly G28", () => {
    expect(renderCommandLines(command("home"), {})).toEqual(["G28"]);
  });

  it("Move renders only the axes given, with the feed word", () => {
    expect(renderCommandLines(command("move"), { x: "10", y: "20", feed: "3000" })).toEqual([
      "G90",
      "G1 X10 Y20 F3000",
    ]);
    expect(renderCommandLines(command("move"), { z: "5", feed: "1500" })).toEqual([
      "G90",
      "G1 Z5 F1500",
    ]);
  });

  it("Heat commands render the set-temperature lines", () => {
    expect(renderCommandLines(command("heat-nozzle"), { temp: "200" })).toEqual(["M104 S200"]);
    expect(renderCommandLines(command("heat-bed"), { temp: "60" })).toEqual(["M140 S60"]);
  });

  it("Pause and Cancel render their lines", () => {
    expect(renderCommandLines(command("pause"), {})).toEqual(["M25"]);
    expect(renderCommandLines(command("cancel"), {})).toEqual([
      "M25",
      "M104 S0",
      "M140 S0",
      "M84",
    ]);
  });

  it("values are validated against the parameter shapes before anything is built", () => {
    expect(validateCommandValues(command("heat-nozzle"), { temp: "999" })).toMatch(/cannot be above 300/);
    expect(validateCommandValues(command("heat-nozzle"), { temp: "" })).toMatch(/is needed/);
    expect(validateCommandValues(command("heat-nozzle"), { temp: "abc" })).toMatch(/must be a number/);
    expect(validateCommandValues(command("heat-nozzle"), { temp: "200" })).toBeNull();
  });

  it("print files are split into sendable lines — blanks and comments go", () => {
    expect(gcodeFileLines("G28\n\n; a comment\nG1 X10 ; trailing\nM104 S200\n")).toEqual([
      "G28",
      "G1 X10",
      "M104 S200",
    ]);
  });
});

describe("sending under the Permission Law — simulated printer peer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("a granted send reaches the peer line for line, and the log records it", async () => {
    const peer = createSimulatedPrinterChannel();
    const outcome = await sendDeviceCommand({
      device: device(),
      profile: PRINTER_GCODE_PROFILE,
      command: command("move"),
      values: { x: "10", y: "20", feed: "3000" },
      channel: peer,
      now: 5000,
    });
    expect(outcome.result).toBe("sent");
    expect(peer.received).toEqual(["G90", "G1 X10 Y20 F3000"]);
    const log = logForDevice(loadCommandLog(), "device-printer");
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ commandName: "Move", result: "sent", at: 5000 });
  });

  it("REFUSAL: without both Permission Law flags the peer hears NOTHING, and the refusal is logged in words", async () => {
    for (const overrides of [
      { ownerConfirmed: undefined, controlGranted: true },
      { ownerConfirmed: true, controlGranted: undefined },
      { ownerConfirmed: undefined, controlGranted: undefined },
    ]) {
      localStorage.clear();
      const peer = createSimulatedPrinterChannel();
      const outcome = await sendDeviceCommand({
        device: device(overrides),
        profile: PRINTER_GCODE_PROFILE,
        command: command("home"),
        values: {},
        channel: peer,
        now: 6000,
      });
      expect(outcome.result).toBe("refused");
      expect(outcome.note).toMatch(/Control is not granted for this device/);
      expect(peer.received).toEqual([]);
      const log = logForDevice(loadCommandLog(), "device-printer");
      expect(log).toHaveLength(1);
      expect(log[0]?.result).toBe("refused");
    }
  });

  it("heat then Status reads back the printer's own numbers — the peer's state, parsed", async () => {
    const peer = createSimulatedPrinterChannel();
    await sendDeviceCommand({
      device: device(),
      profile: PRINTER_GCODE_PROFILE,
      command: command("heat-nozzle"),
      values: { temp: "200" },
      channel: peer,
    });
    await sendDeviceCommand({
      device: device(),
      profile: PRINTER_GCODE_PROFILE,
      command: command("heat-bed"),
      values: { temp: "60" },
      channel: peer,
    });
    const status = await sendDeviceCommand({
      device: device(),
      profile: PRINTER_GCODE_PROFILE,
      command: command("status"),
      values: {},
      channel: peer,
    });
    expect(status.result).toBe("sent");
    expect(status.printerStatus).toMatchObject({ nozzleTargetC: 200, bedTargetC: 60 });
    expect(status.note).toMatch(/Nozzle 24\.6°C \(target 200°C\)/);
    expect(peer.received).toEqual(["M104 S200", "M140 S60", "M105", "M114"]);
  });

  it("a status reply with no readable temperature parses to UNAVAILABLE, never invented numbers", () => {
    expect(parsePrinterStatus(["ok"])).toBeNull();
    expect(parsePrinterStatus([])).toBeNull();
    expect(
      parsePrinterStatus(["ok T:210.3 /210.0 B:60.1 /60.0 @:127 B@:0", "X:1.00 Y:2.00 Z:3.00 E:0.00"]),
    ).toMatchObject({ nozzleC: 210.3, bedC: 60.1, position: { x: 1, y: 2, z: 3 } });
  });

  it("Print a file streams every real line with progress, through the CAD seam", async () => {
    const peer = createSimulatedPrinterChannel();
    const progress: [number, number][] = [];
    const outcome = await printGcode({
      device: device(),
      profile: PRINTER_GCODE_PROFILE,
      gcodeText: "G28\n; sliced by the CAD bench\nM104 S200\nG1 X10 Y10 F3000\n",
      channel: peer,
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(outcome.result).toBe("sent");
    expect(peer.received).toEqual(["G28", "M104 S200", "G1 X10 Y10 F3000"]);
    expect(progress[progress.length - 1]).toEqual([3, 3]);
    expect(outcome.note).toMatch(/3 G-code lines/);
  });

  it("an empty print file sends nothing and says so", async () => {
    const peer = createSimulatedPrinterChannel();
    const outcome = await printGcode({
      device: device(),
      profile: PRINTER_GCODE_PROFILE,
      gcodeText: "; only a comment\n\n",
      channel: peer,
    });
    expect(outcome.result).toBe("failed");
    expect(peer.received).toEqual([]);
  });

  it("no channel = UNAVAILABLE, logged, nothing sent", async () => {
    const outcome = await sendDeviceCommand({
      device: device(),
      profile: PRINTER_GCODE_PROFILE,
      command: command("home"),
      values: {},
      channel: null,
      channelUnavailableReason: "USB serial is UNAVAILABLE in this browser.",
    });
    expect(outcome.result).toBe("unavailable");
    expect(outcome.note).toMatch(/UNAVAILABLE in this browser/);
    expect(logForDevice(loadCommandLog(), "device-printer")[0]?.result).toBe("unavailable");
  });

  it("OFFLINE: the simulated send path runs with the network stubbed away entirely", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() => {
      throw new Error("network is down");
    }) as unknown as typeof fetch;
    try {
      const peer = createSimulatedPrinterChannel();
      const outcome = await sendDeviceCommand({
        device: device(),
        profile: PRINTER_GCODE_PROFILE,
        command: command("home"),
        values: {},
        channel: peer,
      });
      expect(outcome.result).toBe("sent");
      expect(peer.received).toEqual(["G28"]);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("the generic HTTP profile — generality proof", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("a named command renders to a request on the device's own address, and the answer is reported", async () => {
    const peer = createSimulatedHttpChannel((req) => ({
      status: 200,
      body: `answered ${req.method} ${req.url}`,
    }));
    const custom = GENERIC_HTTP_PROFILE.commands.find((c) => c.id === "custom-request");
    if (!custom) throw new Error("no custom-request command");
    const outcome = await sendDeviceCommand({
      device: device({ id: "device-plug", displayName: "Porch Plug" }),
      profile: GENERIC_HTTP_PROFILE,
      command: custom,
      values: { method: "POST", path: "/switch?state=on", body: "" },
      address: "http://192.168.1.50",
      channel: peer,
    });
    expect(outcome.result).toBe("sent");
    expect(peer.requests).toEqual([
      { method: "POST", url: "http://192.168.1.50/switch?state=on", body: undefined },
    ]);
    expect(outcome.note).toMatch(/HTTP 200/);
  });

  it("the Permission Law refuses an HTTP send exactly the same way", async () => {
    const peer = createSimulatedHttpChannel(() => ({ status: 200, body: "" }));
    const status = GENERIC_HTTP_PROFILE.commands.find((c) => c.id === "status-check");
    if (!status) throw new Error("no status-check command");
    const outcome = await sendDeviceCommand({
      device: device({ id: "device-plug", controlGranted: undefined }),
      profile: GENERIC_HTTP_PROFILE,
      command: status,
      values: { path: "/" },
      address: "http://192.168.1.50",
      channel: peer,
    });
    expect(outcome.result).toBe("refused");
    expect(peer.requests).toEqual([]);
  });

  it("the command log is capped and sanitized — a corrupt store reads as empty, never a crash", () => {
    localStorage.setItem("augi.devices.command-log.v1", "{not json");
    expect(loadCommandLog()).toEqual([]);
    for (let i = 0; i < 5; i += 1) {
      appendCommandLog({
        deviceId: "device-printer",
        deviceName: "Shop Printer",
        profileId: "printer-gcode",
        commandId: "home",
        commandName: "Home",
        detail: "G28",
        at: 1000 + i,
        result: "sent",
        note: "ok",
      });
    }
    expect(loadCommandLog()).toHaveLength(5);
  });
});
