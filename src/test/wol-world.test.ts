// WORLD OF LOGIC — the outside field: the five monsters from the
// grass and the woods, their lessons in the deck's own words, and
// the walk that takes the Captain to them. Pure helpers only —
// the fights themselves are proven by the ported engine tests.
import { describe, expect, it } from "vitest";
import { outsideMonsterDef } from "@/avatar/world-of-logic/battles";
import { MONSTER_DEFS } from "@/avatar/world-of-logic/temple";
import {
  WORLD_COLS,
  WORLD_MONSTERS,
  WORLD_ROWS,
  areaForTile,
  isAdjacent,
  lessonFor,
  monsterAt,
  stepToward,
  talkFor,
  tileDistance,
  walkDestination,
} from "@/avatar/world-of-logic/world";

describe("World of Logic — the field", () => {
  it("stands exactly the five deck monsters on it, each a real battle def", () => {
    expect(WORLD_MONSTERS.map((m) => m.label)).toEqual([
      "VIRUS MITE",
      "SPAM CALLER",
      "PHISHING LURE",
      "SMOOTH TALKER",
      "RANSOMWARE TROLL",
    ]);
    for (const m of WORLD_MONSTERS) {
      expect(outsideMonsterDef(m.label), m.label).toBeDefined();
      expect(m.tile.x).toBeGreaterThanOrEqual(0);
      expect(m.tile.x).toBeLessThan(WORLD_COLS);
      expect(m.tile.y).toBeGreaterThanOrEqual(0);
      expect(m.tile.y).toBeLessThan(WORLD_ROWS);
    }
    // No two monsters share a tile.
    const keys = WORLD_MONSTERS.map((m) => `${m.tile.x},${m.tile.y}`);
    expect(new Set(keys).size).toBe(WORLD_MONSTERS.length);
  });

  it("puts three on the grass and two in the woods", () => {
    const areas = WORLD_MONSTERS.map((m) => areaForTile(m.tile));
    expect(areas.filter((a) => a === "outside")).toHaveLength(3);
    expect(areas.filter((a) => a === "woods")).toHaveLength(2);
    expect(areaForTile({ x: 0, y: 0 })).toBe("outside");
  });

  it("carries each monster's lesson and talk in the deck's own words", () => {
    for (const m of WORLD_MONSTERS) {
      const def = outsideMonsterDef(m.label);
      expect(def).toBeDefined();
      expect(lessonFor(m.label)).toBe(MONSTER_DEFS[def!.kind].lesson);
      expect(talkFor(m.label)).toBe(MONSTER_DEFS[def!.kind].talk);
    }
    expect(lessonFor("NOT A MONSTER")).toBeNull();
  });
});

describe("World of Logic — the walk", () => {
  it("measures Chebyshev distance and adjacency", () => {
    expect(tileDistance({ x: 0, y: 0 }, { x: 3, y: 2 })).toBe(3);
    expect(isAdjacent({ x: 4, y: 2 }, { x: 5, y: 3 })).toBe(true);
    expect(isAdjacent({ x: 5, y: 3 }, { x: 5, y: 3 })).toBe(false);
    expect(isAdjacent({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
  });

  it("steps toward open ground one tile at a time, diagonals included", () => {
    expect(stepToward({ x: 1, y: 6 }, { x: 4, y: 2 })).toEqual({ x: 2, y: 5 });
    expect(stepToward({ x: 4, y: 2 }, { x: 4, y: 2 })).toEqual({ x: 4, y: 2 });
  });

  it("never steps onto a monster's tile — the walk stops beside it", () => {
    const mite = WORLD_MONSTERS[0]!; // VIRUS MITE at (5,3)
    expect(stepToward({ x: 4, y: 2 }, mite.tile)).toEqual({ x: 4, y: 2 });
    expect(monsterAt(mite.tile)).toBe(mite);
    expect(monsterAt({ x: 0, y: 0 })).toBeNull();
  });

  it("walks to open ground directly, and beside a monster when it is the target", () => {
    expect(walkDestination({ x: 9, y: 9 })).toEqual({ x: 9, y: 9 });
    const mite = WORLD_MONSTERS[0]!;
    const beside = walkDestination(mite.tile);
    expect(isAdjacent(beside, mite.tile)).toBe(true);
    expect(monsterAt(beside)).toBeNull();
  });
});
