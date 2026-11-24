import { describe, expect, it } from "vitest";
import {
  WEPWAWET_DOG_PROFILE,
  WEPWAWET_SOUND_TRIGGER_IDS,
} from "@/avatar/devices/commandProfiles";
import {
  addBatteryEntry,
  batteryModeLabel,
  loadBatteryLog,
  loadSoundOff,
  removeBatteryEntry,
  saveSoundOff,
} from "@/avatar/devices/wepwawetCard";

/**
 * WEPWAWET CARD STATE — the Captain's sound picks and battery log
 * (owner orders 2026-11-24). The store is his notebook: picks and
 * watched runs only, sanitized on the way in, and the battery log
 * never carries a figure nobody measured.
 */

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe("wepwawet sound picks", () => {
  it("default to all-use and round-trip a Never use pick", () => {
    const storage = fakeStorage();
    expect(loadSoundOff(storage)).toEqual({});
    saveSoundOff({ song: true }, storage);
    expect(loadSoundOff(storage)).toEqual({ song: true });
  });

  it("drops malformed stored values instead of trusting them", () => {
    const storage = fakeStorage();
    storage.setItem("augie.wepwawet.soundOff.v1", JSON.stringify({ song: "yes", dance: true }));
    expect(loadSoundOff(storage)).toEqual({ dance: true });
    storage.setItem("augie.wepwawet.soundOff.v1", "not json");
    expect(loadSoundOff(storage)).toEqual({});
  });

  it("every pick-list trigger is a real command on the profile", () => {
    const ids = new Set(WEPWAWET_DOG_PROFILE.commands.map((c) => c.id));
    for (const id of WEPWAWET_SOUND_TRIGGER_IDS) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("the Music step is the protocol's D3=1 frame", () => {
    const music = WEPWAWET_DOG_PROFILE.commands.find((c) => c.id === "music");
    expect(music).toBeTruthy();
    expect(music!.payload).toEqual({
      kind: "ble-broadcast",
      cmd: 0xe0,
      data: [0, 0, 0, 1, 0],
      holdMs: 500,
    });
  });
});

describe("wepwawet battery log", () => {
  it("starts empty — no figure exists until a run is watched and timed", () => {
    expect(loadBatteryLog(fakeStorage())).toEqual([]);
  });

  it("adds, labels, and removes a watched run", () => {
    const storage = fakeStorage();
    const after = addBatteryEntry(
      { at: "2026-11-24", mode: "patrol", minutes: 47, note: "living room" },
      storage,
    );
    expect(after.length).toBe(1);
    expect(after[0]).toMatchObject({ at: "2026-11-24", mode: "patrol", minutes: 47 });
    expect(batteryModeLabel(after[0]!.mode)).toBe("Walking patrol");
    expect(removeBatteryEntry(after[0]!.id, storage)).toEqual([]);
    expect(loadBatteryLog(storage)).toEqual([]);
  });

  it("refuses impossible runs — a zero or negative time is not a measurement", () => {
    const storage = fakeStorage();
    expect(addBatteryEntry({ at: "2026-11-24", mode: "idle", minutes: 0 }, storage)).toEqual([]);
    expect(addBatteryEntry({ at: "2026-11-24", mode: "idle", minutes: -5 }, storage)).toEqual([]);
  });

  it("sanitizes stored entries — unknown modes and bad dates fall out", () => {
    const storage = fakeStorage();
    storage.setItem(
      "augie.wepwawet.batteryLog.v1",
      JSON.stringify([
        { id: "a", at: "2026-11-24", mode: "idle", minutes: 30 },
        { id: "b", at: "yesterday", mode: "idle", minutes: 30 },
        { id: "c", at: "2026-11-24", mode: "flying", minutes: 30 },
        { id: "d", at: "2026-11-24", mode: "lights", minutes: "long" },
      ]),
    );
    const log = loadBatteryLog(storage);
    expect(log.length).toBe(1);
    expect(log[0]!.id).toBe("a");
  });
});
