/**
 * DAILY TRAINING — the engine (owner orders 2026-11-26).
 * Pure and unit-tested: run drawing, choice shuffling,
 * scoring, calibration (weak areas resurface more often),
 * and the progress view math.
 *
 * Rules from his words:
 *   - He picks the count: 5, 10, or 20 (default 10).
 *   - Questions are drawn RANDOMLY and UNTITLED — nothing
 *     here or in the window ever labels a question with its
 *     subject during a run. The subject exists only in the
 *     record, for calibration.
 *   - Every answer is recorded: date, subject (internal),
 *     correct/incorrect. The progress view shows honest
 *     numbers from those records and nothing else.
 */

import { ACTIVE_QUESTIONS, SUBJECT_IDS, type BankQuestion, type SubjectId } from "./questionBank";

export const RUN_COUNTS = [5, 10, 20] as const;
export type RunCount = (typeof RUN_COUNTS)[number];
export const DEFAULT_RUN_COUNT: RunCount = 10;

export function normalizeRunCount(value: unknown): RunCount {
  return value === 5 || value === 10 || value === 20 ? value : DEFAULT_RUN_COUNT;
}

/** One recorded answer — the core's training record row. */
export interface AnswerRecord {
  /** His Chicago calendar date, YYYY-MM-DD. */
  date: string;
  at: number;
  questionId: string;
  subject: SubjectId;
  correct: boolean;
}

/** Deterministic RNG (mulberry32) — seeded so tests can prove behavior. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SubjectStats {
  subject: SubjectId;
  asked: number;
  correct: number;
  /** null when never asked — shown honestly, never as 0%. */
  accuracy: number | null;
}

export function subjectStats(history: readonly AnswerRecord[]): SubjectStats[] {
  return SUBJECT_IDS.map((subject) => {
    const rows = history.filter((r) => r.subject === subject);
    const correct = rows.filter((r) => r.correct).length;
    return {
      subject,
      asked: rows.length,
      correct,
      accuracy: rows.length === 0 ? null : correct / rows.length,
    };
  });
}

/**
 * Calibration weights: a subject he gets wrong more often
 * weighs more in the draw, and a subject never asked weighs
 * a little extra too — so weak areas resurface more often
 * (spaced repetition) and nothing sits untested forever.
 */
export function weightsFromStats(allStats: readonly SubjectStats[]): Record<SubjectId, number> {
  const weights = {} as Record<SubjectId, number>;
  for (const stats of allStats) {
    if (stats.asked === 0) {
      weights[stats.subject] = 1.5;
    } else {
      const wrongShare = 1 - (stats.accuracy ?? 0);
      weights[stats.subject] = 1 + wrongShare * 2;
    }
  }
  return weights;
}

export function subjectWeights(history: readonly AnswerRecord[]): Record<SubjectId, number> {
  return weightsFromStats(subjectStats(history));
}

export interface DrawnQuestion {
  questionId: string;
  /** INTERNAL ONLY — never rendered during a run. */
  subject: SubjectId;
  prompt: string;
  choices: string[];
  /** Index into `choices` (after shuffling) of the correct answer. */
  answerIndex: number;
  /** The bank's fact + source, shown only after he answers. */
  explanation: string;
}

/** Shuffle a question's choices with the run RNG; the correct answer moves with them. */
export function shuffleQuestion(question: BankQuestion, rng: () => number): DrawnQuestion {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = order[i]!;
    order[i] = order[j]!;
    order[j] = a;
  }
  return {
    questionId: question.id,
    subject: question.subject,
    prompt: question.question,
    choices: order.map((idx) => question.choices[idx]!),
    answerIndex: order.indexOf(question.answerIndex),
    explanation: question.explanation,
  };
}

/**
 * Draw a run: pick subjects by calibrated weight, then take
 * questions round-robin within each subject (shuffled), so a
 * run is mixed across everything and does not repeat a
 * question. Asking for more than the bank holds returns the
 * whole bank — honest, never padded.
 */
export function drawRun(count: number, history: readonly AnswerRecord[], rng: () => number): DrawnQuestion[] {
  return drawRunWithWeights(count, subjectWeights(history), rng);
}

export function drawRunWithWeights(
  count: number,
  weights: Record<SubjectId, number>,
  rng: () => number,
): DrawnQuestion[] {
  const pools = new Map<SubjectId, BankQuestion[]>();
  for (const subject of SUBJECT_IDS) {
    const pool = ACTIVE_QUESTIONS.filter((q) => q.subject === subject);
    // Shuffle each subject's pool once with the run RNG.
    const copy = [...pool];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const a = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = a;
    }
    pools.set(subject, copy);
  }
  const drawn: BankQuestion[] = [];
  const subjectsWithStock = () => SUBJECT_IDS.filter((s) => (pools.get(s)?.length ?? 0) > 0);
  while (drawn.length < count) {
    const available = subjectsWithStock();
    if (available.length === 0) break;
    const totalWeight = available.reduce((sum, s) => sum + weights[s], 0);
    let roll = rng() * totalWeight;
    let picked: SubjectId = available[available.length - 1]!;
    for (const subject of available) {
      roll -= weights[subject];
      if (roll <= 0) {
        picked = subject;
        break;
      }
    }
    const next = pools.get(picked)?.shift();
    if (next) drawn.push(next);
  }
  return drawn.map((q) => shuffleQuestion(q, rng));
}

/** Score a finished run against the drawn questions. */
export function scoreRun(drawn: readonly DrawnQuestion[], picks: readonly (number | null)[]): { correct: number; total: number } {
  let correct = 0;
  drawn.forEach((item, i) => {
    if (picks[i] !== null && picks[i] === item.answerIndex) correct++;
  });
  return { correct, total: drawn.length };
}

/* ------------------------------ Progress view ----------------------------- */

export type Trend = "improving" | "steady" | "slipping" | "not-enough-data";

export interface SubjectProgress extends SubjectStats {
  trend: Trend;
}

export interface DailyLine {
  date: string;
  asked: number;
  correct: number;
  accuracy: number;
}

export interface TrainingProgress {
  totalAsked: number;
  totalCorrect: number;
  overallAccuracy: number | null;
  subjects: SubjectProgress[];
  daily: DailyLine[];
}

/**
 * Trend: the accuracy of the most recent 10 answers in a
 * subject against the 10 before them. Fewer than 10 answers
 * in total is honestly "not enough data" — no trend is
 * invented from a handful of answers.
 */
export function trendFor(rows: readonly AnswerRecord[]): Trend {
  if (rows.length < 10) return "not-enough-data";
  const sorted = [...rows].sort((a, b) => a.at - b.at);
  const recent = sorted.slice(-10);
  const prior = sorted.slice(-20, -10);
  if (prior.length === 0) return "not-enough-data";
  const acc = (list: readonly AnswerRecord[]) => list.filter((r) => r.correct).length / list.length;
  const delta = acc(recent) - acc(prior);
  if (delta >= 0.1) return "improving";
  if (delta <= -0.1) return "slipping";
  return "steady";
}

export function progressFromHistory(history: readonly AnswerRecord[]): TrainingProgress {
  const subjects = subjectStats(history).map((stats) => ({
    ...stats,
    trend: trendFor(history.filter((r) => r.subject === stats.subject)),
  }));
  const byDate = new Map<string, { asked: number; correct: number }>();
  for (const row of history) {
    const day = byDate.get(row.date) ?? { asked: 0, correct: 0 };
    day.asked++;
    if (row.correct) day.correct++;
    byDate.set(row.date, day);
  }
  const daily = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, day]) => ({ date, asked: day.asked, correct: day.correct, accuracy: day.correct / day.asked }));
  const totalAsked = history.length;
  const totalCorrect = history.filter((r) => r.correct).length;
  return {
    totalAsked,
    totalCorrect,
    overallAccuracy: totalAsked === 0 ? null : totalCorrect / totalAsked,
    subjects,
    daily,
  };
}

export function trendLabel(trend: Trend): string {
  switch (trend) {
    case "improving":
      return "Improving";
    case "slipping":
      return "Slipping";
    case "steady":
      return "Steady";
    default:
      return "Not enough data yet";
  }
}
