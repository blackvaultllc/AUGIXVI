// BATTLE PANEL — the battle screen (owner order 2026-11-07
// ~10:53 CST): the enemy's file, the Captain's gear, the moves,
// and the turn-by-turn log. The panel renders what the engine
// decides — it never decides anything itself.
//
// Ported with the panel from the VoiceWave Command Deck
// (blackvaultllc/voicewave-command-deck @ 7653d36,
// src/test/battle-panel.test.tsx) — import paths rewired.

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

function renderPanel(
  battle: BattleState,
  opts: { potionCount?: number; captured?: CapturedVirus[] } = {},
) {
  const onMove = vi.fn((_move: BattleMoveId, _sendId?: string) => {});
  const onClose = vi.fn(() => {});
  render(
    <BattlePanel
      battle={battle}
      captainLevel={1}
      classId={null}
      potionCount={opts.potionCount ?? 1}
      captured={opts.captured ?? []}
      onMove={onMove}
      onClose={onClose}
    />,
  );
  return { onMove, onClose };
}

beforeEach(() => {
  localStorage.removeItem("augi.battles.captain.v1");
  localStorage.removeItem("augi.battles.captured.v1");
});

describe("BattlePanel", () => {
  it("shows the enemy's file — name, temperament, lesson, health", () => {
    renderPanel(battleFor("SPAM CALLER"));
    expect(screen.getByRole("dialog", { name: /Battle — SPAM CALLER/ })).toBeTruthy();
    expect(screen.getByText(/Calm, tame — it can be caught/)).toBeTruthy();
    // The lesson shows twice — in the enemy's file and in the
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
