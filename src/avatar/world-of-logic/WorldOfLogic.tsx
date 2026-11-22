/**
 * WORLD OF LOGIC — the Captain's outside battles, merged into Augie
 * from the VoiceWave Command Deck (blackvaultllc/voicewave-command-
 * deck @ 7653d36). The deck's world is its office layout; this room is
 * the field outside it — the grass and the woods where the five
 * monsters stand. The Captain walks tile to tile (arrow keys, WASD,
 * or tap-to-walk), walks up to a monster to read its lesson first —
 * the deck's two-tap — and then the battle screen opens: per-turn,
 * the deck's own engine (battles.ts) deciding everything, this
 * component only walking, rendering, and settling, the way the deck's
 * AgentDeskPanel settles (record forward-only, captured kept, a
 * beaten monster gone for two minutes — the deck's HERB_REGROW_MS).
 *
 * The Captain fights alone in this room (no party system crosses
 * over) and with no chosen class — base gear, exactly the engine's
 * no-class numbers. Blossom Bell guards him: her giant turn, once
 * per day, per blossom.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addCaptured,
  applyBattleMove,
  captainBattleLevel,
  captainBattleXpToNext,
  enemyForOutsideMonster,
  loadCaptured,
  loadCaptainBattleRecord,
  recordBattleCapture,
  recordBattleFlee,
  recordBattleWin,
  saveCaptured,
  saveCaptainBattleRecord,
  startBattle,
  type BattleMoveId,
  type BattleState,
  type CapturedVirus,
  type CaptainBattleRecord,
} from "./battles";
import {
  giantReadyForDay,
  loadBlossomGiantStore,
  recordGiantTurn,
  saveBlossomGiantStore,
  todayNumber,
  type BlossomGiantStore,
} from "./blossom";
import BattlePanel from "./BattlePanel";
import {
  CAPTAIN_START,
  WORLD_COLS,
  WORLD_ROWS,
  WOODS_START_X,
  areaForTile,
  colorFor,
  isAdjacent,
  lessonFor,
  monsterAt,
  stepToward,
  talkFor,
  walkDestination,
  WORLD_MONSTERS,
  type WorldMonster,
} from "./world";
import type { Tile } from "./office-layout";

/** A beaten virus is gone until another wanders in — two minutes,
 * the deck's herb regrow rhythm (HERB_REGROW_MS in the deck). */
const MONSTER_RETURN_MS = 120_000;

const POTIONS_KEY = "augi.world-of-logic.potions.v1";
const STARTING_POTIONS = 3;

function loadPotions(): number {
  try {
    const raw = window.localStorage.getItem(POTIONS_KEY);
    if (raw === null) return STARTING_POTIONS;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : STARTING_POTIONS;
  } catch {
    return STARTING_POTIONS;
  }
}

function savePotions(n: number): void {
  try {
    window.localStorage.setItem(POTIONS_KEY, String(n));
  } catch {
    // A blocked store never breaks the world.
  }
}

const LABEL_GLYPH: Record<string, string> = {
  "SPAM CALLER": "📞",
  "PHISHING LURE": "🎣",
  "VIRUS MITE": "🦠",
  "SMOOTH TALKER": "🗣️",
  "RANSOMWARE TROLL": "👹",
};

function glyphFor(label: string): string {
  return LABEL_GLYPH[label] ?? "🦠";
}

export default function WorldOfLogic() {
  const [captain, setCaptain] = useState<Tile>(CAPTAIN_START);
  const [walkTarget, setWalkTarget] = useState<Tile | null>(null);
  const [pendingMonster, setPendingMonster] = useState<WorldMonster | null>(null);
  const [selected, setSelected] = useState<WorldMonster | null>(null);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [record, setRecord] = useState<CaptainBattleRecord>(() => loadCaptainBattleRecord());
  const [captured, setCaptured] = useState<CapturedVirus[]>(() => loadCaptured());
  const [potions, setPotions] = useState<number>(() => loadPotions());
  const [hidden, setHidden] = useState<string[]>([]);
  const [blossom, setBlossom] = useState<BlossomGiantStore>(() => loadBlossomGiantStore());

  const battleRef = useRef<BattleState | null>(battle);
  battleRef.current = battle;
  const capturedRef = useRef(captured);
  capturedRef.current = captured;
  const potionsRef = useRef(potions);
  potionsRef.current = potions;
  const blossomRef = useRef(blossom);
  blossomRef.current = blossom;
  const returnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = returnTimerRef.current;
    return () => {
      if (t) clearTimeout(t);
    };
  }, []);

  const visibleMonsters = useMemo(
    () => WORLD_MONSTERS.filter((m) => !hidden.includes(m.label)),
    [hidden],
  );

  const hideMonster = useCallback((label: string) => {
    setHidden((h) => [...new Set([...h, label])]);
    if (returnTimerRef.current) clearTimeout(returnTimerRef.current);
    returnTimerRef.current = setTimeout(() => setHidden([]), MONSTER_RETURN_MS);
  }, []);

  // ---- Walking --------------------------------------------------------

  const approachMonster = useCallback(
    (m: WorldMonster) => {
      if (battleRef.current) return;
      if (isAdjacent(captain, m.tile)) {
        setWalkTarget(null);
        setPendingMonster(null);
        setSelected(m);
        return;
      }
      setSelected(null);
      setPendingMonster(m);
      setWalkTarget(walkDestination(m.tile, visibleMonsters));
    },
    [captain, visibleMonsters],
  );

  // One step per tick toward the walk target; arriving beside a
  // monster opens its lesson — the first tap of the deck's two.
  useEffect(() => {
    if (!walkTarget || battle) return;
    if (captain.x === walkTarget.x && captain.y === walkTarget.y) {
      setWalkTarget(null);
      if (pendingMonster && isAdjacent(captain, pendingMonster.tile)) {
        setSelected(pendingMonster);
      }
      setPendingMonster(null);
      return;
    }
    const t = setTimeout(() => {
      setCaptain((c) => stepToward(c, walkTarget, visibleMonsters));
    }, 150);
    return () => clearTimeout(t);
  }, [captain, walkTarget, battle, pendingMonster, visibleMonsters]);

  const onTileClick = useCallback(
    (tile: Tile) => {
      if (battleRef.current) return;
      const m = monsterAt(tile, visibleMonsters);
      if (m) {
        approachMonster(m);
        return;
      }
      setSelected(null);
      setPendingMonster(null);
      setWalkTarget(tile);
    },
    [approachMonster, visibleMonsters],
  );

  // Arrow keys / WASD walk one tile; the battle owns the keyboard
  // while it is open (BattlePanel's own listener).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (battleRef.current) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))
        return;
      const key = e.key.toLowerCase();
      const delta =
        key === "arrowup" || key === "w"
          ? { x: 0, y: -1 }
          : key === "arrowdown" || key === "s"
            ? { x: 0, y: 1 }
            : key === "arrowleft" || key === "a"
              ? { x: -1, y: 0 }
              : key === "arrowright" || key === "d"
                ? { x: 1, y: 0 }
                : null;
      if (!delta) return;
      e.preventDefault();
      setWalkTarget(null);
      setPendingMonster(null);
      setCaptain((c) => {
        const next = {
          x: Math.max(0, Math.min(WORLD_COLS - 1, c.x + delta.x)),
          y: Math.max(0, Math.min(WORLD_ROWS - 1, c.y + delta.y)),
        };
        const m = monsterAt(next, visibleMonsters);
        if (m) {
          // Stepping into a monster is walking up to it — the
          // lesson opens, the Captain stays at arm's reach.
          setTimeout(() => setSelected(m), 0);
          return c;
        }
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visibleMonsters]);

  // ---- The battle ------------------------------------------------------

  const openBattle = useCallback((m: WorldMonster) => {
    if (battleRef.current) return;
    const lesson = lessonFor(m.label);
    if (lesson === null) return;
    const enemy = enemyForOutsideMonster(m.label, lesson, m.tile);
    if (!enemy) return;
    setSelected(null);
    setBattle(
      startBattle({
        id: `battle-${Date.now().toString(36)}`,
        area: areaForTile(m.tile),
        enemy,
        allies: [],
      }),
    );
  }, []);

  const settleBattle = useCallback(
    (state: BattleState) => {
      const over = state.over;
      if (!over) return;
      setRecord((rec) => {
        const next =
          over.outcome === "victory"
            ? recordBattleWin(rec)
            : over.outcome === "captured"
              ? recordBattleCapture(recordBattleWin(rec))
              : recordBattleFlee(rec);
        saveCaptainBattleRecord(next);
        return next;
      });
      if (over.outcome === "victory" || over.outcome === "captured") {
        hideMonster(state.enemy.label);
      }
    },
    [hideMonster],
  );

  const playBattleMove = useCallback(
    (move: BattleMoveId, sendId?: string) => {
      const b = battleRef.current;
      if (!b || b.over) return;
      const result = applyBattleMove(b, move, {
        classId: null,
        potionCount: potionsRef.current,
        captured: capturedRef.current,
        ...(sendId ? { sendId } : {}),
        nowIso: new Date().toISOString(),
        blossomBellReady: giantReadyForDay(blossomRef.current, todayNumber()),
      });
      if (result.potionUsed) {
        setPotions((p) => {
          const n = Math.max(0, p - 1);
          savePotions(n);
          return n;
        });
      }
      if (result.capturedVirus) {
        const next = addCaptured(capturedRef.current, result.capturedVirus);
        saveCaptured(next);
        setCaptured(next);
      }
      if (result.blossomBellGiant) {
        const next = recordGiantTurn(blossomRef.current, todayNumber());
        saveBlossomGiantStore(next);
        setBlossom(next);
      }
      if (result.state.over) settleBattle(result.state);
      setBattle(result.state);
    },
    [settleBattle],
  );

  // ---- Rendering --------------------------------------------------------

  const level = captainBattleLevel(record);
  const giantReady = giantReadyForDay(blossom, todayNumber());

  const cells: Tile[] = [];
  for (let y = 0; y < WORLD_ROWS; y++) {
    for (let x = 0; x < WORLD_COLS; x++) cells.push({ x, y });
  }

  return (
    <div style={{ padding: "12px 16px 24px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
      <p style={{ fontSize: 13, color: "#9fb0c9", margin: "4px 0 10px" }}>
        ⚔️ THE BLACK HATTER — CAPTAIN · LV {level} · XP {record.xp} ·{" "}
        {captainBattleXpToNext(record)} XP to LV {level + 1} · IMMORTAL — the level is the game,
        earned by fighting. 🧪 Potions: {potions} · 🎯 Captured: {captured.length}/12
        {captured.length > 0 ? ` — ${captured.map((c) => c.name).join(", ")}` : ""}
      </p>
      <p style={{ fontSize: 13, color: "#9fb0c9", margin: "0 0 10px" }}>
        {giantReady
          ? "🦄 Blossom Bell stands guard — her giant turn is ready today, if a strike ever reaches the Captain himself."
          : "🦄 Blossom Bell's giant turn is spent for today — she rests."}
      </p>

      <div
        role="grid"
        aria-label="The outside — grass and woods"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${WORLD_COLS}, 1fr)`,
          gap: 2,
          userSelect: "none",
          background: "#0d4023",
          border: "2px solid #1f7a3d",
          borderRadius: 12,
          padding: 6,
        }}
      >
        {cells.map((tile) => {
          const m = monsterAt(tile, visibleMonsters);
          const isCaptain = captain.x === tile.x && captain.y === tile.y;
          const inWoods = tile.x >= WOODS_START_X;
          const isSelected = selected && m && selected.label === m.label;
          // The field is lit to be READ (owner's verdict
          // 2026-11-22: the near-black void was part of the
          // defect) — bright grass, a deeper but plainly visible
          // woods, bifocal-legible at a glance.
          const bg = isCaptain
            ? "#d4af37"
            : m
              ? (colorFor(m.label) ?? "#7c2d12")
              : inWoods
                ? (tile.x + tile.y) % 3 === 0
                  ? "#1a7a44"
                  : "#146636"
                : (tile.x + tile.y) % 2 === 0
                  ? "#35ac57"
                  : "#2e9e4f";
          return (
            <button
              key={`${tile.x}-${tile.y}`}
              type="button"
              role="gridcell"
              aria-label={
                isCaptain
                  ? "The Captain"
                  : m
                    ? `${m.label} — walk up to it`
                    : inWoods
                      ? `Woods ${tile.x},${tile.y}`
                      : `Grass ${tile.x},${tile.y}`
              }
              onClick={() => onTileClick(tile)}
              style={{
                aspectRatio: "1",
                border: isSelected ? "2px solid #fbbf24" : "1px solid rgba(0,0,0,0.35)",
                borderRadius: 6,
                background: bg,
                color: "#0b0e14",
                fontSize: "clamp(13px, 2.6vw, 22px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {isCaptain
                ? "∞"
                : m
                  ? glyphFor(m.label)
                  : inWoods && (tile.x * 7 + tile.y * 3) % 5 === 0
                    ? "🌲"
                    : ""}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {visibleMonsters.map((m) => (
          <button
            key={m.label}
            type="button"
            onClick={() => approachMonster(m)}
            style={{
              border: "1px solid #3a4763",
              background: "#101623",
              color: "#eef2f7",
              borderRadius: 999,
              padding: "6px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {glyphFor(m.label)} {m.label} —{" "}
            {areaForTile(m.tile) === "woods" ? "the woods" : "the grass"}
          </button>
        ))}
        {visibleMonsters.length === 0 && (
          <span style={{ fontSize: 13, color: "#9fb0c9" }}>
            The field is clear — beaten monsters wander back in two minutes.
          </span>
        )}
      </div>

      {selected && !battle && (
        <section
          aria-label={`Lesson — ${selected.label}`}
          style={{
            marginTop: 14,
            border: "1px solid #d4af37",
            borderRadius: 10,
            padding: 14,
            background: "#101623",
          }}
        >
          <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>{selected.label}</h2>
          <p style={{ margin: "0 0 6px", fontSize: 14, fontStyle: "italic", color: "#c8d3e4" }}>
            “{talkFor(selected.label)}”
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 14 }}>{lessonFor(selected.label)}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => openBattle(selected)}
              style={{
                background: "#d4af37",
                color: "#0b0e14",
                border: 0,
                borderRadius: 999,
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ⚔️ FIGHT
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              style={{
                background: "transparent",
                color: "#9fb0c9",
                border: "1px solid #3a4763",
                borderRadius: 999,
                padding: "8px 16px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Walk away
            </button>
          </div>
        </section>
      )}

      <p style={{ fontSize: 12.5, color: "#7d8ea9", marginTop: 14, lineHeight: 1.55 }}>
        Walk with the arrow keys or WASD, or tap a tile. Walk up to a monster and its lesson opens
        first — then FIGHT. The right move deals double, the wrong tool half; below half health the
        enemy guards, and sword and staff bounce off the guard — the wand breaks it, the super
        ignores it. A tame virus weakened below a third of its health can be captured and sent into
        a later battle, once per battle. A win is +10 XP, a capture +15 — progress never goes
        backwards.
      </p>

      {battle && (
        <BattlePanel
          battle={battle}
          captainLevel={level}
          classId={null}
          potionCount={potions}
          captured={captured}
          onMove={playBattleMove}
          onClose={() => setBattle(null)}
        />
      )}
    </div>
  );
}
