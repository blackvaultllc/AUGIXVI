import { describe, expect, it } from "vitest";
import {
  ANATOMY_LINKS,
  ANATOMY_NODES,
  loadConfigVersions,
  restoreConfigVersion,
  saveConfigVersion,
} from "@/avatar/anatomy";
import { defaultSettings, loadAvatarSettings } from "@/avatar/settings";

/**
 * PART 17 — the anatomy map is complete structure (every link lands
 * on a real node), and config versions save/sanitize/restore
 * through the same persistence as the settings themselves.
 */

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

describe("anatomy map structure", () => {
  it("every link connects two real nodes, and the core is on the map", () => {
    const ids = new Set(ANATOMY_NODES.map((n) => n.id));
    expect(ids.has("core")).toBe(true);
    for (const link of ANATOMY_LINKS) {
      expect(ids.has(link.from)).toBe(true);
      expect(ids.has(link.to)).toBe(true);
    }
  });
});

describe("config versions", () => {
  it("saves a snapshot, clamps junk values, and restores it as current", () => {
    const storage = memoryStorage();
    const settings = { ...defaultSettings(), bloom: 1.4, theme: "gold" as const };
    const versions = saveConfigVersion("Demo day", settings, 1234, storage);
    expect(versions).toHaveLength(1);
    expect(loadConfigVersions(storage)[0]?.name).toBe("Demo day");

    expect(restoreConfigVersion("Demo day", storage)).toBe(true);
    const current = loadAvatarSettings(storage);
    expect(current.bloom).toBe(1.4);
    expect(current.theme).toBe("gold");
    expect(restoreConfigVersion("no such version", storage)).toBe(false);
  });

  it("saving the same name replaces it instead of duplicating", () => {
    const storage = memoryStorage();
    saveConfigVersion("A", defaultSettings(), 1, storage);
    const versions = saveConfigVersion("A", { ...defaultSettings(), bloom: 0.5 }, 2, storage);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.settings.bloom).toBe(0.5);
  });
});
