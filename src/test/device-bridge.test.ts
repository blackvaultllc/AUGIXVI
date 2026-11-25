import { describe, expect, it, vi } from "vitest";
import {
  resolveDeviceSender,
  resolveSenderPath,
  sanitizeDeviceBridgeRequest,
  senderArgsForDeviceFrame,
} from "@/avatar/devices/deviceBridge";
import { runDeviceFrame } from "@/avatar/devices/deviceBridge.server";
import {
  emptyDeviceCoreState,
  seedDeviceCoreState,
  WEPWAWET_DEVICE_ID,
} from "@/avatar/devices/deviceStoreCore";
import { createParrotBroadcastChannel } from "@/avatar/devices/commandModule";
import {
  framesForBroadcastCommand,
  payloadHex,
} from "@/avatar/devices/wepwawetFrame";
import { senderArgsForFrame } from "@/avatar/devices/wepwawetBridge";
import { WEPWAWET_DOG_PROFILE } from "@/avatar/devices/commandProfiles";

/**
 * THE GENERALIZED DEVICE BRIDGE (2026-11-24, plan item D) — the
 * dog's door, opened to every registered broadcast device. The
 * pins: the sender path is fenced to ~/augie-tools/; --live rides
 * only on a live request (without it the sender cannot transmit);
 * the kill switches close the door; and the dog's frames through
 * the general bridge are BYTE-IDENTICAL to the dog door's.
 */

const HOME = "/home/captain";
const A_FRAME = "00".repeat(23);

describe("sanitizeDeviceBridgeRequest", () => {
  it("accepts a device id, one exact frame, its hold, and the live flag", () => {
    expect(
      sanitizeDeviceBridgeRequest({ deviceId: "wepwawet", hex: A_FRAME, holdMs: 500, live: true }),
    ).toEqual({ deviceId: "wepwawet", hex: A_FRAME, holdMs: 500, live: true });
  });

  it("refuses a missing device id and a wrong-length frame", () => {
    expect(sanitizeDeviceBridgeRequest({ hex: A_FRAME, holdMs: 500, live: false })).toBeNull();
    expect(
      sanitizeDeviceBridgeRequest({ deviceId: "wepwawet", hex: "abcd", holdMs: 500, live: false }),
    ).toBeNull();
  });

  it("live is true ONLY when the body says exactly true", () => {
    expect(
      sanitizeDeviceBridgeRequest({ deviceId: "d", hex: A_FRAME, holdMs: 500, live: "yes" })?.live,
    ).toBe(false);
    expect(
      sanitizeDeviceBridgeRequest({ deviceId: "d", hex: A_FRAME, holdMs: 500 })?.live,
    ).toBe(false);
  });
});

describe("the sender allowlist — ~/augie-tools/ or nothing", () => {
  it("resolves a profile-relative sender under the fence", () => {
    expect(resolveSenderPath(HOME, "wepwawet/wepwawet-send.py")).toBe(
      "/home/captain/augie-tools/wepwawet/wepwawet-send.py",
    );
  });

  it("accepts an absolute path already inside the fence", () => {
    expect(resolveSenderPath(HOME, "/home/captain/augie-tools/x/send.py")).toBe(
      "/home/captain/augie-tools/x/send.py",
    );
  });

  it("refuses escapes, absolutes outside the fence, and empty paths", () => {
    expect(resolveSenderPath(HOME, "../outside.py")).toBeNull();
    expect(resolveSenderPath(HOME, "wepwawet/../../etc/evil.py")).toBeNull();
    expect(resolveSenderPath(HOME, "/etc/passwd")).toBeNull();
    expect(resolveSenderPath(HOME, "/home/captain/other/send.py")).toBeNull();
    expect(resolveSenderPath(HOME, "")).toBeNull();
  });
});

describe("sender args — the live flag is the whole safety shape", () => {
  it("--live rides only when the request is live", () => {
    const path = "/home/captain/augie-tools/wepwawet/wepwawet-send.py";
    const dry = senderArgsForDeviceFrame(path, { hex: A_FRAME, holdMs: 500, live: false });
    expect(dry).not.toContain("--live");
    const live = senderArgsForDeviceFrame(path, { hex: A_FRAME, holdMs: 500, live: true });
    expect(live[live.length - 1]).toBe("--live");
  });

  it("the general bridge's args equal the dog door's args for the same frame", () => {
    const path = "/home/captain/augie-tools/wepwawet/wepwawet-send.py";
    const req = { hex: A_FRAME, holdMs: 3000, live: true };
    expect(senderArgsForDeviceFrame(path, req)).toEqual(senderArgsForFrame(path, req));
  });
});

describe("resolveDeviceSender", () => {
  it("the dog resolves to his staged sender from the seed state", () => {
    const resolved = resolveDeviceSender(seedDeviceCoreState(), WEPWAWET_DEVICE_ID, HOME);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.senderPath).toBe("/home/captain/augie-tools/wepwawet/wepwawet-send.py");
      expect(resolved.profile.id).toBe(WEPWAWET_DOG_PROFILE.id);
    }
  });

  it("an unknown device is refused in words", () => {
    const resolved = resolveDeviceSender(emptyDeviceCoreState(), "nope", HOME);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.status).toBe(404);
  });

  it("a profile whose sender escapes the fence is refused", () => {
    const state = seedDeviceCoreState();
    state.profiles = [
      {
        ...WEPWAWET_DOG_PROFILE,
        id: "evil-broadcast",
        senderPath: "../../etc/evil.py",
        builtin: false,
      },
    ];
    state.registry = [
      { ...state.registry[0]!, id: "evil-1" },
    ];
    state.bindings = {
      "evil-1": { deviceId: "evil-1", profileId: "evil-broadcast", address: "" },
    };
    const resolved = resolveDeviceSender(state, "evil-1", HOME);
    expect(resolved.ok).toBe(false);
  });
});

describe("runDeviceFrame", () => {
  const req = { deviceId: WEPWAWET_DEVICE_ID, hex: A_FRAME, holdMs: 500, live: false };

  it("runs the resolved sender and returns its words", async () => {
    const seen: string[] = [];
    const run = await runDeviceFrame(req, {
      env: { HOME },
      state: seedDeviceCoreState(),
      senderRunner: async (senderPath) => {
        seen.push(senderPath);
        return "DRY RUN — printed";
      },
    });
    expect(run).toEqual({ ok: true, mode: "dry", output: "DRY RUN — printed" });
    expect(seen).toEqual(["/home/captain/augie-tools/wepwawet/wepwawet-send.py"]);
  });

  it("the kill switches close the door", async () => {
    const off = await runDeviceFrame(req, {
      env: { HOME, DEVICE_BRIDGE: "off" },
      state: seedDeviceCoreState(),
      senderRunner: async () => "never",
    });
    expect(off.ok).toBe(false);
    const dogOff = await runDeviceFrame(req, {
      env: { HOME, WEPWAWET_BRIDGE: "off" },
      state: seedDeviceCoreState(),
      senderRunner: async () => "never",
    });
    expect(dogOff.ok).toBe(false);
    if (!dogOff.ok) expect(dogOff.error).toContain("WEPWAWET_BRIDGE=off");
  });

  it("an unknown device never reaches a sender", async () => {
    const runner = vi.fn(async () => "never");
    const run = await runDeviceFrame(
      { ...req, deviceId: "ghost" },
      { env: { HOME }, state: seedDeviceCoreState(), senderRunner: runner },
    );
    expect(run.ok).toBe(false);
    expect(runner).not.toHaveBeenCalled();
  });
});

describe("the dog through the general door — byte-identical frames", () => {
  it("the bridge channel posts the encoder's exact bytes under the device id", async () => {
    const calls: { url: string; body: { deviceId?: string; hex: string; holdMs: number; live: boolean } }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: { body?: string }) => {
        calls.push({
          url: String(url),
          body: JSON.parse(init?.body ?? "{}") as (typeof calls)[number]["body"],
        });
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, mode: "dry", output: "printed" }),
        };
      }),
    );
    const stop = WEPWAWET_DOG_PROFILE.commands.find((c) => c.id === "stop")!;
    if (stop.payload.kind !== "ble-broadcast") throw new Error("stop must be a broadcast frame");
    const expected = framesForBroadcastCommand(stop.payload);
    const channel = createParrotBroadcastChannel({ live: false, deviceId: WEPWAWET_DEVICE_ID });
    for (const frame of expected) {
      await channel.advertise(frame.payload, frame.holdMs);
    }
    expect(calls.map((c) => c.url)).toEqual(["/api/devices/bridge", "/api/devices/bridge"]);
    expect(calls.map((c) => c.body.deviceId)).toEqual([WEPWAWET_DEVICE_ID, WEPWAWET_DEVICE_ID]);
    expect(calls.map((c) => c.body.hex)).toEqual(
      expected.map((f) => payloadHex(f.payload).replace(/ /g, "")),
    );
    expect(calls.map((c) => c.body.holdMs)).toEqual(expected.map((f) => f.holdMs));
    vi.unstubAllGlobals();
  });
});
