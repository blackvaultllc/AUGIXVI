/**
 * OSIRIS'S SPOT ON THE STAGE (owner order 2026-11-22): "I can hardly
 * see this picture of Augie in the box — make it to where I can move
 * him around the screen." The particle figure — Osiris, the sand-code
 * construct — is draggable: the operator pulls him anywhere on the
 * stage and he stays there, across reloads, until he is sent home.
 *
 * This module is the plain-data half: the saved offset (world units,
 * relative to his home spot at stage center), the clamp that keeps
 * him inside the camera's frame, and the device-local storage. The
 * renderer owns the anchor the offset moves (AvatarRenderer.ts); the
 * stage owns the pointer work (AvatarStage.tsx).
 *
 * NAMING, in the owner's system: ANUBIS is the command face he speaks
 * to day to day (AnubisPresence.tsx); AUGIE / OSIRIS is the whole
 * construct — this figure. Anubis relays to the construct.
 */
export type FigureOffset = { x: number; y: number };

/** His home spot: stage center, where he has always stood. */
export const FIGURE_HOME: FigureOffset = { x: 0, y: 0 };

/**
 * How far he may be pulled from home, in world units. The stage
 * camera frames roughly ±7.5 horizontally at his depth, and his body
 * spans about −2.6…+2.1 vertically around his origin — these limits
 * keep the whole figure inside the frame at any window size the
 * stage supports.
 */
export const FIGURE_OFFSET_LIMITS = { x: 6.5, up: 3.4, down: 2.4 } as const;

export const OSIRIS_POSITION_STORAGE_KEY = "augi.avatar.osiris-position.v1";

export function clampFigureOffset(offset: FigureOffset): FigureOffset {
  const clamp = (value: number, min: number, max: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 0;
  return {
    x: clamp(offset.x, -FIGURE_OFFSET_LIMITS.x, FIGURE_OFFSET_LIMITS.x),
    y: clamp(offset.y, -FIGURE_OFFSET_LIMITS.down, FIGURE_OFFSET_LIMITS.up),
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The saved spot, or null when he has never been moved (or was sent home). */
export function loadFigureOffset(storage: StorageLike | null = defaultStorage()): FigureOffset | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(OSIRIS_POSITION_STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const offset = value as Partial<FigureOffset>;
    if (typeof offset.x !== "number" || typeof offset.y !== "number") return null;
    return clampFigureOffset({ x: offset.x, y: offset.y });
  } catch {
    return null;
  }
}

export function saveFigureOffset(
  offset: FigureOffset,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(OSIRIS_POSITION_STORAGE_KEY, JSON.stringify(clampFigureOffset(offset)));
  } catch {
    // A full or blocked store never breaks the stage; he just won't
    // keep the spot across a reload.
  }
}

/** Send him home: forget the saved spot entirely. */
export function clearFigureOffset(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(OSIRIS_POSITION_STORAGE_KEY);
  } catch {
    // Nothing to forget cleanly — the next save overwrites anyway.
  }
}
