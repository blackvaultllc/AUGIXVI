/**
 * WORLD OF LOGIC — the outside: the grass and the woods where the
 * monsters stand. In the VoiceWave Command Deck this world is the
 * office layout the Captain walks out of; here it is the field the
 * room renders — the same five monsters from the grass and the woods
 * (battles.ts names them), each carrying its lesson from the deck's
 * monster definitions, the Captain walking tile to tile.
 *
 * Pure: placement, areas, and movement only — the battle engine
 * (battles.ts) decides every fight.
 */
import { outsideMonsterDef } from "./battles";
import { MONSTER_DEFS } from "./temple";
import type { Tile } from "./office-layout";

export const WORLD_COLS = 16;
export const WORLD_ROWS = 12;
/** Columns at or beyond this x are the woods; the rest is grass. */
export const WOODS_START_X = 11;

export const CAPTAIN_START: Tile = { x: 1, y: 6 };

export interface WorldMonster {
  /** The layout label — how the world names it (battles.ts keys on it). */
  label: string;
  tile: Tile;
}

export type WorldArea = "outside" | "woods";

/**
 * The five, standing where they stand: three on the grass, two in
 * the woods — the troll keeps to the trees, like the deck's layout.
 */
export const WORLD_MONSTERS: WorldMonster[] = [
  { label: "VIRUS MITE", tile: { x: 5, y: 3 } },
  { label: "SPAM CALLER", tile: { x: 7, y: 8 } },
  { label: "PHISHING LURE", tile: { x: 4, y: 10 } },
  { label: "SMOOTH TALKER", tile: { x: 13, y: 4 } },
  { label: "RANSOMWARE TROLL", tile: { x: 14, y: 9 } },
];

export function areaForTile(tile: Tile): WorldArea {
  return tile.x >= WOODS_START_X ? "woods" : "outside";
}

export function monsterAt(
  tile: Tile,
  monsters: WorldMonster[] = WORLD_MONSTERS,
): WorldMonster | null {
  return monsters.find((m) => m.tile.x === tile.x && m.tile.y === tile.y) ?? null;
}

/** The lesson a monster carries — the deck's own words for its kind. */
export function lessonFor(label: string): string | null {
  const def = outsideMonsterDef(label);
  if (!def) return null;
  return MONSTER_DEFS[def.kind].lesson;
}

/** The monster's spoken line when the Captain talks to it. */
export function talkFor(label: string): string | null {
  const def = outsideMonsterDef(label);
  if (!def) return null;
  return MONSTER_DEFS[def.kind].talk;
}

/** The monster's body colour on the field. */
export function colorFor(label: string): string | null {
  const def = outsideMonsterDef(label);
  if (!def) return null;
  return MONSTER_DEFS[def.kind].color;
}

/** Chebyshev distance — diagonals count as one step, like the deck. */
export function tileDistance(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function isAdjacent(a: Tile, b: Tile): boolean {
  return tileDistance(a, b) <= 1 && !(a.x === b.x && a.y === b.y);
}

function clampTile(t: Tile): Tile {
  return {
    x: Math.max(0, Math.min(WORLD_COLS - 1, t.x)),
    y: Math.max(0, Math.min(WORLD_ROWS - 1, t.y)),
  };
}

/**
 * One step from `from` toward `to` — never onto a monster's tile:
 * the Captain stops beside a monster, the way walking up to one
 * ends at arm's reach. Returns `from` unchanged when already there
 * or when the only step would land on a monster.
 */
export function stepToward(from: Tile, to: Tile, monsters: WorldMonster[] = WORLD_MONSTERS): Tile {
  if (from.x === to.x && from.y === to.y) return from;
  const next = clampTile({
    x: from.x + Math.sign(to.x - from.x),
    y: from.y + Math.sign(to.y - from.y),
  });
  // A monster's tile is never stepped onto — the walk stops beside it.
  if (monsterAt(next, monsters)) return from;
  return next;
}

/**
 * Where a walk toward a monster ends: the closest reachable tile
 * beside it. Walking to open ground ends on the tile itself.
 */
export function walkDestination(target: Tile, monsters: WorldMonster[] = WORLD_MONSTERS): Tile {
  if (!monsterAt(target, monsters)) return clampTile(target);
  // Beside the monster — the first free neighbouring tile.
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const t = clampTile({ x: target.x + dx, y: target.y + dy });
      if (!monsterAt(t, monsters)) return t;
    }
  }
  return clampTile(target);
}
