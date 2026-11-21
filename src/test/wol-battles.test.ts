// TURN-BASED BATTLES — the engine (owner order 2026-11-07
// ~10:53 CST): per-turn, like the Pokémon catch screen and the
// old-school Final Fantasy fights. The right move in the right
// sequence kills quicker; a miss is real; a tame virus can be
// caught and sent into a later battle. Nothing here is a dice
// roll — every outcome is calculated, so every test below is
// deterministic.
//
// Ported with the engine from the VoiceWave Command Deck
// (blackvaultllc/voicewave-command-deck @ 7653d36,
// src/test/battles.test.ts) — the deck's own tests, import paths
// rewired to the port. They are the playability proof at the
// engine level: battles start, resolve, capture, and settle here.

import { describe, expect, it, beforeEach } from "vitest";
import {
  BATTLE_PARTY_COINS,
  BATTLE_PARTY_XP,
  MAX_CAPTURED,
  addCaptured,
  applyBattleMove,
  baseDamageFor,
  captureError,
  captainBattleLevel,
  captainBattleXpToNext,
  capturedDamageFor,
  emptyCaptainBattleRecord,
  enemyForGangMember,
  enemyForOutsideMonster,
  loadCaptured,
  loadCaptainBattleRecord,
  moveError,
  outsideMonsterDef,
  recordBattleCapture,
  recordBattleFlee,
  recordBattleWin,
  saveCaptured,
  saveCaptainBattleRecord,
  staffDamageFor,
  startBattle,
  wandDamageFor,
  type BattleAllyState,
  type BattleState,
  type CapturedVirus,
} from "@/avatar/world-of-logic/battles";

import type { TempleMonster } from "@/avatar/world-of-logic/temple";

const ALLY: BattleAllyState = { workerId: "w1", name: "Test Worker", hp: 20, maxHp: 20 };

function battleFor(label: string, allies: BattleAllyState[] = []): BattleState {
  const enemy = enemyForOutsideMonster(label, "Test lesson — the company skill and the rule.", {
    x: 1,
    y: 1,
  });
  if (!enemy) throw new Error(`no enemy for ${label}`);
  return startBattle({ id: "test-battle", area: "outside", enemy, allies });
}

function play(
  state: BattleState,
  move: "sword" | "wand" | "staff" | "super" | "potion" | "capture" | "send" | "flee",
  opts: {
    classId?: string | null;
    potionCount?: number;
    captured?: CapturedVirus[];
    sendId?: string;
    blossomBellReady?: boolean;
  } = {},
) {
  return applyBattleMove(state, move, {
    classId: opts.classId ?? null,
    potionCount: opts.potionCount ?? 1,
    captured: opts.captured ?? [],
    ...(opts.sendId ? { sendId: opts.sendId } : {}),
    nowIso: "2026-11-07T12:00:00.000Z",
    blossomBellReady: opts.blossomBellReady ?? false,
  });
}

beforeEach(() => {
  localStorage.removeItem("augi.battles.captain.v1");
  localStorage.removeItem("augi.battles.captured.v1");
});

describe("outside monsters", () => {
  it("all five outside monsters resolve with temperament, weakness, and resistance", () => {
    const spam = outsideMonsterDef("SPAM CALLER");
    expect(spam).toMatchObject({
      kind: "spam-caller",
      temperament: "tame",
      weakness: "wand",
      resists: "sword",
    });
    expect(outsideMonsterDef("PHISHING LURE")).toMatchObject({
      kind: "social-engineer",
      temperament: "tame",
      weakness: "staff",
      resists: "sword",
    });
    expect(outsideMonsterDef("VIRUS MITE")).toMatchObject({
      kind: "virus-mite",
      temperament: "tame",
      weakness: "sword",
      resists: "staff",
    });
    expect(outsideMonsterDef("SMOOTH TALKER")).toMatchObject({
      kind: "social-engineer",
      temperament: "rigid",
      weakness: "wand",
      resists: "sword",
    });
    expect(outsideMonsterDef("RANSOMWARE TROLL")).toMatchObject({
      kind: "hardcore-virus",
      temperament: "rigid",
      weakness: "super",
      resists: "wand",
    });
    expect(outsideMonsterDef("NOT A MONSTER")).toBeUndefined();
  });

  it("a battle starts at round 1 with the monster's full health", () => {
    const b = battleFor("SPAM CALLER");
    expect(b.round).toBe(1);
    expect(b.enemy.hp).toBe(25);
    expect(b.enemy.maxHp).toBe(25);
    expect(b.over).toBeNull();
    expect(b.log[0]).toMatch(/SPAM CALLER/);
  });
});

describe("the right move in the right sequence", () => {
  it("the sword kills a virus mite in one hit — its weakness, doubled", () => {
    const b = battleFor("VIRUS MITE");
    const r = play(b, "sword");
    expect(r.state.over?.outcome).toBe("victory");
    expect(r.lines.join(" ")).toMatch(/CRITICAL/);
    expect(r.state.enemy.hp).toBeLessThanOrEqual(0);
  });

  it("a spam caller takes the sword then the wand — the resisted hit alone is not enough", () => {
    const b = battleFor("SPAM CALLER");
    const first = play(b, "sword");
    // The sword is resisted — half damage, 6 of 25.
    expect(first.state.enemy.hp).toBe(19);
    expect(first.state.over).toBeNull();
    const second = play(first.state, "wand");
    // The wand is the weakness — doubled, 20 more, and it falls.
    expect(second.state.over?.outcome).toBe("victory");
    expect(second.lines.join(" ")).toMatch(/CRITICAL/);
  });

  it("class damage follows the class — a wizard's wand hits harder", () => {
    expect(baseDamageFor("sword", null)).toBe(12);
    expect(baseDamageFor("sword", "warrior")).toBe(16);
    expect(wandDamageFor("wizard")).toBe(14);
    expect(wandDamageFor(null)).toBe(10);
    expect(staffDamageFor("wizard")).toBe(16);
    expect(staffDamageFor(null)).toBe(14);
  });
});

describe("the guard — a miss is real", () => {
  it("a guarding virus bounces the sword and the staff, and the turn is spent", () => {
    const b = battleFor("PHISHING LURE");
    // The staff is its weakness — 28 damage, down to 2, and it guards.
    const first = play(b, "staff");
    expect(first.state.enemy.hp).toBe(2);
    expect(first.state.enemy.guarding).toBe(true);
    // The sword into the guard is a real miss — the turn is
    // spent (the round turns over) and the virus is unhurt.
    const miss = play(first.state, "sword");
    expect(miss.state.enemy.hp).toBe(2);
    expect(miss.state.enemy.guarding).toBe(true);
    expect(miss.state.round).toBe(first.state.round + 1);
    expect(miss.lines.join(" ")).toMatch(/MISS/);
    // The wand breaks the guard and finishes it.
    const finish = play(first.state, "wand");
    expect(finish.state.over?.outcome).toBe("victory");
    expect(finish.lines.join(" ")).toMatch(/guard breaks/);
  });

  it("the super ignores the guard — a guarded virus still takes the full hit", () => {
    const b = battleFor("PHISHING LURE");
    // The staff is its weakness — 28 damage, down to 2, and it guards.
    const guarding = play(b, "staff").state;
    expect(guarding.enemy.guarding).toBe(true);
    const finished = play(guarding, "super");
    expect(finished.state.over?.outcome).toBe("victory");
    expect(finished.lines.join(" ")).not.toMatch(/MISS/);
  });

  it("the super recharges for three rounds", () => {
    const b = battleFor("RANSOMWARE TROLL");
    // A super just fired — three rounds of rest before it is ready.
    const cooling: BattleState = { ...b, superCooldownLeft: 3 };
    expect(moveError(cooling, "super", { classId: null, potionCount: 1, captured: [] })).toMatch(
      /Resting/,
    );
    // Three wand rounds tick the cooldown down — the wand is
    // resisted here, so the troll survives them.
    let state = cooling;
    for (let i = 0; i < 3; i++) {
      state = play(state, "wand").state;
    }
    expect(moveError(state, "super", { classId: null, potionCount: 1, captured: [] })).toBeNull();
  });
});

describe("capture — Pokémon rules, calculated, never a dice roll", () => {
  it("a tame virus cannot be caught at full strength, but can once weakened", () => {
    const b = battleFor("SPAM CALLER");
    expect(captureError(b)).toMatch(/Too strong/);
    // Three resisted sword hits: 25 → 19 → 13 → 7, a third or less.
    let state = b;
    for (let i = 0; i < 3; i++) state = play(state, "sword").state;
    expect(state.enemy.hp).toBe(7);
    expect(captureError(state)).toBeNull();
    const caught = play(state, "capture");
    expect(caught.state.over?.outcome).toBe("captured");
    expect(caught.capturedVirus?.name).toBe("SPAM CALLER");
    expect(caught.capturedVirus?.kind).toBe("spam-caller");
  });

  it("a rigid virus cannot be caught at any health", () => {
    const b = battleFor("SMOOTH TALKER");
    expect(captureError(b)).toMatch(/Too rigid/);
    expect(moveError(b, "capture", { classId: null, potionCount: 1, captured: [] })).toMatch(
      /Too rigid/,
    );
  });

  it("a full collection refuses the catch before the battle ends", () => {
    const full: CapturedVirus[] = Array.from({ length: MAX_CAPTURED }, (_, i) => ({
      id: `cap-${i}`,
      kind: "virus-mite",
      name: `VIRUS MITE ${i + 1}`,
      capturedAt: "2026-11-07T12:00:00.000Z",
    }));
    // addCaptured keeps the shelf as it is — no more fits.
    expect(
      addCaptured(full, {
        id: "cap-13",
        kind: "virus-mite",
        name: "VIRUS MITE 13",
        capturedAt: "2026-11-07T12:00:00.000Z",
      }),
    ).toBe(full);
    // And the engine refuses the capture outright, so a caught
    // virus never vanishes into a full shelf.
    const b = battleFor("VIRUS MITE");
    expect(captureError(b, full)).toMatch(/full/);
    expect(moveError(b, "capture", { classId: null, potionCount: 1, captured: full })).toMatch(
      /full/,
    );
  });

  it("a captured virus can be sent into a later battle — once per battle", () => {
    const mite: CapturedVirus = {
      id: "cap-1",
      kind: "virus-mite",
      name: "VIRUS MITE",
      capturedAt: "2026-11-07T12:00:00.000Z",
    };
    expect(capturedDamageFor("virus-mite")).toBe(10);
    const b = battleFor("SPAM CALLER");
    const sent = play(b, "send", { captured: [mite], sendId: "cap-1" });
    expect(sent.state.enemy.hp).toBe(15);
    expect(sent.lines.join(" ")).toMatch(/sent in/);
    expect(
      moveError(sent.state, "send", {
        classId: null,
        potionCount: 1,
        captured: [mite],
        sendId: "cap-1",
      }),
    ).toMatch(/Already sent/);
    expect(moveError(b, "send", { classId: null, potionCount: 1, captured: [] })).toMatch(
      /Nothing captured/,
    );
  });
});

describe("potions, the party, and the Captain's immortality", () => {
  it("a potion heals the most-hurt standing ally and spends one from the pack", () => {
    const b = battleFor("SPAM CALLER", [ALLY]);
    // Round 1: the sword lands, the caller strikes the ally for 6.
    const hurt = play(b, "sword");
    expect(hurt.state.allies[0]?.hp).toBe(14);
    const healed = play(hurt.state, "potion");
    expect(healed.potionUsed).toBe(true);
    expect(healed.state.allies[0]?.hp).toBe(20);
  });

  it("a potion with none in the pack, or nobody hurt, is refused", () => {
    const b = battleFor("SPAM CALLER", [ALLY]);
    expect(moveError(b, "potion", { classId: null, potionCount: 0, captured: [] })).toMatch(
      /No healing potion/,
    );
    expect(moveError(b, "potion", { classId: null, potionCount: 1, captured: [] })).toMatch(
      /Nobody hurt/,
    );
  });

  it("the party strikes beside him — 5 damage each, every round", () => {
    const b = battleFor("SPAM CALLER", [ALLY]);
    const r = play(b, "sword");
    // Sword 6 + party 5 = 11 of 25, and the caller struck back.
    expect(r.state.enemy.hp).toBe(14);
    expect(r.state.allies[0]?.hp).toBe(14);
    expect(r.lines.join(" ")).toMatch(/The party strikes/);
  });

  it("a knocked-out party member is out of THIS battle only", () => {
    // The ally walks in already hurt (6 of 20) — one troll
    // strike finishes them, and the fight goes on without them.
    // A below-half enemy holds its guard under the party's
    // pressure and does not strike back, so the knockout has to
    // come while the enemy is still above half.
    const hurt: BattleAllyState = { workerId: "w1", name: "Test Worker", hp: 6, maxHp: 20 };
    const b = battleFor("RANSOMWARE TROLL", [hurt]);
    const r = play(b, "sword");
    expect(r.state.allies[0]?.hp).toBe(0);
    expect(r.state.log.join(" ")).toMatch(/knocked out of this battle/);
    expect(r.state.over).toBeNull();
  });

  it("with no party, the enemy swings at the Captain — immortal, it bounces off", () => {
    const b = battleFor("SPAM CALLER");
    const r = play(b, "sword");
    expect(r.state.over).toBeNull();
    expect(r.lines.join(" ")).toMatch(/bounces off/);
  });
});

describe("fleeing and leveling — forward only", () => {
  it("fleeing walks away — nothing lost, nothing gained", () => {
    const b = battleFor("SPAM CALLER");
    const r = play(b, "flee");
    expect(r.state.over?.outcome).toBe("fled");
    const record = recordBattleFlee(loadCaptainBattleRecord());
    expect(record.flees).toBe(1);
    expect(record.xp).toBe(0);
  });

  it("a win is +10 XP and a capture is +15 XP — the level curve is the crew curve", () => {
    const fresh = emptyCaptainBattleRecord();
    expect(captainBattleLevel(fresh)).toBe(1);
    expect(captainBattleXpToNext(fresh)).toBe(20);
    expect(captainBattleLevel({ ...fresh, xp: 19 })).toBe(1);
    expect(captainBattleLevel({ ...fresh, xp: 20 })).toBe(2);
    expect(captainBattleLevel({ ...fresh, xp: 60 })).toBe(3);
    expect(captainBattleLevel({ ...fresh, xp: 99_000 })).toBe(100);
    const afterWin = recordBattleWin(fresh);
    expect(afterWin.xp).toBe(10);
    expect(afterWin.wins).toBe(1);
    expect(captainBattleLevel(afterWin)).toBe(1);
    // A capture pays the win AND the bonus — +15 in all.
    const afterCapture = recordBattleCapture(afterWin);
    expect(afterCapture.xp).toBe(15);
    expect(afterCapture.captures).toBe(1);
    expect(captainBattleLevel(afterCapture)).toBe(1);
    // A second win reaches LV 2.
    const afterSecondWin = recordBattleWin(afterCapture);
    expect(afterSecondWin.xp).toBe(25);
    expect(captainBattleLevel(afterSecondWin)).toBe(2);
  });

  it("the record and the collection persist", () => {
    const afterWin = recordBattleWin(loadCaptainBattleRecord());
    expect(afterWin.xp).toBe(10);
    // The record round-trips through localStorage.
    saveCaptainBattleRecord(afterWin);
    expect(loadCaptainBattleRecord().xp).toBe(10);
    expect(loadCaptainBattleRecord().wins).toBe(1);
    const mite: CapturedVirus = {
      id: "cap-1",
      kind: "virus-mite",
      name: "VIRUS MITE",
      capturedAt: "2026-11-07T12:00:00.000Z",
    };
    const next = addCaptured(loadCaptured(), mite);
    expect(next).toHaveLength(1);
    // The collection round-trips through localStorage.
    saveCaptured(next);
    expect(loadCaptured()).toHaveLength(1);
    expect(loadCaptured()[0]?.name).toBe("VIRUS MITE");
  });

  it("the party's battle wage is the temple-kill wage", () => {
    expect(BATTLE_PARTY_XP).toBe(2);
    expect(BATTLE_PARTY_COINS).toBe(5);
  });
});

describe("gang members — walking up to one in the woods opens the battle", () => {
  const GANG: TempleMonster = {
    id: "gang-emp-1",
    kind: "gang-member",
    name: "Test Gang Member",
    tile: { x: 10, y: 12 },
    hp: 40,
    maxHp: 40,
  };

  it("fights under the worker's own name, rigid, sword-weak — a person, never a virus", () => {
    const enemy = enemyForGangMember(GANG);
    expect(enemy).toMatchObject({
      label: "gang-emp-1",
      name: "Test Gang Member",
      kind: "gang-member",
      temperament: "rigid",
      weakness: "sword",
      resists: "wand",
    });
    expect(enemy.lesson).toMatch(/cannot break through the buildings/);
    expect(enemy.hp).toBe(40);
    expect(enemy.maxHp).toBe(40);
  });

  it("a sword-struck member fights the battle already hurt — its own current HP, honestly", () => {
    const hurt: TempleMonster = { ...GANG, hp: 12 };
    const enemy = enemyForGangMember(hurt);
    expect(enemy.hp).toBe(12);
    expect(enemy.maxHp).toBe(40);
  });

  it("can never be captured — a person never surrenders to be caught", () => {
    const enemy = enemyForGangMember(GANG);
    const b = startBattle({ id: "test-gang-battle", area: "woods", enemy, allies: [] });
    expect(captureError(b)).toMatch(/Too rigid to be caught/);
    expect(moveError(b, "capture", { classId: null, potionCount: 1, captured: [] })).toMatch(
      /Too rigid to be caught/,
    );
  });

  it("the sword is the answer — its weakness, doubled — and the wand is resisted", () => {
    const enemy = enemyForGangMember(GANG);
    const b = startBattle({ id: "test-gang-battle", area: "woods", enemy, allies: [] });
    // Sword 12, doubled to 24 — the mite's 40 falls to 16, and
    // the guard is up (below half), so the fight goes on.
    const sword = play(b, "sword");
    expect(sword.state.enemy.hp).toBe(16);
    expect(sword.state.over).toBeNull();
    // Wand 10, halved to 5 — the resisted move is the slow road.
    const wand = play(b, "wand");
    expect(wand.state.enemy.hp).toBe(35);
  });
});

describe("Blossom Bell the protector", () => {
  it("turns GIANT and destroys the enemy when its strike is aimed at the Captain himself", () => {
    const b = battleFor("SPAM CALLER");
    const r = play(b, "sword", { blossomBellReady: true });
    expect(r.blossomBellGiant).toBe(true);
    expect(r.state.over?.outcome).toBe("victory");
    expect(r.lines.join(" ")).toMatch(/BLOSSOM BELL turns GIANT/);
    expect(r.lines.join(" ")).toMatch(/protects the Captain/);
  });

  it("does not turn giant when her giant turn is not ready — the strike bounces off the immortal Captain", () => {
    const b = battleFor("SPAM CALLER");
    const r = play(b, "sword");
    expect(r.blossomBellGiant).toBe(false);
    expect(r.state.over).toBeNull();
    expect(r.lines.join(" ")).toMatch(/immortal, it bounces off/);
  });

  it("does not turn giant while an ally stands — the enemy strikes the ally instead", () => {
    const b = battleFor("SPAM CALLER", [ALLY]);
    const r = play(b, "sword", { blossomBellReady: true });
    expect(r.blossomBellGiant).toBe(false);
    expect(r.state.over).toBeNull();
    expect(r.state.allies[0]!.hp).toBeLessThan(20);
  });

  it("does not turn giant when the Captain's own move kills the enemy", () => {
    const b = battleFor("VIRUS MITE");
    const r = play(b, "sword", { blossomBellReady: true });
    expect(r.state.over?.outcome).toBe("victory");
    expect(r.blossomBellGiant).toBe(false);
  });

  it("does not turn giant when the enemy guards — a guarding enemy does not strike", () => {
    const b = battleFor("SPAM CALLER");
    const r = play(b, "wand", { blossomBellReady: true });
    expect(r.blossomBellGiant).toBe(false);
    expect(r.state.over).toBeNull();
    expect(r.state.enemy.guarding).toBe(true);
  });
});
