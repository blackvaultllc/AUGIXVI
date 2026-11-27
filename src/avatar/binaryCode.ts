/**
 * BINARY — the reading core (owner order 2026-11-27).
 *
 * His page teaches the code the whole construct runs on, the way
 * he reads it himself:
 *   · A bit is one switch: 0 is off, 1 is on.
 *   · A byte is eight bits. Read the places right to left:
 *     1, 2, 4, 8, 16, 32, 64, 128.
 *   · Add the places where a 1 sits — that sum is the number,
 *     and the number names the character (ASCII).
 *
 * Pure module, no I/O: the window renders from it and the tests
 * prove it. The chart is exactly the set he ordered — A–Z, a–z,
 * the numbers, and space — generated from the ASCII codes so it
 * can never drift from the translator beside it.
 */

/** The eight places of a byte, left to right as written. */
export const BIT_PLACES: readonly number[] = [128, 64, 32, 16, 8, 4, 2, 1];

/** True when the string is exactly one byte: eight 0/1 characters. */
export function isByteString(value: string): boolean {
  return /^[01]{8}$/.test(value);
}

/** The number a byte names: the sum of the places where a 1 sits. */
export function byteValue(bits: string): number | null {
  if (!isByteString(bits)) return null;
  let total = 0;
  for (let i = 0; i < 8; i += 1) {
    if (bits[i] === "1") total += BIT_PLACES[i] ?? 0;
  }
  return total;
}

/** One place of a byte, for the reading lesson: its value and its bit. */
export interface BytePlace {
  place: number;
  bit: "0" | "1";
  /** True when this place counts toward the sum (its bit is on). */
  counted: boolean;
}

/** A byte broken into its eight places, left to right as written. */
export function byteBreakdown(bits: string): BytePlace[] | null {
  if (!isByteString(bits)) return null;
  return BIT_PLACES.map((place, i) => {
    const bit = bits[i] === "1" ? "1" : "0";
    return { place, bit, counted: bit === "1" } as BytePlace;
  });
}

/** The sum written the way he reads it: "64 + 8 + 1 = 73". */
export function byteSumWords(bits: string): string | null {
  const breakdown = byteBreakdown(bits);
  const value = byteValue(bits);
  if (!breakdown || value === null) return null;
  const counted = breakdown.filter((p) => p.counted).map((p) => String(p.place));
  if (counted.length === 0) return "nothing is on = 0";
  return `${counted.join(" + ")} = ${value}`;
}

/** One character as its byte. ASCII only (codes 0–127); else null. */
export function charToByte(char: string): string | null {
  if (char.length !== 1) return null;
  const code = char.codePointAt(0) ?? -1;
  if (code < 0 || code > 127) return null;
  return code.toString(2).padStart(8, "0");
}

/** A byte as its character, when the byte names a printable one. */
export function byteToChar(bits: string): string | null {
  const value = byteValue(bits);
  if (value === null || value < 32 || value > 126) return null;
  return String.fromCodePoint(value);
}

export interface EncodeResult {
  /** The bytes, space-separated, one per character. */
  binary: string;
  /** Characters with no ASCII byte — named, never silently dropped. */
  unsupported: string[];
}

/** Letters → binary: one 8-bit group per character. */
export function encodeText(text: string): EncodeResult {
  const bytes: string[] = [];
  const unsupported: string[] = [];
  for (const char of text) {
    const byte = charToByte(char);
    if (byte) bytes.push(byte);
    else if (!unsupported.includes(char)) unsupported.push(char);
  }
  return { binary: bytes.join(" "), unsupported };
}

export interface DecodeResult {
  /** The letters the bytes name. */
  text: string;
  /**
   * Groups that are not a readable byte: not eight 0/1 digits, or a
   * byte outside the printable characters. Named, never guessed at.
   */
  badGroups: string[];
}

/**
 * Binary → letters. Whitespace is ignored, so groups may be typed
 * with spaces, line breaks, or run together in one long string.
 */
export function decodeBinary(input: string): DecodeResult {
  const digits = input.replace(/[^01]/g, "");
  const stray = input.replace(/[01\s]/g, "");
  const badGroups: string[] = [];
  if (stray) badGroups.push(`not binary: ${stray}`);
  let text = "";
  for (let i = 0; i + 8 <= digits.length; i += 8) {
    const group = digits.slice(i, i + 8);
    const char = byteToChar(group);
    if (char) text += char;
    else badGroups.push(group);
  }
  const remainder = digits.length % 8;
  if (remainder !== 0)
    badGroups.push(`unfinished group: ${digits.slice(digits.length - remainder)}`);
  return { text, badGroups };
}

/** One row of the character chart. */
export interface ChartEntry {
  char: string;
  /** The name shown for the one character that prints as nothing. */
  label: string;
  code: number;
  bits: string;
}

function chartEntry(code: number): ChartEntry {
  const char = String.fromCodePoint(code);
  return {
    char,
    label: code === 32 ? "space" : char,
    code,
    bits: code.toString(2).padStart(8, "0"),
  };
}

function chartRange(from: number, to: number): ChartEntry[] {
  const entries: ChartEntry[] = [];
  for (let code = from; code <= to; code += 1) entries.push(chartEntry(code));
  return entries;
}

/**
 * THE CHARACTER CHART — the full set he ordered, in four groups:
 * space, the typed numbers, A–Z, a–z. Every entry agrees with the
 * translator by construction (same codes, same padding).
 *
 * The group notes carry the patterns he reads them by (his order
 * 2026-11-27): a typed digit is 0011 + the digit's own binary;
 * a capital is 010 + the letter's number (A is 1); a small letter
 * is 011 + the letter's number.
 */
export const BINARY_CHART: { group: string; note: string; entries: ChartEntry[] }[] = [
  {
    group: "Space",
    note: "The space is a real character with its own byte: 00100000.",
    entries: [chartEntry(32)],
  },
  {
    group: "Typed numbers — the characters '0' to '9'",
    note: "0011 + the digit's own binary. These are the characters you type — not the numbers themselves (the counting chart above is the numbers).",
    entries: chartRange(48, 57),
  },
  {
    group: "Capital letters",
    note: "010 + the letter's number — A is 1, B is 2, all the way to Z at 26.",
    entries: chartRange(65, 90),
  },
  {
    group: "Small letters",
    note: "011 + the letter's number — same numbers as the capitals, one switch higher.",
    entries: chartRange(97, 122),
  },
  {
    group: "Punctuation & symbols",
    note: "The marks that finish the printable set — the translator reads these too.",
    entries: [
      ...chartRange(33, 47),
      ...chartRange(58, 64),
      ...chartRange(91, 96),
      ...chartRange(123, 126),
    ],
  },
];

/**
 * COUNTING — the numbers themselves (supplement order 2026-11-27).
 *
 * A pure number wears no byte costume: 5 by itself is 101, while
 * the character '5' typed on a screen is the byte 00110101. The
 * numbers are counted the slow way, the way he works them: write
 * the places (16, 8, 4, 2, 1 for this range), take the biggest
 * place that fits, subtract, and keep going with what's left.
 */

/** A whole number as binary with no padding: 5 → "101", 0 → "0". */
export function numberToBinary(value: number): string {
  if (!Number.isInteger(value) || value < 0) return "";
  return value.toString(2);
}

export interface CountingStep {
  /** The place taken at this step. */
  place: number;
  /** What remains after taking it. */
  remaining: number;
}

/**
 * The slow method, step by step: from the number, take the
 * biggest place that fits, subtract, repeat on the remainder.
 * 17 → take 16 (1 left), take 1 (0 left).
 */
export function countingSteps(value: number): CountingStep[] {
  if (!Number.isInteger(value) || value < 0) return [];
  const steps: CountingStep[] = [];
  let remaining = value;
  let place = 1;
  while (place * 2 <= value) place *= 2;
  while (remaining > 0) {
    if (place <= remaining) {
      remaining -= place;
      steps.push({ place, remaining });
    }
    place /= 2;
  }
  return steps;
}

/** The count written as its sum: "16 + 1 = 17". */
export function countingSumWords(value: number): string {
  const steps = countingSteps(value);
  if (steps.length === 0) return "nothing is on = 0";
  return `${steps.map((s) => String(s.place)).join(" + ")} = ${value}`;
}

/** One row of the counting chart. */
export interface CountingEntry {
  value: number;
  /** The number's own binary, no padding: 5 → "101". */
  bits: string;
  /** The same bits under the five places 16-8-4-2-1: 5 → "00101". */
  placed: string;
  sum: string;
}

/** THE COUNTING CHART — the pure numbers, 0 through 20. */
export const COUNTING_CHART: CountingEntry[] = Array.from({ length: 21 }, (_, value) => ({
  value,
  bits: numberToBinary(value),
  placed: numberToBinary(value).padStart(5, "0"),
  sum: countingSumWords(value),
}));
