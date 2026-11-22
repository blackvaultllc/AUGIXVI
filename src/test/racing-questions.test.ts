import { describe, expect, it } from "vitest";
import {
  FAMILY_STAGES,
  currentTablesForLap,
  pitProblems,
  raceQuestion,
  reviewTablesForLap,
  strategyFor,
  type Rng,
} from "@/avatar/learner/racing/questions";

/** Deterministic rng so the sequencing claims are testable. */
function mulberry32(seed: number): Rng {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expectValidQuestion(q: { a: number; b: number; answer: number; choices: number[] }) {
  expect(q.answer).toBe(q.a * q.b);
  expect(q.choices).toHaveLength(4);
  expect(new Set(q.choices).size).toBe(4);
  expect(q.choices).toContain(q.answer);
  expect(q.choices.every((c) => c > 0)).toBe(true);
}

describe("fact families come in mastery order", () => {
  it("starts with the friendly tables 2, 5, 10", () => {
    expect(FAMILY_STAGES[0]).toEqual([2, 5, 10]);
    expect(currentTablesForLap(1)).toEqual([2, 5, 10]);
    expect(reviewTablesForLap(1)).toEqual([]);
  });

  it("lap 2 races 3 and 4, lap 3 races 6-9 with 11 and 12 sprinkled in", () => {
    expect(currentTablesForLap(2)).toEqual([3, 4]);
    const lap3 = currentTablesForLap(3);
    for (const t of [6, 7, 8, 9, 11, 12]) expect(lap3).toContain(t);
    // 11 and 12 are the light sprinkle, not the main course.
    expect(lap3.filter((t) => t === 11 || t === 12).length).toBeLessThan(
      lap3.filter((t) => t >= 6 && t <= 9).length,
    );
  });
});

describe("race questions", () => {
  it("lap 1 only ever asks the friendly tables — no frustration wall", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 300; i++) {
      const q = raceQuestion(1, rng);
      expect([2, 5, 10]).toContain(q.a);
      expectValidQuestion(q);
    }
  });

  it("lap 2 spirals: mostly 3s and 4s, with real review of 2, 5, 10", () => {
    const rng = mulberry32(7);
    let current = 0;
    let review = 0;
    for (let i = 0; i < 400; i++) {
      const q = raceQuestion(2, rng);
      if (q.a === 3 || q.a === 4) current++;
      else if ([2, 5, 10].includes(q.a)) review++;
      else throw new Error(`lap 2 asked an out-of-sequence table: ${q.a}`);
      expectValidQuestion(q);
    }
    // Roughly 70/30 — allow generous statistical room around it.
    expect(current / 400).toBeGreaterThan(0.55);
    expect(review / 400).toBeGreaterThan(0.15);
    expect(review / 400).toBeLessThan(0.45);
  });

  it("lap 3 asks the 6-9 families, reviews everything before, and 11-12 stay rare", () => {
    const rng = mulberry32(99);
    let hard = 0;
    let elevens = 0;
    for (let i = 0; i < 600; i++) {
      const q = raceQuestion(3, rng);
      expect([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).toContain(q.a);
      if (q.a >= 6 && q.a <= 9) hard++;
      if (q.a === 11 || q.a === 12) elevens++;
      expectValidQuestion(q);
    }
    expect(hard).toBeGreaterThan(150);
    expect(elevens).toBeGreaterThan(0);
    expect(elevens).toBeLessThan(hard / 2);
  });
});

describe("pit stop strategies teach the trick", () => {
  it("names the decomposition for the classic hard facts", () => {
    expect(strategyFor(7, 8)).toContain("5 × 8");
    expect(strategyFor(7, 8)).toContain("2 × 8");
    expect(strategyFor(4, 6)).toContain("Double");
    expect(strategyFor(9, 7)).toContain("10 × 7");
    expect(strategyFor(2, 9)).toContain("Double");
    expect(strategyFor(6, 7)).toContain("5 × 7");
  });

  it("the first pit stop teaches 3s and 4s, the second teaches 6-9", () => {
    const rng = mulberry32(5);
    for (const q of pitProblems(0, rng)) {
      expect([3, 4]).toContain(q.a);
      expect(q.strategy).toBeTruthy();
      expectValidQuestion(q);
    }
    for (const q of pitProblems(1, rng)) {
      expect([6, 7, 8, 9]).toContain(q.a);
      expect(q.strategy).toBeTruthy();
      expectValidQuestion(q);
    }
  });

  it("gives three distinct problems per stop", () => {
    const problems = pitProblems(1, mulberry32(11));
    expect(problems).toHaveLength(3);
    expect(new Set(problems.map((q) => `${q.a}x${q.b}`)).size).toBe(3);
  });
});
