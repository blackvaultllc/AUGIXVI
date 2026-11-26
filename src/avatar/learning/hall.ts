/**
 * THE TRAINING HALL — levels, XP, and the full statistics
 * (owner spec 2026-11-26). Pure and unit-tested; every
 * number here is computed from his real recorded answers
 * and nothing else. Where the record is thin, the stats
 * say so instead of dressing up a handful of answers.
 *
 * XP — earned by correct answers only:
 *   choice answer: 10 XP × difficulty tier (1–3)
 *   typed answer:  15 XP × difficulty tier (typing the fact
 *                  from memory earns half again)
 * Wrong answers earn nothing. XP is never stored as a
 * number he could drift from — it is derived from the
 * record (question difficulty from the bank, mode and
 * correctness from the record row), so the level always
 * stands on the same record the statistics read.
 *
 * THE LEVEL CURVE — a long road by design:
 *   cumulative XP to STAND at level L = round(25 × L^1.5)
 *   level 1 at 0 XP · level 2 at 71 · level 10 at 791 ·
 *   level 100 at 25,000 · level 500 at 279,508 ·
 *   LEVEL 1000 at 790,569 XP — graduation: mastery across
 *   the bank. A full 20-question run, all correct, earns
 *   roughly 200–450 XP, so the early levels come in the
 *   first days, level 100 is a season of daily training,
 *   and the summit is years down the road — as ordered.
 */

import { questionById } from "./questionBank";
import { progressFromHistory, type AnswerRecord, type TrainingProgress } from "./training";

export const GRADUATION_LEVEL = 1000;

export const XP_CHOICE_BASE = 10;
export const XP_TYPED_BASE = 15;

/** XP one recorded answer earned (0 if wrong or the item is unknown). */
export function xpForRecord(record: AnswerRecord): number {
  if (!record.correct) return 0;
  const question = questionById(record.questionId);
  if (!question) return 0;
  const base = record.mode === "typed" ? XP_TYPED_BASE : XP_CHOICE_BASE;
  return base * question.difficulty;
}

/** Cumulative XP required to stand at a level (level 1 = 0). */
export function cumulativeXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(25 * Math.pow(level, 1.5));
}

/** The level a total XP stands at, and the road to the next. */
export interface LevelState {
  totalXp: number;
  level: number;
  /** XP earned inside the current level. */
  xpIntoLevel: number;
  /** XP needed to reach the next level (0 at graduation). */
  xpToNextLevel: number;
  /** Cumulative XP at which the next level begins (null at graduation). */
  nextLevelAt: number | null;
  graduated: boolean;
}

export function levelFromXp(totalXp: number): LevelState {
  let level = 1;
  while (level < GRADUATION_LEVEL && cumulativeXpForLevel(level + 1) <= totalXp) level++;
  const atLevel = cumulativeXpForLevel(level);
  const nextAt = level >= GRADUATION_LEVEL ? null : cumulativeXpForLevel(level + 1);
  return {
    totalXp,
    level,
    xpIntoLevel: totalXp - atLevel,
    xpToNextLevel: nextAt === null ? 0 : nextAt - totalXp,
    nextLevelAt: nextAt,
    graduated: level >= GRADUATION_LEVEL,
  };
}

export function levelStateFromHistory(history: readonly AnswerRecord[]): LevelState {
  return levelFromXp(history.reduce((sum, r) => sum + xpForRecord(r), 0));
}

/* ------------------------------ The statistics ---------------------------- */

export interface SessionSummary {
  runId: string;
  date: string;
  at: number;
  asked: number;
  correct: number;
  xp: number;
}

export interface ResponseStats {
  /** Answers that carried a measured response time. */
  measured: number;
  averageMs: number | null;
  medianMs: number | null;
  /** His fastest and slowest areas by average response — only where measured. */
  fastestSubject: { subject: AnswerRecord["subject"]; averageMs: number } | null;
  slowestSubject: { subject: AnswerRecord["subject"]; averageMs: number } | null;
}

export interface RetentionStats {
  /** Items he has been asked more than once. */
  repeatedItems: number;
  /** Accuracy the FIRST time an item was asked. */
  firstAttemptAccuracy: number | null;
  /** Accuracy on every later asking of those same items — spaced repetition performance. */
  repeatAccuracy: number | null;
}

export interface StreakStats {
  /** Consecutive Chicago days with at least one recorded answer, ending today or yesterday. */
  currentStreakDays: number;
  longestStreakDays: number;
  /** Distinct days with at least one recorded answer. */
  activeDays: number;
}

export interface LevelHistoryPoint {
  date: string;
  totalXp: number;
  level: number;
}

export interface HallStats {
  progress: TrainingProgress;
  level: LevelState;
  sessions: SessionSummary[];
  response: ResponseStats;
  retention: RetentionStats;
  streaks: StreakStats;
  levelHistory: LevelHistoryPoint[];
}

function dayNumberFromISO(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map((n) => Number(n));
  return Math.floor(Date.UTC(y!, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

export function streaksFromHistory(history: readonly AnswerRecord[], todayISO: string): StreakStats {
  const days = [...new Set(history.map((r) => r.date))].sort();
  if (days.length === 0) return { currentStreakDays: 0, longestStreakDays: 0, activeDays: 0 };
  const dayNums = days.map(dayNumberFromISO);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < dayNums.length; i++) {
    run = dayNums[i] === dayNums[i - 1]! + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  // Current streak: the run ending at the most recent active
  // day — counted as current only if that day is today or
  // yesterday (his time); an older tail is history, not a streak.
  let current = 1;
  for (let i = dayNums.length - 1; i > 0; i--) {
    if (dayNums[i] === dayNums[i - 1]! + 1) current++;
    else break;
  }
  const todayNum = dayNumberFromISO(todayISO);
  const lastDay = dayNums[dayNums.length - 1]!;
  if (todayNum - lastDay > 1) current = 0;
  return { currentStreakDays: current, longestStreakDays: longest, activeDays: days.length };
}

export function sessionsFromHistory(history: readonly AnswerRecord[]): SessionSummary[] {
  const byRun = new Map<string, AnswerRecord[]>();
  for (const record of history) {
    const key = record.runId ?? `legacy-${record.date}`;
    const list = byRun.get(key) ?? [];
    list.push(record);
    byRun.set(key, list);
  }
  const sessions: SessionSummary[] = [];
  for (const [runId, rows] of byRun) {
    const sorted = [...rows].sort((a, b) => a.at - b.at);
    sessions.push({
      runId,
      date: sorted[0]!.date,
      at: sorted[0]!.at,
      asked: sorted.length,
      correct: sorted.filter((r) => r.correct).length,
      xp: sorted.reduce((sum, r) => sum + xpForRecord(r), 0),
    });
  }
  return sessions.sort((a, b) => b.at - a.at);
}

export function responseFromHistory(history: readonly AnswerRecord[]): ResponseStats {
  const measured = history.filter((r) => typeof r.responseMs === "number" && r.responseMs >= 0);
  if (measured.length === 0) {
    return { measured: 0, averageMs: null, medianMs: null, fastestSubject: null, slowestSubject: null };
  }
  const times = measured.map((r) => r.responseMs!).sort((a, b) => a - b);
  const average = times.reduce((s, t) => s + t, 0) / times.length;
  const median = times.length % 2 === 1 ? times[(times.length - 1) / 2]! : (times[times.length / 2 - 1]! + times[times.length / 2]!) / 2;
  const bySubject = new Map<AnswerRecord["subject"], number[]>();
  for (const r of measured) {
    const list = bySubject.get(r.subject) ?? [];
    list.push(r.responseMs!);
    bySubject.set(r.subject, list);
  }
  const averages = [...bySubject.entries()]
    .filter(([, list]) => list.length >= 3)
    .map(([subject, list]) => ({ subject, averageMs: list.reduce((s, t) => s + t, 0) / list.length }))
    .sort((a, b) => a.averageMs - b.averageMs);
  return {
    measured: measured.length,
    averageMs: Math.round(average),
    medianMs: Math.round(median),
    fastestSubject: averages[0] ?? null,
    slowestSubject: averages.length > 1 ? averages[averages.length - 1]! : null,
  };
}

export function retentionFromHistory(history: readonly AnswerRecord[]): RetentionStats {
  const byItem = new Map<string, AnswerRecord[]>();
  for (const record of history) {
    const list = byItem.get(record.questionId) ?? [];
    list.push(record);
    byItem.set(record.questionId, list);
  }
  let repeatedItems = 0;
  let firstAsked = 0;
  let firstRight = 0;
  let repeatAsked = 0;
  let repeatRight = 0;
  for (const rows of byItem.values()) {
    if (rows.length < 2) continue;
    repeatedItems++;
    const sorted = [...rows].sort((a, b) => a.at - b.at);
    firstAsked++;
    if (sorted[0]!.correct) firstRight++;
    for (const row of sorted.slice(1)) {
      repeatAsked++;
      if (row.correct) repeatRight++;
    }
  }
  return {
    repeatedItems,
    firstAttemptAccuracy: firstAsked === 0 ? null : firstRight / firstAsked,
    repeatAccuracy: repeatAsked === 0 ? null : repeatRight / repeatAsked,
  };
}

export function levelHistoryFromHistory(history: readonly AnswerRecord[]): LevelHistoryPoint[] {
  const byDate = new Map<string, number>();
  for (const record of history) {
    byDate.set(record.date, (byDate.get(record.date) ?? 0) + xpForRecord(record));
  }
  const points: LevelHistoryPoint[] = [];
  let total = 0;
  for (const date of [...byDate.keys()].sort()) {
    total += byDate.get(date)!;
    points.push({ date, totalXp: total, level: levelFromXp(total).level });
  }
  return points;
}

export function hallStatsFromHistory(history: readonly AnswerRecord[], todayISO: string): HallStats {
  return {
    progress: progressFromHistory(history),
    level: levelStateFromHistory(history),
    sessions: sessionsFromHistory(history),
    response: responseFromHistory(history),
    retention: retentionFromHistory(history),
    streaks: streaksFromHistory(history, todayISO),
    levelHistory: levelHistoryFromHistory(history),
  };
}
