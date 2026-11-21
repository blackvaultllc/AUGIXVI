// WORLD OF LOGIC — the room, played end to end: the Captain walks
// up to a monster, reads its lesson, fights with the deck's engine
// through the deck's own panel, and the outcome settles — record
// forward-only, a beaten monster gone, a captured virus kept.
// Deterministic throughout: the engine calculates, never rolls.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorldOfLogic from "@/avatar/world-of-logic/WorldOfLogic";
import { todayNumber } from "@/avatar/world-of-logic/blossom";

function walkToMonster(label: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`${label} — the`) }));
  // One tile per 150ms tick; each step's timer is scheduled by the
  // effect that runs after the previous step renders, so advance
  // tick by tick, letting React flush between steps.
  for (let i = 0; i < 40; i++) {
    act(() => {
      vi.advanceTimersByTime(150);
    });
  }
}

describe("World of Logic room", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the field — the Captain and all five monsters standing", () => {
    render(<WorldOfLogic />);
    expect(screen.getByRole("grid", { name: /The outside/ })).toBeTruthy();
    expect(screen.getByLabelText("The Captain")).toBeTruthy();
    for (const label of [
      "VIRUS MITE",
      "SPAM CALLER",
      "PHISHING LURE",
      "SMOOTH TALKER",
      "RANSOMWARE TROLL",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(`${label} — the`) })).toBeTruthy();
    }
    expect(screen.getByText(/LV 1 · XP 0/)).toBeTruthy();
  });

  it("plays a battle to victory: walk up, lesson first, then the fight", () => {
    render(<WorldOfLogic />);
    walkToMonster("VIRUS MITE");
    // The lesson opens first — the deck's two-tap.
    expect(screen.getByText(/patch the door before the mite finds it/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /FIGHT/ }));
    expect(screen.getByRole("dialog", { name: /Battle — VIRUS MITE/ })).toBeTruthy();
    // The sword is the mite's weakness: 12 × 2 = 24 ≥ its 20 HP —
    // one move, calculated, ends it.
    fireEvent.click(screen.getByRole("button", { name: /SWORD \(1\)/ }));
    expect(screen.getByText(/VICTORY/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /BACK TO THE WORLD/ }));
    // Settled: +10 XP on the deck's own record key, monster gone.
    const rec = JSON.parse(localStorage.getItem("augi.battles.captain.v1") ?? "{}") as {
      xp?: number;
      wins?: number;
    };
    expect(rec.xp).toBe(10);
    expect(rec.wins).toBe(1);
    expect(screen.queryByRole("button", { name: /VIRUS MITE — the/ })).toBeNull();
    expect(screen.getByText(/LV 1 · XP 10/)).toBeTruthy();
  });

  it("captures a weakened tame virus and keeps it in the collection", () => {
    // Blossom Bell's giant turn already spent today, so the fight
    // runs its full course (her rule is proven in the engine tests).
    localStorage.setItem("augi.blossom-bell.v1", JSON.stringify({ giantDay: todayNumber() }));
    render(<WorldOfLogic />);
    walkToMonster("SPAM CALLER");
    fireEvent.click(screen.getByRole("button", { name: /FIGHT/ }));
    expect(screen.getByRole("dialog", { name: /Battle — SPAM CALLER/ })).toBeTruthy();
    // The sword is resisted (6 a hit): 25 → 19 → 13 → 7, below a
    // third of 25 — then the capture lands, calculated.
    const sword = () => fireEvent.click(screen.getByRole("button", { name: /SWORD \(1\)/ }));
    sword();
    sword();
    sword();
    expect(screen.getByText(/HP 7 \/ 25/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /CAPTURE \(6\)/ }));
    expect(screen.getByText(/CAPTURED/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /BACK TO THE WORLD/ }));
    const saved = JSON.parse(localStorage.getItem("augi.battles.captured.v1") ?? "[]") as {
      name: string;
    }[];
    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe("SPAM CALLER");
    const rec = JSON.parse(localStorage.getItem("augi.battles.captain.v1") ?? "{}") as {
      xp?: number;
      captures?: number;
    };
    expect(rec.xp).toBe(15);
    expect(rec.captures).toBe(1);
    expect(screen.getByText(/Captured: 1\/12/)).toBeTruthy();
  });

  it("a fled battle costs nothing and the monster stays", () => {
    render(<WorldOfLogic />);
    walkToMonster("PHISHING LURE");
    fireEvent.click(screen.getByRole("button", { name: /FIGHT/ }));
    fireEvent.click(screen.getByRole("button", { name: /FLEE/ }));
    expect(screen.getByText(/WALKED AWAY/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /BACK TO THE WORLD/ }));
    const rec = JSON.parse(localStorage.getItem("augi.battles.captain.v1") ?? "{}") as {
      xp?: number;
      flees?: number;
    };
    expect(rec.xp).toBe(0);
    expect(rec.flees).toBe(1);
    expect(screen.getByRole("button", { name: /PHISHING LURE — the/ })).toBeTruthy();
  });
});
