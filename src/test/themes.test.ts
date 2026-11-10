import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getThemeAccent,
  getThemePalette,
  loadThemePreference,
  saveThemePreference,
  THEMES,
} from "@/avatar/themes";

afterEach(() => vi.unstubAllGlobals());

describe("avatar color themes", () => {
  it("provides at least eight named palettes", () => {
    expect(Object.keys(THEMES).length).toBeGreaterThanOrEqual(8);
    for (const palette of Object.values(THEMES)) {
      expect(palette.a).toHaveLength(3);
      expect(palette.b).toHaveLength(3);
      expect(palette.core).toHaveLength(3);
      expect(palette.vein).toHaveLength(3);
    }
  });

  it("applies a valid custom color to particles, glow, core, and UI accent", () => {
    const palette = getThemePalette("custom", "#ff0000");
    expect(palette.a).toEqual([1, 0, 0]);
    expect(palette.core).toEqual([1, 0, 0]);
    expect(palette.vein).toEqual([0.82, 0, 0]);
    expect(getThemeAccent("custom", "#ff0000")).toBe("#ff0000");
  });

  it("saves the selected theme locally and safely restores it", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });

    saveThemePreference({ theme: "black-gold", customColor: "#aabbcc" });

    expect(loadThemePreference()).toEqual({ theme: "black-gold", customColor: "#aabbcc" });
  });
});
