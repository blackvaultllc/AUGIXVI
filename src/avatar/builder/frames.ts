/**
 * STAGE FRAMES — the ForeverUI Movers pattern for Augie's own
 * interface pieces (owner order 2026-11-22, the Environment
 * Builder): the medallions, the HUD clusters, and the construct
 * controls can be dragged to where the Captain wants them, and
 * anchored there. The pattern, from the reference he supplied:
 *
 * - DRAG PRECEDENCE: a dragged spot wins over the shipped default.
 *   A frame with no saved offset sits exactly where it always sat.
 * - ANCHOR LAW (objects): an anchored frame is LOCKED in place
 *   until unanchored — the same law as placed room items.
 * - SNAPPING: while dragging, a frame snaps to the viewport's
 *   center lines and to other frames' edges and centers, and shows
 *   the guide it snapped to. Alt held during a drag disables
 *   snapping; an optional grid snap rounds to a fixed step.
 * - RESET: one frame back to its default, or all of them, from the
 *   builder's Frames tab.
 *
 * Three frames are self-managed: the command box carries its own
 * anchor, position, and size system on its rail (CommandBox.tsx),
 * and the two medallions run the shared medallion anchor system
 * (useMedallionAnchor — grab, move, stretch, persisted on the
 * medallion itself). They are listed in the registry so the Frames
 * tab shows the whole stage honestly, and their resets go through
 * their own stores. This module's offsets drive the frames that
 * have no mover of their own: the HUD clusters and the construct
 * controls.
 *
 * Plain TS + injectable storage — the snap math and the store are
 * unit-testable without a DOM.
 */

export type FrameId =
  | "anubis"
  | "black-hatter"
  | "hud-status"
  | "hud-core"
  | "construct-controls"
  | "command-box";

export type FrameDef = {
  id: FrameId;
  name: string;
  blurb: string;
  /** True when the frame runs its own mover system (the command box). */
  selfManaged: boolean;
};

export const STAGE_FRAMES: readonly FrameDef[] = [
  {
    id: "anubis",
    name: "Anubis medallion",
    blurb: "Runs its own medallion anchor — grab, move and stretch the medallion itself; where you leave it persists.",
    selfManaged: true,
  },
  {
    id: "black-hatter",
    name: "Black Hatter medallion",
    blurb: "Runs its own medallion anchor — grab, move and stretch the medallion itself; where you leave it persists.",
    selfManaged: true,
  },
  {
    id: "hud-status",
    name: "Status cluster",
    blurb: "Status and intensity, top-right by default.",
    selfManaged: false,
  },
  {
    id: "hud-core",
    name: "Core cluster",
    blurb: "Core link, phone brain and sensors, top-left by default.",
    selfManaged: false,
  },
  {
    id: "construct-controls",
    name: "Construct controls",
    blurb: "AUGI's anchor / drive / body controls, bottom-right by default.",
    selfManaged: false,
  },
  {
    id: "command-box",
    name: "Command box (chat)",
    blurb: "Carries its own anchor on its rail — unanchor it there to drag and stretch it.",
    selfManaged: true,
  },
];

/** A frame's saved offset from its shipped default spot, in pixels. */
export type FrameOffset = { dx: number; dy: number; anchored: boolean };

export const FRAMES_STORAGE_KEY = "augi.avatar.frames.v1";

export type FrameStore = Partial<Record<FrameId, FrameOffset>>;

const OFFSET_LIMIT = 4000;

function clampOffset(value: number): number {
  return Number.isFinite(value) ? Math.min(OFFSET_LIMIT, Math.max(-OFFSET_LIMIT, value)) : 0;
}

export function sanitizeFrameStore(raw: unknown): FrameStore {
  if (!raw || typeof raw !== "object") return {};
  const store: FrameStore = {};
  for (const def of STAGE_FRAMES) {
    if (def.selfManaged) continue;
    const entry = (raw as Record<string, unknown>)[def.id];
    if (!entry || typeof entry !== "object") continue;
    const offset = entry as Partial<FrameOffset>;
    if (typeof offset.dx !== "number" || typeof offset.dy !== "number") continue;
    store[def.id] = {
      dx: clampOffset(offset.dx),
      dy: clampOffset(offset.dy),
      anchored: offset.anchored !== false,
    };
  }
  return store;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadFrameStore(storage: StorageLike | null = defaultStorage()): FrameStore {
  if (!storage) return {};
  try {
    const raw = storage.getItem(FRAMES_STORAGE_KEY);
    if (!raw) return {};
    return sanitizeFrameStore(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveFrameStore(store: FrameStore, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(FRAMES_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Best effort — the live stage still holds the positions.
  }
}

/** Drag precedence: a saved offset wins; no record means the default spot. */
export function frameOffset(store: FrameStore, id: FrameId): FrameOffset {
  return store[id] ?? { dx: 0, dy: 0, anchored: true };
}

export function withFrameOffset(store: FrameStore, id: FrameId, offset: FrameOffset): FrameStore {
  return { ...store, [id]: { dx: clampOffset(offset.dx), dy: clampOffset(offset.dy), anchored: offset.anchored } };
}

export function withoutFrame(store: FrameStore, id: FrameId): FrameStore {
  const next = { ...store };
  delete next[id];
  return next;
}

/* ------------------------------ snapping ------------------------------- */

export type FrameRect = { x: number; y: number; w: number; h: number };

export type SnapGuides = {
  /** Viewport-relative x of a vertical guide line that engaged. */
  vertical?: number;
  /** Viewport-relative y of a horizontal guide line that engaged. */
  horizontal?: number;
};

export type SnapOptions = {
  /** Master snap switch (Alt during a drag turns it off per-drag). */
  enabled: boolean;
  /** Snap threshold in pixels. */
  threshold?: number;
  /** Optional grid step in pixels; positions round to it after snapping. */
  grid?: number | null;
};

const DEFAULT_THRESHOLD = 9;

/**
 * Snap a dragged frame's top-left: against the viewport's center
 * lines and every other frame's left / center / right (and top /
 * middle / bottom) lines. Returns the adjusted position and the
 * guides that engaged, so the stage can flash them.
 */
export function snapFramePosition(
  pos: { x: number; y: number },
  size: { w: number; h: number },
  viewport: { w: number; h: number },
  others: readonly FrameRect[],
  options: SnapOptions,
): { x: number; y: number; guides: SnapGuides } {
  let { x, y } = pos;
  const guides: SnapGuides = {};
  if (options.enabled) {
    const threshold = options.threshold ?? DEFAULT_THRESHOLD;
    const xLines: number[] = [0, viewport.w / 2, viewport.w];
    const yLines: number[] = [0, viewport.h / 2, viewport.h];
    for (const other of others) {
      xLines.push(other.x, other.x + other.w / 2, other.x + other.w);
      yLines.push(other.y, other.y + other.h / 2, other.y + other.h);
    }
    const snapAxis = (
      value: number,
      extent: number,
      lines: number[],
    ): { value: number; guide?: number } => {
      let best: { delta: number; guide: number } | null = null;
      for (const line of lines) {
        for (const anchor of [0, extent / 2, extent]) {
          const delta = line - (value + anchor);
          if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
            best = { delta, guide: line };
          }
        }
      }
      return best ? { value: value + best.delta, guide: best.guide } : { value };
    };
    const snappedX = snapAxis(x, size.w, xLines);
    x = snappedX.value;
    if (snappedX.guide !== undefined) guides.vertical = snappedX.guide;
    const snappedY = snapAxis(y, size.h, yLines);
    y = snappedY.value;
    if (snappedY.guide !== undefined) guides.horizontal = snappedY.guide;
  }
  if (options.grid) {
    x = Math.round(x / options.grid) * options.grid;
    y = Math.round(y / options.grid) * options.grid;
  }
  return { x, y, guides };
}
