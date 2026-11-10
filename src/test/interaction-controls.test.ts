import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadClearScreenPreference,
  loadSilentModePreference,
  parseInteractionCommand,
  saveClearScreenPreference,
  saveSilentModePreference,
} from "@/avatar/interactionControls";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("voice and focus controls", () => {
  it("recognizes focus controls and wake calls with trailing commands", () => {
    expect(parseInteractionCommand("clear screen")).toEqual({ type: "clear-screen" });
    expect(parseInteractionCommand("show controls")).toEqual({ type: "show-screen" });
    expect(parseInteractionCommand("Hey Osiris, walk around")).toEqual({
      type: "wake",
      remainder: "walk around",
    });
    expect(parseInteractionCommand("Osiris")).toEqual({ type: "wake", remainder: "" });
  });

  it("recognizes silence instructions without treating normal commands as silence", () => {
    expect(parseInteractionCommand("I'll talk to you in a minute")).toEqual({ type: "silence" });
    expect(parseInteractionCommand("Don't talk again until I say your name")).toEqual({
      type: "silence",
    });
    expect(parseInteractionCommand("walk")).toBeNull();
  });

  it("persists focus and silence preferences on this device", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });

    expect(loadClearScreenPreference()).toBe(false);
    expect(loadSilentModePreference()).toBe(true);
    saveClearScreenPreference(true);
    saveSilentModePreference(false);
    expect(loadClearScreenPreference()).toBe(true);
    expect(loadSilentModePreference()).toBe(false);
  });
});
