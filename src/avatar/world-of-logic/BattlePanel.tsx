// TURN-BASED BATTLES — the battle screen (owner order
// 2026-11-07 ~10:53 CST), ported from the VoiceWave Command Deck
// (blackvaultllc/voicewave-command-deck @ 7653d36,
// src/components/hud/BattlePanel.tsx) for the World of Logic room.
// The engine (battles.ts) decides everything; this panel only
// renders it.
//
// PRESENTATION REBUILD (owner's verdict from his own screen,
// 2026-11-22 ~16:14 EST — "this is not how this game should look
// at all"): the old screen stacked text panels — enemy file,
// Captain paragraphs, victory block, turn log — over a near-black
// void. The battle now opens as a real fight scene in the standing
// Final Fantasy frame:
//   1. THE SCENE (the enemy/scene box): the Black Hatter and the
//      monster stand on the grass/woods ground as figures facing
//      off, bright enough to see. The enemy's nameplate rides the
//      scene — name, temperament, lesson, HP as a bar, the guard
//      shown plainly before he picks.
//   2. THE FIGHTER BOX: the Captain (level, IMMORTAL) and any
//      party beside him, HP as bars.
//   3. THE COMMAND BOX: the moves. The ATTACK row opens the
//      attack-choice box right beside it (the standing rule) —
//      sword, wand, staff, super.
// The fighters MOVE: a landed hit lunges the attacker, shakes the
// target, and floats the damage number up (gold on a CRITICAL);
// the enemy lunges back when a strike reaches the party. The
// turn-by-turn record still exists — as a compact log strip
// inside the frame, not the page's main content. Keys 1–6 play
// the moves, Escape flees — the battle owns the keyboard while
// it is open. A miss is never a dice roll: the engine decided
// it before this panel drew anything.

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
import { MONSTER_DEFS } from "./temple";
import type { TempleMonsterKind } from "./temple";

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

const ATTACK_MOVES: BattleMoveId[] = ["sword", "wand", "staff", "super"];
const COMMAND_MOVES: BattleMoveId[] = ["potion", "capture"];

function hpPct(hp: number, maxHp: number): number {
  return maxHp <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
}

/** The Captain's figure — the Black Hatter: top hat with a gold
 * band, the ∞ medallion, sword in hand, facing the enemy. */
function CaptainFigure() {
  return (
    <svg
      viewBox="0 0 120 150"
      className="wol-bf-figure-svg"
      role="img"
      aria-label="The Black Hatter"
    >
      {/* sword arm, reaching toward the enemy (his left) */}
      <path d="M38 84 L14 96 L20 104 L42 96 Z" fill="#1f2a44" />
      {/* the Super Beast Sword */}
      <path d="M16 92 L2 74 L8 70 L20 88 Z" fill="#d7dee9" stroke="#8fa3bf" strokeWidth="1" />
      <rect x="14" y="86" width="12" height="4" rx="2" fill="#d4af37" transform="rotate(-38 20 88)" />
      {/* coat body */}
      <path d="M42 78 Q60 70 78 78 L86 138 Q60 146 34 138 Z" fill="#141c30" stroke="#2c3a5c" strokeWidth="2" />
      {/* coat opening + shirt */}
      <path d="M54 76 L60 96 L66 76 L64 138 L56 138 Z" fill="#e8ecf3" />
      {/* the ∞ medallion */}
      <circle cx="60" cy="106" r="8" fill="#0b0e14" stroke="#d4af37" strokeWidth="2" />
      <text x="60" y="111" textAnchor="middle" fontSize="11" fill="#d4af37" fontWeight="700">
        ∞
      </text>
      {/* head */}
      <circle cx="60" cy="52" r="16" fill="#8a5a33" stroke="#5d3c20" strokeWidth="1.5" />
      {/* eyes + set jaw */}
      <circle cx="54" cy="50" r="2" fill="#14100c" />
      <circle cx="66" cy="50" r="2" fill="#14100c" />
      <path d="M52 62 Q60 59 68 62" stroke="#3d2716" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* the black hat — wide brim, tall crown, gold band */}
      <ellipse cx="60" cy="38" rx="30" ry="6" fill="#0b0e14" stroke="#2c3a5c" strokeWidth="1.5" />
      <path d="M42 38 L46 10 Q60 5 74 10 L78 38 Z" fill="#0b0e14" stroke="#2c3a5c" strokeWidth="1.5" />
      <path d="M44 30 L76 30 L77 38 L43 38 Z" fill="#d4af37" />
      {/* staff arm (his right) with the Wizard Staff */}
      <path d="M80 84 L98 74 L102 82 L84 94 Z" fill="#1f2a44" />
      <line x1="100" y1="76" x2="108" y2="34" stroke="#7c4a21" strokeWidth="4" strokeLinecap="round" />
      <circle cx="109" cy="29" r="7" fill="#7dd3fc" stroke="#e0f2fe" strokeWidth="2" />
    </svg>
  );
}

/** The monster's figure — a body in its kind's colour, shaped by
 * what it is: spikes on the viruses, a handset on the callers, a
 * grin on the talker, a cap on the gang member. */
function MonsterFigure({ kind }: { kind: TempleMonsterKind }) {
  const color = MONSTER_DEFS[kind].color;
  const spiky = kind === "virus-mite" || kind === "hardcore-virus";
  const caller = kind === "spam-caller" || kind === "scam-caller";
  return (
    <svg
      viewBox="0 0 130 120"
      className="wol-bf-figure-svg"
      role="img"
      aria-label={MONSTER_DEFS[kind].name}
    >
      {spiky &&
        [18, 42, 65, 88, 108].map((x, i) => (
          <path
            key={x}
            d={`M${x} ${i % 2 === 0 ? 26 : 20} L${x + 6} ${i % 2 === 0 ? 8 : 4} L${x + 12} ${i % 2 === 0 ? 26 : 20} Z`}
            fill={color}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="1"
          />
        ))}
      {/* feet */}
      <ellipse cx="42" cy="106" rx="13" ry="5" fill="rgba(0,0,0,0.4)" />
      <ellipse cx="88" cy="106" rx="13" ry="5" fill="rgba(0,0,0,0.4)" />
      {/* body */}
      <path
        d="M65 18 Q104 22 108 58 Q110 92 84 100 Q65 106 46 100 Q20 92 22 58 Q26 22 65 18 Z"
        fill={color}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth="2"
      />
      {/* belly shade */}
      <ellipse cx="65" cy="80" rx="24" ry="16" fill="rgba(255,255,255,0.16)" />
      {kind === "gang-member" && (
        <>
          {/* cap */}
          <path d="M34 30 Q65 8 96 30 L96 22 Q65 2 34 22 Z" fill="#1c1917" />
          <rect x="88" y="24" width="26" height="6" rx="3" fill="#1c1917" />
          {/* gold chain */}
          <path d="M44 66 Q65 80 86 66" stroke="#d4af37" strokeWidth="3.5" fill="none" />
        </>
      )}
      {/* eyes */}
      <circle cx="48" cy="52" r="9" fill="#ffffff" />
      <circle cx="82" cy="52" r="9" fill="#ffffff" />
      <circle cx="50" cy="54" r="4" fill="#14100c" />
      <circle cx="84" cy="54" r="4" fill="#14100c" />
      {/* brows — set, hostile */}
      <path d="M38 42 L58 47" stroke="rgba(0,0,0,0.55)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M92 42 L72 47" stroke="rgba(0,0,0,0.55)" strokeWidth="3.5" strokeLinecap="round" />
      {/* mouth — the talker's grin is widest */}
      {kind === "social-engineer" ? (
        <path d="M40 72 Q65 90 90 72 Q65 80 40 72 Z" fill="#2b0a0a" />
      ) : (
        <>
          <path d="M46 74 Q65 84 84 74 L80 86 Q65 92 50 86 Z" fill="#2b0a0a" />
          <path d="M54 76 L58 84 L62 77 Z" fill="#ffffff" />
          <path d="M70 77 L74 84 L78 76 Z" fill="#ffffff" />
        </>
      )}
      {caller && (
        <>
          {/* the handset it never puts down */}
          <path
            d="M104 58 q14 4 12 18 q-8 2 -12 -2 q-2 -8 0 -16 Z"
            fill="#1f2937"
            stroke="rgba(0,0,0,0.4)"
            strokeWidth="1.5"
          />
          <path d="M112 34 q10 8 8 20" stroke="rgba(255,255,255,0.65)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M118 26 q14 12 11 30" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/** A pine for the woods backdrop of the scene. */
function Pine({ x, scale }: { x: number; scale: number }) {
  return (
    <svg
      viewBox="0 0 40 90"
      className="wol-bf-pine"
      style={{ left: `${x}%`, transform: `scale(${scale})` }}
      aria-hidden="true"
    >
      <rect x="17" y="70" width="6" height="18" fill="#3d2716" />
      <path d="M20 2 L36 34 L26 34 L40 60 L0 60 L14 34 L4 34 Z" fill="#0a4023" />
    </svg>
  );
}

interface BattleFx {
  id: number;
  captainLunge: boolean;
  enemyHit: boolean;
  enemyLunge: boolean;
  captainHit: boolean;
  dmg: number | null;
  crit: boolean;
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
  // The attack-choice box sits open beside the Attack menu —
  // the standing rule — until he folds it away.
  const [attackOpen, setAttackOpen] = useState(true);
  const logRef = useRef<HTMLDivElement | null>(null);

  // The log follows the fight — newest line in view.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [battle.log.length]);

  // ---- The fight, animated --------------------------------------
  // Each new turn replays in the scene: whoever landed the hit
  // lunges, the target shakes, and the damage number floats up —
  // gold when the engine logged a CRITICAL. Presentation only:
  // every number here is read back out of the state the engine
  // already settled.
  const prevRef = useRef<{ enemyHp: number; alliesHp: number; logLen: number } | null>(null);
  const [fx, setFx] = useState<BattleFx | null>(null);
  useEffect(() => {
    const alliesHp = battle.allies.reduce((s, a) => s + a.hp, 0);
    const prev = prevRef.current;
    prevRef.current = { enemyHp: battle.enemy.hp, alliesHp, logLen: battle.log.length };
    if (!prev || battle.log.length === prev.logLen) return;
    const enemyDmg = prev.enemyHp - battle.enemy.hp;
    const alliesDmg = prev.alliesHp - alliesHp;
    const newLines = battle.log.slice(prev.logLen).join(" ");
    const next: BattleFx = {
      id: battle.log.length,
      captainLunge: enemyDmg > 0,
      enemyHit: enemyDmg > 0,
      enemyLunge: alliesDmg > 0,
      captainHit: alliesDmg > 0,
      dmg: enemyDmg > 0 ? enemyDmg : null,
      crit: newLines.includes("CRITICAL"),
    };
    setFx(next);
    const t = setTimeout(() => {
      setFx((f) => (f && f.id === next.id ? null : f));
    }, 780);
    return () => clearTimeout(t);
  }, [battle]);

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
  const enemyDefeated = over?.outcome === "victory";
  const enemyCaught = over?.outcome === "captured";

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
        className="wol-bf-row"
        disabled={!!err || !!over}
        title={err ?? undefined}
        onClick={() => onMove(move)}
      >
        <span className="wol-bf-row-main">
          <span className="wol-bf-row-label">
            {MOVE_LABEL[move]}
            {key ? ` (${key})` : ""}
            {move === "super" && battle.superCooldownLeft > 0
              ? ` — ${battle.superCooldownLeft}r`
              : ""}
          </span>
          {err ? (
            <span className="wol-bf-row-sub">{err}</span>
          ) : move === "potion" ? (
            <span className="wol-bf-row-sub">{potionCount} in the pack</span>
          ) : move === "super" ? (
            <span className="wol-bf-row-sub">30 damage, ignores the guard</span>
          ) : move === "capture" ? (
            <span className="wol-bf-row-sub">
              {enemy.temperament === "tame"
                ? "Catch it — tame, once weakened"
                : "Too rigid to catch"}
            </span>
          ) : move === "sword" ? (
            <span className="wol-bf-row-sub">The Super Beast Sword</span>
          ) : move === "wand" ? (
            <span className="wol-bf-row-sub">The Magic Wand — breaks the guard</span>
          ) : move === "staff" ? (
            <span className="wol-bf-row-sub">The Wizard Staff</span>
          ) : null}
        </span>
        <span className="wol-bf-row-chevron">›</span>
      </button>
    );
  };

  const body = (
    <div
      className="wol-battle"
      role="dialog"
      aria-modal="true"
      aria-label={`Battle — ${enemy.name}`}
    >
      {/* ============ THE SCENE — the enemy/scene box ============ */}
      <div
        className={`wol-bf-scene wol-bf-scene--${battle.area}`}
        data-testid="wol-battle-scene"
        data-area={battle.area}
      >
        {battle.area === "woods" && (
          <div className="wol-bf-tree-line" aria-hidden="true">
            <Pine x={2} scale={1.15} />
            <Pine x={16} scale={0.9} />
            <Pine x={58} scale={1.05} />
            <Pine x={74} scale={0.85} />
            <Pine x={90} scale={1.2} />
          </div>
        )}
        <p className="wol-bf-scene-line">
          ⚔️ BATTLE — {battle.area === "woods" ? "In the woods" : "On the grass"} — Round{" "}
          {battle.round}
        </p>

        {/* The enemy's nameplate — its file, riding the scene:
            name, temperament, the lesson, HP as a bar, and the
            guard shown plainly before he picks. */}
        <section className="wol-bf-nameplate" aria-label="Enemy" data-testid="wol-enemy-plate">
          <h3 className="wol-bf-plate-name">{enemy.name}</h3>
          <p className="wol-bf-plate-line">
            {enemy.temperament === "tame"
              ? "Calm, tame — it can be caught"
              : "Rigid — it has to be defeated"}
          </p>
          <p className="wol-bf-plate-lesson">{enemy.lesson}</p>
          <p className="wol-bf-plate-hp">
            HP {enemy.hp} / {enemy.maxHp}
          </p>
          <div
            className="wol-bf-hpbar"
            role="progressbar"
            aria-label={`${enemy.name} health`}
            aria-valuenow={enemy.hp}
            aria-valuemin={0}
            aria-valuemax={enemy.maxHp}
          >
            <div
              className="wol-bf-hpbar-fill wol-bf-hpbar-fill--enemy"
              style={{ width: `${hpPct(enemy.hp, enemy.maxHp)}%` }}
            />
          </div>
          <p className="wol-bf-plate-guard">
            {enemy.guarding
              ? "🛡️ GUARDING — sword and staff bounce off. The wand breaks the guard, the super ignores it."
              : "⚔️ ATTACKING — every move lands. The right move deals double."}
          </p>
        </section>

        {/* The monster, standing in the scene. */}
        <div
          className={[
            "wol-bf-fighter wol-bf-fighter--enemy",
            fx?.enemyHit ? "wol-bf-hit" : "",
            fx?.enemyLunge ? "wol-bf-lunge-r" : "",
            enemyDefeated ? "wol-bf-defeated" : "",
            enemyCaught ? "wol-bf-caught" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-testid="wol-battle-enemy-figure"
        >
          <MonsterFigure kind={enemy.kind} />
          {enemy.guarding && !over && (
            <span className="wol-bf-guard-badge" aria-hidden="true">
              🛡️
            </span>
          )}
          {fx?.dmg != null && (
            <span
              key={fx.id}
              className={`wol-bf-dmg${fx.crit ? " wol-bf-dmg--crit" : ""}`}
              aria-hidden="true"
            >
              {fx.crit ? `CRITICAL ${fx.dmg}!` : `-${fx.dmg}`}
            </span>
          )}
        </div>

        {/* The Captain, facing the monster — party beside him. */}
        <div
          className={[
            "wol-bf-fighter wol-bf-fighter--captain",
            fx?.captainLunge ? "wol-bf-lunge-l" : "",
            fx?.captainHit ? "wol-bf-hit" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-testid="wol-battle-captain-figure"
        >
          <CaptainFigure />
        </div>
        {battle.allies.length > 0 && (
          <div className="wol-bf-allies" aria-hidden="true">
            {battle.allies.map((a) => (
              <span key={a.workerId} className="wol-bf-ally-chip" title={a.name}>
                {a.name.charAt(0)}
              </span>
            ))}
          </div>
        )}

        {/* The result, bannered across the scene. */}
        {over && (
          <p className="wol-bf-banner" data-testid="wol-battle-banner">
            {over.outcome === "victory"
              ? `${enemy.name} DEFEATED`
              : over.outcome === "captured"
                ? `${enemy.name} CAUGHT`
                : "WALKED OFF"}
          </p>
        )}
      </div>

      {/* ============ THE LOG — compact, inside the frame ============ */}
      <section className="wol-bf-log" aria-label="Battle log">
        <h3 className="wol-bf-log-title">THE FIGHT — TURN BY TURN</h3>
        <div ref={logRef} className="wol-bf-log-lines">
          {battle.log.map((line, i) => (
            <p key={i} className="wol-bf-log-line">
              {line}
            </p>
          ))}
        </div>
      </section>

      {/* ============ THE BOXES — fighter + command ============ */}
      <div className="wol-bf-boxes">
        <div className="wol-bf-command-wrap">
          {/* The command box — or the result, when the fight ends. */}
          {over ? (
            <section
              className="wol-bf-box wol-bf-box--command"
              aria-label="Battle result"
              data-testid="wol-box-command"
            >
              <h3 className="wol-bf-box-title">
                {over.outcome === "victory"
                  ? "🏆 VICTORY"
                  : over.outcome === "captured"
                    ? "🎯 CAPTURED"
                    : "🏃 WALKED AWAY"}
              </h3>
              <p className="wol-bf-box-line">
                {over.outcome === "victory"
                  ? `${enemy.name} defeated — +10 XP. The party earned their share.`
                  : over.outcome === "captured"
                    ? `${enemy.name} caught — +15 XP. It fights for the Captain now.`
                    : "Walked away — nothing lost, nothing gained. The virus is still out there."}
              </p>
              <button type="button" className="wol-bf-row" onClick={onClose}>
                <span className="wol-bf-row-main">
                  <span className="wol-bf-row-label">BACK TO THE WORLD</span>
                </span>
                <span className="wol-bf-row-chevron">›</span>
              </button>
            </section>
          ) : (
            <section
              className="wol-bf-box wol-bf-box--command"
              aria-label="Moves"
              data-testid="wol-box-command"
            >
              <h3 className="wol-bf-box-title">YOUR MOVE — ROUND {battle.round}</h3>
              <button
                type="button"
                className="wol-bf-row"
                aria-expanded={attackOpen}
                onClick={() => {
                  setSendArmed(false);
                  setAttackOpen((o) => !o);
                }}
              >
                <span className="wol-bf-row-main">
                  <span className="wol-bf-row-label">⚔️ ATTACK</span>
                  <span className="wol-bf-row-sub">Sword · Wand · Staff · Super</span>
                </span>
                <span className="wol-bf-row-chevron">{attackOpen ? "‹" : "›"}</span>
              </button>
              {COMMAND_MOVES.map(moveButton)}
              <button
                type="button"
                className="wol-bf-row"
                disabled={captured.length === 0 || sendable.length === 0}
                title={
                  captured.length === 0
                    ? "Nothing captured yet — catch a tame virus first."
                    : sendable.length === 0
                      ? "Every captured virus is already out in this fight."
                      : undefined
                }
                onClick={() => {
                  setAttackOpen(false);
                  setSendArmed(true);
                }}
              >
                <span className="wol-bf-row-main">
                  <span className="wol-bf-row-label">📤 SEND A CAPTURED VIRUS</span>
                  <span className="wol-bf-row-sub">
                    {captured.length === 0
                      ? "Nothing captured yet — catch a tame virus first"
                      : `${captured.length} captured — ${sendable.length} ready to send`}
                  </span>
                </span>
                <span className="wol-bf-row-chevron">›</span>
              </button>
              <button type="button" className="wol-bf-row" onClick={() => onMove("flee")}>
                <span className="wol-bf-row-main">
                  <span className="wol-bf-row-label">🏃 FLEE (Esc)</span>
                  <span className="wol-bf-row-sub">Walk away — nothing lost, nothing gained</span>
                </span>
                <span className="wol-bf-row-chevron">›</span>
              </button>
            </section>
          )}

          {/* The attack-choice box — right beside the Attack menu. */}
          {!over && attackOpen && !sendArmed && (
            <section
              className="wol-bf-box wol-bf-box--attack"
              aria-label="Attack moves"
              data-testid="wol-box-attack"
            >
              <h3 className="wol-bf-box-title">ATTACK — PICK THE TOOL</h3>
              {ATTACK_MOVES.map(moveButton)}
            </section>
          )}

          {/* The SEND picker — the same slot beside the command box. */}
          {!over && sendArmed && (
            <section
              className="wol-bf-box wol-bf-box--attack"
              aria-label="Send a captured virus"
              data-testid="wol-box-send"
            >
              <h3 className="wol-bf-box-title">SEND — PICK ONE</h3>
              <p className="wol-bf-box-line">One send per virus per battle.</p>
              {sendable.length === 0 ? (
                <p className="wol-bf-box-line">
                  Every captured virus is already out in this fight.
                </p>
              ) : (
                sendable.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="wol-bf-row"
                    onClick={() => {
                      setSendArmed(false);
                      onMove("send", c.id);
                    }}
                  >
                    <span className="wol-bf-row-main">
                      <span className="wol-bf-row-label">📤 SEND {c.name}</span>
                      <span className="wol-bf-row-sub">
                        {capturedDamageFor(c.kind)} damage — caught{" "}
                        {new Date(c.capturedAt).toLocaleDateString()}
                      </span>
                    </span>
                    <span className="wol-bf-row-chevron">›</span>
                  </button>
                ))
              )}
              <button type="button" className="wol-bf-row" onClick={() => setSendArmed(false)}>
                <span className="wol-bf-row-main">
                  <span className="wol-bf-row-label">CANCEL</span>
                </span>
                <span className="wol-bf-row-chevron">›</span>
              </button>
            </section>
          )}
        </div>

        {/* The fighter box — the Captain and his party. */}
        <section
          className="wol-bf-box wol-bf-box--fighter"
          aria-label="Captain"
          data-testid="wol-box-fighter"
        >
          <h3 className="wol-bf-box-title">THE BLACK HATTER — CAPTAIN</h3>
          <p className="wol-bf-box-line">
            LV {captainLevel} · IMMORTAL — he cannot die. The level is the game, earned by
            fighting. {classId ? `Class: ${classId}.` : "No class chosen yet."} Gear: Super Beast
            Sword, Magic Wand, Wizard Staff.
          </p>
          {battle.allies.length > 0 ? (
            <div className="wol-bf-party">
              <p className="wol-bf-box-line wol-bf-party-title">PARTY — fighting beside him</p>
              {battle.allies.map((a) => (
                <div key={a.workerId} className="wol-bf-ally">
                  <p className="wol-bf-box-line">
                    {a.name} — HP {a.hp} / {a.maxHp}
                    {a.hp <= 0 ? " — KNOCKED OUT of this battle" : ""}
                  </p>
                  <div
                    className="wol-bf-hpbar"
                    role="progressbar"
                    aria-label={`${a.name} health`}
                    aria-valuenow={a.hp}
                    aria-valuemin={0}
                    aria-valuemax={a.maxHp}
                  >
                    <div
                      className="wol-bf-hpbar-fill wol-bf-hpbar-fill--ally"
                      style={{ width: `${hpPct(a.hp, a.maxHp)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="wol-bf-box-line">
              No party with him — in this room he fights alone, and he is immortal.
            </p>
          )}
        </section>
      </div>
    </div>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(body, document.body);
  }
  return body;
}
