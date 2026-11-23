/**
 * THE ROOM THE CAPTAIN DESIGNS — data, persistence, and the portable
 * package (owner order 2026-11-22, the Environment Builder).
 *
 * A room is plain data: the surfaces (backdrop, floor, wall) and the
 * placed items, each with its variant, its spot on the floor plane,
 * its facing, and its anchor state. THE OBJECT ANCHOR LAW is the
 * reverse of the construct's: an anchored OBJECT is LOCKED in place
 * until unanchored — the data layer itself refuses to move an
 * anchored item, so no caller can drag one by accident.
 *
 * Layouts are named profiles in the ForeverUI pattern: they SAVE AS
 * YOU GO (every edit writes the store; there is no save button to
 * forget), they switch by name, and any one of them exports as a
 * portable DATA-ONLY package — readable JSON text that another of
 * the Captain's sites can import later. The builder, the room, and
 * this package format are deliberately self-contained: nothing here
 * imports the avatar page, the renderer, or the chat.
 *
 * Storage keys are versioned like the other augi.avatar.* keys.
 * Plain TS, injectable storage — unit-testable without a DOM.
 */
import { LIBRARY, libraryItem, type ItemSizeId } from "./library";
import { backdropById } from "./backdrops";

/**
 * WHAT THE FLOOR IS (owner orders 2026-11-22): the floor is ONE of
 * two things, and he picks which — a solid color, or a picture.
 * THE COVER RULE (his defect report, same day): he set a floor
 * color and still saw the grid bleeding through — "I shouldn't
 * have saw the grid." So a chosen color or picture COVERS: opaque,
 * whole. THE GRID REMOVAL (his decision, same day, final): "Remove
 * the grid entirely." There is no grid floor anymore — a layout
 * saved with one migrates to a solid color floor on load (see
 * sanitizeSurfaces).
 */
export type FloorStyle = "color" | "picture";

/** How a backdrop picture fits the back wall: Whole picture or Fill screen. */
export type BackdropFit = "contain" | "cover";

export type RoomSurfaces = {
  /** The room's backdrop color — the renderer's clear color in the Room. */
  backdrop: string;
  /**
   * A backdrop PICTURE from the Captain's theme sets (backdrops.ts),
   * by asset id — or null for the plain color backdrop. When set,
   * the picture renders TRUE on the back wall — full strength, no
   * veil (his correction 2026-11-22) — fitted per backdropFit.
   */
  backdropImage: string | null;
  /**
   * HOW THE BACKDROP PICTURE FITS THE WALL (owner order
   * 2026-11-23 ~07:22 EST): "Whole picture" (contain — the whole
   * picture visible, the standing default) or "Fill screen"
   * (cover — the picture cascades edge to edge, its edges
   * trimmed). His choice, persisted with the room and synced
   * with the picture across his devices (settings.ts).
   */
  backdropFit: BackdropFit;
  /** The floor tint — the solid floor's color. */
  floor: string;
  /** Which floor stands in the Room: the solid color, or a picture. */
  floorStyle: FloorStyle;
  /**
   * The floor PICTURE, from the same theme sets as the backdrop —
   * read when floorStyle is "picture". Cover-fit across the framed
   * floor, opaque: it covers, whole.
   */
  floorImage: string | null;
  /** The back-wall color. */
  wall: string;
  /**
   * THE WORLD SKY (owner order 2026-11-23): a picture standing
   * far behind the built world — stars and space above, earth
   * below, the horizon he looks at from out in his world. A
   * backdrop asset id, or null for plain darkness. DISTINCT from
   * the room's backdrop: the backdrop hangs on the home wall; the
   * sky belongs to the open world and follows the view as he
   * travels, the way a real sky does.
   */
  skyImage: string | null;
};

/**
 * The shipped Room — THE BLACK-HOLDER COMPOSITION (owner eye-check
 * 2026-11-23 ~06:51 EST, superseding the warm-white shipped room
 * of 2026-11-22): "make the white background holder black so that
 * way the picture sticks out better," and from his phone photo the
 * same morning: the pale two-tone room is NOT the standing look on
 * any device. The factory surfaces are black — backdrop, wall, and
 * floor — so a fresh stage on any screen opens on the black
 * composition, and his backdrop picture (when he picks one) stands
 * on the black wall exactly as the picture rules already render
 * it. Every color stays his to choose in the builder; a room he
 * has colored himself keeps his colors — only the factory default
 * changed.
 */
export const DEFAULT_SURFACES: RoomSurfaces = {
  backdrop: "#000000",
  backdropImage: null,
  backdropFit: "contain",
  floor: "#000000",
  floorStyle: "color",
  floorImage: null,
  wall: "#000000",
  skyImage: null,
};

/** A surface color's rough luminance (0–1) — the stage-look
 *  derivation reads it: a room HE colored light still gets the
 *  light stage look; the black default does not. */
export function surfaceIsLight(hex: string): boolean {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return false;
  const value = parseInt(match[1]!, 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/** The floor picture that actually stands, or null when none can. */
export function standingFloorImage(surfaces: RoomSurfaces): string | null {
  return surfaces.floorStyle === "picture" ? surfaces.floorImage : null;
}

export type PlacedItem = {
  id: string;
  baseId: string;
  form: string;
  size: ItemSizeId;
  color: string;
  /** Floor-plane position in world units (the stage's x/z). */
  x: number;
  z: number;
  /** Facing, degrees clockwise around Y. */
  rotation: number;
  /** OBJECT ANCHOR LAW: anchored = locked in place until unanchored. */
  anchored: boolean;
};

export type RoomContent = {
  surfaces: RoomSurfaces;
  items: PlacedItem[];
  /** Claimed ground plots in the wider world (never home plots). */
  plots: GroundPlot[];
};

export type RoomLayout = {
  id: string;
  name: string;
  room: RoomContent;
};

/** Where the home plot is: the framed floor of the Room. The home
 * plot's coordinates NEVER move — the wider world (below) extends
 * AROUND this origin, so every saved layout loads exactly as it
 * was saved (owner order 2026-11-23: build a world, piece by
 * piece, around the home he already has). */
export const ROOM_BOUNDS = { x: 10.5, zBack: -8.5, zFront: 2.5 } as const;

/**
 * THE WIDER WORLD (owner order 2026-11-23): the ground runs far
 * past the home plot in every direction, and pieces may stand
 * anywhere in it. Beyond the home plot the unbuilt world is
 * darkness — no fake terrain — until he claims a plot and lays
 * ground cover on it (see GroundPlot below). Item positions clamp
 * to the world's edge, not the home plot's frame: that widening is
 * the whole point of this round, and the old home-frame clamp pin
 * in the tests was updated to say so.
 */
export const WORLD_BOUNDS = { x: 120, zBack: -120, zFront: 120 } as const;

export function clampRoomPoint(x: number, z: number): { x: number; z: number } {
  const clamp = (value: number, min: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 0;
  return {
    x: clamp(x, -WORLD_BOUNDS.x, WORLD_BOUNDS.x),
    z: clamp(z, WORLD_BOUNDS.zBack, WORLD_BOUNDS.zFront),
  };
}

/* --------------------------- ground plots ----------------------------- */
/**
 * A claimed piece of the wider world. The world is read as a grid
 * of square plots, PLOT_SIZE world units on a side, indexed from
 * the home origin — plot (0, 0) covers x 0…11, z 0…11; plot
 * (-1, -1) covers x −11…0, z −11…0. A claimed plot renders with
 * the room's floor choice (his color — grass green included — or
 * his floor picture) laid over the darkness. The four plots the
 * home floor already covers are HOME plots: always covered by the
 * room itself, never stored in the claimed list.
 */
export const PLOT_SIZE = 11;

export type GroundPlot = { x: number; z: number };

export function plotAtPoint(x: number, z: number): GroundPlot {
  return { x: Math.floor(x / PLOT_SIZE), z: Math.floor(z / PLOT_SIZE) };
}

export function plotCenter(plot: GroundPlot): { x: number; z: number } {
  return { x: (plot.x + 0.5) * PLOT_SIZE, z: (plot.z + 0.5) * PLOT_SIZE };
}

export function isHomePlot(plot: GroundPlot): boolean {
  return plot.x >= -1 && plot.x <= 0 && plot.z >= -1 && plot.z <= 0;
}

export function samePlot(a: GroundPlot, b: GroundPlot): boolean {
  return a.x === b.x && a.z === b.z;
}

export function claimPlot(room: RoomContent, plot: GroundPlot): RoomContent {
  if (isHomePlot(plot)) return room;
  if (room.plots.some((entry) => samePlot(entry, plot))) return room;
  return { ...room, plots: [...room.plots, plot] };
}

export function unclaimPlot(room: RoomContent, plot: GroundPlot): RoomContent {
  if (!room.plots.some((entry) => samePlot(entry, plot))) return room;
  return { ...room, plots: room.plots.filter((entry) => !samePlot(entry, plot)) };
}

export function plotClaimed(room: RoomContent, plot: GroundPlot): boolean {
  return isHomePlot(plot) || room.plots.some((entry) => samePlot(entry, plot));
}

export function emptyRoom(): RoomContent {
  return { surfaces: { ...DEFAULT_SURFACES }, items: [], plots: [] };
}

/* ------------------------------ item ops ------------------------------ */
/* Pure and immutable: every op returns a new RoomContent (or the
 * same one when the op is refused), so the stage can setState with
 * the result and the save-as-you-go writer persists it verbatim. */

export function addItem(room: RoomContent, item: PlacedItem): RoomContent {
  const spot = clampRoomPoint(item.x, item.z);
  return { ...room, items: [...room.items, { ...item, ...spot }] };
}

export function moveItem(room: RoomContent, id: string, x: number, z: number): RoomContent {
  const target = room.items.find((item) => item.id === id);
  if (!target || target.anchored) return room; // the anchor law, enforced in data
  const spot = clampRoomPoint(x, z);
  return {
    ...room,
    items: room.items.map((item) => (item.id === id ? { ...item, ...spot } : item)),
  };
}

export function rotateItem(room: RoomContent, id: string, rotation: number): RoomContent {
  const target = room.items.find((item) => item.id === id);
  if (!target || target.anchored) return room;
  const facing = ((rotation % 360) + 360) % 360;
  return {
    ...room,
    items: room.items.map((item) => (item.id === id ? { ...item, rotation: facing } : item)),
  };
}

export function setItemAnchored(room: RoomContent, id: string, anchored: boolean): RoomContent {
  return {
    ...room,
    items: room.items.map((item) => (item.id === id ? { ...item, anchored } : item)),
  };
}

export function removeItem(room: RoomContent, id: string): RoomContent {
  return { ...room, items: room.items.filter((item) => item.id !== id) };
}

/**
 * Change a placed item's clothes — form, size, color. The anchor
 * law locks POSITION, not appearance: an anchored store may still
 * be repainted. Unknown forms/colors for the base are refused (the
 * room comes back unchanged) so a bad patch can never corrupt a
 * saved layout.
 */
export function updateItemVariant(
  room: RoomContent,
  id: string,
  patch: Partial<Pick<PlacedItem, "form" | "size" | "color">>,
): RoomContent {
  const target = room.items.find((item) => item.id === id);
  if (!target) return room;
  const base = libraryItem(target.baseId);
  if (!base) return room;
  if (patch.form !== undefined && !base.forms.some((entry) => entry.id === patch.form)) return room;
  if (patch.color !== undefined && !base.colors.some((entry) => entry.id === patch.color)) return room;
  return {
    ...room,
    items: room.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  };
}

export function setSurfaces(room: RoomContent, surfaces: RoomSurfaces): RoomContent {
  return { ...room, surfaces: sanitizeSurfaces(surfaces) };
}

/** A fresh placed item for a library base, at a floor spot. */
export function makePlacedItem(
  id: string,
  baseId: string,
  variant: { form: string; size: ItemSizeId; color: string },
  x: number,
  z: number,
): PlacedItem {
  return {
    id,
    baseId,
    form: variant.form,
    size: variant.size,
    color: variant.color,
    x,
    z,
    rotation: 0,
    anchored: false,
  };
}

/* ---------------------------- validation ------------------------------ */

const HEX = /^#[0-9a-fA-F]{6}$/;

export function sanitizeSurfaces(raw: unknown): RoomSurfaces {
  const value = (raw ?? {}) as Partial<RoomSurfaces>;
  const pick = (candidate: unknown, fallback: string) =>
    typeof candidate === "string" && HEX.test(candidate) ? candidate : fallback;
  const floorImage = backdropById(value.floorImage)?.id ?? null;
  // THE GRID IS GONE (owner decision 2026-11-22, "Remove the grid
  // entirely"): the floor is a solid color or a picture, nothing
  // else. THE MIGRATION: a layout saved with floorStyle "grid" —
  // or saved before the floor choice existed at all — loads as a
  // SOLID COLOR floor in its saved floor tint: the color he
  // picked, no hole, no error. A picture style that names a
  // picture it does not have falls back to the solid color rather
  // than a hole in the room.
  const floorStyle: FloorStyle =
    value.floorStyle === "picture" && floorImage ? "picture" : "color";
  return {
    backdrop: pick(value.backdrop, DEFAULT_SURFACES.backdrop),
    // Only a picture from his own theme registry may ride a layout —
    // an unknown id reads as no picture, never as a broken image.
    backdropImage: backdropById(value.backdropImage)?.id ?? null,
    // The fit choice rides the layout too: anything but the
    // explicit Fill-screen reads as the Whole-picture default.
    backdropFit: value.backdropFit === "cover" ? "cover" : "contain",
    floor: pick(value.floor, DEFAULT_SURFACES.floor),
    floorStyle,
    floorImage,
    wall: pick(value.wall, DEFAULT_SURFACES.wall),
    // The world sky: only a picture from his own registry may
    // stand over the world — an unknown id reads as no sky.
    skyImage: backdropById(value.skyImage)?.id ?? null,
  };
}

export function sanitizeItem(raw: unknown): PlacedItem | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<PlacedItem>;
  const base = typeof value.baseId === "string" ? libraryItem(value.baseId) : null;
  if (!base || typeof value.id !== "string" || !value.id) return null;
  const form = base.forms.some((entry) => entry.id === value.form)
    ? (value.form as string)
    : base.forms[0]!.id;
  const size = (["small", "medium", "large", "grand"] as const).includes(value.size as ItemSizeId)
    ? (value.size as ItemSizeId)
    : "medium";
  const color = base.colors.some((entry) => entry.id === value.color)
    ? (value.color as string)
    : base.colors[0]!.id;
  const spot = clampRoomPoint(
    typeof value.x === "number" ? value.x : 0,
    typeof value.z === "number" ? value.z : 0,
  );
  return {
    id: value.id,
    baseId: base.id,
    form,
    size,
    color,
    ...spot,
    rotation:
      typeof value.rotation === "number" && Number.isFinite(value.rotation)
        ? ((value.rotation % 360) + 360) % 360
        : 0,
    anchored: value.anchored === true,
  };
}

export function sanitizePlot(raw: unknown): GroundPlot | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<GroundPlot>;
  if (typeof value.x !== "number" || typeof value.z !== "number") return null;
  if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) return null;
  const plot = { x: Math.trunc(value.x), z: Math.trunc(value.z) };
  // Home plots are the room's own ground — never stored as claims.
  return isHomePlot(plot) ? null : plot;
}

export function sanitizeRoom(raw: unknown): RoomContent {
  const value = (raw ?? {}) as Partial<RoomContent>;
  const items = Array.isArray(value.items)
    ? value.items.map(sanitizeItem).filter((item): item is PlacedItem => item !== null)
    : [];
  const plots: GroundPlot[] = [];
  if (Array.isArray(value.plots)) {
    for (const rawPlot of value.plots) {
      const plot = sanitizePlot(rawPlot);
      if (plot && !plots.some((entry) => samePlot(entry, plot))) plots.push(plot);
    }
  }
  return { surfaces: sanitizeSurfaces(value.surfaces), items, plots };
}

/* ------------------------- the portable package ------------------------ */

export const ROOM_PACKAGE_KIND = "augi-room";
export const ROOM_PACKAGE_VERSION = 1;

/**
 * A designed room as portable DATA-ONLY text — readable JSON, no
 * code, no functions, nothing executable. This is the package the
 * Captain lifts onto another site later.
 */
export function exportRoomPackage(layout: RoomLayout): string {
  return JSON.stringify(
    {
      kind: ROOM_PACKAGE_KIND,
      version: ROOM_PACKAGE_VERSION,
      name: layout.name,
      surfaces: layout.room.surfaces,
      items: layout.room.items,
      plots: layout.room.plots,
    },
    null,
    2,
  );
}

export type RoomPackageResult =
  | { ok: true; name: string; room: RoomContent }
  | { ok: false; error: string };

export function parseRoomPackage(text: string): RoomPackageResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That text is not a room package — it is not readable JSON." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "That text is not a room package." };
  }
  const value = parsed as { kind?: unknown; version?: unknown; name?: unknown };
  if (value.kind !== ROOM_PACKAGE_KIND) {
    return { ok: false, error: "That package is not an Augie room (its kind is different)." };
  }
  if (value.version !== ROOM_PACKAGE_VERSION) {
    return {
      ok: false,
      error: `That room package is version ${String(value.version)} — this builder reads version ${ROOM_PACKAGE_VERSION}.`,
    };
  }
  const room = sanitizeRoom(parsed);
  return {
    ok: true,
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : "Imported room",
    room,
  };
}

/* ----------------------------- layout store ---------------------------- */

export const BUILDER_LAYOUTS_STORAGE_KEY = "augi.avatar.builder.layouts.v1";

export type LayoutStore = {
  activeId: string;
  layouts: RoomLayout[];
};

export const DEFAULT_LAYOUT_NAME = "The Room — default";

export function defaultLayoutStore(): LayoutStore {
  const layout: RoomLayout = { id: "default", name: DEFAULT_LAYOUT_NAME, room: emptyRoom() };
  return { activeId: layout.id, layouts: [layout] };
}

export function activeLayout(store: LayoutStore): RoomLayout {
  return store.layouts.find((layout) => layout.id === store.activeId) ?? store.layouts[0]!;
}

/** Replace one layout's room (the save-as-you-go write path). */
export function withLayoutRoom(store: LayoutStore, layoutId: string, room: RoomContent): LayoutStore {
  return {
    ...store,
    layouts: store.layouts.map((layout) => (layout.id === layoutId ? { ...layout, room } : layout)),
  };
}

export function sanitizeLayoutStore(raw: unknown): LayoutStore {
  const value = (raw ?? {}) as Partial<LayoutStore>;
  const layouts: RoomLayout[] = Array.isArray(value.layouts)
    ? value.layouts
        .map((entry): RoomLayout | null => {
          if (!entry || typeof entry !== "object") return null;
          const layout = entry as Partial<RoomLayout>;
          if (typeof layout.id !== "string" || !layout.id) return null;
          return {
            id: layout.id,
            name:
              typeof layout.name === "string" && layout.name.trim()
                ? layout.name.trim()
                : "Untitled room",
            room: sanitizeRoom(layout.room),
          };
        })
        .filter((layout): layout is RoomLayout => layout !== null)
    : [];
  if (layouts.length === 0) return defaultLayoutStore();
  const activeId =
    typeof value.activeId === "string" && layouts.some((layout) => layout.id === value.activeId)
      ? value.activeId
      : layouts[0]!.id;
  return { activeId, layouts };
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadLayoutStore(storage: StorageLike | null = defaultStorage()): LayoutStore {
  if (!storage) return defaultLayoutStore();
  try {
    const raw = storage.getItem(BUILDER_LAYOUTS_STORAGE_KEY);
    if (!raw) return defaultLayoutStore();
    return sanitizeLayoutStore(JSON.parse(raw));
  } catch {
    return defaultLayoutStore();
  }
}

export function saveLayoutStore(
  store: LayoutStore,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(BUILDER_LAYOUTS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Best effort — the live stage state still holds the design.
  }
}

/** The catalog every placed item must belong to (re-exported for the panel). */
export { LIBRARY };
