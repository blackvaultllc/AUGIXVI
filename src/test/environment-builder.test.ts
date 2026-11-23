import { describe, expect, it } from "vitest";
import {
  LIBRARY,
  ITEM_SIZES,
  libraryItem,
  totalVariantCount,
  variantCount,
  variantCountLine,
} from "@/avatar/builder/library";
import {
  DEFAULT_SURFACES,
  addItem,
  claimPlot,
  clampRoomPoint,
  defaultLayoutStore,
  emptyRoom,
  exportRoomPackage,
  isHomePlot,
  loadLayoutStore,
  makePlacedItem,
  moveItem,
  parseRoomPackage,
  plotAtPoint,
  plotClaimed,
  removeItem,
  rotateItem,
  saveLayoutStore,
  sanitizeRoom,
  setItemAnchored,
  setSurfaces,
  unclaimPlot,
  updateItemVariant,
  withLayoutRoom,
  type RoomContent,
} from "@/avatar/builder/room";
import {
  describeOffset,
  mapToWorld,
  worldMapExtent,
  worldToMap,
} from "@/avatar/builder/worldMap";
import {
  GAZETTEER,
  formatLatLon,
  markerPosition,
  parseCoordinates,
  resolveLocation,
} from "@/avatar/builder/gazetteer";
import {
  STAGE_FRAMES,
  frameOffset,
  loadFrameStore,
  saveFrameStore,
  snapFramePosition,
  withFrameOffset,
  withoutFrame,
} from "@/avatar/builder/frames";
import { BACKDROPS, backdropById, backdropPlaneSize } from "@/avatar/builder/backdrops";

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

const store = libraryItem("store")!;
const variant = { form: "gable", size: "medium" as const, color: "brick" };

function roomWithItem(anchored = false): RoomContent {
  const item = makePlacedItem("item-1", "store", variant, 1, -1);
  return addItem(emptyRoom(), { ...item, anchored });
}

describe("environment builder — the library's honest count", () => {
  it("counts variants as forms × sizes × colors, summed over the catalog", () => {
    const manual = LIBRARY.reduce(
      (sum, item) => sum + item.forms.length * ITEM_SIZES.length * item.colors.length,
      0,
    );
    expect(totalVariantCount()).toBe(manual);
    expect(variantCount(store)).toBe(store.forms.length * ITEM_SIZES.length * store.colors.length);
  });

  it("honestly reaches the thousands — the printed line shows the math", () => {
    expect(totalVariantCount()).toBeGreaterThanOrEqual(2000);
    expect(variantCountLine()).toContain(String(LIBRARY.length));
    expect(variantCountLine()).toContain(totalVariantCount().toLocaleString("en-US"));
  });

  it("every base has at least two forms and a real palette, so variants render differently", () => {
    for (const item of LIBRARY) {
      expect(item.forms.length).toBeGreaterThanOrEqual(2);
      expect(item.colors.length).toBeGreaterThanOrEqual(4);
      expect(new Set(item.forms.map((entry) => entry.id)).size).toBe(item.forms.length);
      expect(new Set(item.colors.map((entry) => entry.id)).size).toBe(item.colors.length);
    }
  });
});

describe("environment builder — the object anchor law", () => {
  it("an unanchored item moves; an anchored item refuses to move or rotate", () => {
    const free = roomWithItem(false);
    const moved = moveItem(free, "item-1", 3, -2);
    expect(moved.items[0]).toMatchObject({ x: 3, z: -2 });
    expect(rotateItem(free, "item-1", 90).items[0]!.rotation).toBe(90);

    const locked = roomWithItem(true);
    expect(moveItem(locked, "item-1", 5, 0)).toBe(locked);
    expect(rotateItem(locked, "item-1", 45)).toBe(locked);
  });

  it("anchoring and unanchoring flip the lock; removing takes the item out", () => {
    const room = roomWithItem(false);
    const anchored = setItemAnchored(room, "item-1", true);
    expect(anchored.items[0]!.anchored).toBe(true);
    expect(moveItem(anchored, "item-1", 4, 0)).toBe(anchored);
    const freed = setItemAnchored(anchored, "item-1", false);
    expect(moveItem(freed, "item-1", 4, 0).items[0]).toMatchObject({ x: 4, z: 0 });
    expect(removeItem(freed, "item-1").items).toHaveLength(0);
  });

  it("positions clamp to the WORLD's edge — the world grew (owner order 2026-11-23)", () => {
    // This pin used to assert the home plot's framed floor
    // (±10.5, −8.5…2.5). The wider-world round widened the clamp
    // on purpose: pieces now stand anywhere in the world, and the
    // home plot's coordinates did not move — only the fence did.
    expect(clampRoomPoint(99, 99)).toEqual({ x: 99, z: 99 });
    expect(clampRoomPoint(500, 500)).toEqual({ x: 120, z: 120 });
    expect(clampRoomPoint(-500, -500)).toEqual({ x: -120, z: -120 });
    const room = moveItem(roomWithItem(false), "item-1", 500, 500);
    expect(room.items[0]).toMatchObject({ x: 120, z: 120 });
    // …and a piece can now stand far outside the old frame.
    const far = moveItem(roomWithItem(false), "item-1", 40, -60);
    expect(far.items[0]).toMatchObject({ x: 40, z: -60 });
  });
});

describe("environment builder — room surfaces persist like items", () => {
  it("surface choices save and reload through the layout store", () => {
    const storage = fakeStorage();
    let layouts = defaultLayoutStore();
    const surfaces = {
      backdrop: "#101018",
      backdropImage: "egypt-throne",
      // The fit choice rides the layout since the Captain's
      // Whole/Fill order (2026-11-23) — it persists like every
      // other surface choice.
      backdropFit: "contain" as const,
      floor: "#2a4a7a",
      floorStyle: "color" as const,
      floorImage: null,
      wall: "#3a3f4a",
      skyImage: null,
    };
    layouts = withLayoutRoom(layouts, layouts.activeId, setSurfaces(emptyRoom(), surfaces));
    saveLayoutStore(layouts, storage);
    const reloaded = loadLayoutStore(storage);
    expect(reloaded.layouts[0]!.room.surfaces).toEqual(surfaces);
  });

  it("a backdrop picture must come from his own theme registry — unknown ids read as none", () => {
    const room = sanitizeRoom({
      surfaces: { backdrop: "#101018", backdropImage: "not-his-picture", floor: "#2a4a7a", wall: "#3a3f4a" },
      items: [],
    });
    expect(room.surfaces.backdropImage).toBeNull();
    const withArt = sanitizeRoom({
      surfaces: { backdropImage: "egypt-pyramids-planets" },
      items: [],
    });
    expect(withArt.surfaces.backdropImage).toBe("egypt-pyramids-planets");
  });

  it("items and their anchor states survive the same round trip", () => {
    const storage = fakeStorage();
    let layouts = defaultLayoutStore();
    layouts = withLayoutRoom(layouts, layouts.activeId, roomWithItem(true));
    saveLayoutStore(layouts, storage);
    const reloaded = loadLayoutStore(storage);
    expect(reloaded.layouts[0]!.room.items).toHaveLength(1);
    expect(reloaded.layouts[0]!.room.items[0]).toMatchObject({
      baseId: "store",
      form: "gable",
      anchored: true,
      x: 1,
      z: -1,
    });
  });

  it("a corrupt store falls back to the shipped default, never to a crash", () => {
    const storage = fakeStorage();
    storage.setItem("augi.avatar.builder.layouts.v1", "{not json");
    const loaded = loadLayoutStore(storage);
    expect(loaded.layouts).toHaveLength(1);
    expect(loaded.layouts[0]!.room).toEqual(emptyRoom());
    expect(loaded.layouts[0]!.room.surfaces).toEqual(DEFAULT_SURFACES);
  });

  it("sanitize drops unknown bases and repairs bad variants honestly", () => {
    const room = sanitizeRoom({
      surfaces: { backdrop: "not-a-color", floor: "#123456", wall: "#abcdef" },
      items: [
        { id: "ok", baseId: "pine", form: "nope", size: "huge", color: "nope", x: 1, z: 1 },
        { id: "bad", baseId: "does-not-exist", form: "x", size: "medium", color: "x", x: 0, z: 0 },
      ],
    });
    expect(room.items).toHaveLength(1);
    expect(room.items[0]).toMatchObject({ baseId: "pine", form: "cone", size: "medium", color: "pine" });
    expect(room.surfaces.backdrop).toBe(DEFAULT_SURFACES.backdrop);
    expect(room.surfaces.floor).toBe("#123456");
  });
});

describe("environment builder — the portable room package", () => {
  it("exports data-only JSON and imports it back whole (round trip)", () => {
    const layout = {
      id: "den",
      name: "Captain's Den",
      room: setSurfaces(roomWithItem(true), {
        ...DEFAULT_SURFACES,
        backdrop: "#0e1420",
        floor: "#28486e",
        wall: "#5a6a86",
      }),
    };
    const text = exportRoomPackage(layout);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed["kind"]).toBe("augi-room");
    // "plots" joined the package with the wider world (owner order
    // 2026-11-23): a carried-away room keeps the ground he claimed.
    expect(Object.keys(parsed).sort()).toEqual(["items", "kind", "name", "plots", "surfaces", "version"]);
    const back = parseRoomPackage(text);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.name).toBe("Captain's Den");
      expect(back.room).toEqual(layout.room);
    }
  });

  it("refuses text that is not a room package, in words", () => {
    expect(parseRoomPackage("hello").ok).toBe(false);
    expect(parseRoomPackage('{"kind":"something-else","version":1}').ok).toBe(false);
    expect(parseRoomPackage('{"kind":"augi-room","version":99}').ok).toBe(false);
  });
});

describe("environment builder — his theme backdrops", () => {
  it("the registry carries both of his sets, every entry a real shipped file size", () => {
    expect(BACKDROPS.filter((asset) => asset.set === "egyptian")).toHaveLength(12);
    expect(BACKDROPS.filter((asset) => asset.set === "maps")).toHaveLength(10);
    for (const asset of BACKDROPS) {
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
      expect(asset.src.endsWith(".jpg")).toBe(true);
    }
    expect(backdropById("background-1")).toBeNull();
    expect(backdropById("egypt-pyramids-planets")!.name).toBe("Pyramids under the planets");
  });

  it("cover fit: the picture covers the view with its aspect never distorted", () => {
    // Wide picture, squarer view: height rules, width overflows (cropped).
    const wide = backdropPlaneSize({ width: 1600, height: 900 }, 20, 15);
    expect(wide.h).toBe(15);
    expect(wide.w).toBeCloseTo(15 * (1600 / 900));
    expect(wide.w / wide.h).toBeCloseTo(1600 / 900);
    // Square picture, wide view: width rules, height overflows.
    const square = backdropPlaneSize({ width: 474, height: 474 }, 28, 15.7);
    expect(square.w).toBe(28);
    expect(square.h).toBe(28);
    // Both dimensions always cover the view.
    for (const size of [wide, square]) {
      expect(size.w).toBeGreaterThanOrEqual(20);
      expect(size.h).toBeGreaterThanOrEqual(15);
    }
  });
});

describe("environment builder — stage frames (the Movers pattern)", () => {
  it("drag precedence: a saved offset wins; no record means the default spot", () => {
    let store = loadFrameStore(fakeStorage());
    expect(frameOffset(store, "hud-status")).toEqual({ dx: 0, dy: 0, anchored: true });
    store = withFrameOffset(store, "hud-status", { dx: 120, dy: -40, anchored: true });
    expect(frameOffset(store, "hud-status")).toEqual({ dx: 120, dy: -40, anchored: true });
    store = withoutFrame(store, "hud-status");
    expect(frameOffset(store, "hud-status")).toEqual({ dx: 0, dy: 0, anchored: true });
  });

  it("frame offsets persist, and the self-managed command box is never stored here", () => {
    const storage = fakeStorage();
    let store = withFrameOffset({}, "hud-core", { dx: 10, dy: 20, anchored: false });
    store = withFrameOffset(store, "command-box", { dx: 1, dy: 1, anchored: true });
    saveFrameStore(store, storage);
    const loaded = loadFrameStore(storage);
    expect(frameOffset(loaded, "hud-core")).toEqual({ dx: 10, dy: 20, anchored: false });
    expect(loaded["command-box"]).toBeUndefined();
    expect(STAGE_FRAMES.find((frame) => frame.id === "command-box")!.selfManaged).toBe(true);
  });

  it("snaps to the viewport center lines and to other frames' edges, with guides", () => {
    const viewport = { w: 1000, h: 800 };
    const size = { w: 100, h: 50 };
    // Near the horizontal center: the frame's center (x+50) snaps to 500.
    const centered = snapFramePosition({ x: 447, y: 100 }, size, viewport, [], { enabled: true });
    expect(centered.x).toBe(450);
    expect(centered.guides.vertical).toBe(500);
    // Near another frame's right edge (300): the frame's left edge snaps to it.
    const edged = snapFramePosition({ x: 295, y: 100 }, size, viewport, [{ x: 100, y: 0, w: 200, h: 40 }], {
      enabled: true,
    });
    expect(edged.x).toBe(300);
    expect(edged.guides.vertical).toBe(300);
    // Disabled snapping (Alt) leaves the position untouched.
    const free = snapFramePosition({ x: 447, y: 100 }, size, viewport, [], { enabled: false });
    expect(free).toEqual({ x: 447, y: 100, guides: {} });
  });

  it("grid snap rounds to the step after line snapping", () => {
    const snapped = snapFramePosition(
      { x: 123, y: 67 },
      { w: 100, h: 50 },
      { w: 1000, h: 800 },
      [],
      { enabled: false, grid: 25 },
    );
    expect(snapped).toEqual({ x: 125, y: 75, guides: {} });
  });
});

describe("environment builder — variant changes on placed pieces", () => {
  it("a placed piece can change form, size and color — even while anchored", () => {
    let room = roomWithItem(true);
    const id = room.items[0]!.id;
    room = updateItemVariant(room, id, { form: "awning", size: "grand", color: "slate" });
    expect(room.items[0]).toMatchObject({ form: "awning", size: "grand", color: "slate", anchored: true });
  });

  it("a form or color the base does not carry is refused whole", () => {
    const room = roomWithItem(false);
    const id = room.items[0]!.id;
    expect(updateItemVariant(room, id, { form: "castle" })).toBe(room);
    expect(updateItemVariant(room, id, { color: "invisible" })).toBe(room);
    expect(updateItemVariant(room, "no-such-piece", { form: "gable" })).toBe(room);
  });
});

describe("the wider world — claimed ground plots (owner order 2026-11-23)", () => {
  it("plots are indexed from the home origin, and the home plots are the room's own", () => {
    expect(plotAtPoint(0, 0)).toEqual({ x: 0, z: 0 });
    expect(plotAtPoint(10.9, 2.4)).toEqual({ x: 0, z: 0 });
    expect(plotAtPoint(-0.1, -0.1)).toEqual({ x: -1, z: -1 });
    expect(plotAtPoint(25, -30)).toEqual({ x: 2, z: -3 });
    expect(isHomePlot({ x: 0, z: 0 })).toBe(true);
    expect(isHomePlot({ x: -1, z: -1 })).toBe(true);
    expect(isHomePlot({ x: 1, z: 0 })).toBe(false);
    expect(isHomePlot({ x: 0, z: 1 })).toBe(false);
  });

  it("claiming covers a plot once; home plots are never stored; unclaiming takes the cover up", () => {
    let room = emptyRoom();
    room = claimPlot(room, { x: 2, z: -3 });
    expect(room.plots).toEqual([{ x: 2, z: -3 }]);
    expect(claimPlot(room, { x: 2, z: -3 })).toBe(room); // already claimed — no duplicate
    expect(claimPlot(room, { x: 0, z: 0 })).toBe(room); // home — the room itself covers it
    expect(plotClaimed(room, { x: 2, z: -3 })).toBe(true);
    expect(plotClaimed(room, { x: 0, z: -1 })).toBe(true); // home counts as covered
    expect(plotClaimed(room, { x: 5, z: 5 })).toBe(false);
    room = unclaimPlot(room, { x: 2, z: -3 });
    expect(room.plots).toEqual([]);
    expect(unclaimPlot(room, { x: 2, z: -3 })).toBe(room);
  });

  it("claimed plots survive the layout store and the portable package", () => {
    const storage = fakeStorage();
    let layouts = defaultLayoutStore();
    const room = claimPlot(claimPlot(emptyRoom(), { x: 3, z: 1 }), { x: -4, z: -2 });
    layouts = withLayoutRoom(layouts, layouts.activeId, room);
    saveLayoutStore(layouts, storage);
    expect(loadLayoutStore(storage).layouts[0]!.room.plots).toEqual([
      { x: 3, z: 1 },
      { x: -4, z: -2 },
    ]);
    const back = parseRoomPackage(exportRoomPackage({ id: "w", name: "World", room }));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.room.plots).toEqual(room.plots);
  });

  it("sanitize keeps honest plots and drops home plots, duplicates and junk", () => {
    const room = sanitizeRoom({
      items: [],
      plots: [{ x: 2, z: 2 }, { x: 0, z: 0 }, { x: 2, z: 2 }, { x: "far", z: 1 }, null, { x: 2.9, z: -3.2 }],
    });
    expect(room.plots).toEqual([
      { x: 2, z: 2 },
      { x: 2, z: -3 },
    ]);
  });

  it("an old layout with no plots field loads with the world unclaimed, home intact", () => {
    const room = sanitizeRoom({ surfaces: {}, items: [] });
    expect(room.plots).toEqual([]);
    expect(emptyRoom().plots).toEqual([]);
  });
});

describe("the wider world — the world sky (owner order 2026-11-23)", () => {
  it("the sky is a registry picture or nothing — unknown ids read as no sky", () => {
    const room = sanitizeRoom({ surfaces: { skyImage: "egypt-throne" }, items: [] });
    expect(room.surfaces.skyImage).toBe("egypt-throne");
    const bogus = sanitizeRoom({ surfaces: { skyImage: "not-his-sky" }, items: [] });
    expect(bogus.surfaces.skyImage).toBeNull();
    expect(emptyRoom().surfaces.skyImage).toBeNull();
  });
});

describe("the built-world map — framing and projection (owner order 2026-11-23)", () => {
  it("the extent frames home, claims, pieces, inhabitants and the view — padded", () => {
    const room = claimPlot(emptyRoom(), { x: 4, z: 0 });
    const extent = worldMapExtent(room, [{ id: "augi", name: "AUGI", x: -30, z: 5, kind: "construct" }], { x: 0, z: 0 });
    expect(extent.minX).toBeLessThanOrEqual(-34);
    expect(extent.maxX).toBeGreaterThanOrEqual(4 * 11 + 11 + 4 - 1); // the claimed plot's east edge, padded
    expect(extent.minZ).toBeLessThanOrEqual(-21);
    expect(extent.maxZ).toBeGreaterThanOrEqual(21);
  });

  it("world → map → world round-trips, and north reads up", () => {
    const extent = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
    const p = worldToMap(extent, 500, 400, 10, -20);
    expect(mapToWorld(extent, 500, 400, p.px, p.py)).toEqual({ x: 10, z: -20 });
    // North (−z) is a SMALLER py (higher on the map) than south.
    expect(worldToMap(extent, 500, 400, 0, -20).py).toBeLessThan(worldToMap(extent, 500, 400, 0, 20).py);
    expect(worldToMap(extent, 500, 400, -50, -50)).toEqual({ px: 0, py: 0 });
  });

  it("offsets describe in plain words from home", () => {
    expect(describeOffset(0, 0)).toBe("the home plot");
    expect(describeOffset(12, -5)).toBe("12 east, 5 north of home");
    expect(describeOffset(-3, 8)).toBe("3 west, 8 south of home");
  });
});

describe("the command map's gazetteer — real data only", () => {
  it("resolves home ground and the heritage anchors to their atlas coordinates", () => {
    expect(resolveLocation("Mobile")).toMatchObject({ name: "Mobile, Alabama", lat: 30.6944, lon: -88.0431 });
    expect(resolveLocation("cairo")).toMatchObject({ name: "Cairo, Egypt", lat: 30.0444, lon: 31.2357 });
    expect(resolveLocation("the pyramids")).toMatchObject({ name: "Giza, Egypt" });
    expect(resolveLocation("NYC")).toMatchObject({ name: "New York City", lat: 40.7128, lon: -74.006 });
  });

  it("magnitude rides only on the earthquake entries", () => {
    const haiti = resolveLocation("2010 Haiti earthquake");
    expect(haiti?.magnitude).toBe(7.0);
    expect(haiti?.kind).toBe("earthquake");
    expect(resolveLocation("Mobile")?.magnitude).toBeUndefined();
    for (const entry of GAZETTEER) {
      if (entry.kind === "place") expect(entry.magnitude).toBeUndefined();
    }
  });

  it("an unknown or ambiguous name resolves to nothing — never a guess", () => {
    expect(resolveLocation("Atlantis")).toBeNull();
    expect(resolveLocation("")).toBeNull();
    // "san" matches both San Francisco and the 1906 quake entry.
    expect(resolveLocation("san")).toBeNull();
  });

  it("typed coordinates resolve as given, in both notations, and bad pairs refuse", () => {
    expect(resolveLocation("30.69, -88.04")).toMatchObject({ lat: 30.69, lon: -88.04, kind: "coordinates" });
    expect(resolveLocation("33.86S 151.21E")).toMatchObject({ lat: -33.86, lon: 151.21 });
    expect(parseCoordinates("999, 999")).toBeNull();
    expect(parseCoordinates("Mobile")).toBeNull();
  });

  it("the readout formats hemispheres, and the marker math is equirectangular", () => {
    expect(formatLatLon(30.6944, -88.0431)).toBe("30.6944° N, 88.0431° W");
    expect(formatLatLon(-33.8688, 151.2093)).toBe("33.8688° S, 151.2093° E");
    expect(markerPosition(0, 0)).toEqual({ x: 50, y: 50 });
    expect(markerPosition(90, -180)).toEqual({ x: 0, y: 0 });
    expect(markerPosition(-90, 180)).toEqual({ x: 100, y: 100 });
  });
});
