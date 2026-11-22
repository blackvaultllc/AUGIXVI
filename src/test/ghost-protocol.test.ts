import { describe, expect, it } from "vitest";
import { buildScanState, mergePresentNetworks } from "@/avatar/devices/wifiWatch";
import {
  ghostTokensMatch,
  isPrivateOrTailnetIp,
} from "@/avatar/devices/ghostPairing.server";

/**
 * GHOST PROTOCOL ONE core side (Part 23) — the phone as a second
 * scanner: its sightings merge into scan-state without ever touching
 * the Parrot watcher's own report, and the phone's door opens only
 * for the owner's network + the pairing token.
 */
describe("phone sightings merge into scan-state", () => {
  const now = 1_000_000;

  it("unions both scanners and keeps the stronger rssi per SSID", () => {
    const state = buildScanState(
      {
        watchlist: ["SOFTISH-1851", "HOME-NET"],
        sightings: { at: now - 1_000, tool: "nmcli", networks: [{ ssid: "HOME-NET", rssi: -60 }] },
        phoneSightings: {
          at: now - 2_000,
          tool: "ghost-protocol-one",
          networks: [
            { ssid: "SOFTISH-1851", rssi: -70 },
            { ssid: "HOME-NET", rssi: -45 },
          ],
        },
        lastScanAt: now - 1_000,
        tool: "nmcli",
      },
      now,
    );
    expect(state.networks).toEqual(
      expect.arrayContaining([
        { ssid: "SOFTISH-1851", rssi: -70 },
        { ssid: "HOME-NET", rssi: -45 },
      ]),
    );
    expect(state.networks).toHaveLength(2);
  });

  it("a stale phone report contributes nothing — disappearance is a conclusion", () => {
    const state = buildScanState(
      {
        watchlist: ["SOFTISH-1851"],
        sightings: { at: now - 1_000, tool: "nmcli", networks: [] },
        phoneSightings: {
          at: now - 200_000,
          tool: "ghost-protocol-one",
          networks: [{ ssid: "SOFTISH-1851", rssi: -70 }],
        },
        lastScanAt: now - 1_000,
        tool: "nmcli",
      },
      now,
    );
    expect(state.networks).toEqual([]);
  });

  it("mergePresentNetworks keeps an rssi over a missing one", () => {
    expect(mergePresentNetworks([{ ssid: "A" }], [{ ssid: "A", rssi: -80 }])).toEqual([
      { ssid: "A", rssi: -80 },
    ]);
  });
});

describe("the phone door: network + token", () => {
  it("accepts LAN and tailnet addresses only", () => {
    expect(isPrivateOrTailnetIp("192.168.1.20")).toBe(true);
    expect(isPrivateOrTailnetIp("10.0.0.79")).toBe(true);
    expect(isPrivateOrTailnetIp("100.67.177.55")).toBe(true); // the Parrot's tailnet address class
    expect(isPrivateOrTailnetIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrTailnetIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrTailnetIp("100.128.0.1")).toBe(false); // outside the /10 tailnet range
    expect(isPrivateOrTailnetIp("")).toBe(false);
  });

  it("tokens must match exactly and be at least the minimum length", () => {
    expect(ghostTokensMatch("abcd1234efgh", "abcd1234efgh")).toBe(true);
    expect(ghostTokensMatch("abcd1234efgh", "abcd1234efgx")).toBe(false);
    expect(ghostTokensMatch("abcd1234efgh", null)).toBe(false);
    expect(ghostTokensMatch("short", "short")).toBe(false);
  });
});
