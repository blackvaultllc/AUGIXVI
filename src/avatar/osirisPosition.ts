/**
 * AUGI'S SPOT AND ANCHOR STATE ON THE STAGE (owner orders
 * 2026-11-22): "I can hardly see this picture of Augie in the box —
 * make it to where I can move him around the screen." The movable
 * sand-code body is AUGI, the construct; OSIRIS is the core within
 * him, under command. The Captain pulls AUGI anywhere on the stage
 * and he stays there, across reloads, until he is sent home.
 *
 * This module is the plain-data half: the saved offset (world units,
 * relative to his home spot at stage center), the clamp that keeps
 * him inside the camera's frame, the construct's anchor state, and
 * the device-local storage. The renderer owns the anchor the offset
 * moves (AvatarRenderer.ts); the stage owns the pointer work
 * (AvatarStage.tsx).
 *
 * NAMING, in the owner's final structure: Captain Infinity is at the
 * top; ANUBIS is in command, the face he speaks to day to day
 * (AnubisPresence.tsx); OSIRIS is under Anubis; AUGI is the sand-code
 * construct — this movable figure, with Osiris as the core within.
 *
 * CONSTRUCT ANCHOR LAW (owner order 2026-11-22, the reverse of a
 * placed object): AUGI ANCHORED = set into the stage and FREE — he
 * moves around and does his work. AUGI UNANCHORED = the Captain has
 * lifted him out to FIX something — he holds still for adjustment.
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
export const CONSTRUCT_ANCHOR_STORAGE_KEY = "augi.avatar.construct-anchor.v1";
export const FULL_BODY_HOLD_STORAGE_KEY = "augi.avatar.body-hold.v1";

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

/**
 * The construct's anchor state. Nothing saved means ANCHORED — set
 * into the stage and free to work, the state he has always opened in.
 * Only an explicit saved "unanchored" starts him held for fixing.
 */
export function loadConstructAnchored(
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(CONSTRUCT_ANCHOR_STORAGE_KEY) !== "unanchored";
  } catch {
    return true;
  }
}

export function saveConstructAnchored(
  anchored: boolean,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(CONSTRUCT_ANCHOR_STORAGE_KEY, anchored ? "anchored" : "unanchored");
  } catch {
    // Best effort only — the live stage state still holds.
  }
}

/**
 * The full-body hold (owner order 2026-11-22, live defect fix):
 * nothing saved means NOT held — the compact companion presentation
 * is the default, as ordered. Only an explicit saved "full" opens
 * the stage with AUGI at full body, held there until released.
 */
export function loadFullBodyHold(storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(FULL_BODY_HOLD_STORAGE_KEY) === "full";
  } catch {
    return false;
  }
}

export function saveFullBodyHold(
  held: boolean,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(FULL_BODY_HOLD_STORAGE_KEY, held ? "full" : "companion");
  } catch {
    // Best effort only — the live stage state still holds.
  }
}
