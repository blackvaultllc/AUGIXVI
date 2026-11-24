import { describe, expect, it } from "vitest";
import {
  bridgeClientAllowed,
  sanitizeBridgeRequest,
  senderArgsForFrame,
} from "@/avatar/devices/wepwawetBridge";
import { payloadHex, zeroPayload } from "@/avatar/devices/wepwawetFrame";

/**
 * WEPWAWET BRIDGE — the contract between the Devices panel and the
 * Parrot's staged sender. These pins hold the door's shape: one
 * exact frame or nothing, his own networks or nothing, and --live
 * present ONLY when the request is live (the sender cannot transmit
 * without it — that flag is the whole safety shape).
 */

const A_FRAME = payloadHex(zeroPayload()).replace(/ /g, "");

describe("sanitizeBridgeRequest", () => {
  it("accepts one exact frame, its hold, and the live flag", () => {
    expect(sanitizeBridgeRequest({ hex: A_FRAME, holdMs: 500, live: false })).toEqual({
      hex: A_FRAME,
      holdMs: 500,
      live: false,
    });
    expect(sanitizeBridgeRequest({ hex: A_FRAME, holdMs: 3000, live: true })?.live).toBe(true);
  });

  it("tolerates spaced hex and reads a missing hold as 500", () => {
    const spaced = payloadHex(zeroPayload());
    expect(sanitizeBridgeRequest({ hex: spaced, live: false })).toEqual({
      hex: A_FRAME,
      holdMs: 500,
      live: false,
    });
  });

  it("clamps the hold into the sender's safe band", () => {
    expect(sanitizeBridgeRequest({ hex: A_FRAME, holdMs: 5, live: false })?.holdMs).toBe(50);
    expect(sanitizeBridgeRequest({ hex: A_FRAME, holdMs: 99999, live: false })?.holdMs).toBe(10000);
  });

  it("refuses anything that is not one exact frame", () => {
    expect(sanitizeBridgeRequest(null)).toBeNull();
    expect(sanitizeBridgeRequest({})).toBeNull();
    expect(sanitizeBridgeRequest({ hex: "abcd", live: false })).toBeNull();
    expect(sanitizeBridgeRequest({ hex: `${A_FRAME}00`, live: false })).toBeNull();
    expect(sanitizeBridgeRequest({ hex: 42, live: false })).toBeNull();
    // live is never read as truthy-anything: only the boolean true is live.
    expect(sanitizeBridgeRequest({ hex: A_FRAME, live: "yes" })?.live).toBe(false);
  });
});

describe("bridgeClientAllowed", () => {
  it("allows this machine, the tailnet, and private LANs", () => {
    for (const ip of [
      "127.0.0.1",
      "::1",
      "::ffff:127.0.0.1",
      "100.67.177.55", // the Parrot's own tailnet address shape
      "100.101.3.9",
      "192.168.1.40",
      "10.0.0.8",
      "172.16.4.4",
    ]) {
      expect(bridgeClientAllowed(ip)).toBe(true);
    }
  });

  it("refuses public addresses and garbage", () => {
    for (const ip of ["8.8.8.8", "203.0.113.7", "172.32.0.1", "100.128.0.1", "", "banana"]) {
      expect(bridgeClientAllowed(ip)).toBe(false);
    }
    expect(bridgeClientAllowed(null)).toBe(false);
    expect(bridgeClientAllowed(undefined)).toBe(false);
  });
});

describe("senderArgsForFrame", () => {
  it("builds an argv array — the hex is data, never a shell string", () => {
    const args = senderArgsForFrame("/home/x/wepwawet-send.py", {
      hex: A_FRAME,
      holdMs: 500,
      live: false,
    });
    expect(args).toEqual(["/home/x/wepwawet-send.py", "--air-frame", A_FRAME, "--hold", "500"]);
  });

  it("--live rides ONLY on a live request", () => {
    const dry = senderArgsForFrame("/s.py", { hex: A_FRAME, holdMs: 500, live: false });
    const live = senderArgsForFrame("/s.py", { hex: A_FRAME, holdMs: 500, live: true });
    expect(dry).not.toContain("--live");
    expect(live).toContain("--live");
  });
});
