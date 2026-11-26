/**
 * THE TRAINING HALL — tests (owner spec 2026-11-26): the
 * level curve and XP rules, typed-answer grading (tolerant
 * on wording, strict on the fact), calibration tightening,
 * the full statistics, the honest assessment, and the four
 * new subjects under the same POC bar.
 */
import { describe, expect, it } from "vitest";
import { ACTIVE_QUESTIONS, QUESTION_BANK, SUBJECT_IDS, questionById, validateBank } from "@/avatar/learning/questionBank";
import { gradeTypedAnswer, keyTerms, numbersIn, tightenAnswer } from "@/avatar/learning/grading";
import {
  cumulativeXpForLevel,
  hallStatsFromHistory,
  levelFromXp,
  retentionFromHistory,
  sessionsFromHistory,
  streaksFromHistory,
  xpForRecord,
} from "@/avatar/learning/hall";
import {
  generatePatternItems,
  makeDigitSpan,
  makeSpeedRound,
  mcSectionScore,
  memoryScore,
  overallFromSections,
  sanitizeAssessmentRecord,
  seededRng,
  speedScore,
  VOCAB_BANK,
} from "@/avatar/learning/assessment";
import type { AnswerRecord } from "@/avatar/learning/training";

function record(partial: Partial<AnswerRecord> & { questionId: string }): AnswerRecord {
  return {
    date: "2026-01-15",
    at: 1_000,
    subject: questionById(partial.questionId)?.subject ?? "psychology",
    correct: true,
    ...partial,
  };
}

/* ------------------------------ New subjects ------------------------------ */

describe("the four new subjects — same POC bar", () => {
  it("the bank still validates clean at 100 questions across 18 subjects", () => {
    expect(validateBank()).toEqual([]);
    expect(ACTIVE_QUESTIONS.length).toBe(100);
    expect(SUBJECT_IDS.length).toBe(18);
    for (const subject of ["virtual-reality", "timekeeping", "longevity", "mythology"] as const) {
      expect(ACTIVE_QUESTIONS.filter((q) => q.subject === subject).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("longevity items are framed as what was believed, sought, or verified — never as established effect", () => {
    const items = ACTIVE_QUESTIONS.filter((q) => q.subject === "longevity");
    for (const item of items) {
      const text = `${item.question} ${item.explanation}`.toLowerCase();
      expect(
        ["belie", "sought", "legend", "verified", "record", "debated"].some((marker) => text.includes(marker)),
        item.id,
      ).toBe(true);
    }
  });

  it("mythology items stand on the mythological record, named as such", () => {
    for (const item of ACTIVE_QUESTIONS.filter((q) => q.subject === "mythology")) {
      expect(item.source.toLowerCase()).toContain("mythology");
    }
  });

  it("every item carries a difficulty tier; the exact-recall items sit at tier 3", () => {
    for (const item of QUESTION_BANK) expect([1, 2, 3]).toContain(item.difficulty);
    expect(questionById("dark-milgram")!.difficulty).toBe(3);
    expect(questionById("time-cesium")!.difficulty).toBe(3);
    expect(questionById("psy-pavlov")!.difficulty).toBe(1);
    expect(questionById("law-miranda")!.difficulty).toBe(2);
  });
});

/* --------------------------------- XP & levels ---------------------------- */

describe("XP and the level curve — a long road to 1000", () => {
  it("XP follows the rule: 10 × tier for a pick, 15 × tier for a typed answer, nothing for a miss", () => {
    expect(xpForRecord(record({ questionId: "psy-pavlov", correct: true }))).toBe(10); // tier 1, choice
    expect(xpForRecord(record({ questionId: "dark-milgram", correct: true }))).toBe(30); // tier 3, choice
    expect(xpForRecord(record({ questionId: "law-miranda", correct: true, mode: "typed" }))).toBe(30); // tier 2, typed
    expect(xpForRecord(record({ questionId: "dark-milgram", correct: false, mode: "typed" }))).toBe(0);
  });

  it("the curve is the documented one", () => {
    expect(cumulativeXpForLevel(1)).toBe(0);
    expect(cumulativeXpForLevel(2)).toBe(71); // round(25 × 2^1.5)
    expect(cumulativeXpForLevel(10)).toBe(791);
    expect(cumulativeXpForLevel(100)).toBe(25_000);
    expect(cumulativeXpForLevel(1000)).toBe(790_569);
  });

  it("the curve never runs backward and level 1000 is graduation", () => {
    let previous = -1;
    for (const level of [1, 2, 3, 5, 10, 25, 50, 100, 250, 500, 750, 999, 1000]) {
      const xp = cumulativeXpForLevel(level);
      expect(xp).toBeGreaterThan(previous);
      previous = xp;
    }
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(71).level).toBe(2);
    expect(levelFromXp(790_568).level).toBe(999);
    const summit = levelFromXp(790_569);
    expect(summit.level).toBe(1000);
    expect(summit.graduated).toBe(true);
    expect(summit.xpToNextLevel).toBe(0);
  });
});

/* ------------------------------ Typed grading ----------------------------- */

describe("typed answers — tolerant on wording, strict on the fact", () => {
  it("a paraphrase carrying the key terms grades correct", () => {
    const item = questionById("psy-two-systems")!;
    expect(gradeTypedAnswer(item, "fast automatic effortless thinking").correct).toBe(true);
    expect(gradeTypedAnswer(item, "It is the fast, automatic mode of thinking").correct).toBe(true);
  });

  it("the opposite fact grades wrong even in fine wording", () => {
    const item = questionById("psy-two-systems")!;
    expect(gradeTypedAnswer(item, "the slow deliberate effortful mode of thinking").correct).toBe(false);
  });

  it("a wrong number fails the answer outright — numbers are the fact's spine", () => {
    const item = questionById("time-cesium")!;
    expect(gradeTypedAnswer(item, "cesium 133, 9,192,631,770 periods").correct).toBe(true);
    expect(gradeTypedAnswer(item, "cesium 133, 9,000,000,000 periods").correct).toBe(false);
    expect(numbersIn("9,192,631,770")).toEqual(["9192631770"]);
  });

  it("key terms and stems: 'salivating' answers the conditioning item", () => {
    const item = questionById("psy-pavlov")!;
    const grade = gradeTypedAnswer(item, "the dogs salivated when the bell rang alone");
    expect(grade.correct).toBe(true);
    expect(keyTerms(item.choices[item.answerIndex]!).length).toBeGreaterThan(0);
  });

  it("an empty answer is never correct", () => {
    expect(gradeTypedAnswer(questionById("ana-femur")!, "   ").correct).toBe(false);
  });
});

describe("calibration — his words, tightened, never replaced", () => {
  it("strips lead-ins and hedges and keeps the core", () => {
    expect(tightenAnswer("I think the answer is the femur")).toBe("The femur.");
    expect(tightenAnswer("maybe it is probably the liver")).toBe("It is the liver.");
    expect(tightenAnswer("206 bones")).toBe("206 bones.");
  });

  it("leaves a plain answer essentially as he said it", () => {
    expect(tightenAnswer("The femur is the longest bone.")).toBe("The femur is the longest bone.");
  });
});

/* ------------------------------- Statistics ------------------------------- */

describe("full statistics — from the real record only", () => {
  const history: AnswerRecord[] = [
    record({ questionId: "ana-femur", correct: false, at: 100, date: "2026-01-13", runId: "run-a", responseMs: 4000 }),
    record({ questionId: "ana-bones", correct: true, at: 101, date: "2026-01-13", runId: "run-a", responseMs: 2000 }),
    record({ questionId: "ana-femur", correct: true, at: 200, date: "2026-01-14", runId: "run-b", responseMs: 3000 }),
    record({ questionId: "law-miranda", correct: true, at: 300, date: "2026-01-15", runId: "run-c", responseMs: 1000, mode: "typed", typedText: "Miranda v. Arizona" }),
  ];

  it("sessions group by run, with their XP", () => {
    const sessions = sessionsFromHistory(history);
    expect(sessions.length).toBe(3);
    const runA = sessions.find((s) => s.runId === "run-a")!;
    expect(runA.asked).toBe(2);
    expect(runA.correct).toBe(1);
    expect(runA.xp).toBe(20); // ana-bones is tier 2 → 10 × 2 for a picked answer
  });

  it("retention compares first attempts against repeats", () => {
    const retention = retentionFromHistory(history);
    expect(retention.repeatedItems).toBe(1); // ana-femur asked twice
    expect(retention.firstAttemptAccuracy).toBe(0);
    expect(retention.repeatAccuracy).toBe(1);
  });

  it("streaks count consecutive days and die honestly after a gap", () => {
    expect(streaksFromHistory(history, "2026-01-15")).toEqual({
      currentStreakDays: 3,
      longestStreakDays: 3,
      activeDays: 3,
    });
    expect(streaksFromHistory(history, "2026-01-17").currentStreakDays).toBe(0);
    expect(streaksFromHistory([], "2026-01-15")).toEqual({ currentStreakDays: 0, longestStreakDays: 0, activeDays: 0 });
  });

  it("the hall roll-up carries level, response times, and a level road", () => {
    const hall = hallStatsFromHistory(history, "2026-01-15");
    expect(hall.response.measured).toBe(4);
    expect(hall.response.averageMs).toBe(2500);
    expect(hall.response.medianMs).toBe(2500);
    expect(hall.levelHistory.length).toBe(3);
    expect(hall.level.totalXp).toBeGreaterThan(0);
    expect(hall.level.level).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------- Assessment ------------------------------- */

describe("the assessment — the Hall's own scores, labeled true", () => {
  it("pattern items are well-formed and deterministic per seed", () => {
    const rngA = seededRng(7);
    const rngB = seededRng(7);
    const first = generatePatternItems(5, rngA);
    const second = generatePatternItems(5, rngB);
    expect(first).toEqual(second); // same seed, same items — generation is reproducible
    for (const item of first) {
      expect(item.sequence.length).toBe(4);
      expect(new Set(item.choices).size).toBe(4);
      expect(item.choices[item.answerIndex]).not.toBeUndefined();
      expect(item.sequence).not.toContain(item.choices[item.answerIndex]);
    }
  });

  it("vocabulary items are real words with exactly one right meaning", () => {
    for (const item of VOCAB_BANK) {
      expect(new Set(item.choices).size).toBe(4);
      expect(item.choices[item.answerIndex]).toBeTruthy();
    }
  });

  it("scoring formulas are the documented ones", () => {
    expect(mcSectionScore(4, 5)).toBe(80);
    expect(memoryScore(9)).toBe(100);
    expect(memoryScore(3)).toBe(0);
    expect(memoryScore(6)).toBe(50);
    expect(speedScore(6, 6)).toBe(100);
    expect(speedScore(3, 4)).toBe(50); // the floor of 6 rounds stands against a short run
    expect(speedScore(0, 5)).toBe(0);
    expect(overallFromSections({ pattern: 80, vocabulary: 60, memory: 40, speed: 100 })).toBe(70);
  });

  it("a speed round's stated count is the true count in its grid", () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 10; i++) {
      const round = makeSpeedRound(rng);
      const actual = round.grid.split("").filter((c) => c === round.target).length;
      expect(actual).toBe(round.count);
      expect(round.count).toBeGreaterThan(0);
    }
    expect(makeDigitSpan(7, rng).length).toBe(7);
  });

  it("stored assessment records are re-scored on read — a wrong overall is corrected, junk is dropped", () => {
    const fixed = sanitizeAssessmentRecord({
      date: "2026-01-15",
      at: 1000,
      sections: { pattern: 80, vocabulary: 60, memory: 40, speed: 100 },
      overall: 999,
    });
    expect(fixed?.overall).toBe(70);
    expect(sanitizeAssessmentRecord({ date: "2026-01-15", at: 1, sections: { pattern: 101, vocabulary: 0, memory: 0, speed: 0 } })).toBeNull();
    expect(sanitizeAssessmentRecord(null)).toBeNull();
  });
});
