/**
 * TYPED-ANSWER GRADING — Training Hall (owner spec
 * 2026-11-26). He can type his answer instead of picking
 * one. The grading rule, stated plainly:
 *
 *   TOLERANT on wording, STRICT on the fact.
 *
 * - Numbers are the fact's spine: every number in the
 *   verified correct answer (a year, a count, a voltage)
 *   must appear in his text, digit for digit after
 *   normalization (commas and spaces inside numbers are
 *   ignored). Miss the number, miss the question.
 * - Key terms: the significant words of the correct answer
 *   (4+ letters, not filler) — at least two thirds of them
 *   must appear in his text, whole word or shared stem
 *   (a 5+ letter prefix match counts, so "salivating"
 *   answers "salivate").
 * - A very short correct answer (one or two key terms —
 *   "Au", "Korea") must appear as a whole word.
 *
 * The verdict is computed from the bank item alone, the
 * same way on the client (for instant feedback) and on the
 * server (which re-grades typed answers itself and never
 * trusts the client's word for them).
 *
 * CALIBRATION: after grading, the Hall shows his answer
 * "calibrated to a shorter version" — his own words with
 * the filler stripped (the hedges, the lead-ins), tightened
 * to the core of what he said. It is shown BESIDE his words
 * and never replaces them: the core record keeps his
 * verbatim text.
 */

import type { BankQuestion } from "./questionBank";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "by", "for",
  "with", "from", "into", "over", "under", "about", "that", "this", "it",
  "its", "is", "are", "was", "were", "be", "been", "being", "as", "so",
]);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9'. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Numbers in a text, normalized (commas removed, so 9,192,631,770 is one token). */
export function numbersIn(text: string): string[] {
  const found = text.replace(/,/g, "").match(/\d+(?:\.\d+)?/g);
  return found ?? [];
}

/** The significant words of the verified answer — its key terms. */
export function keyTerms(correctChoice: string): string[] {
  const words = normalizeText(correctChoice.replace(/,/g, " ")).split(" ");
  const terms: string[] = [];
  for (const word of words) {
    const clean = word.replace(/^'+|'+$/g, "");
    if (clean.length < 4) continue;
    if (STOPWORDS.has(clean)) continue;
    if (/^\d/.test(clean)) continue; // numbers are checked strictly, separately
    if (!terms.includes(clean)) terms.push(clean);
  }
  return terms;
}

function termPresent(term: string, hisWords: string[]): boolean {
  return hisWords.some((word) => {
    if (word === term) return true;
    // Shared stem: a 5+ letter common prefix counts (salivating ~ salivate).
    if (term.length >= 5 && word.length >= 5) {
      let i = 0;
      while (i < Math.min(term.length, word.length) && term[i] === word[i]) i++;
      return i >= 5 && Math.abs(term.length - word.length) <= 4;
    }
    return false;
  });
}

export interface TypedGrade {
  correct: boolean;
  /** Plain words on why — shown to him with the verdict. */
  note: string;
}

export function gradeTypedAnswer(question: BankQuestion, typed: string): TypedGrade {
  const correctChoice = question.choices[question.answerIndex]!;
  const his = normalizeText(typed.replace(/,/g, " "));
  if (!his) return { correct: false, note: "Nothing was typed." };
  const hisWords = his.split(" ").filter(Boolean);

  // STRICT on the fact: every number in the verified answer must appear.
  const neededNumbers = numbersIn(correctChoice);
  const hisNumbers = numbersIn(typed);
  for (const n of neededNumbers) {
    if (!hisNumbers.includes(n)) {
      return { correct: false, note: `The fact carries the number ${n} — it was not in your answer.` };
    }
  }

  const terms = keyTerms(correctChoice);
  if (terms.length === 0) {
    // The answer is essentially a symbol or unit ("Au", "9.8 m/s²"):
    // its numbers were already checked strictly above; every
    // remaining token of 2+ letters must appear whole.
    const target = normalizeText(correctChoice.replace(/,/g, " "))
      .split(" ")
      .filter((t) => t.length >= 2 && !/^\d/.test(t));
    if (target.length === 0) return { correct: true, note: "Your words carry the fact — the number is exact." };
    const hit = target.every((t) => hisWords.includes(t));
    return hit
      ? { correct: true, note: "Your words carry the fact." }
      : { correct: false, note: "The key word of the fact was not in your answer." };
  }
  if (terms.length <= 2) {
    const hitCount = terms.filter((t) => termPresent(t, hisWords)).length;
    return hitCount === terms.length
      ? { correct: true, note: "Your words carry the fact." }
      : { correct: false, note: "A key term of the fact was missing from your answer." };
  }
  const hitCount = terms.filter((t) => termPresent(t, hisWords)).length;
  const needed = Math.ceil(terms.length * (2 / 3));
  return hitCount >= needed
    ? { correct: true, note: `Your words carry the fact (${hitCount} of ${terms.length} key terms).` }
    : {
        correct: false,
        note: `Only ${hitCount} of ${terms.length} key terms of the fact were in your answer — ${needed} are needed.`,
      };
}

/* ------------------------- Calibration (tightening) ------------------------ */

const LEAD_INS = [
  "i think the answer is",
  "i think it is",
  "i think it's",
  "i think",
  "i believe the answer is",
  "i believe it is",
  "i believe",
  "the answer is",
  "my answer is",
  "it is",
  "it's",
  "that would be",
  "this is",
];
const HEDGES = ["maybe", "probably", "possibly", "i guess", "sort of", "kind of", "just", "really"];

/**
 * His answer, calibrated to a shorter version: the filler
 * stripped, the core kept — HIS words tightened, not
 * replaced. Display only; the record keeps his verbatim
 * text. If nothing can be tightened, returns his words
 * as-is (trimmed).
 */
export function tightenAnswer(typed: string): string {
  let text = typed.trim().replace(/\s+/g, " ");
  if (!text) return "";
  let lower = text.toLowerCase();
  for (const lead of LEAD_INS) {
    if (lower.startsWith(lead + " ") || lower === lead) {
      text = text.slice(lead.length).trim();
      lower = text.toLowerCase();
      break;
    }
  }
  // Strip hedge words anywhere they appear as whole words.
  for (const hedge of HEDGES) {
    const pattern = new RegExp(`\\b${hedge.replace(/ /g, "\\s+")}\\b`, "gi");
    text = text.replace(pattern, " ");
  }
  text = text.replace(/\s+/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
  text = text.replace(/^[,.\s]+/, "");
  if (!text) return typed.trim();
  // Sentence shape: first letter up, one closing period if he ended plainly.
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (!/[.!?]$/.test(text)) text += ".";
  return text;
}
