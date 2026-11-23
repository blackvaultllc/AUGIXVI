import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  CONSTRUCT_ANCHOR_STORAGE_KEY,
  FIGURE_HOME,
  FIGURE_OFFSET_LIMITS,
  FULL_BODY_HOLD_STORAGE_KEY,
  OSIRIS_POSITION_STORAGE_KEY,
  clampFigureOffset,
  clearFigureOffset,
  loadConstructAnchored,
  loadFigureOffset,
  loadFullBodyHold,
  saveConstructAnchored,
  saveFigureOffset,
  saveFullBodyHold,
} from "@/avatar/osirisPosition";
import { parseSceneCommand, sceneLine } from "@/avatar/worldScenes";
import { WorldSceneManager } from "@/avatar/worldSceneRenderer";

/**
 * THE STAGE REDESIGN (owner order 2026-11-22): the white Room as the
 * default stage, Anubis at command, and Osiris movable. These tests
 * pin the plain-data half — his saved spot, its clamp, the Room's
 * command words, and the Room's surface set on the stage.
 */

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  };
}

describe("Osiris's spot — the drag's saved offset", () => {
  it("starts at home: nothing saved, nothing loaded", () => {
    const storage = fakeStorage();
    expect(loadFigureOffset(storage)).toBeNull();
    expect(FIGURE_HOME).toEqual({ x: 0, y: 0 });
  });

  it("round-trips a dragged spot through storage", () => {
    const storage = fakeStorage();
    saveFigureOffset({ x: 2.25, y: -1.5 }, storage);
    expect(storage.map.get(OSIRIS_POSITION_STORAGE_KEY)).toBeDefined();
    expect(loadFigureOffset(storage)).toEqual({ x: 2.25, y: -1.5 });
  });

  it("clamps every direction to the frame, on save and on load", () => {
    expect(clampFigureOffset({ x: 99, y: 99 })).toEqual({
      x: FIGURE_OFFSET_LIMITS.x,
      y: FIGURE_OFFSET_LIMITS.up,
    });
    expect(clampFigureOffset({ x: -99, y: -99 })).toEqual({
      x: -FIGURE_OFFSET_LIMITS.x,
      y: -FIGURE_OFFSET_LIMITS.down,
    });
    const storage = fakeStorage();
    storage.setItem(OSIRIS_POSITION_STORAGE_KEY, JSON.stringify({ x: 42, y: -42 }));
    expect(loadFigureOffset(storage)).toEqual({
      x: FIGURE_OFFSET_LIMITS.x,
      y: -FIGURE_OFFSET_LIMITS.down,
    });
  });

  it("sending him home forgets the spot entirely", () => {
    const storage = fakeStorage();
    saveFigureOffset({ x: 1, y: 1 }, storage);
    clearFigureOffset(storage);
    expect(loadFigureOffset(storage)).toBeNull();
  });

  it("a corrupt saved spot reads as home, never as a crash", () => {
    const storage = fakeStorage();
    storage.setItem(OSIRIS_POSITION_STORAGE_KEY, "{not json");
    expect(loadFigureOffset(storage)).toBeNull();
    storage.setItem(OSIRIS_POSITION_STORAGE_KEY, JSON.stringify({ x: "left", y: 1 }));
    expect(loadFigureOffset(storage)).toBeNull();
    storage.setItem(OSIRIS_POSITION_STORAGE_KEY, JSON.stringify(null));
    expect(loadFigureOffset(storage)).toBeNull();
  });

  it("a missing store is a quiet no-op in every direction", () => {
    expect(loadFigureOffset(null)).toBeNull();
    expect(() => saveFigureOffset({ x: 1, y: 1 }, null)).not.toThrow();
    expect(() => clearFigureOffset(null)).not.toThrow();
  });
});

describe("AUGI's anchor — the construct law", () => {
  it("starts anchored: set into the stage and free", () => {
    const storage = fakeStorage();
    expect(loadConstructAnchored(storage)).toBe(true);
    expect(loadConstructAnchored(null)).toBe(true);
  });

  it("round-trips the held-for-fixing state", () => {
    const storage = fakeStorage();
    saveConstructAnchored(false, storage);
    expect(storage.map.get(CONSTRUCT_ANCHOR_STORAGE_KEY)).toBe("unanchored");
    expect(loadConstructAnchored(storage)).toBe(false);
    saveConstructAnchored(true, storage);
    expect(loadConstructAnchored(storage)).toBe(true);
  });

  it("anything but the explicit 'unanchored' reads as anchored", () => {
    const storage = fakeStorage();
    storage.setItem(CONSTRUCT_ANCHOR_STORAGE_KEY, "garbage");
    expect(loadConstructAnchored(storage)).toBe(true);
  });
});

describe("AUGI's full-body hold (defect fix 2026-11-22)", () => {
  it("defaults to NOT held — companion size is the default presentation", () => {
    const storage = fakeStorage();
    expect(loadFullBodyHold(storage)).toBe(false);
    expect(loadFullBodyHold(null)).toBe(false);
  });

  it("round-trips the thrown hold across a reload", () => {
    const storage = fakeStorage();
    saveFullBodyHold(true, storage);
    expect(storage.map.get(FULL_BODY_HOLD_STORAGE_KEY)).toBe("full");
    expect(loadFullBodyHold(storage)).toBe(true);
    saveFullBodyHold(false, storage);
    expect(loadFullBodyHold(storage)).toBe(false);
  });

  it("anything but the explicit 'full' reads as not held", () => {
    const storage = fakeStorage();
    storage.setItem(FULL_BODY_HOLD_STORAGE_KEY, "garbage");
    expect(loadFullBodyHold(storage)).toBe(false);
  });
});

describe("the Room — command words", () => {
  it("routes the room by its own words", () => {
    expect(parseSceneCommand("room")).toBe("room");
    expect(parseSceneCommand("room scene")).toBe("room");
    expect(parseSceneCommand("white room")).toBe("room");
    expect(parseSceneCommand("take me to the room")).toBe("room");
    expect(parseSceneCommand("show me the white room")).toBe("room");
    expect(sceneLine("room").length).toBeGreaterThan(0);
  });
});

describe("the Room — on the stage", () => {
  it("stands its surfaces and no citizens, and leaves cleanly", () => {
    const scene = new THREE.Scene();
    const manager = new WorldSceneManager(scene);
    manager.setScene("room");
    expect(manager.currentScene).toBe("room");
    expect(manager.citizenCount).toBe(0);
    expect(manager.particleCount).toBe(0);
    const set = scene.getObjectByName("living-world-room");
    expect(set).toBeDefined();
    // The Room's surfaces (Environment Builder surfaces, 2026-11-22):
    // the solid floor plane + the plain back wall — and NO GRID
    // LINES anywhere in the set (owner decision, same day: "Remove
    // the grid entirely"). No citizens, ever.
    expect(set!.children.length).toBe(2);
    expect(scene.getObjectByName("living-world-room-floor-solid")).toBeDefined();
    expect(scene.getObjectByName("living-world-room-wall")).toBeDefined();
    expect(scene.getObjectByName("living-world-room-floor-grid")).toBeUndefined();
    let gridHelpers = 0;
    set!.traverse((child) => {
      if (child.type === "GridHelper") gridHelpers += 1;
    });
    expect(gridHelpers).toBe(0);

    manager.setScene("office");
    expect(scene.getObjectByName("living-world-room")).toBeUndefined();
    expect(manager.citizenCount).toBe(10);

    manager.dispose();
    expect(scene.children.length).toBe(0);
    expect(manager.currentScene).toBeNull();
  });
});
