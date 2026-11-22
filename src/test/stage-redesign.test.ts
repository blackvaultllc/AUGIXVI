import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  FIGURE_HOME,
  FIGURE_OFFSET_LIMITS,
  OSIRIS_POSITION_STORAGE_KEY,
  clampFigureOffset,
  clearFigureOffset,
  loadFigureOffset,
  saveFigureOffset,
} from "@/avatar/osirisPosition";
import { parseSceneCommand, sceneLine } from "@/avatar/worldScenes";
import { WorldSceneManager } from "@/avatar/worldSceneRenderer";

/**
 * THE STAGE REDESIGN (owner order 2026-11-22): the white Room as the
 * default stage, Anubis at command, and Osiris movable. These tests
 * pin the plain-data half — his saved spot, its clamp, the Room's
 * command words, and the Room's grid set on the stage.
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
  it("stands a grid set and no citizens, and leaves cleanly", () => {
    const scene = new THREE.Scene();
    const manager = new WorldSceneManager(scene);
    manager.setScene("room");
    expect(manager.currentScene).toBe("room");
    expect(manager.citizenCount).toBe(0);
    expect(manager.particleCount).toBe(0);
    const set = scene.getObjectByName("living-world-room");
    expect(set).toBeDefined();
    // Floor grid + back-wall grid — two line sets, nothing else.
    expect(set!.children.length).toBe(2);

    manager.setScene("office");
    expect(scene.getObjectByName("living-world-room")).toBeUndefined();
    expect(manager.citizenCount).toBe(10);

    manager.dispose();
    expect(scene.children.length).toBe(0);
    expect(manager.currentScene).toBeNull();
  });
});
