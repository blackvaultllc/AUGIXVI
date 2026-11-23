/**
 * THE BUILT-WORLD MAP — pure geometry (owner order 2026-11-23).
 *
 * A map of the Captain's OWN built world: the home plot, the
 * plots he has claimed, the pieces standing in them, and the
 * inhabitants at their world positions. Plain math only — the
 * extent that frames everything he has built, and the two-way
 * projection between world units and map pixels — so the panel
 * stays a dumb surface and this file unit-tests without a DOM.
 *
 * Orientation: north is the back of the stage (−z) and reads UP
 * on the map; east (+x) reads right. The home origin never moves.
 */
import { PLOT_SIZE, ROOM_BOUNDS, plotCenter, type RoomContent } from "./room";

export type WorldInhabitant = {
  id: string;
  name: string;
  x: number;
  z: number;
  kind: "construct" | "god";
};

export type MapExtent = { minX: number; maxX: number; minZ: number; maxZ: number };

/** The home plot's ground on the map: the framed floor, in full. */
export const HOME_RECT: MapExtent = {
  minX: -ROOM_BOUNDS.x,
  maxX: ROOM_BOUNDS.x,
  minZ: ROOM_BOUNDS.zBack,
  maxZ: ROOM_BOUNDS.zFront,
};

function grow(extent: MapExtent, x: number, z: number) {
  extent.minX = Math.min(extent.minX, x);
  extent.maxX = Math.max(extent.maxX, x);
  extent.minZ = Math.min(extent.minZ, z);
  extent.maxZ = Math.max(extent.maxZ, z);
}

/**
 * The smallest extent that frames the home plot, every claimed
 * plot, every placed piece, every inhabitant, and where the view
 * currently stands — padded, and never smaller than a comfortable
 * look at the home plot and its nearest neighbors.
 */
export function worldMapExtent(
  room: RoomContent,
  inhabitants: readonly WorldInhabitant[],
  viewCenter: { x: number; z: number },
): MapExtent {
  const extent: MapExtent = { minX: -17, maxX: 17, minZ: -17, maxZ: 17 };
  grow(extent, HOME_RECT.minX, HOME_RECT.minZ);
  grow(extent, HOME_RECT.maxX, HOME_RECT.maxZ);
  for (const plot of room.plots) {
    const center = plotCenter(plot);
    grow(extent, center.x - PLOT_SIZE / 2, center.z - PLOT_SIZE / 2);
    grow(extent, center.x + PLOT_SIZE / 2, center.z + PLOT_SIZE / 2);
  }
  for (const item of room.items) grow(extent, item.x, item.z);
  for (const soul of inhabitants) grow(extent, soul.x, soul.z);
  grow(extent, viewCenter.x, viewCenter.z);
  const pad = 4;
  return {
    minX: extent.minX - pad,
    maxX: extent.maxX + pad,
    minZ: extent.minZ - pad,
    maxZ: extent.maxZ + pad,
  };
}

/** World → map pixels. North (−z) is up. */
export function worldToMap(
  extent: MapExtent,
  width: number,
  height: number,
  x: number,
  z: number,
): { px: number; py: number } {
  return {
    px: ((x - extent.minX) / (extent.maxX - extent.minX)) * width,
    py: ((z - extent.minZ) / (extent.maxZ - extent.minZ)) * height,
  };
}

/** Map pixels → world. The exact inverse of worldToMap. */
export function mapToWorld(
  extent: MapExtent,
  width: number,
  height: number,
  px: number,
  py: number,
): { x: number; z: number } {
  return {
    x: extent.minX + (px / width) * (extent.maxX - extent.minX),
    z: extent.minZ + (py / height) * (extent.maxZ - extent.minZ),
  };
}

/** A plain-words bearing from home: "12 east, 5 north of home". */
export function describeOffset(x: number, z: number): string {
  const parts: string[] = [];
  const east = Math.round(x);
  const north = Math.round(-z);
  if (east !== 0) parts.push(`${Math.abs(east)} ${east > 0 ? "east" : "west"}`);
  if (north !== 0) parts.push(`${Math.abs(north)} ${north > 0 ? "north" : "south"}`);
  return parts.length > 0 ? `${parts.join(", ")} of home` : "the home plot";
}
