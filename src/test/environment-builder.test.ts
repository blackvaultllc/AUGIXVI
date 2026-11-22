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
  clampRoomPoint,
  defaultLayoutStore,
  emptyRoom,
  exportRoomPackage,
  loadLayoutStore,
  makePlacedItem,
  moveItem,
  parseRoomPackage,
  removeItem,
  rotateItem,
  saveLayoutStore,
  sanitizeRoom,
  setItemAnchored,
  setSurfaces,
  updateItemVariant,
  withLayoutRoom,
  type RoomContent,
} from "@/avatar/builder/room";
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

  it("positions clamp to the room's framed floor", () => {
    expect(clampRoomPoint(99, 99)).toEqual({ x: 10.5, z: 2.5 });
    expect(clampRoomPoint(-99, -99)).toEqual({ x: -10.5, z: -8.5 });
    const room = moveItem(roomWithItem(false), "item-1", 500, 500);
    expect(room.items[0]).toMatchObject({ x: 10.5, z: 2.5 });
  });
});

describe("environment builder — room surfaces persist like items", () => {
  it("surface choices save and reload through the layout store", () => {
    const storage = fakeStorage();
    let layouts = defaultLayoutStore();
    const surfaces = {
      backdrop: "#101018",
      backdropImage: "egypt-throne",
      floor: "#2a4a7a",
      wall: "#3a3f4a",
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
    expect(Object.keys(parsed).sort()).toEqual(["items", "kind", "name", "surfaces", "version"]);
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
