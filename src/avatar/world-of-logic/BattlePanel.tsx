// TURN-BASED BATTLES — the battle screen (owner order
// 2026-11-07 ~10:53 CST), ported from the VoiceWave Command Deck
// (blackvaultllc/voicewave-command-deck @ 7653d36,
// src/components/hud/BattlePanel.tsx) for the World of Logic room:
// when the Captain walks out and interacts with a virus, it opens
// a battle screen like the Pokémon catch screen / old-school
// Final Fantasy — per-turn, fighting with his powers, executing
// the right things to kill the viruses in the right sequence and
// as quick as possible, like a real cybersecurity defense
// technician. The screen is the fight: the enemy's file (name,
// temperament, lesson), the Captain's gear, the party beside him,
// the moves, and the turn-by-turn log. The weakness is NOT
// labeled — he learns it by fighting (a hit with the right move
// logs CRITICAL). The guard IS shown, plainly, before he picks —
// a sword swung into the guard is his mistake, and the miss is
// real.
//
// The overlay renders through a portal to document.body so it
// sits above the room. Keys 1–6 play the moves, Escape flees —
// the battle owns the keyboard while it is open. A miss is never
// a dice roll: the engine decides everything, this panel only
// renders it. Port changes: the import path, the wol- CSS class
// names, and the no-party line (this room has no temple party —
// the Captain fights alone here).

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MOVE_KEY,
  MOVE_LABEL,
  capturedDamageFor,
  moveError,
  type BattleMoveId,
  type BattleState,
  type CapturedVirus,
} from "./battles";

export interface BattlePanelProps {
  battle: BattleState;
  /** The Captain's IN-GAME level — earned by fighting. */
  captainLevel: number;
  classId: string | null;
  potionCount: number;
  captured: CapturedVirus[];
  onMove: (move: BattleMoveId, sendId?: string) => void;
  /** The battle is over and the Captain walks back out. */
  onClose: () => void;
}

const PLAY_MOVES: BattleMoveId[] = ["sword", "wand", "staff", "super", "potion", "capture"];

function hpPct(hp: number, maxHp: number): number {
  return maxHp <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
}

export default function BattlePanel({
  battle,
  captainLevel,
  classId,
  potionCount,
  captured,
  onMove,
  onClose,
}: BattlePanelProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  // The SEND picker — which captured virus to send in. The
  // move itself is a tap on one of them; CANCEL closes the list.
  const [sendArmed, setSendArmed] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  // The log follows the fight — newest line in view.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [battle.log.length]);

  // The battle owns the keyboard while it is open — 1–6 play
  // the moves, Escape flees. Never while typing in a field.
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const battleRef = useRef(battle);
  battleRef.current = battle;
  useEffect(() => {
    if (battle.over) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))
        return;
      const key = e.key.toLowerCase();
      if (key === "escape") {
        e.preventDefault();
        onMoveRef.current("flee");
        return;
      }
      const move = (Object.keys(MOVE_KEY) as BattleMoveId[]).find(
        (m) => MOVE_KEY[m] === key && m !== "flee",
      );
      if (!move) return;
      e.preventDefault();
      const b = battleRef.current;
      const err = moveError(b, move, {
        classId,
        potionCount,
        captured,
      });
      if (err) return;
      onMoveRef.current(move);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // The class, potion count, and collection are read live
    // through the refs above; the listener itself never re-binds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.over]);

  const enemy = battle.enemy;
  const over = battle.over;
  const sendable = captured.filter((c) => !battle.usedCapturedIds.includes(c.id));

  const moveButton = (move: BattleMoveId) => {
    const err = moveError(battle, move, {
      classId,
      potionCount,
      captured,
    });
    const key = MOVE_KEY[move];
    return (
      <button
        key={move}
        type="button"
        className="wol-menu-row"
        disabled={!!err || !!over}
        title={err ?? undefined}
        onClick={() => onMove(move)}
      >
        <span className="wol-wol-menu-row-main">
          <span className="wol-wol-menu-row-label">
            {MOVE_LABEL[move]}
            {key ? ` (${key})` : ""}
            {move === "super" && battle.superCooldownLeft > 0
              ? ` — ${battle.superCooldownLeft}r`
              : ""}
          </span>
          {err ? (
            <span className="wol-wol-menu-row-sub">{err}</span>
          ) : move === "potion" ? (
            <span className="wol-wol-menu-row-sub">{potionCount} in the pack</span>
          ) : move === "super" ? (
            <span className="wol-wol-menu-row-sub">30 damage, ignores the guard</span>
          ) : move === "capture" ? (
            <span className="wol-wol-menu-row-sub">
              {enemy.temperament === "tame"
                ? "Catch it — tame, once weakened"
                : "Too rigid to catch"}
            </span>
          ) : null}
        </span>
        <span className="wol-wol-menu-row-chevron">›</span>
      </button>
    );
  };

  const body = (
    <div
      className="wol-battle"
      role="dialog"
      aria-modal="true"
      aria-label={`Battle — ${enemy.name}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        display: "flex",
        flexDirection: "column",
        background: "rgba(2, 6, 12, 0.97)",
        color: "#e5e7eb",
        overflow: "auto",
        padding: "16px",
      }}
    >
      <div style={{ maxWidth: 720, width: "100%", margin: "0 auto" }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
          ⚔️ BATTLE — {enemy.name}
        </h2>
        <p className="wol-text-xs" style={{ opacity: 0.8 }}>
          {battle.area === "woods" ? "In the woods" : "On the grass"} — Round {battle.round} —{" "}
          {enemy.temperament === "tame"
            ? "Calm, tame — it can be caught"
            : "Rigid — it has to be defeated"}
        </p>

        {/* The enemy's file — what it is, what it teaches. */}
        <section
          className="wol-menu-section"
          aria-label="Enemy"
          style={{ border: "1px solid #7c2d12", borderRadius: 8, padding: 12, marginTop: 12 }}
        >
          <h3 className="wol-menu-section-title">{enemy.name}</h3>
          <p className="wol-text-xs">{enemy.lesson}</p>
          <p className="wol-text-xs" style={{ marginTop: 6 }}>
            HP {enemy.hp} / {enemy.maxHp}
          </p>
          <div
            role="progressbar"
            aria-label={`${enemy.name} health`}
            aria-valuenow={enemy.hp}
            aria-valuemin={0}
            aria-valuemax={enemy.maxHp}
            style={{ height: 10, background: "#1f2937", borderRadius: 5, overflow: "hidden" }}
          >
            <div
              style={{
                width: `${hpPct(enemy.hp, enemy.maxHp)}%`,
                height: "100%",
                background: enemy.hp <= enemy.maxHp / 3 ? "#dc2626" : "#ea580c",
              }}
            />
          </div>
          <p className="wol-text-xs" style={{ marginTop: 6, fontWeight: 700 }}>
            {enemy.guarding
              ? "🛡️ GUARDING — sword and staff bounce off. The wand breaks the guard, the super ignores it."
              : "⚔️ ATTACKING — every move lands. The right move deals double."}
          </p>
        </section>

        {/* The Captain — immortal, and his game level. */}
        <section className="wol-menu-section" aria-label="Captain" style={{ marginTop: 12 }}>
          <h3 className="wol-menu-section-title">THE BLACK HATTER — CAPTAIN</h3>
          <p className="wol-text-xs">
            LV {captainLevel} · IMMORTAL — he cannot die. The level is the game, earned by fighting.{" "}
            {classId ? `Class: ${classId}.` : "No class chosen yet."} Gear: Super Beast Sword, Magic
            Wand, Wizard Staff.
          </p>
          {battle.allies.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p className="wol-text-xs" style={{ fontWeight: 700 }}>
                PARTY — fighting beside him
              </p>
              {battle.allies.map((a) => (
                <p key={a.workerId} className="wol-text-xs">
                  {a.name} — HP {a.hp} / {a.maxHp}
                  {a.hp <= 0 ? " — KNOCKED OUT of this battle" : ""}
                </p>
              ))}
            </div>
          )}
          {battle.allies.length === 0 && (
            <p className="wol-text-xs" style={{ marginTop: 8 }}>
              No party with him — in this room he fights alone, and he is immortal.
            </p>
          )}
        </section>

        {/* The moves — or the result, when the fight is over. */}
        {over ? (
          <section
            className="wol-menu-section"
            aria-label="Battle result"
            style={{ marginTop: 12 }}
          >
            <h3 className="wol-menu-section-title">
              {over.outcome === "victory"
                ? "🏆 VICTORY"
                : over.outcome === "captured"
                  ? "🎯 CAPTURED"
                  : "🏃 WALKED AWAY"}
            </h3>
            <p className="wol-text-xs">
              {over.outcome === "victory"
                ? `${enemy.name} defeated — +10 XP. The party earned their share.`
                : over.outcome === "captured"
                  ? `${enemy.name} caught — +15 XP. It fights for the Captain now.`
                  : "Walked away — nothing lost, nothing gained. The virus is still out there."}
            </p>
            <button
              type="button"
              className="wol-menu-row"
              onClick={onClose}
              style={{ marginTop: 8 }}
            >
              <span className="wol-wol-menu-row-main">
                <span className="wol-wol-menu-row-label">BACK TO THE WORLD</span>
              </span>
              <span className="wol-wol-menu-row-chevron">›</span>
            </button>
          </section>
        ) : (
          <section className="wol-menu-section" aria-label="Moves" style={{ marginTop: 12 }}>
            <h3 className="wol-menu-section-title">YOUR MOVE — ROUND {battle.round}</h3>
            {PLAY_MOVES.map(moveButton)}
            {/* SEND — pick a captured virus to send in. */}
            {sendArmed ? (
              <div style={{ marginTop: 8 }}>
                <p className="wol-text-xs" style={{ fontWeight: 700 }}>
                  SEND — pick one. One send per virus per battle.
                </p>
                {sendable.length === 0 ? (
                  <p className="wol-text-xs">Every captured virus is already out in this fight.</p>
                ) : (
                  sendable.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="wol-menu-row"
                      onClick={() => {
                        setSendArmed(false);
                        onMove("send", c.id);
                      }}
                    >
                      <span className="wol-wol-menu-row-main">
                        <span className="wol-wol-menu-row-label">📤 SEND {c.name}</span>
                        <span className="wol-wol-menu-row-sub">
                          {capturedDamageFor(c.kind)} damage — caught{" "}
                          {new Date(c.capturedAt).toLocaleDateString()}
                        </span>
                      </span>
                      <span className="wol-wol-menu-row-chevron">›</span>
                    </button>
                  ))
                )}
                <button type="button" className="wol-menu-row" onClick={() => setSendArmed(false)}>
                  <span className="wol-wol-menu-row-main">
                    <span className="wol-wol-menu-row-label">CANCEL</span>
                  </span>
                  <span className="wol-wol-menu-row-chevron">›</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="wol-menu-row"
                disabled={captured.length === 0 || sendable.length === 0 || !!over}
                title={
                  captured.length === 0
                    ? "Nothing captured yet — catch a tame virus first."
                    : sendable.length === 0
                      ? "Every captured virus is already out in this fight."
                      : undefined
                }
                onClick={() => setSendArmed(true)}
              >
                <span className="wol-wol-menu-row-main">
                  <span className="wol-wol-menu-row-label">📤 SEND A CAPTURED VIRUS</span>
                  <span className="wol-wol-menu-row-sub">
                    {captured.length === 0
                      ? "Nothing captured yet — catch a tame virus first"
                      : `${captured.length} captured — ${sendable.length} ready to send`}
                  </span>
                </span>
                <span className="wol-wol-menu-row-chevron">›</span>
              </button>
            )}
            <button
              type="button"
              className="wol-menu-row"
              disabled={!!over}
              onClick={() => onMove("flee")}
            >
              <span className="wol-wol-menu-row-main">
                <span className="wol-wol-menu-row-label">🏃 FLEE (Esc)</span>
                <span className="wol-wol-menu-row-sub">
                  Walk away — nothing lost, nothing gained
                </span>
              </span>
              <span className="wol-wol-menu-row-chevron">›</span>
            </button>
          </section>
        )}

        {/* The turn-by-turn record. */}
        <section
          className="wol-menu-section"
          aria-label="Battle log"
          style={{ marginTop: 12, paddingBottom: 24 }}
        >
          <h3 className="wol-menu-section-title">THE FIGHT, TURN BY TURN</h3>
          <div
            ref={logRef}
            style={{
              maxHeight: 220,
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {battle.log.map((line, i) => (
              <p key={i} className="wol-text-xs" style={{ margin: 0 }}>
                {line}
              </p>
            ))}
          </div>
        </section>
      </div>
    </div>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(body, document.body);
  }
  return body;
}
