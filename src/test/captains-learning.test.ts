/**
 * THE CAPTAIN'S LEARNING — pure-module tests (owner orders
 * 2026-11-26): quote rotation, prayer-time math, the POC
 * question bank, the training engine (draw, weighting,
 * scoring, progress), the sight log's sanitizers, and the
 * shelves' substance.
 */
import { describe, expect, it } from "vitest";
import { QUOTES, quoteForDay, quoteIndexFor, spokenQuote } from "@/avatar/learning/quotes";
import {
  PRAYER_SLOTS,
  duePrayerSlot,
  markPrayerHeard,
  prayerSlotsRemaining,
  type PrayerDoneMap,
} from "@/avatar/learning/prayerTime";
import { chicagoDateISO } from "@/avatar/learning/time";
import { STUDY_SHELVES } from "@/avatar/learning/studyShelves";
import { ART_OF_WAR_CHAPTERS } from "@/avatar/learning/artOfWar";
import {
  ACTIVE_QUESTIONS,
  QUESTION_BANK,
  SUBJECT_IDS,
  validateBank,
} from "@/avatar/learning/questionBank";
import {
  drawRun,
  progressFromHistory,
  scoreRun,
  seededRng,
  shuffleQuestion,
  subjectWeights,
  type AnswerRecord,
} from "@/avatar/learning/training";
import { sanitizeSightEntries } from "@/avatar/learning/sightLog";

/* --------------------------------- Quotes -------------------------------- */

describe("quotes — real, attributed, rotating", () => {
  it("every quote carries an author and a source; none is anonymous", () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(24);
    for (const quote of QUOTES) {
      expect(quote.text.trim().length).toBeGreaterThan(0);
      expect(quote.author.trim().length).toBeGreaterThan(0);
      expect(quote.source.trim().length).toBeGreaterThan(0);
    }
  });

  it("day and night differ on the same day, across many days", () => {
    for (let day = 20_000; day < 20_400; day++) {
      expect(quoteForDay(day, "day")).not.toBe(quoteForDay(day, "night"));
    }
  });

  it("the next day differs from today, in both slots", () => {
    for (let day = 20_000; day < 20_400; day++) {
      expect(quoteForDay(day + 1, "day")).not.toBe(quoteForDay(day, "day"));
      expect(quoteForDay(day + 1, "night")).not.toBe(quoteForDay(day, "night"));
    }
  });

  it("walks the whole ring before anything repeats", () => {
    const seen = new Set<number>();
    const totalSlots = QUOTES.length;
    for (let i = 0; i < totalSlots; i++) {
      const day = 20_000 + Math.floor(i / 2);
      const slot = i % 2 === 0 ? "day" : "night";
      const index = quoteIndexFor(day, slot, QUOTES.length);
      expect(seen.has(index)).toBe(false);
      seen.add(index);
    }
    expect(seen.size).toBe(totalSlots);
  });

  it("the spoken form names the slot and the author", () => {
    const line = spokenQuote(QUOTES[0]!, "night");
    expect(line).toContain("quote of the night");
    expect(line).toContain(QUOTES[0]!.author);
  });
});

/* -------------------------------- Prayer time ----------------------------- */

// 2026-01-15 is CST (UTC-6) in Chicago: 07:00 local = 13:00 UTC.
const at = (hourUTC: number, minute = 0) => new Date(Date.UTC(2026, 0, 15, hourUTC, minute));
const DATE = "2026-01-15";

describe("prayer time — four slots, each at most once, only while due", () => {
  it("the day is keyed to his Chicago date", () => {
    expect(chicagoDateISO(at(13))).toBe(DATE);
  });

  it("nothing is due before the morning slot", () => {
    expect(duePrayerSlot(at(12, 59), {})).toBeNull();
    expect(prayerSlotsRemaining(at(12, 59), {}).length).toBe(4);
  });

  it("the morning slot comes due at 07:00 his time", () => {
    expect(duePrayerSlot(at(13), {})?.id).toBe("morning");
  });

  it("once heard, a slot does not fire again that day", () => {
    const done: PrayerDoneMap = markPrayerHeard({}, DATE, "morning");
    expect(duePrayerSlot(at(13, 30), done)).toBeNull();
    expect(duePrayerSlot(at(17, 59), done)).toBeNull(); // still nothing until midday
  });

  it("the next slot takes over when its time comes", () => {
    const done: PrayerDoneMap = markPrayerHeard({}, DATE, "morning");
    expect(duePrayerSlot(at(18), done)?.id).toBe("midday"); // 12:00 CST
  });

  it("an unheard earlier slot does not resurface after a later slot's window opens", () => {
    // At 12:30 his time with nothing heard, the due slot is midday —
    // the morning window has closed; the pill offers the current one.
    expect(duePrayerSlot(at(18, 30), {})?.id).toBe("midday");
  });

  it("at most four prompts a day: all heard means none due, even late", () => {
    let done: PrayerDoneMap = {};
    for (const slot of PRAYER_SLOTS) done = markPrayerHeard(done, DATE, slot.id);
    expect(duePrayerSlot(at(23, 59), done)).toBeNull(); // 17:59 CST
    expect(duePrayerSlot(new Date(Date.UTC(2026, 0, 16, 3, 30)), done)).toBeNull(); // 21:30 CST
    expect(prayerSlotsRemaining(at(13), done).length).toBe(0);
  });

  it("a new day starts clean", () => {
    let done: PrayerDoneMap = {};
    for (const slot of PRAYER_SLOTS) done = markPrayerHeard(done, DATE, slot.id);
    const nextMorning = new Date(Date.UTC(2026, 0, 16, 13, 0)); // 07:00 CST next day
    expect(duePrayerSlot(nextMorning, done)?.id).toBe("morning");
  });
});

/* ------------------------------ The POC bank ------------------------------ */

describe("the question bank — the POC bar, enforced", () => {
  it("validates clean: one correct answer, a source, and a confirmed-as-of date on every active item", () => {
    expect(validateBank()).toEqual([]);
  });

  it("covers every subject he named, with real depth in each", () => {
    for (const subject of SUBJECT_IDS) {
      const items = ACTIVE_QUESTIONS.filter((q) => q.subject === subject);
      expect(items.length, subject).toBeGreaterThanOrEqual(4);
    }
    expect(ACTIVE_QUESTIONS.length).toBeGreaterThanOrEqual(70);
  });

  it("every item's explanation states the fact and its source plainly", () => {
    for (const item of QUESTION_BANK) {
      expect(item.explanation).toContain("Source:");
      expect(item.explanation.length).toBeGreaterThan(60);
    }
  });

  it("a bank item missing its source or date fails validation — POC is code, not a promise", () => {
    const broken = [
      { ...QUESTION_BANK[0]!, id: "broken-1", source: "" },
      { ...QUESTION_BANK[0]!, id: "broken-2", confirmedAsOf: "recently" },
      { ...QUESTION_BANK[0]!, id: "broken-3", choices: ["a", "a", "b", "c"] as unknown as [string, string, string, string] },
    ];
    const problems = validateBank(broken);
    expect(problems.length).toBe(3);
  });

  it("retired items are never drawn and never edited into the active bank", () => {
    const retiredIds = new Set(QUESTION_BANK.filter((q) => q.retired).map((q) => q.id));
    for (const item of ACTIVE_QUESTIONS) expect(retiredIds.has(item.id)).toBe(false);
  });
});

/* ----------------------------- Training engine ---------------------------- */

function record(subject: AnswerRecord["subject"], correct: boolean, at: number, date = DATE): AnswerRecord {
  return { date, at, questionId: `q-${at}`, subject, correct };
}

describe("daily training — draw, scoring, calibration", () => {
  it("draws exactly the chosen count, with no repeated question", () => {
    for (const count of [5, 10, 20] as const) {
      const run = drawRun(count, [], seededRng(42));
      expect(run.length).toBe(count);
      expect(new Set(run.map((r) => r.questionId)).size).toBe(count);
    }
  });

  it("drawn questions keep the subject internal only — the run view renders prompt and choices", () => {
    const run = drawRun(10, [], seededRng(7));
    for (const item of run) {
      expect(Object.keys(item).sort()).toEqual(
        ["answerIndex", "choices", "explanation", "prompt", "questionId", "subject"].sort(),
      );
      // The prompt itself never announces its subject.
      for (const subject of SUBJECT_IDS) {
        expect(item.prompt.toLowerCase()).not.toContain(`[${subject}]`);
      }
    }
  });

  it("shuffling keeps exactly one correct answer, and it is the bank's answer", () => {
    const rng = seededRng(99);
    for (const question of ACTIVE_QUESTIONS.slice(0, 25)) {
      const drawn = shuffleQuestion(question, rng);
      expect(drawn.choices[drawn.answerIndex]).toBe(question.choices[question.answerIndex]);
      expect(new Set(drawn.choices).size).toBe(4);
    }
  });

  it("scoring counts only the picks that match", () => {
    const run = drawRun(5, [], seededRng(3));
    const picks = run.map((item, i) => (i < 3 ? item.answerIndex : (item.answerIndex + 1) % 4));
    expect(scoreRun(run, picks)).toEqual({ correct: 3, total: 5 });
    expect(scoreRun(run, run.map(() => null))).toEqual({ correct: 0, total: 5 });
  });

  it("weak subjects weigh more in the draw than strong ones", () => {
    const history: AnswerRecord[] = [];
    for (let i = 0; i < 20; i++) history.push(record("psychology", false, 1_000 + i));
    for (let i = 0; i < 20; i++) history.push(record("law", true, 2_000 + i));
    const weights = subjectWeights(history);
    expect(weights["psychology"]).toBeGreaterThan(weights["law"]);
  });

  it("over many runs, the weak subject is drawn more often than the strong one", () => {
    const history: AnswerRecord[] = [];
    for (let i = 0; i < 20; i++) history.push(record("psychology", false, 1_000 + i));
    for (let i = 0; i < 20; i++) history.push(record("law", true, 2_000 + i));
    let psychology = 0;
    let law = 0;
    for (let seed = 0; seed < 300; seed++) {
      const run = drawRun(10, history, seededRng(seed));
      psychology += run.filter((r) => r.subject === "psychology").length;
      law += run.filter((r) => r.subject === "law").length;
    }
    expect(psychology).toBeGreaterThan(law);
  });

  it("the progress view is built from the recorded answers and nothing else", () => {
    const history: AnswerRecord[] = [
      ...Array.from({ length: 10 }, (_, i) => record("anatomy", false, 1_000 + i, "2026-01-14")),
      ...Array.from({ length: 10 }, (_, i) => record("anatomy", true, 2_000 + i, "2026-01-15")),
      record("law", true, 3_000, "2026-01-15"),
    ];
    const progress = progressFromHistory(history);
    expect(progress.totalAsked).toBe(21);
    expect(progress.totalCorrect).toBe(11);
    const anatomy = progress.subjects.find((s) => s.subject === "anatomy")!;
    expect(anatomy.accuracy).toBe(0.5);
    expect(anatomy.trend).toBe("improving"); // last 10 all right after first 10 all wrong
    const law = progress.subjects.find((s) => s.subject === "law")!;
    expect(law.trend).toBe("not-enough-data");
    expect(progress.daily).toEqual([
      { date: "2026-01-14", asked: 10, correct: 0, accuracy: 0 },
      { date: "2026-01-15", asked: 11, correct: 11, accuracy: 1 },
    ]);
    const untouched = progress.subjects.find((s) => s.subject === "science")!;
    expect(untouched.accuracy).toBeNull(); // never asked — shown honestly, not as 0%
  });
});

/* -------------------------------- Sight log ------------------------------- */

describe("sight log — his record, sanitized, never judged", () => {
  it("keeps valid entries, defaults the outcome, and drops malformed rows", () => {
    const entries = sanitizeSightEntries([
      { id: "a", at: 1_700_000_000_000, text: "Saw the truck lights.", outcome: "came-to-pass" },
      { id: "b", at: 1_700_000_100_000, text: "A feeling about tomorrow." },
      { id: "", at: 5, text: "no id" },
      { id: "c", at: -1, text: "bad time" },
      "junk",
    ]);
    expect(entries.map((e) => e.id)).toEqual(["b", "a"]); // newest first
    expect(entries[0]!.outcome).toBe("not-yet-known");
    expect(entries[1]!.outcome).toBe("came-to-pass");
  });
});

/* --------------------------------- Shelves -------------------------------- */

describe("the shelves — real substance", () => {
  it("ships Psychology and Dark Psychology with attributed study notes", () => {
    expect(STUDY_SHELVES.map((s) => s.id)).toEqual(["psychology", "dark-psychology"]);
    for (const shelf of STUDY_SHELVES) {
      expect(shelf.notes.length).toBeGreaterThanOrEqual(6);
      for (const note of shelf.notes) {
        expect(note.source.trim().length).toBeGreaterThan(0);
        expect(note.body.length).toBeGreaterThan(80);
      }
    }
    const dark = STUDY_SHELVES.find((s) => s.id === "dark-psychology")!;
    // Framed as recognition and defense, in the notes themselves.
    expect(dark.notes.every((n) => n.body.includes("THE COUNTER"))).toBe(true);
  });

  it("ships The Art of War whole — all thirteen chapters of the Giles text", () => {
    expect(ART_OF_WAR_CHAPTERS.length).toBe(13);
    expect(ART_OF_WAR_CHAPTERS.map((c) => c.numeral)).toEqual([
      "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII",
    ]);
    const chapterOne = ART_OF_WAR_CHAPTERS[0]!;
    expect(chapterOne.sections.some((s) => s.includes("All warfare is based on deception"))).toBe(true);
    const chapterThree = ART_OF_WAR_CHAPTERS[2]!;
    expect(chapterThree.sections.some((s) => s.includes("know the enemy and know yourself"))).toBe(true);
    for (const chapter of ART_OF_WAR_CHAPTERS) {
      expect(chapter.sections.length).toBeGreaterThanOrEqual(10);
    }
  });
});
