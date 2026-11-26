/**
 * THE TRAINING HALL ASSESSMENT (owner spec 2026-11-26) —
 * a periodic cognitive check-in built from established
 * item types: pattern reasoning, vocabulary, working
 * memory, processing speed.
 *
 * HONEST FORM — the law of this module: these are the
 * Training Hall's OWN measured scores. This is not a
 * clinical IQ test, it produces no IQ number, and nothing
 * here may be labeled "IQ" — the tracked number is his
 * ASSESSMENT SCORE, the interface says so in one plain
 * line (ASSESSMENT_HONESTY_LINE), and the baseline is his
 * first assessment, charted from day one against himself.
 *
 * Pattern items are generated from rules, so the correct
 * answer is correct by construction and verifiable.
 * Vocabulary items are a small fixed bank of real words
 * with their dictionary meanings. Working memory is a
 * digit-span task (the classic form); processing speed is
 * a timed counting task. Section scores are scaled 0–100
 * by the plain formulas in this file; the overall score is
 * their mean. Nothing is normed against other people —
 * the comparison is him against his own line.
 */

import { seededRng } from "./training";

export const ASSESSMENT_HONESTY_LINE =
  "These are the Training Hall's own measured scores — not a clinical IQ test. The number tracked is your assessment score, measured against your own line.";

export interface AssessmentSections {
  pattern: number;
  vocabulary: number;
  memory: number;
  speed: number;
}

export interface AssessmentRecord {
  date: string;
  at: number;
  sections: AssessmentSections;
  /** The mean of the four sections — computed on the server, never trusted from the client. */
  overall: number;
}

export function overallFromSections(sections: AssessmentSections): number {
  const values = [sections.pattern, sections.vocabulary, sections.memory, sections.speed];
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

export function sanitizeAssessmentRecord(raw: unknown): AssessmentRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const date = typeof row["date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row["date"]) ? row["date"] : null;
  const at = typeof row["at"] === "number" && Number.isFinite(row["at"]) && row["at"] > 0 ? row["at"] : null;
  const rawSections = row["sections"];
  if (!date || at === null || !rawSections || typeof rawSections !== "object") return null;
  const s = rawSections as Record<string, unknown>;
  const section = (key: string): number | null => {
    const v = s[key];
    return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v) : null;
  };
  const pattern = section("pattern");
  const vocabulary = section("vocabulary");
  const memory = section("memory");
  const speed = section("speed");
  if (pattern === null || vocabulary === null || memory === null || speed === null) return null;
  const sections = { pattern, vocabulary, memory, speed };
  // The overall is always recomputed — a stored number is never trusted.
  return { date, at, sections, overall: overallFromSections(sections) };
}

export function sanitizeAssessments(raw: unknown): AssessmentRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(sanitizeAssessmentRecord)
    .filter((r): r is AssessmentRecord => r !== null)
    .sort((a, b) => a.at - b.at)
    .slice(-365);
}

/* ---------------------------- Pattern reasoning --------------------------- */

export interface PatternItem {
  /** The sequence as shown, with the next term missing. */
  sequence: number[];
  choices: number[];
  answerIndex: number;
  /** The rule, in plain words — shown after he answers. */
  rule: string;
}

type Rule = {
  name: string;
  make: (rng: () => number) => { sequence: number[]; next: number; distractors: number[] };
};

const RULES: Rule[] = [
  {
    name: "Add the same step each time",
    make: (rng) => {
      const start = 1 + Math.floor(rng() * 12);
      const step = 2 + Math.floor(rng() * 9);
      const seq = [0, 1, 2, 3].map((i) => start + i * step);
      return { sequence: seq, next: start + 4 * step, distractors: [start + 4 * step + step, start + 4 * step - 1, start + 5 * step] };
    },
  },
  {
    name: "Multiply by the same number each time",
    make: (rng) => {
      const start = 1 + Math.floor(rng() * 4);
      const ratio = 2 + Math.floor(rng() * 2); // ×2 or ×3
      const seq = [0, 1, 2, 3].map((i) => start * Math.pow(ratio, i));
      const next = start * Math.pow(ratio, 4);
      return { sequence: seq, next, distractors: [next * ratio, next + ratio, next - start] };
    },
  },
  {
    name: "The steps themselves grow by one",
    make: (rng) => {
      const start = 1 + Math.floor(rng() * 8);
      const firstStep = 1 + Math.floor(rng() * 4);
      const seq = [start];
      let step = firstStep;
      for (let i = 0; i < 3; i++) {
        seq.push(seq[seq.length - 1]! + step);
        step++;
      }
      const next = seq[seq.length - 1]! + step;
      return { sequence: seq, next, distractors: [next + 1, next - step, next + step] };
    },
  },
  {
    name: "Add, then multiply — alternating",
    make: (rng) => {
      const start = 1 + Math.floor(rng() * 5);
      const add = 1 + Math.floor(rng() * 4);
      const seq = [start];
      for (let i = 0; i < 3; i++) {
        const last = seq[seq.length - 1]!;
        seq.push(i % 2 === 0 ? last + add : last * 2);
      }
      const last = seq[seq.length - 1]!;
      const next = seq.length % 2 === 0 ? last * 2 : last + add;
      return { sequence: seq, next, distractors: [next + add, next * 2 === next ? next + 1 : next * 2, next - 1] };
    },
  },
  {
    name: "Squares — each term is a counting number squared, shifted",
    make: (rng) => {
      const shift = Math.floor(rng() * 5);
      const from = 1 + Math.floor(rng() * 3);
      const seq = [0, 1, 2, 3].map((i) => (from + i) * (from + i) + shift);
      const next = (from + 4) * (from + 4) + shift;
      return { sequence: seq, next, distractors: [next + 2 * (from + 4), next - 1, (from + 4) * (from + 4)] };
    },
  },
];

/** Generate `count` pattern items; every answer is correct by construction. */
export function generatePatternItems(count: number, rng: () => number): PatternItem[] {
  const items: PatternItem[] = [];
  for (let i = 0; i < count; i++) {
    const rule = RULES[Math.floor(rng() * RULES.length)]!;
    const made = rule.make(rng);
    const options = [made.next, ...made.distractors];
    // Dedupe distractors against the answer and each other, deterministically,
    // then pad with values checked against everything already present.
    const unique = [...new Set(options)];
    let pad = 1;
    while (unique.length < 4) {
      const candidate = made.next + pad * 3 + 1;
      if (!unique.includes(candidate)) unique.push(candidate);
      pad++;
    }
    const choices = unique.slice(0, 4);
    // Shuffle deterministically with the same rng.
    for (let j = choices.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1));
      const a = choices[j]!;
      choices[j] = choices[k]!;
      choices[k] = a;
    }
    items.push({ sequence: made.sequence, choices, answerIndex: choices.indexOf(made.next), rule: rule.name });
  }
  return items;
}

/* ------------------------------- Vocabulary ------------------------------- */

export interface VocabItem {
  word: string;
  choices: string[];
  answerIndex: number;
}

/** Real words, dictionary meanings — the fixed vocabulary bank. */
export const VOCAB_BANK: readonly VocabItem[] = [
  { word: "candid", choices: ["truthful and straightforward", "carefully hidden", "extremely wealthy", "easily frightened"], answerIndex: 0 },
  { word: "frugal", choices: ["generous to a fault", "careful with money; not wasteful", "quick to anger", "fond of travel"], answerIndex: 1 },
  { word: "obscure", choices: ["very famous", "loud and clear", "not well known; hard to understand", "recently invented"], answerIndex: 2 },
  { word: "diligent", choices: ["lazy but lucky", "working hard and carefully", "speaking loudly", "changing often"], answerIndex: 1 },
  { word: "hostile", choices: ["welcoming to strangers", "unfriendly; opposed", "tired and ill", "silent in company"], answerIndex: 1 },
  { word: "vivid", choices: ["pale and fading", "produced in the past", "bright, clear, and lifelike", "impossible to prove"], answerIndex: 2 },
  { word: "reluctant", choices: ["unwilling; hesitant", "eager and ready", "proud of oneself", "lost in thought"], answerIndex: 0 },
  { word: "ancient", choices: ["brand new", "belonging to a very distant past", "made of stone", "written in code"], answerIndex: 1 },
  { word: "scarce", choices: ["plentiful", "hard to find; not enough to meet demand", "dangerously sharp", "worth a fortune"], answerIndex: 1 },
  { word: "precise", choices: ["roughly correct", "exactly accurate", "spoken quickly", "pleasantly vague"], answerIndex: 1 },
  { word: "timid", choices: ["bold in company", "shy and easily frightened", "skilled with tools", "stubborn in argument"], answerIndex: 1 },
  { word: "vast", choices: ["very great in size", "narrow and deep", "recently discovered", "guarded by law"], answerIndex: 0 },
];

export function pickVocabItems(count: number, rng: () => number): VocabItem[] {
  const copy = [...VOCAB_BANK];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = a;
  }
  return copy.slice(0, Math.min(count, copy.length));
}

/* --------------------- Working memory & processing speed ------------------ */

/**
 * Digit span scoring: he is shown spans of growing length.
 * Score = 100 × (longest span he reproduced exactly − 3) / 6,
 * floored at 0 — a span of 3 scores 0, a span of 9 scores 100.
 */
export function memoryScore(longestCorrectSpan: number): number {
  return Math.max(0, Math.min(100, Math.round(((longestCorrectSpan - 3) / 6) * 100)));
}

export function makeDigitSpan(length: number, rng: () => number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += String(Math.floor(rng() * 10));
  return out;
}

/**
 * Processing speed scoring: in a fixed 60-second window he
 * counts a target letter in grid after grid. The score is
 * correct counts against the round floor of 6 — a steady
 * worker finishes six or more rounds in the minute, so
 * pace is inside the score: answer slowly and the floor
 * stands against you; answer fast and wrong and the misses
 * stand against you.
 */
export function speedScore(correctCount: number, attemptedCount: number): number {
  if (attemptedCount === 0) return 0;
  return Math.max(0, Math.min(100, Math.round((correctCount / Math.max(6, attemptedCount)) * 100)));
}

export interface SpeedRound {
  grid: string;
  target: string;
  count: number;
}

const SPEED_LETTERS = "ABCDEFGHJKLMNPRSTUVXYZ";

export function makeSpeedRound(rng: () => number, size = 40): SpeedRound {
  const target = SPEED_LETTERS[Math.floor(rng() * SPEED_LETTERS.length)]!;
  let grid = "";
  let count = 0;
  for (let i = 0; i < size; i++) {
    const letter = SPEED_LETTERS[Math.floor(rng() * SPEED_LETTERS.length)]!;
    grid += letter;
    if (letter === target) count++;
  }
  if (count === 0) {
    grid = target + grid.slice(1);
    count = 1;
  }
  return { grid, target, count };
}

/** Section score for a set of answered MC items (pattern / vocabulary). */
export function mcSectionScore(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

export { seededRng };
