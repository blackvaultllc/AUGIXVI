import { describe, expect, it } from "vitest";
import {
  SETTINGS_META_KEY,
  SETTINGS_STORAGE_KEY,
  defaultSettings,
  hasSavedAvatarSettings,
  loadAvatarSettings,
  loadAvatarSettingsUpdatedAt,
  sanitizeAvatarSettings,
  saveAvatarSettings,
  saveAvatarSettingsUpdatedAt,
  type AvatarSettings,
} from "@/avatar/settings";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

const HIS_CONFIGURATION: AvatarSettings = {
  maxParticles: 60_000,
  bloom: 0,
  glitch: 0.15,
  theme: "purple",
  customColor: "#22c55e",
  sensitivity: 1.1,
  cooldownMs: 650,
  backdropImage: null,
  backdropFit: "contain" as const,
  backdropSynced: false,
};

describe("settings persistence — close it, open it, it's still his", () => {
  it("a fresh profile defaults bloom to OFF (his standing complaint)", () => {
    const storage = new MemoryStorage();
    expect(loadAvatarSettings(storage).bloom).toBe(0);
    expect(defaultSettings().bloom).toBe(0);
  });

  it("bloom turned OFF stays OFF across a reload — the named case", () => {
    const storage = new MemoryStorage();
    saveAvatarSettings(HIS_CONFIGURATION, storage);
    const reloaded = loadAvatarSettings(storage);
    expect(reloaded.bloom).toBe(0);
    expect(reloaded).toEqual(HIS_CONFIGURATION);
  });

  it("his colors stay his colors across a reload (green custom, purple theme)", () => {
    const storage = new MemoryStorage();
    saveAvatarSettings(HIS_CONFIGURATION, storage);
    const reloaded = loadAvatarSettings(storage);
    expect(reloaded.theme).toBe("purple");
    expect(reloaded.customColor).toBe("#22c55e");
  });

  it("saving stamps the saved-at time; an account apply can restamp it", () => {
    const storage = new MemoryStorage();
    expect(hasSavedAvatarSettings(storage)).toBe(false);
    expect(loadAvatarSettingsUpdatedAt(storage)).toBeNull();
    const before = Date.now();
    saveAvatarSettings(HIS_CONFIGURATION, storage);
    expect(hasSavedAvatarSettings(storage)).toBe(true);
    const stamped = loadAvatarSettingsUpdatedAt(storage);
    expect(stamped).not.toBeNull();
    expect(stamped!).toBeGreaterThanOrEqual(before);
    expect(stamped!).toBeLessThanOrEqual(Date.now());
    saveAvatarSettingsUpdatedAt(123_456, storage);
    expect(loadAvatarSettingsUpdatedAt(storage)).toBe(123_456);
    expect(storage.getItem(SETTINGS_META_KEY)).toContain("123456");
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toContain('"bloom":0');
  });

  it("sanitize clamps out-of-range values and rejects junk — local and account copies alike", () => {
    const cleaned = sanitizeAvatarSettings({
      maxParticles: 9_999_999,
      bloom: 99,
      glitch: -4,
      theme: "not-a-theme",
      customColor: "green",
      sensitivity: 0,
      cooldownMs: 60_000,
    });
    expect(cleaned.maxParticles).toBe(200_000);
    expect(cleaned.bloom).toBe(2.5);
    expect(cleaned.glitch).toBe(0);
    expect(cleaned.theme).toBe("cyan");
    expect(cleaned.customColor).toBe("#22d3ee");
    expect(cleaned.sensitivity).toBe(0.1);
    expect(cleaned.cooldownMs).toBe(5_000);
    expect(sanitizeAvatarSettings(null)).toEqual(defaultSettings());
    expect(sanitizeAvatarSettings("junk")).toEqual(defaultSettings());
  });
});
