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
 * space, the numbers, A–Z, a–z. Every entry agrees with the
 * translator by construction (same codes, same padding).
 */
export const BINARY_CHART: { group: string; entries: ChartEntry[] }[] = [
  { group: "Space", entries: [chartEntry(32)] },
  { group: "Numbers", entries: chartRange(48, 57) },
  { group: "Capital letters", entries: chartRange(65, 90) },
  { group: "Small letters", entries: chartRange(97, 122) },
];
