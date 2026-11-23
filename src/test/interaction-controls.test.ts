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

  // REGRESSION (owner defect 2026-11-21 — "he's not talking anymore"):
  // the old silence matcher treated the bare word "wait" ANYWHERE in a
  // command as a silence instruction, so an ordinary command like
  // "wait, open the cube" latched silent mode (persisted) and swallowed
  // the command. A silence instruction must BE the instruction.
  it("does not silence on the bare word 'wait' inside an ordinary command", () => {
    expect(parseInteractionCommand("wait, open the cube")).toBeNull();
    expect(parseInteractionCommand("wait a second, what is this?")).toBeNull();
    expect(parseInteractionCommand("open the cube, wait")).toBeNull();
    expect(parseInteractionCommand("hold on, what is this")).toBeNull();
  });

  it("still silences on real silence instructions", () => {
    expect(parseInteractionCommand("stop talking")).toEqual({ type: "silence" });
    expect(parseInteractionCommand("please be quiet")).toEqual({ type: "silence" });
    expect(parseInteractionCommand("wait till I call your name")).toEqual({
      type: "silence",
    });
    expect(parseInteractionCommand("stop answering")).toEqual({ type: "silence" });
  });

  it("persists focus and silence preferences on this device", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });

    expect(loadClearScreenPreference()).toBe(false);
    // Unset silence preference = NOT silent (owner defect 2026-11-22):
    // the old default-true booted every fresh machine muted, so lines
    // printed to the chat but were never spoken and the face never
    // moved. Silence starts only from a saved explicit order.
    expect(loadSilentModePreference()).toBe(false);
    saveClearScreenPreference(true);
    saveSilentModePreference(false);
    expect(loadClearScreenPreference()).toBe(true);
    expect(loadSilentModePreference()).toBe(false);
  });
});
