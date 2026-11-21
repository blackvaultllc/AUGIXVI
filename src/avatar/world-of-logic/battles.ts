// TURN-BASED BATTLES (owner order 2026-11-07 ~10:53 CST —
// delivered as a freestyle rap so the builder understands his
// brain): back in the day he played emulators — Legend of
// Legaia, Chrono Trigger, Breath of Fire; walk up and kill
// things. When he walks OUT of the office and interacts with a
// virus, it opens a battle screen like the Pokémon catch screen
// / old-school Final Fantasy — PER-TURN, fighting with his
// powers, executing the right things to kill the viruses in the
// right sequence and as quick as possible, like a real
// cybersecurity defense technician going to a company to fight
// a virus. Viruses have temperaments — some calm/tame, some
// rigid — and he can CAPTURE some like Pokémon and use them
// against other viruses in a logical way. The outside becomes
// strategic. CYBERSECURITY IS PRIMARY.
//
// Rules, all enforced here and unit-tested:
//  - Combat is OUTSIDE only, never on employees, never in the
//    office. The enemies are the outside monsters that already
//    stand on the grass and in the woods (SPAM CALLER, PHISHING
//    LURE, VIRUS MITE, SMOOTH TALKER, RANSOMWARE TROLL), each
//    with the lesson it already carries. The temple keeps its
//    own real-time sword combat — battles are the outside way.
//  - THE CAPTAIN STARTS AT LEVEL 1 in the game and levels up by
//    fighting. His IMMORTAL power stays — he cannot die, so the
//    level is the game progression, earned by fighting, on the
//    same slow curve as the crew (20*L XP to climb). The sheet
//    shows the game level, never ∞, in the game.
//  - A MISS IS REAL: the enemy guards when its HP falls below
//    half — a sword or staff swung into the guard BOUNCES OFF
//    (0 damage, the turn spent, and the log says MISS). The
//    guard is shown on screen before he picks, so a miss is his
//    mistake, not a dice roll. The wand breaks the guard; the
//    super ignores it. The right move in the right sequence
//    kills quicker: the weakness move deals double, the
//    resisted move deals half.
//  - PARTY: adventurers party up NATURALLY or when he needs
//    help — NEVER instantaneously/automatically. A battle uses
//    the party he already invited (temple PARTY tab) — nobody
//    is added by the battle. Each standing member strikes for
//    5 after his move. A member knocked out is out of THIS
//    battle only — the party stands, they keep what they
//    earned, they earn nothing from a battle they fell in.
//  - CAPTURE: a calm/tame virus, weakened below a third of its
//    HP, can be captured — and a capture always works when the
//    conditions hold (calculated, never a dice roll). A rigid
//    virus can never be caught — it has to be defeated. A
//    captured virus joins a small collection (max 12) and can
//    be SENT against another virus once per battle.
//  - FORWARD-ONLY (standing rule): progress never goes
//    backwards. A win is +10 XP, a capture +5 on top; a flee
//    costs nothing and takes nothing; a miss is a learning
//    experience, never a loss of level or gear.
//  - The Captain is IMMORTAL: an enemy with no party member to
//    hit swings at him and it bounces off — the log says so.
//  - FAMILIAR (this build, NOT a later one): Blossom Bell the
//    unicorn joins battles as his PROTECTOR — not as a 20-HP
//    ally (she is super ultra powerful, she cannot be knocked
//    out of a battle). When the enemy's strike is aimed at the
//    Captain himself — nobody standing to take it — she turns
//    GIANT and destroys it, once per in-world day. See
//    `applyBattleMove`'s blossomBellReady input.
//  - IN-WORLD only, never real money, never a real-world effect.
//
// Pure, except the localStorage stores (injectable for tests,
// guarded so prerender returns empty instead of throwing).

import { levelForXp, xpForNextLevel } from "./crew-levels";
import { PARTY_DAMAGE } from "./party-pvp";
import {
  MONSTER_DEFS,
  SUPER_DAMAGE,
  swordDamageFor,
  type TempleMonster,
  type TempleMonsterKind,
} from "./temple";
import type { Tile } from "./office-layout";

// ---- The outside monsters ----------------------------------------

/** A virus's temperament — calm/tame ones can be caught, rigid
 * ones never can. */
export type Temperament = "tame" | "rigid";

/** A battle move the Captain can play. */
export type BattleMoveId =
  | "sword"
  | "wand"
  | "staff"
  | "super"
  | "potion"
  | "capture"
  | "send"
  | "flee";

/** The moves that deal damage — the weakness and the resist
 * name one of these. */
export type DamageMoveId = "sword" | "wand" | "staff" | "super";

export interface OutsideMonsterDef {
  /** The layout furniture's label — how the world names it. */
  label: string;
  kind: TempleMonsterKind;
  temperament: Temperament;
  /** The right move against it — deals double. The lesson is
   * the skill; the weakness is the technique that answers it. */
  weakness: DamageMoveId;
  /** The wrong tool for it — deals half. A phone call cannot
   * be cut with a sword; a word cannot be cut either. */
  resists: Exclude<DamageMoveId, "super">;
}

/**
 * The outside monsters, by the label the layout carries — the
 * five from the grass and the woods, plus two per era from the
 * TARDIS travels. Temperament: the lesser threats are tame — a
 * mite, a caller, a lure — and can be caught once weakened. The
 * rigid ones never surrender and have to be defeated.
 */
export const OUTSIDE_MONSTER_DEFS: OutsideMonsterDef[] = [
  {
    label: "SPAM CALLER",
    kind: "spam-caller",
    temperament: "tame",
    weakness: "wand",
    resists: "sword",
  },
  {
    label: "PHISHING LURE",
    kind: "social-engineer",
    temperament: "tame",
    weakness: "staff",
    resists: "sword",
  },
  {
    label: "VIRUS MITE",
    kind: "virus-mite",
    temperament: "tame",
    weakness: "sword",
    resists: "staff",
  },
  {
    label: "SMOOTH TALKER",
    kind: "social-engineer",
    temperament: "rigid",
    weakness: "wand",
    resists: "sword",
  },
  {
    label: "RANSOMWARE TROLL",
    kind: "hardcore-virus",
    temperament: "rigid",
    weakness: "super",
    resists: "wand",
  },
  // TARDIS TIME TRAVEL (owner order 2026-11-07): the same
  // threats in era dress — two per era, from the era layouts
  // in lib/time-travel.ts (ERA_MONSTERS). Labels must match
  // exactly, so the two-tap battle opens for them. The rigid
  // ones never surrender and cannot be caught — only defeated.
  { label: "SNAKE OIL SALESMAN", kind: "social-engineer", temperament: "tame", weakness: "wand", resists: "sword" },
  { label: "STAGECOACH ROBBER", kind: "spam-caller", temperament: "tame", weakness: "sword", resists: "staff" },
  { label: "FORUM FORGER", kind: "social-engineer", temperament: "tame", weakness: "staff", resists: "sword" },
  { label: "COUNTERFEIT COIN", kind: "virus-mite", temperament: "tame", weakness: "sword", resists: "staff" },
  { label: "TOMB ROBBER", kind: "spam-caller", temperament: "tame", weakness: "wand", resists: "sword" },
  { label: "FALSE PROPHET", kind: "social-engineer", temperament: "rigid", weakness: "wand", resists: "sword" },
  { label: "PLAGUE RUMOR", kind: "virus-mite", temperament: "tame", weakness: "sword", resists: "staff" },
  { label: "HIGHWAYMAN", kind: "hardcore-virus", temperament: "rigid", weakness: "super", resists: "wand" },
  { label: "NEST RAIDER", kind: "virus-mite", temperament: "tame", weakness: "wand", resists: "sword" },
  { label: "METEOR SHILL", kind: "social-engineer", temperament: "tame", weakness: "staff", resists: "sword" },
  { label: "DEEPFAKE DRONE", kind: "social-engineer", temperament: "tame", weakness: "wand", resists: "sword" },
  { label: "RANSOMWARE SATELLITE", kind: "hardcore-virus", temperament: "rigid", weakness: "super", resists: "wand" },
];

export function outsideMonsterDef(label: string): OutsideMonsterDef | undefined {
  return OUTSIDE_MONSTER_DEFS.find((d) => d.label === label);
}

// ---- Damage ------------------------------------------------------

export const BATTLE_SUPER_COOLDOWN_ROUNDS = 3;
/** A party member's stamina in a battle — knocked out at 0. */
export const PARTY_MEMBER_BATTLE_HP = 20;
/** A potion mends a party member this much. */
export const POTION_HEAL = 15;
/** The enemy's strike — the troll hits harder than the rest. */
export const ENEMY_DAMAGE = 6;
export const ENEMY_DAMAGE_HARDCORE = 8;
/** A tame virus can be caught once its HP is at or below this
 * share of its max. */
export const CAPTURE_HP_FRACTION = 1 / 3;
/** XP for winning a battle outside. */
export const BATTLE_WIN_XP = 10;
/** Extra XP for catching the virus instead of defeating it. */
export const CAPTURE_BONUS_XP = 5;
/** XP a standing party member earns for a battle win. */
export const BATTLE_PARTY_XP = 2;
/** Coins a standing party member earns for a battle win — the
 * same wage as a temple kill. */
export const BATTLE_PARTY_COINS = 5;
/** The collection holds this many captured viruses — small, by
 * design. */
export const MAX_CAPTURED = 12;

/** The wand's damage — the wizard's and warlock's tool. */
export function wandDamageFor(classId: string | null): number {
  if (classId === "wizard") return 14;
  if (classId === "warlock") return 13;
  return 10;
}

/** The staff's damage — the wizard's long arm. */
export function staffDamageFor(classId: string | null): number {
  if (classId === "wizard") return 16;
  return 14;
}

/** The enemy's strike damage — the hardcore troll hits harder. */
export function enemyDamageFor(kind: TempleMonsterKind): number {
  return kind === "hardcore-virus" ? ENEMY_DAMAGE_HARDCORE : ENEMY_DAMAGE;
}

/** A captured virus's damage when sent — half its kind's base
 * HP, at least 5, at most 25. */
export function capturedDamageFor(kind: TempleMonsterKind): number {
  return Math.min(25, Math.max(5, Math.floor(MONSTER_DEFS[kind].baseHp / 2)));
}

// ---- The battle --------------------------------------------------

export interface BattleEnemyState {
  label: string;
  name: string;
  kind: TempleMonsterKind;
  temperament: Temperament;
  weakness: DamageMoveId;
  resists: Exclude<DamageMoveId, "super">;
  /** The lesson the layout carries — what it teaches. */
  lesson: string;
  tile: Tile;
  hp: number;
  maxHp: number;
  /** True once its HP has fallen below half — the guard is up
   * and the sword and staff bounce off it. */
  guarding: boolean;
}

/**
 * A fighter beside the Captain — a worker from his party.
 *
 * Blossom Bell is NOT one of these: she fights beside him as
 * his PROTECTOR, not as a 20-HP ally — she cannot be knocked
 * out of a battle. Her giant intervention lives in
 * `applyBattleMove` (blossomBellReady), and the panel's ally
 * list never gains her as a worker. The old seam (a union with
 * a familiar kind) was closed this way on purpose: a familiar
 * with HP to lose would contradict her order.
 */
export interface BattleAllyState {
  workerId: string;
  name: string;
  hp: number;
  maxHp: number;
}

export type BattleOutcome = "victory" | "captured" | "fled";

export interface BattleState {
  id: string;
  /** "outside" is the grass, "woods" is the woods. */
  area: "outside" | "woods";
  enemy: BattleEnemyState;
  allies: BattleAllyState[];
  round: number;
  /** Rounds until the super is ready again — 0 when ready. */
  superCooldownLeft: number;
  /** Captured viruses already sent in this battle — one send
   * per virus per battle. */
  usedCapturedIds: string[];
  /** The turn-by-turn record, newest last. */
  log: string[];
  over: { outcome: BattleOutcome } | null;
}

export interface CapturedVirus {
  id: string;
  kind: TempleMonsterKind;
  /** The name it was caught under — the outside label. */
  name: string;
  /** ISO timestamp — the real moment it was caught. */
  capturedAt: string;
}

/**
 * The enemy for an outside monster the Captain tapped twice —
 * the lesson bubble first, the fight second. Null when the
 * label is not one of the five — an unknown label never opens
 * a battle.
 */
export function enemyForOutsideMonster(
  label: string,
  lesson: string,
  tile: Tile,
): BattleEnemyState | null {
  const def = outsideMonsterDef(label);
  if (!def) return null;
  const maxHp = MONSTER_DEFS[def.kind].baseHp;
  return {
    label: def.label,
    name: def.label,
    kind: def.kind,
    temperament: def.temperament,
    weakness: def.weakness,
    resists: def.resists,
    lesson,
    tile,
    hp: maxHp,
    maxHp,
    guarding: false,
  };
}

/**
 * The enemy for a gang member the Captain walked up to in the
 * woods — a worker who left to start a gang, fighting under
 * their own name. A gang member is a person, never a virus:
 * RIGID (never captured — `captureError` refuses rigid
 * enemies), and the sword is the answer — the temple sword
 * strike is the established way to fight them. HP is the
 * member's own current HP, so a sword-struck member fights the
 * battle already hurt, honestly. A win walks them away from
 * the gang (the panel's `resolveGangDefeat` on settle, never
 * `hideMonster` — they are not furniture).
 */
export function enemyForGangMember(monster: TempleMonster): BattleEnemyState {
  const def = MONSTER_DEFS["gang-member"];
  return {
    label: monster.id,
    name: monster.name,
    kind: "gang-member",
    temperament: "rigid",
    weakness: "sword",
    resists: "wand",
    lesson: def.lesson,
    tile: monster.tile,
    hp: monster.hp,
    maxHp: monster.maxHp,
    guarding: false,
  };
}

/** A fresh battle — round 1, the super ready, nobody sent yet. */
export function startBattle(input: {
  id: string;
  area: "outside" | "woods";
  enemy: BattleEnemyState;
  allies: BattleAllyState[];
}): BattleState {
  return {
    id: input.id,
    area: input.area,
    enemy: input.enemy,
    allies: input.allies,
    round: 1,
    superCooldownLeft: 0,
    usedCapturedIds: [],
    log: [
      `${input.enemy.name} — ${input.enemy.temperament === "tame" ? "calm, tame" : "rigid"}. ${input.enemy.lesson}`,
    ],
    over: null,
  };
}

/** The move's damage before weakness, resistance, or the guard. */
export function baseDamageFor(
  move: DamageMoveId,
  classId: string | null,
): number {
  switch (move) {
    case "sword":
      return swordDamageFor(classId);
    case "wand":
      return wandDamageFor(classId);
    case "staff":
      return staffDamageFor(classId);
    case "super":
      return SUPER_DAMAGE;
  }
}

/** Whether a captured virus can be caught right now — or the
 * plain reason it cannot. A full shelf takes no more: the
 * capture is refused before the battle ends, so a caught virus
 * never vanishes into a full collection. */
export function captureError(state: BattleState, captured: CapturedVirus[] = []): string | null {
  if (state.enemy.temperament === "rigid") {
    return "Too rigid to be caught — it has to be defeated.";
  }
  if (captured.length >= MAX_CAPTURED) {
    return `The collection is full — ${MAX_CAPTURED} already. A full shelf takes no more.`;
  }
  if (state.enemy.hp > state.enemy.maxHp * CAPTURE_HP_FRACTION) {
    return "Too strong to catch — weaken it below a third of its health first.";
  }
  return null;
}

/**
 * Why a move cannot be played right now — or null when it can.
 * A move that cannot be played is disabled on screen with this
 * reason, so a tap can never waste a turn on it. The REAL miss
 * is the guard: the sword and staff stay playable while the
 * enemy guards, and swinging into the guard is the miss.
 */
export function moveError(
  state: BattleState,
  move: BattleMoveId,
  input: {
    classId: string | null;
    potionCount: number;
    captured: CapturedVirus[];
    sendId?: string;
  },
): string | null {
  if (state.over) return "The battle is over.";
  switch (move) {
    case "sword":
    case "wand":
    case "staff":
    case "flee":
      return null;
    case "super":
      return state.superCooldownLeft > 0
        ? `Resting — ${state.superCooldownLeft} round${state.superCooldownLeft === 1 ? "" : "s"} left.`
        : null;
    case "potion":
      if (input.potionCount <= 0) return "No healing potion in the pack.";
      if (!state.allies.some((a) => a.hp > 0 && a.hp < a.maxHp)) {
        return "Nobody hurt to heal — the Captain is immortal.";
      }
      return null;
    case "capture":
      return captureError(state, input.captured);
    case "send": {
      if (input.captured.length === 0) {
        return "Nothing captured yet — catch a tame virus first.";
      }
      if (!input.sendId) return "Pick a captured virus to send.";
      const target = input.captured.find((c) => c.id === input.sendId);
      if (!target) return "That virus is not in the collection.";
      if (state.usedCapturedIds.includes(input.sendId)) {
        return "Already sent in this battle — one send per virus per battle.";
      }
      return null;
    }
  }
}

/** The label a move shows on its button. */
export const MOVE_LABEL: Record<BattleMoveId, string> = {
  sword: "⚔️ SWORD",
  wand: "🪄 WAND",
  staff: "🔮 STAFF",
  super: "💥 SUPER",
  potion: "🧪 POTION",
  capture: "🎯 CAPTURE",
  send: "📤 SEND",
  flee: "🏃 FLEE",
};

/** The keyboard key for a move while the battle is open. */
export const MOVE_KEY: Record<BattleMoveId, string> = {
  sword: "1",
  wand: "2",
  staff: "3",
  super: "4",
  potion: "5",
  capture: "6",
  send: "",
  flee: "escape",
};

export interface BattleMoveResult {
  state: BattleState;
  /** The lines this move added to the log, in order. */
  lines: string[];
  /** True when the move drank a potion from the pack. */
  potionUsed: boolean;
  /** The virus caught, when the move was a capture. */
  capturedVirus: CapturedVirus | null;
  /** True when Blossom Bell turned GIANT and destroyed the
   * enemy — the protector fired on this move. */
  blossomBellGiant: boolean;
}

function applyDamage(
  enemy: BattleEnemyState,
  damage: number,
): BattleEnemyState {
  const hp = Math.max(0, enemy.hp - Math.max(0, Math.floor(damage)));
  // The guard goes up the moment its HP falls below half — and
  // stays up until the wand breaks it.
  const guarding = enemy.guarding || hp <= enemy.maxHp / 2;
  return { ...enemy, hp, guarding };
}

/**
 * Pure: play one move. A round is the Captain's move, then the
 * party strikes, then the enemy strikes — unless the move ended
 * the battle first (defeat, capture, or flee). Every line the
 * move writes is returned, so the panel only renders what the
 * engine decided.
 */
export function applyBattleMove(
  state: BattleState,
  move: BattleMoveId,
  input: {
    classId: string | null;
    /** Healing potions in the pack — the real count. */
    potionCount: number;
    captured: CapturedVirus[];
    sendId?: string;
    nowIso?: string;
    /** PROTECTOR: Blossom Bell's giant turn is ready today —
     * her strongest power, once per in-world day. The panel
     * decides from the store and the living day; the engine
     * only fires when it is true. */
    blossomBellReady?: boolean;
  },
): BattleMoveResult {
  if (state.over) {
    return { state, lines: [], potionUsed: false, capturedVirus: null, blossomBellGiant: false };
  }
  const err = moveError(state, move, {
    classId: input.classId,
    potionCount: input.potionCount,
    captured: input.captured,
    ...(input.sendId ? { sendId: input.sendId } : {}),
  });
  // A move the engine refuses writes nothing and spends nothing.
  if (err) {
    return { state, lines: [], potionUsed: false, capturedVirus: null, blossomBellGiant: false };
  }

  let next: BattleState = { ...state, log: [...state.log] };
  const lines: string[] = [];
  let potionUsed = false;
  let capturedVirus: CapturedVirus | null = null;
  let blossomBellGiant = false;

  const finish = (
    outcome: BattleOutcome,
    extra: string[],
  ): BattleMoveResult => {
    const done: BattleState = {
      ...next,
      over: { outcome },
      log: [...next.log, ...lines, ...extra],
    };
    return { state: done, lines: [...lines, ...extra], potionUsed, capturedVirus, blossomBellGiant };
  };

  // FLEE — walk away. The virus stays out there at full
  // strength; nothing is lost, nothing is gained.
  if (move === "flee") {
    lines.push(`The Captain walks away — ${next.enemy.name} is still out there.`);
    return finish("fled", []);
  }

  // CAPTURE — a tame virus, weakened below a third. It always
  // works when the conditions hold: calculated, never a dice
  // roll. The battle ends as a capture.
  if (move === "capture") {
    const nowIso = input.nowIso ?? new Date().toISOString();
    capturedVirus = {
      id: `cap-${Date.now().toString(36)}-${next.enemy.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      kind: next.enemy.kind,
      name: next.enemy.name,
      capturedAt: nowIso,
    };
    lines.push(`${next.enemy.name} caught — it fights for the Captain now.`);
    return finish("captured", []);
  }

  // POTION — mend the most-hurt standing ally. The Captain is
  // immortal, so the potion is always for the party.
  if (move === "potion") {
    const hurt = next.allies.filter((a) => a.hp > 0 && a.hp < a.maxHp);
    const target = hurt.sort((a, b) => a.hp - b.hp)[0];
    if (!target) {
      return { state, lines: [], potionUsed: false, capturedVirus: null, blossomBellGiant: false };
    }
    const healed = Math.min(POTION_HEAL, target.maxHp - target.hp);
    next = {
      ...next,
      allies: next.allies.map((a) =>
        a.workerId === target.workerId ? { ...a, hp: a.hp + healed } : a,
      ),
    };
    potionUsed = true;
    lines.push(`Potion — ${target.name} mended +${healed}.`);
  }

  // SEND — a captured virus fights for the Captain, once per
  // battle. It strikes with half its kind's base HP.
  if (move === "send") {
    const target = input.captured.find((c) => c.id === input.sendId);
    if (!target) {
      return { state, lines: [], potionUsed: false, capturedVirus: null, blossomBellGiant: false };
    }
    const damage = capturedDamageFor(target.kind);
    next = {
      ...next,
      usedCapturedIds: [...next.usedCapturedIds, target.id],
      enemy: applyDamage(next.enemy, damage),
    };
    lines.push(`${target.name} sent in — ${damage} damage.`);
    if (next.enemy.hp <= 0) {
      lines.push(`${next.enemy.name} defeated — the right virus for the job.`);
      return finish("victory", []);
    }
  }

  // The damage moves — sword, wand, staff, super. The guard is
  // the real miss: sword and staff bounce off it, the wand
  // breaks it, the super ignores it. The weakness deals double,
  // the resisted move deals half.
  if (move === "sword" || move === "wand" || move === "staff" || move === "super") {
    const enemy = next.enemy;
    if (enemy.guarding && (move === "sword" || move === "staff")) {
      lines.push(
        `MISS — ${MOVE_LABEL[move]} bounces off the guard. The guard was up, and the swing was the mistake.`,
      );
    } else {
      let damage = baseDamageFor(move, input.classId);
      let note = "";
      if (move === enemy.weakness) {
        damage *= 2;
        note = " CRITICAL — the right move!";
      } else if (move === enemy.resists) {
        damage = Math.max(1, Math.floor(damage / 2));
        note = " — the wrong tool, half damage.";
      }
      const brokeGuard = enemy.guarding && move === "wand";
      const after = applyDamage(enemy, damage);
      next = {
        ...next,
        enemy: brokeGuard ? { ...after, guarding: false } : after,
      };
      lines.push(
        `${MOVE_LABEL[move]} hits — ${damage} damage.${note}${brokeGuard ? " The guard breaks!" : ""}`,
      );
      if (next.enemy.hp <= 0) {
        lines.push(`${next.enemy.name} defeated — ${next.enemy.lesson}`);
        return finish("victory", []);
      }
    }
  }

  // THE PARTY STRIKES — every standing member hits for 5, like
  // the temple party strikes. A member's strike can finish the
  // fight, and the kill lands the same way.
  const standing = next.allies.filter((a) => a.hp > 0);
  if (standing.length > 0) {
    let enemy = next.enemy;
    for (const ally of standing) {
      enemy = applyDamage(enemy, PARTY_DAMAGE);
      if (enemy.hp <= 0) break;
    }
    next = { ...next, enemy };
    lines.push(
      `The party strikes — ${standing.length} ${standing.length === 1 ? "member" : "members"} hit for ${PARTY_DAMAGE} each.`,
    );
    if (next.enemy.hp <= 0) {
      lines.push(`${next.enemy.name} defeated — the party finished it.`);
      return finish("victory", []);
    }
  }

  // THE ENEMY STRIKES — it cannot hurt the Captain (immortal),
  // so it hits the lowest-HP standing ally. A guarding enemy
  // holds its guard and does not strike back. An ally at 0 is
  // knocked out of THIS battle only — out, not gone.
  if (!next.enemy.guarding) {
    const target = [...next.allies]
      .filter((a) => a.hp > 0)
      .sort((a, b) => a.hp - b.hp)[0];
    if (target) {
      const damage = enemyDamageFor(next.enemy.kind);
      const hp = Math.max(0, target.hp - damage);
      next = {
        ...next,
        allies: next.allies.map((a) => (a.workerId === target.workerId ? { ...a, hp } : a)),
      };
      lines.push(
        hp <= 0
          ? `${next.enemy.name} strikes ${target.name} for ${damage} — knocked out of this battle.`
          : `${next.enemy.name} strikes ${target.name} for ${damage}.`,
      );
    } else if (input.blossomBellReady) {
      // PROTECTOR (owner order 2026-11-07 ~11:34 CST): the
      // attack is aimed at the Captain himself — nobody standing
      // to take it — and her giant turn is ready today. She turns
      // GIANT and destroys the enemy on the spot, and the battle
      // is over. She is his familiar; her win is his win, so the
      // victory settles the usual way (XP, wages, the monster
      // gone). The panel records today as her giant day.
      blossomBellGiant = true;
      lines.push(
        `🦄 BLOSSOM BELL turns GIANT — one stomp, ${next.enemy.name} is destroyed. She protects the Captain.`,
      );
      return finish("victory", []);
    } else {
      lines.push(`${next.enemy.name} swings at the Captain — he is immortal, it bounces off.`);
    }
  } else {
    lines.push(`${next.enemy.name} holds its guard — no strike back.`);
  }

  // The round turns over; the super rests one round less.
  next = {
    ...next,
    round: next.round + 1,
    superCooldownLeft: Math.max(0, next.superCooldownLeft - 1),
    log: [...next.log, ...lines],
  };
  // The super rests after use — the cooldown starts the round
  // it fires, so a fired super reads 3, then 2, then 1, then 0.
  if (move === "super") {
    next = { ...next, superCooldownLeft: BATTLE_SUPER_COOLDOWN_ROUNDS };
  }
  return { state: next, lines, potionUsed, capturedVirus, blossomBellGiant };
}

// ---- The Captain's battle record ---------------------------------

export interface CaptainBattleRecord {
  version: 1;
  /** Battle XP, all time — forward-only. */
  xp: number;
  wins: number;
  captures: number;
  flees: number;
}

export const CAPTAIN_BATTLES_KEY = "augi.battles.captain.v1";

export interface BattleStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): BattleStore | null {
  try {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function emptyCaptainBattleRecord(): CaptainBattleRecord {
  return { version: 1, xp: 0, wins: 0, captures: 0, flees: 0 };
}

/** The Captain's IN-GAME level — LV 1 at 0 XP, climbing the
 * same slow curve as the crew (20*L to climb). */
export function captainBattleLevel(record: CaptainBattleRecord): number {
  return levelForXp(record.xp);
}

/** XP still needed to reach the next level. */
export function captainBattleXpToNext(record: CaptainBattleRecord): number {
  const level = captainBattleLevel(record);
  return xpForNextLevel(level);
}

function isCaptainBattleRecord(value: unknown): value is CaptainBattleRecord {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["xp"] === "number" &&
    Number.isFinite(v["xp"]) &&
    (v["xp"] as number) >= 0 &&
    typeof v["wins"] === "number" &&
    Number.isFinite(v["wins"]) &&
    (v["wins"] as number) >= 0 &&
    typeof v["captures"] === "number" &&
    Number.isFinite(v["captures"]) &&
    (v["captures"] as number) >= 0 &&
    typeof v["flees"] === "number" &&
    Number.isFinite(v["flees"]) &&
    (v["flees"] as number) >= 0
  );
}

export function loadCaptainBattleRecord(
  store: BattleStore | null = defaultStore(),
): CaptainBattleRecord {
  if (!store) return emptyCaptainBattleRecord();
  try {
    const raw = store.getItem(CAPTAIN_BATTLES_KEY);
    if (!raw) return emptyCaptainBattleRecord();
    const parsed: unknown = JSON.parse(raw);
    if (!isCaptainBattleRecord(parsed)) return emptyCaptainBattleRecord();
    return {
      version: 1,
      xp: Math.floor(parsed.xp),
      wins: Math.floor(parsed.wins),
      captures: Math.floor(parsed.captures),
      flees: Math.floor(parsed.flees),
    };
  } catch {
    return emptyCaptainBattleRecord();
  }
}

export function saveCaptainBattleRecord(
  record: CaptainBattleRecord,
  store: BattleStore | null = defaultStore(),
): void {
  if (!store) return;
  try {
    store.setItem(
      CAPTAIN_BATTLES_KEY,
      JSON.stringify({
        version: 1,
        xp: Math.max(0, Math.floor(record.xp)),
        wins: Math.max(0, Math.floor(record.wins)),
        captures: Math.max(0, Math.floor(record.captures)),
        flees: Math.max(0, Math.floor(record.flees)),
      }),
    );
  } catch {
    // A full or blocked store never breaks the office.
  }
}

/** Pure: the record with a win — +10 XP, forward-only. */
export function recordBattleWin(record: CaptainBattleRecord): CaptainBattleRecord {
  return { ...record, xp: record.xp + BATTLE_WIN_XP, wins: record.wins + 1 };
}

/** Pure: the record with a capture — +5 XP on top of the win. */
export function recordBattleCapture(record: CaptainBattleRecord): CaptainBattleRecord {
  return { ...record, xp: record.xp + CAPTURE_BONUS_XP, captures: record.captures + 1 };
}

/** Pure: the record with a flee — nothing gained, nothing lost. */
export function recordBattleFlee(record: CaptainBattleRecord): CaptainBattleRecord {
  return { ...record, flees: record.flees + 1 };
}

// ---- The captured collection -------------------------------------

export const CAPTURED_KEY = "augi.battles.captured.v1";

function isCapturedVirus(value: unknown): value is CapturedVirus {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["id"] === "string" &&
    (v["id"] as string).length > 0 &&
    typeof v["kind"] === "string" &&
    (v["kind"] as string) in MONSTER_DEFS &&
    typeof v["name"] === "string" &&
    (v["name"] as string).length > 0 &&
    typeof v["capturedAt"] === "string" &&
    !Number.isNaN(Date.parse(v["capturedAt"] as string))
  );
}

export function loadCaptured(
  store: BattleStore | null = defaultStore(),
): CapturedVirus[] {
  if (!store) return [];
  try {
    const raw = store.getItem(CAPTURED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCapturedVirus).slice(0, MAX_CAPTURED);
  } catch {
    return [];
  }
}

export function saveCaptured(
  captured: CapturedVirus[],
  store: BattleStore | null = defaultStore(),
): void {
  if (!store) return;
  try {
    store.setItem(CAPTURED_KEY, JSON.stringify(captured.filter(isCapturedVirus).slice(0, MAX_CAPTURED)));
  } catch {
    // A full or blocked store never breaks the office.
  }
}

/** Pure: the collection with a new capture — capped at 12, the
 * oldest stays when the shelf is full (a full shelf takes no
 * more; the panel says so). */
export function addCaptured(
  captured: CapturedVirus[],
  virus: CapturedVirus,
): CapturedVirus[] {
  if (captured.length >= MAX_CAPTURED) return captured;
  if (captured.some((c) => c.id === virus.id)) return captured;
  return [...captured, virus];
}
