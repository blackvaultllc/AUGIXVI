// BATTLE PANEL — the battle screen. The panel renders what the
// engine decides — it never decides anything itself.
//
// PRESENTATION (rebuilt 2026-11-22 on the owner's verdict —
// "this is not how this game should look at all"): a real fight
// scene in the Final Fantasy three-box frame — the scene box
// (fighters facing off on the grass/woods, the enemy's nameplate
// with its HP bar), the fighter box, and the command box with
// the attack-choice box beside the Attack menu. These tests pin
// the frame, the animation hooks, and the standing rule that
// the battle RULES never move: battles.ts stays byte-identical,
// asserted by hash below.
//
// Ported with the panel from the VoiceWave Command Deck
// (blackvaultllc/voicewave-command-deck @ 7653d36,
// src/test/battle-panel.test.tsx) — import paths rewired.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BattlePanel from "@/avatar/world-of-logic/BattlePanel";
import {
  applyBattleMove,
  enemyForOutsideMonster,
  startBattle,
  type BattleMoveId,
  type BattleState,
  type CapturedVirus,
} from "@/avatar/world-of-logic/battles";

const MITE: CapturedVirus = {
  id: "cap-1",
  kind: "virus-mite",
  name: "VIRUS MITE",
  capturedAt: "2026-11-07T12:00:00.000Z",
};

function battleFor(label: string): BattleState {
  const enemy = enemyForOutsideMonster(label, "Test lesson — the company skill and the rule.", {
    x: 1,
    y: 1,
  });
  if (!enemy) throw new Error(`no enemy for ${label}`);
  return startBattle({ id: "test-battle", area: "outside", enemy, allies: [] });
}

function panel(
  battle: BattleState,
  onMove: (move: BattleMoveId, sendId?: string) => void,
  onClose: () => void,
  opts: { potionCount?: number; captured?: CapturedVirus[] } = {},
) {
  return (
    <BattlePanel
      battle={battle}
      captainLevel={1}
      classId={null}
      potionCount={opts.potionCount ?? 1}
      captured={opts.captured ?? []}
      onMove={onMove}
      onClose={onClose}
    />
  );
}

function renderPanel(
  battle: BattleState,
  opts: { potionCount?: number; captured?: CapturedVirus[] } = {},
) {
  const onMove = vi.fn((_move: BattleMoveId, _sendId?: string) => {});
  const onClose = vi.fn(() => {});
  const utils = render(panel(battle, onMove, onClose, opts));
  return { onMove, onClose, ...utils };
}

beforeEach(() => {
  localStorage.removeItem("augi.battles.captain.v1");
  localStorage.removeItem("augi.battles.captured.v1");
});

describe("BattlePanel — the fight", () => {
  it("shows the enemy's file — name, temperament, lesson, health", () => {
    renderPanel(battleFor("SPAM CALLER"));
    expect(screen.getByRole("dialog", { name: /Battle — SPAM CALLER/ })).toBeTruthy();
    expect(screen.getByText(/Calm, tame — it can be caught/)).toBeTruthy();
    // The lesson shows — in the enemy's nameplate and in the
    // opening log line.
    expect(screen.getAllByText(/Test lesson/).length).toBeGreaterThan(0);
    expect(screen.getByText(/HP 25 \/ 25/)).toBeTruthy();
    expect(screen.getByText(/LV 1 · IMMORTAL/)).toBeTruthy();
    expect(screen.getByText(/YOUR MOVE — ROUND 1/)).toBeTruthy();
  });

  it("shows the guard plainly before he picks — a guarded virus says so", () => {
    const b = battleFor("PHISHING LURE");
    // The staff is its weakness — 28 damage, down to 2, and it guards.
    const guarding = applyBattleMove(b, "staff", {
      classId: null,
      potionCount: 1,
      captured: [],
      nowIso: "2026-11-07T12:00:00.000Z",
    }).state;
    expect(guarding.enemy.guarding).toBe(true);
    renderPanel(guarding);
    expect(screen.getByText(/GUARDING — sword and staff bounce off/)).toBeTruthy();
    // …and the guard badge rides the monster's figure in the scene.
    expect(document.querySelector(".wol-bf-guard-badge")).not.toBeNull();
  });

  it("clicking a move plays it, and the keys play it too", () => {
    const { onMove } = renderPanel(battleFor("SPAM CALLER"));
    fireEvent.click(screen.getByRole("button", { name: /SWORD \(1\)/ }));
    expect(onMove).toHaveBeenCalledWith("sword");
    fireEvent.keyDown(window, { key: "2" });
    expect(onMove).toHaveBeenCalledWith("wand");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onMove).toHaveBeenCalledWith("flee");
  });

  it("a rigid virus cannot be captured — the button says why, plainly", () => {
    renderPanel(battleFor("SMOOTH TALKER"));
    const capture = screen.getByRole("button", { name: /CAPTURE \(6\)/ });
    expect(capture).toBeDisabled();
    expect(capture).toHaveAttribute("title", expect.stringMatching(/Too rigid/));
  });

  it("a potion with none in the pack is disabled and says so", () => {
    renderPanel(battleFor("SPAM CALLER"), { potionCount: 0 });
    const potion = screen.getByRole("button", { name: /POTION \(5\)/ });
    expect(potion).toBeDisabled();
    expect(potion).toHaveAttribute("title", expect.stringMatching(/No healing potion/));
  });

  it("sending a captured virus lists it and sends the one picked", () => {
    const { onMove } = renderPanel(battleFor("SPAM CALLER"), { captured: [MITE] });
    fireEvent.click(screen.getByRole("button", { name: /SEND A CAPTURED VIRUS/ }));
    fireEvent.click(screen.getByRole("button", { name: /SEND VIRUS MITE/ }));
    expect(onMove).toHaveBeenCalledWith("send", "cap-1");
  });

  it("a finished battle shows the result and walks back out", () => {
    const b = battleFor("VIRUS MITE");
    const won = applyBattleMove(b, "sword", {
      classId: null,
      potionCount: 1,
      captured: [],
      nowIso: "2026-11-07T12:00:00.000Z",
    }).state;
    expect(won.over?.outcome).toBe("victory");
    const { onClose } = renderPanel(won);
    expect(screen.getByText(/VICTORY/)).toBeTruthy();
    expect(screen.getByText(/defeated — \+10 XP/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /BACK TO THE WORLD/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("BattlePanel — the three-box frame (2026-11-22 rebuild)", () => {
  it("renders the scene box with both fighters facing off on the field", () => {
    renderPanel(battleFor("VIRUS MITE"));
    const scene = screen.getByTestId("wol-battle-scene");
    expect(scene).toBeTruthy();
    expect(scene.getAttribute("data-area")).toBe("outside");
    // Both figures stand in the scene — the monster and the Captain.
    expect(screen.getByTestId("wol-battle-enemy-figure")).toBeTruthy();
    expect(screen.getByTestId("wol-battle-captain-figure")).toBeTruthy();
    expect(document.querySelector(".wol-bf-fighter--enemy svg")).not.toBeNull();
    expect(document.querySelector(".wol-bf-fighter--captain svg")).not.toBeNull();
    // The enemy's HP rides the scene as a bar, not a paragraph.
    const bar = screen.getByRole("progressbar", { name: /VIRUS MITE health/ });
    expect(bar).toBeTruthy();
  });

  it("renders the fighter box and the command box as FF blue boxes", () => {
    renderPanel(battleFor("VIRUS MITE"));
    expect(screen.getByTestId("wol-box-fighter")).toBeTruthy();
    expect(screen.getByTestId("wol-box-command")).toBeTruthy();
    expect(screen.getByText(/THE BLACK HATTER — CAPTAIN/)).toBeTruthy();
  });

  it("the attack-choice box opens right beside the Attack menu", () => {
    renderPanel(battleFor("VIRUS MITE"));
    const attackBox = screen.getByTestId("wol-box-attack");
    expect(attackBox).toBeTruthy();
    // The four attack tools live in the attack box, not the command box.
    const sword = screen.getByRole("button", { name: /SWORD \(1\)/ });
    expect(attackBox.contains(sword)).toBe(true);
    const commandBox = screen.getByTestId("wol-box-command");
    expect(commandBox.contains(sword)).toBe(false);
    // Folding the Attack menu away folds its choice box with it.
    fireEvent.click(screen.getByRole("button", { name: /ATTACK/ }));
    expect(screen.queryByTestId("wol-box-attack")).toBeNull();
  });

  it("the turn log is a compact strip inside the frame, not the page", () => {
    renderPanel(battleFor("VIRUS MITE"));
    const log = screen.getByRole("region", { name: /Battle log/ }) as HTMLElement | null;
    const logSection =
      log ?? (document.querySelector(".wol-bf-log") as HTMLElement | null);
    expect(logSection).not.toBeNull();
    expect(logSection!.querySelector(".wol-bf-log-lines")).not.toBeNull();
    expect(logSection!.textContent).toMatch(/VIRUS MITE — calm, tame/);
  });

  it("a landed hit animates: the Captain lunges, the monster shakes, the damage floats", () => {
    const before = battleFor("SPAM CALLER");
    const after = applyBattleMove(before, "sword", {
      classId: null,
      potionCount: 1,
      captured: [],
      nowIso: "2026-11-07T12:00:00.000Z",
    }).state;
    const dmg = before.enemy.hp - after.enemy.hp;
    expect(dmg).toBeGreaterThan(0);
    const onMove = vi.fn((_move: BattleMoveId, _sendId?: string) => {});
    const onClose = vi.fn(() => {});
    const { rerender } = render(panel(before, onMove, onClose));
    rerender(panel(after, onMove, onClose));
    const enemyFigure = screen.getByTestId("wol-battle-enemy-figure");
    expect(enemyFigure.className).toMatch(/wol-bf-hit/);
    const captainFigure = screen.getByTestId("wol-battle-captain-figure");
    expect(captainFigure.className).toMatch(/wol-bf-lunge-l/);
    const floater = document.querySelector(".wol-bf-dmg");
    expect(floater).not.toBeNull();
    expect(floater!.textContent).toContain(String(dmg));
  });

  it("a won battle drops the monster in the scene and banners the result", () => {
    const b = battleFor("VIRUS MITE");
    const won = applyBattleMove(b, "sword", {
      classId: null,
      potionCount: 1,
      captured: [],
      nowIso: "2026-11-07T12:00:00.000Z",
    }).state;
    renderPanel(won);
    expect(screen.getByTestId("wol-battle-enemy-figure").className).toMatch(/wol-bf-defeated/);
    expect(screen.getByTestId("wol-battle-banner").textContent).toMatch(/VIRUS MITE DEFEATED/);
  });

  it("the battle RULES never move — battles.ts is byte-identical", () => {
    const path = resolve(process.cwd(), "src/avatar/world-of-logic/battles.ts");
    const hash = createHash("sha256").update(readFileSync(path)).digest("hex");
    expect(hash).toBe("ed6fcc1906c125841ec311f34a925d3c22b3cfacb050b559aadd5a882e4ef097");
  });
});
