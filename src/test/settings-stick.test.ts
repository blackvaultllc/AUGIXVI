import { describe, expect, it } from "vitest";
import {
  SETTINGS_STORAGE_KEY,
  defaultSettings,
  loadAvatarSettings,
  saveAvatarSettings,
} from "@/avatar/settings";

/**
 * PART 14 — SETTINGS MUST STICK (Domenick, emphatic, 2026-11-21).
 * Two proofs: (1) close/reopen — a value he set comes back exactly;
 * (2) a fresh profile starts with bloom LOW, never blasting.
 */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    map,
  };
}

describe("settings stick (Part 14)", () => {
  it("fresh profile: bloom starts LOW (0 — OFF in the merged settings), not blasting", () => {
    // Merge note (2026-11-22): this line's build defaulted fresh bloom
    // to 0.25; the main line's settings module won the merge and its
    // fresh default is 0 (OFF). The Part 14 contract — fresh starts
    // low/off, saved values win — is what these assertions pin.
    const storage = fakeStorage();
    const fresh = loadAvatarSettings(storage);
    expect(fresh.bloom).toBe(0);
    expect(fresh.bloom).toBeLessThanOrEqual(0.3);
    expect(defaultSettings().bloom).toBe(0);
  });

  it("close/reopen: his saved values come back exactly as he left them", () => {
    const storage = fakeStorage();
    const his = {
      ...defaultSettings(),
      bloom: 0.6,
      glitch: 0.1,
      theme: "gold" as const,
      maxParticles: 42_000,
      sensitivity: 1.4,
      cooldownMs: 250,
    };
    expect(saveAvatarSettings(his, storage)).toBe(true);
    // "Reopen" = a fresh load from the same storage.
    const reopened = loadAvatarSettings(storage);
    expect(reopened).toEqual(his);
  });

  it("his saved bloom wins over the default — a saved 0 stays 0 (bloom off sticks)", () => {
    const storage = fakeStorage();
    saveAvatarSettings({ ...defaultSettings(), bloom: 0 }, storage);
    expect(loadAvatarSettings(storage).bloom).toBe(0);
    saveAvatarSettings({ ...defaultSettings(), bloom: 2 }, storage);
    expect(loadAvatarSettings(storage).bloom).toBe(2);
  });

  it("a partial or older saved profile keeps his values and fills the rest from defaults", () => {
    const storage = fakeStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ bloom: 0.9, theme: "rose" }),
    });
    const loaded = loadAvatarSettings(storage);
    expect(loaded.bloom).toBe(0.9);
    expect(loaded.theme).toBe("rose");
    expect(loaded.maxParticles).toBe(defaultSettings().maxParticles);
  });

  it("corrupt saved data falls back to the (low-bloom) defaults, never to a blast", () => {
    const storage = fakeStorage({ [SETTINGS_STORAGE_KEY]: "{not json" });
    expect(loadAvatarSettings(storage).bloom).toBe(0);
  });
});
