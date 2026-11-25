import { describe, expect, it } from "vitest";
import { canControl, parseControlsText } from "@/avatar/devices/deviceRegistry";
import { createSimulatedBroadcastChannel } from "@/avatar/devices/commandModule";
import {
  emptyDeviceCoreState,
  seedDeviceCoreState,
  stateCommandsFor,
  WEPWAWET_DEVICE_ID,
  type DeviceCoreState,
} from "@/avatar/devices/deviceStoreCore";
import {
  deviceBriefLines,
  parseDeviceCommandIntent,
  toolBindProfile,
  toolRegisterDevice,
  toolSendDeviceCommand,
  toolSetDeviceFlags,
} from "@/avatar/devices/deviceTools";
import { capabilitiesBrief } from "@/avatar/capabilities";
import { WEPWAWET_COMPANY_ID, framesForBroadcastCommand, payloadHex } from "@/avatar/devices/wepwawetFrame";
import { WEPWAWET_DOG_PROFILE } from "@/avatar/devices/commandProfiles";

/**
 * ANUBIS'S DEVICE TOOLS (2026-11-24) — the construct can register
 * a device with its earned map, bind its command set, ask for a
 * Permission Law grant (never take one), and fire commands the
 * Captain granted. The brief it answers from is generated from
 * the same registry. Frame authoring runs end to end: a "frame:"
 * line in a control map becomes a command that airs exact bytes.
 */

const NOW = 1_800_000_000_000;

/**
 * The seed dog as he stood while the Captain owned him — retired
 * marker lifted, the recorded grant restored — for the tests that
 * exercise the live send and intent roads. The seed itself is
 * retired now (the sale, 2026-11-24).
 */
const liveDogState = (): DeviceCoreState => {
  const state = seedDeviceCoreState();
  return {
    ...state,
    registry: state.registry.map((d) => ({
      ...d,
      retired: undefined,
      ownerConfirmed: true as const,
      controlGranted: true as const,
    })),
  };
};

describe("registerDevice", () => {
  it("registers with its earned map — and NEVER with the Permission Law flags", () => {
    const smuggled = {
      displayName: "Porch bot",
      kind: "other" as const,
      transport: "ble" as const,
      controls: parseControlsText(
        "Wave | command | frame for the wave | frame: E0 00 00 00 00 07 500 | verified",
      ),
      // A draft that tries to smuggle the flags in has nowhere to land.
      ...({ ownerConfirmed: true, controlGranted: true } as object),
    };
    const result = toolRegisterDevice(emptyDeviceCoreState(), smuggled, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { state, device } = result.value;
    expect(device.ownerConfirmed).toBeUndefined();
    expect(device.controlGranted).toBeUndefined();
    expect(canControl(device)).toBe(false);
    expect(state.registry[0]?.id).toBe(device.id);
    // The map's frame line is a fireable command from birth.
    expect(stateCommandsFor(state, device).map((c) => c.name)).toEqual(["Wave"]);
  });

  it("an authored profile is stored and bound with the registration", () => {
    const profile = {
      ...WEPWAWET_DOG_PROFILE,
      id: "porch-bot-broadcast",
      name: "Porch bot (Bluetooth broadcast)",
      builtin: false,
    };
    const result = toolRegisterDevice(
      emptyDeviceCoreState(),
      { displayName: "Porch bot", transport: "ble", profile, bindingAddress: "B0B5CA11" },
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.profiles.map((p) => p.id)).toContain("porch-bot-broadcast");
    expect(result.value.state.bindings[result.value.device.id]?.address).toBe("B0B5CA11");
  });
});

describe("setDeviceFlags — the ask is filed, never applied", () => {
  it("files a pending request; the device stays ungranted until the Captain resolves it", () => {
    const registered = toolRegisterDevice(
      emptyDeviceCoreState(),
      { displayName: "Porch bot" },
      NOW,
    );
    if (!registered.ok) throw new Error("registration failed");
    const asked = toolSetDeviceFlags(registered.value.state, {
      deviceId: registered.value.device.id,
      ownerConfirmed: true,
      controlGranted: true,
      reason: "The Captain bought it and asked me to set it up.",
      now: NOW + 1,
    });
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    expect(asked.value.request.status).toBe("pending");
    const device = asked.value.state.registry.find(
      (d) => d.id === registered.value.device.id,
    )!;
    expect(canControl(device)).toBe(false);
  });
});

describe("bindProfile", () => {
  it("binds an existing profile to a registered device", () => {
    const registered = toolRegisterDevice(
      emptyDeviceCoreState(),
      { displayName: "Shop printer" },
      NOW,
    );
    if (!registered.ok) throw new Error("registration failed");
    const bound = toolBindProfile(registered.value.state, {
      deviceId: registered.value.device.id,
      profileId: "printer-gcode",
      now: NOW + 1,
    });
    expect(bound.ok).toBe(true);
    if (!bound.ok) return;
    expect(bound.value.state.bindings[registered.value.device.id]?.profileId).toBe(
      "printer-gcode",
    );
  });

  it("refuses an unknown profile", () => {
    const registered = toolRegisterDevice(
      emptyDeviceCoreState(),
      { displayName: "Shop printer" },
      NOW,
    );
    if (!registered.ok) throw new Error("registration failed");
    const bound = toolBindProfile(registered.value.state, {
      deviceId: registered.value.device.id,
      profileId: "no-such-profile",
      now: NOW + 1,
    });
    expect(bound.ok).toBe(false);
  });
});

describe("sendDeviceCommand — the Permission Law at the construct's hand", () => {
  it("REFUSED when the flags are off — nothing airs, and the refusal is logged in the core", async () => {
    const registered = toolRegisterDevice(
      emptyDeviceCoreState(),
      {
        displayName: "Porch bot",
        transport: "ble",
        controls: parseControlsText(
          "Wave | command | frame for the wave | frame: E0 00 00 00 00 07 500 | verified",
        ),
      },
      NOW,
    );
    if (!registered.ok) throw new Error("registration failed");
    const channel = createSimulatedBroadcastChannel(WEPWAWET_COMPANY_ID);
    const sent = await toolSendDeviceCommand(registered.value.state, {
      deviceId: registered.value.device.id,
      commandId: "control-1",
      channel,
      now: NOW + 2,
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.value.outcome.result).toBe("refused");
    expect(channel.aired).toHaveLength(0);
    expect(sent.value.state.log).toHaveLength(1);
    expect(sent.value.state.log[0]?.result).toBe("refused");
  });

  it("frame authoring end to end: the aired bytes are the frame the map describes", async () => {
    const state = liveDogState();
    const channel = createSimulatedBroadcastChannel(WEPWAWET_COMPANY_ID);
    const sent = await toolSendDeviceCommand(state, {
      deviceId: WEPWAWET_DEVICE_ID,
      commandId: "forward",
      channel,
      now: NOW,
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.value.outcome.result).toBe("sent");
    const forward = WEPWAWET_DOG_PROFILE.commands.find((c) => c.id === "forward")!;
    if (forward.payload.kind !== "ble-broadcast") throw new Error("forward must broadcast");
    const expected = framesForBroadcastCommand(forward.payload);
    expect(channel.aired.map((a) => a.hex)).toEqual(expected.map((f) => payloadHex(f.payload)));
    expect(channel.aired.map((a) => a.holdMs)).toEqual(expected.map((f) => f.holdMs));
    expect(sent.value.state.log.at(-1)?.result).toBe("sent");
  });

  it("the RETIRED dog refuses at the construct's hand — nothing airs, the refusal is logged", async () => {
    const state = seedDeviceCoreState();
    const channel = createSimulatedBroadcastChannel(WEPWAWET_COMPANY_ID);
    const sent = await toolSendDeviceCommand(state, {
      deviceId: WEPWAWET_DEVICE_ID,
      commandId: "forward",
      channel,
      now: NOW,
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.value.outcome.result).toBe("refused");
    expect(sent.value.outcome.note).toContain("retired");
    expect(sent.value.outcome.note).toContain("2026-11-24");
    expect(channel.aired).toHaveLength(0);
    expect(sent.value.state.log.at(-1)?.result).toBe("refused");
  });
});

describe("the Captain's word — parseDeviceCommandIntent", () => {
  const state = liveDogState();

  it("reads a direct order to the dog", () => {
    expect(parseDeviceCommandIntent("tell Wepwawet to sit", state)?.commandId).toBe("sit");
    expect(parseDeviceCommandIntent("have the dog dance", state)?.commandId).toBe("dance");
    expect(parseDeviceCommandIntent("stop the dog", state)?.commandId).toBe("stop");
    expect(parseDeviceCommandIntent("tell the dog to feed 3", state)?.commandId).toBe("feed-3");
    expect(parseDeviceCommandIntent("Wepwawet: lie down", state)?.commandId).toBe("lie-down");
  });

  it("conversation is not an order — near misses fall through", () => {
    expect(parseDeviceCommandIntent("tell me about Wepwawet", state)).toBeNull();
    expect(parseDeviceCommandIntent("the dog is cute today", state)).toBeNull();
    expect(parseDeviceCommandIntent("tell Wepwawet to fly to the moon", state)).toBeNull();
    expect(parseDeviceCommandIntent("what can the dog do", state)).toBeNull();
  });

  it("the RETIRED dog takes no orders — his name in an order is conversation now", () => {
    const retired = seedDeviceCoreState();
    expect(parseDeviceCommandIntent("tell Wepwawet to sit", retired)).toBeNull();
    expect(parseDeviceCommandIntent("stop the dog", retired)).toBeNull();
    expect(parseDeviceCommandIntent("have the dog dance", retired)).toBeNull();
  });
});

describe("the generated brief — the registry is the knowledge", () => {
  it("the seed brief states the dog is RETIRED — sold, gone, never offered", () => {
    const brief = capabilitiesBrief();
    expect(brief).toContain("Wepwawet");
    expect(brief).toContain("RETIRED");
    expect(brief).toContain("sold on 2026-11-24");
    expect(brief).toContain("Never offer to drive it");
    // Never again as a current, granted device:
    expect(brief).not.toContain("Control is GRANTED");
    expect(brief).not.toContain("PROVEN LIVE");
    expect(capabilitiesBrief("short")).toContain("RETIRED");
    expect(capabilitiesBrief("short")).toContain("2026-11-24");
  });

  it("change the registry and the brief changes", () => {
    const state: DeviceCoreState = seedDeviceCoreState();
    const before = deviceBriefLines(state).join("\n");
    expect(before).toContain("Wepwawet");
    const emptied: DeviceCoreState = { ...state, registry: [], bindings: {} };
    expect(deviceBriefLines(emptied)).toHaveLength(0);
    const briefWithoutDog = capabilitiesBrief("full", emptied);
    expect(briefWithoutDog).not.toContain("PROVEN LIVE");
    const withPrinter: DeviceCoreState = {
      ...state,
      registry: [
        ...state.registry,
        {
          id: "printer-1",
          displayName: "Shop printer",
          kind: "other",
          transport: "usb",
          externalId: "",
          presence: "unknown",
          presenceEvents: [],
          source: "manual",
          declaredServices: [],
          capabilities: [],
          limitations: [],
          batteryLevel: null,
          measured: {},
          firstSeen: NOW,
          lastSeen: NOW,
        },
      ],
    };
    expect(deviceBriefLines(withPrinter).join("\n")).toContain("Shop printer");
    expect(deviceBriefLines(withPrinter).join("\n")).toContain("control is NOT granted");
  });
});
