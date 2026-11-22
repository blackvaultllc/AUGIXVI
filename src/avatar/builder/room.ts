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

export type RoomSurfaces = {
  /** The room's backdrop color — the renderer's clear color in the Room. */
  backdrop: string;
  /**
   * A backdrop PICTURE from the Captain's theme sets (backdrops.ts),
   * by asset id — or null for the plain color backdrop. When set,
   * the picture is cover-fit on the back wall under a quieting veil
   * tinted by `backdrop`, per his fit rule.
   */
  backdropImage: string | null;
  /** The floor tint — the Room's floor plane and grid. */
  floor: string;
  /** The back-wall grid tint. */
  wall: string;
};

/** The shipped Room: warm white, pale blue-gray floor, soft wall. */
export const DEFAULT_SURFACES: RoomSurfaces = {
  backdrop: "#f6f2e9",
  backdropImage: null,
  floor: "#93a9c9",
  wall: "#aebfd8",
};

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
};

export type RoomLayout = {
  id: string;
  name: string;
  room: RoomContent;
};

/** Where items may stand: the framed floor of the Room. */
export const ROOM_BOUNDS = { x: 10.5, zBack: -8.5, zFront: 2.5 } as const;

export function clampRoomPoint(x: number, z: number): { x: number; z: number } {
  const clamp = (value: number, min: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 0;
  return {
    x: clamp(x, -ROOM_BOUNDS.x, ROOM_BOUNDS.x),
    z: clamp(z, ROOM_BOUNDS.zBack, ROOM_BOUNDS.zFront),
  };
}

export function emptyRoom(): RoomContent {
  return { surfaces: { ...DEFAULT_SURFACES }, items: [] };
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
  return {
    backdrop: pick(value.backdrop, DEFAULT_SURFACES.backdrop),
    // Only a picture from his own theme registry may ride a layout —
    // an unknown id reads as no picture, never as a broken image.
    backdropImage: backdropById(value.backdropImage)?.id ?? null,
    floor: pick(value.floor, DEFAULT_SURFACES.floor),
    wall: pick(value.wall, DEFAULT_SURFACES.wall),
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

export function sanitizeRoom(raw: unknown): RoomContent {
  const value = (raw ?? {}) as Partial<RoomContent>;
  const items = Array.isArray(value.items)
    ? value.items.map(sanitizeItem).filter((item): item is PlacedItem => item !== null)
    : [];
  return { surfaces: sanitizeSurfaces(value.surfaces), items };
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
