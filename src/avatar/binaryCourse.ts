/**
 * BINARY COURSE — the full learning program core (owner order
 * 2026-11-27: "a very extensive learning program… every single
 * aspect"). Fifteen modules, in his order: foundations, places &
 * counting, converting, bytes & sizes, characters, the translator,
 * arithmetic, negatives, logic gates, bitwise work, hex & octal,
 * real-world binary, floating point, error detection, and the
 * practice & mastery pass.
 *
 * Everything here is real math, plain TS, no I/O except the
 * progress store (injectable storage, same pattern as brain.ts).
 * The window renders lessons from these helpers and the drills
 * are generated from them, so a drill's "working" can never
 * disagree with the lesson beside it.
 */
import { BIT_PLACES, byteToChar, byteValue, isByteString } from "./binaryCode";

/** The fifteen modules, in the owner's order. */
export const BINARY_MODULES: { id: string; title: string }[] = [
  { id: "foundations", title: "Foundations" },
  { id: "places", title: "Place Values & Counting" },
  { id: "converting", title: "Converting: Decimal → Binary" },
  { id: "sizes", title: "Bytes & Sizes" },
  { id: "characters", title: "Characters (ASCII)" },
  { id: "translator", title: "The Translator" },
  { id: "arithmetic", title: "Binary Arithmetic" },
  { id: "negatives", title: "Negative Numbers" },
  { id: "gates", title: "Logic & Gates" },
  { id: "bitwise", title: "Bitwise Work" },
  { id: "bases", title: "Hexadecimal & Octal" },
  { id: "realworld", title: "Real-World Binary" },
  { id: "floating", title: "Floating Point" },
  { id: "errors", title: "Error Detection" },
  { id: "mastery", title: "Practice & Mastery" },
];

/** Format a number as an 8-bit byte string. */
export function toByte(value: number): string {
  return (value & 0xff).toString(2).padStart(8, "0");
}

/** Format a number as binary with an exact width. */
export function toBits(value: number, width: number): string {
  return value.toString(2).padStart(width, "0").slice(-width);
}

/* ── Module 3: decimal → binary, the divide-by-2 road ────────── */

export interface DivisionStep {
  dividend: number;
  quotient: number;
  remainder: 0 | 1;
}

/** Divide by 2, write the remainder, repeat — read remainders up. */
export function divisionSteps(value: number): DivisionStep[] {
  if (!Number.isInteger(value) || value < 0) return [];
  if (value === 0) return [{ dividend: 0, quotient: 0, remainder: 0 }];
  const steps: DivisionStep[] = [];
  let current = value;
  while (current > 0) {
    steps.push({
      dividend: current,
      quotient: Math.floor(current / 2),
      remainder: (current % 2) as 0 | 1,
    });
    current = Math.floor(current / 2);
  }
  return steps;
}

/* ── Module 4: bytes & sizes ─────────────────────────────────── */

export interface SizeUnit {
  name: string;
  short: string;
  bytes: number;
  plain: string;
}

/** Sizes as powers of 1024 (2^10) — the binary counting of storage. */
export const SIZE_UNITS: SizeUnit[] = [
  { name: "Byte", short: "B", bytes: 1, plain: "8 bits — one character" },
  { name: "Kilobyte", short: "KB", bytes: 1024, plain: "about a paragraph of text" },
  { name: "Megabyte", short: "MB", bytes: 1024 ** 2, plain: "about a minute of music" },
  {
    name: "Gigabyte",
    short: "GB",
    bytes: 1024 ** 3,
    plain: "about a thousand books' worth, or a short video",
  },
  { name: "Terabyte", short: "TB", bytes: 1024 ** 4, plain: "a big hard drive" },
];

/* ── Module 6: the translator's per-byte breakdown ───────────── */

export interface ByteReading {
  bits: string;
  sum: string;
  value: number | null;
  char: string | null;
}

/** Read a byte the teaching way: places added, number, character. */
export function readByte(bits: string): ByteReading {
  const value = byteValue(bits);
  if (value === null) return { bits, sum: "", value: null, char: null };
  const counted = BIT_PLACES.filter((_, i) => bits[i] === "1");
  return {
    bits,
    sum: counted.length ? counted.join(" + ") : "nothing on",
    value,
    char: byteToChar(bits),
  };
}

/* ── Module 7: arithmetic, step by step ──────────────────────── */

export interface AddColumn {
  place: number;
  a: "0" | "1";
  b: "0" | "1";
  carryIn: 0 | 1;
  written: "0" | "1";
  carryOut: 0 | 1;
}

export interface AddResult {
  columns: AddColumn[];
  result: string;
  /** True when the true sum needs a ninth bit. */
  overflow: boolean;
  sum: number;
}

/** Add two bytes column by column, carries shown — the real walk. */
export function addBytes(aBits: string, bBits: string): AddResult | null {
  if (!isByteString(aBits) || !isByteString(bBits)) return null;
  const columns: AddColumn[] = [];
  let carry: 0 | 1 = 0;
  let result = "";
  for (let i = 7; i >= 0; i -= 1) {
    const a = aBits[i] as "0" | "1";
    const b = bBits[i] as "0" | "1";
    const total = (a === "1" ? 1 : 0) + (b === "1" ? 1 : 0) + carry;
    const written = (total % 2 === 1 ? "1" : "0") as "0" | "1";
    const carryOut = (total >= 2 ? 1 : 0) as 0 | 1;
    columns.unshift({ place: BIT_PLACES[i] ?? 0, a, b, carryIn: carry, written, carryOut });
    result = written + result;
    carry = carryOut;
  }
  const sum = (byteValue(aBits) ?? 0) + (byteValue(bBits) ?? 0);
  return { columns, result, overflow: carry === 1, sum };
}

export interface SubResult {
  result: string;
  /** The answer as a plain number (a − b). */
  difference: number;
}

/** Subtract two bytes (a − b) by the borrowing road. */
export function subtractBytes(aBits: string, bBits: string): SubResult | null {
  const a = byteValue(aBits);
  const b = byteValue(bBits);
  if (a === null || b === null) return null;
  return { result: toByte(a - b), difference: a - b };
}

export interface MultiplyStep {
  /** The bits of a that produced this row (one per 1 in b). */
  shiftBy: number;
  row: string;
  rowValue: number;
}

export interface MultiplyResult {
  steps: MultiplyStep[];
  result: string;
  product: number;
}

/** Multiply by shift-and-add: one row per 1 in the second number. */
export function multiplyBytes(aBits: string, bBits: string): MultiplyResult | null {
  const a = byteValue(aBits);
  const b = byteValue(bBits);
  if (a === null || b === null) return null;
  const steps: MultiplyStep[] = [];
  for (let i = 0; i < 8; i += 1) {
    if (bBits[7 - i] === "1") {
      const rowValue = a * 2 ** i;
      steps.push({ shiftBy: i, row: rowValue.toString(2), rowValue });
    }
  }
  const product = a * b;
  return { steps, result: product.toString(2), product };
}

export interface DivideResult {
  quotient: number;
  remainder: number;
  quotientBits: string;
}

/** Divide two whole numbers (b must not be 0). */
export function divideValues(a: number, b: number): DivideResult | null {
  if (b === 0) return null;
  const quotient = Math.floor(a / b);
  return { quotient, remainder: a - quotient * b, quotientBits: quotient.toString(2) };
}

/* ── Module 8: negative numbers ──────────────────────────────── */

/** A signed number (−128…127) as its 8-bit two's complement byte. */
export function toTwosComplement(value: number): string | null {
  if (!Number.isInteger(value) || value < -128 || value > 127) return null;
  return toByte(value);
}

/** Read an 8-bit byte as a two's complement signed number. */
export function fromTwosComplement(bits: string): number | null {
  const value = byteValue(bits);
  if (value === null) return null;
  return bits[0] === "1" ? value - 256 : value;
}

/** Flip every bit (ones' complement / the NOT operation). */
export function flipBits(bits: string): string {
  return bits
    .split("")
    .map((bit) => (bit === "1" ? "0" : "1"))
    .join("");
}

/** Negate a byte the computer's way: flip the bits, add 1. */
export function negateByte(bits: string): string | null {
  if (!isByteString(bits)) return null;
  const flipped = flipBits(bits);
  const added = addBytes(flipped, "00000001");
  return added ? added.result : null;
}

/**
 * Signed overflow: adding two numbers of the same sign and
 * getting the opposite sign — the answer ran past the limit.
 */
export function signedOverflow(aBits: string, bBits: string): boolean {
  const added = addBytes(aBits, bBits);
  if (!added) return false;
  return aBits[0] === bBits[0] && added.result[0] !== aBits[0];
}

/* ── Module 9: logic gates ───────────────────────────────────── */

export type GateName = "AND" | "OR" | "NOT" | "XOR" | "NAND" | "NOR" | "XNOR";

export interface GateDef {
  name: GateName;
  inputs: 1 | 2;
  plain: string;
  run: (a: 0 | 1, b: 0 | 1) => 0 | 1;
}

export const GATES: GateDef[] = [
  {
    name: "AND",
    inputs: 2,
    plain: "On only when BOTH inputs are on.",
    run: (a, b) => (a === 1 && b === 1 ? 1 : 0),
  },
  {
    name: "OR",
    inputs: 2,
    plain: "On when EITHER input is on (or both).",
    run: (a, b) => (a === 1 || b === 1 ? 1 : 0),
  },
  {
    name: "NOT",
    inputs: 1,
    plain: "Flips the one input: on becomes off, off becomes on.",
    run: (a) => (a === 1 ? 0 : 1),
  },
  {
    name: "XOR",
    inputs: 2,
    plain: "On when the inputs are DIFFERENT.",
    run: (a, b) => (a !== b ? 1 : 0),
  },
  {
    name: "NAND",
    inputs: 2,
    plain: "AND, then flipped: off only when both are on.",
    run: (a, b) => (a === 1 && b === 1 ? 0 : 1),
  },
  {
    name: "NOR",
    inputs: 2,
    plain: "OR, then flipped: on only when both are off.",
    run: (a, b) => (a === 0 && b === 0 ? 1 : 0),
  },
  {
    name: "XNOR",
    inputs: 2,
    plain: "XOR, then flipped: on when the inputs are the SAME.",
    run: (a, b) => (a === b ? 1 : 0),
  },
];

/* ── Module 10: bitwise work ─────────────────────────────────── */

export function bitwise(aBits: string, bBits: string, op: "AND" | "OR" | "XOR"): string | null {
  if (!isByteString(aBits) || !isByteString(bBits)) return null;
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    const a = aBits[i] === "1";
    const b = bBits[i] === "1";
    const on = op === "AND" ? a && b : op === "OR" ? a || b : a !== b;
    out += on ? "1" : "0";
  }
  return out;
}

/** Shift left: every bit moves one place up — the number doubles. */
export function shiftLeft(bits: string): string | null {
  if (!isByteString(bits)) return null;
  return bits.slice(1) + "0";
}

/** Shift right: every bit moves one place down — the number halves (rounded down). */
export function shiftRight(bits: string): string | null {
  if (!isByteString(bits)) return null;
  return "0" + bits.slice(0, 7);
}

/** Turn one bit ON with a mask (OR). Position counts from the right, 0–7. */
export function setBit(bits: string, position: number): string | null {
  if (!isByteString(bits) || position < 0 || position > 7) return null;
  const chars = bits.split("");
  chars[7 - position] = "1";
  return chars.join("");
}

/** Turn one bit OFF with a mask (AND with the flipped mask). */
export function clearBit(bits: string, position: number): string | null {
  if (!isByteString(bits) || position < 0 || position > 7) return null;
  const chars = bits.split("");
  chars[7 - position] = "0";
  return chars.join("");
}

/** Flip one bit with a mask (XOR). */
export function toggleBit(bits: string, position: number): string | null {
  if (!isByteString(bits) || position < 0 || position > 7) return null;
  const chars = bits.split("");
  chars[7 - position] = chars[7 - position] === "1" ? "0" : "1";
  return chars.join("");
}

/* ── Module 11: hexadecimal & octal ──────────────────────────── */

export const HEX_DIGITS = "0123456789ABCDEF";

export interface BaseRow {
  value: number;
  binary: string;
  hex: string;
  octal: string;
}

/** The full shorthand chart: 0–15 in decimal, binary, hex, octal. */
export const BASE_CHART: BaseRow[] = Array.from({ length: 16 }, (_, value) => ({
  value,
  binary: toBits(value, 4),
  hex: HEX_DIGITS[value] ?? "",
  octal: value.toString(8),
}));

/** A byte as two hex digits: group the bits in fours. */
export function byteToHex(bits: string): string | null {
  if (!isByteString(bits)) return null;
  const high = parseInt(bits.slice(0, 4), 2);
  const low = parseInt(bits.slice(4), 2);
  return `${HEX_DIGITS[high]}${HEX_DIGITS[low]}`;
}

/** Two hex digits back to the byte they stand for. */
export function hexToByte(hex: string): string | null {
  const clean = hex.trim().toUpperCase();
  if (!/^[0-9A-F]{2}$/.test(clean)) return null;
  return toByte(parseInt(clean, 16));
}

/** A byte in octal: group the bits in threes (2 + 3 + 3). */
export function byteToOctal(bits: string): string | null {
  const value = byteValue(bits);
  if (value === null) return null;
  return value.toString(8);
}

/* ── Module 14: error detection ──────────────────────────────── */

/**
 * Even parity: one extra bit chosen so the total count of 1s
 * (byte + parity bit) comes out even. Returns the parity bit.
 */
export function parityBit(bits: string): "0" | "1" | null {
  if (!isByteString(bits)) return null;
  const ones = bits.split("").filter((b) => b === "1").length;
  return ones % 2 === 0 ? "0" : "1";
}

/** Did this byte + parity bit survive the trip? (Even parity.) */
export function parityHolds(bits: string, parity: "0" | "1"): boolean {
  return parityBit(bits) === parity;
}

/** A simple checksum: add the bytes, keep only the lowest byte. */
export function checksum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0) % 256;
}

/* ── Module 15: drills, quizzes, progress ────────────────────── */

/** Small deterministic random source so drills are testable. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

export interface Drill {
  moduleId: string;
  prompt: string;
  /** The accepted answer, normalized (no spaces, uppercase). */
  answer: string;
  /** The full working, shown when the answer is wrong — and after. */
  working: string;
  /** Multiple-choice options, when the drill is a choice. */
  choices?: string[];
}

function pick(rng: () => number, values: number[]): number {
  return values[Math.floor(rng() * values.length)] ?? values[0] ?? 0;
}

function randomByte(rng: () => number): string {
  return toByte(Math.floor(rng() * 256));
}

function printableByte(rng: () => number): string {
  const ranges: [number, number][] = [
    [48, 57],
    [65, 90],
    [97, 122],
  ];
  const range = ranges[Math.floor(rng() * ranges.length)] ?? [65, 90];
  return toByte(range[0] + Math.floor(rng() * (range[1] - range[0] + 1)));
}

/** Generate one drill for a module. Module 15 mixes all the rest. */
export function makeDrill(moduleId: string, rng: () => number): Drill {
  if (moduleId === "mastery") {
    const pool = [
      "foundations",
      "places",
      "converting",
      "sizes",
      "characters",
      "arithmetic",
      "negatives",
      "gates",
      "bitwise",
      "bases",
      "realworld",
      "errors",
    ];
    return makeDrill(pool[Math.floor(rng() * pool.length)] ?? "places", rng);
  }
  switch (moduleId) {
    case "foundations": {
      const bits = pick(rng, [1, 2, 3, 4, 5, 6, 7, 8]);
      return {
        moduleId,
        prompt: `How many different values can ${bits} bits make?`,
        answer: String(2 ** bits),
        working: `Each bit doubles the count: 2 × 2 … ${bits} times = 2^${bits} = ${2 ** bits}.`,
      };
    }
    case "places": {
      const bits = randomByte(rng);
      const value = byteValue(bits) ?? 0;
      const counted = BIT_PLACES.filter((_, i) => bits[i] === "1");
      return {
        moduleId,
        prompt: `Read this byte: ${bits}. What number is it?`,
        answer: String(value),
        working: `Add the places where a 1 sits: ${counted.length ? counted.join(" + ") : "none on"} = ${value}.`,
      };
    }
    case "converting": {
      const value = pick(rng, [5, 9, 17, 26, 43, 58, 97, 130, 200, 255]);
      return {
        moduleId,
        prompt: `Write the number ${value} in binary.`,
        answer: value.toString(2),
        working: `Biggest place that fits, subtract, keep going: ${countingWordsFor(value)} — so ${value} = ${value.toString(2)}.`,
      };
    }
    case "sizes": {
      const which = rng() < 0.5;
      if (which) {
        return {
          moduleId,
          prompt: "How many different values can one byte hold?",
          answer: "256",
          working: "8 bits, each doubling: 2^8 = 256 values — the numbers 0 through 255.",
        };
      }
      const kb = pick(rng, [2, 3, 5, 10]);
      return {
        moduleId,
        prompt: `How many bytes are in ${kb} KB, counting the binary way (1 KB = 1024 bytes)?`,
        answer: String(kb * 1024),
        working: `${kb} × 1024 = ${kb * 1024} bytes.`,
      };
    }
    case "characters": {
      const bits = printableByte(rng);
      const char = byteToChar(bits) ?? "?";
      if (rng() < 0.5) {
        return {
          moduleId,
          prompt: `Which character is the byte ${bits}?`,
          answer: char.toUpperCase(),
          working: `${bits} = ${byteValue(bits)} — and ${byteValue(bits)} on the ASCII chart is '${char}'.`,
        };
      }
      return {
        moduleId,
        prompt: `What is the byte for the character '${char}'?`,
        answer: bits,
        working: `'${char}' is number ${byteValue(bits)} on the chart, and ${byteValue(bits)} in binary is ${bits}.`,
      };
    }
    case "arithmetic": {
      const kind = pick(rng, [0, 1, 2, 3]);
      const a = Math.floor(rng() * 100) + 1;
      const b = Math.floor(rng() * 60) + 1;
      if (kind === 0) {
        return {
          moduleId,
          prompt: `Add: ${toByte(a)} + ${toByte(b)} (give the 8-bit answer)`,
          answer: toByte(a + b),
          working: `${a} + ${b} = ${a + b}, and ${a + b} in binary is ${toByte(a + b)} (the byte keeps the lowest eight bits).`,
        };
      }
      if (kind === 1) {
        const big = Math.max(a, b);
        const small = Math.min(a, b);
        return {
          moduleId,
          prompt: `Subtract: ${toByte(big)} − ${toByte(small)} (give the 8-bit answer)`,
          answer: toByte(big - small),
          working: `${big} − ${small} = ${big - small}, and ${big - small} in binary is ${toByte(big - small)}.`,
        };
      }
      if (kind === 2) {
        const x = Math.floor(rng() * 12) + 2;
        const y = Math.floor(rng() * 12) + 2;
        return {
          moduleId,
          prompt: `Multiply: ${x} × ${y} — give the answer in binary.`,
          answer: (x * y).toString(2),
          working: `Shift-and-add: ${x} × ${y} = ${x * y}, and ${x * y} in binary is ${(x * y).toString(2)}.`,
        };
      }
      const divisor = Math.floor(rng() * 9) + 2;
      const quotient = Math.floor(rng() * 15) + 1;
      const remainder = Math.floor(rng() * divisor);
      const dividend = quotient * divisor + remainder;
      return {
        moduleId,
        prompt: `Divide: ${dividend} ÷ ${divisor}. Give the quotient in binary.`,
        answer: quotient.toString(2),
        working: `${divisor} goes into ${dividend} exactly ${quotient} times with ${remainder} left over. ${quotient} in binary is ${quotient.toString(2)}.`,
      };
    }
    case "negatives": {
      const value = -(Math.floor(rng() * 60) + 1);
      if (rng() < 0.5) {
        return {
          moduleId,
          prompt: `Write ${value} as an 8-bit two's complement byte.`,
          answer: toTwosComplement(value) ?? "",
          working: `Write ${-value} (${toByte(-value)}), flip every bit (${flipBits(toByte(-value))}), add 1 → ${toTwosComplement(value)}.`,
        };
      }
      const bits = toTwosComplement(value) ?? "11111111";
      return {
        moduleId,
        prompt: `Read this two's complement byte: ${bits}. What signed number is it?`,
        answer: String(value),
        working: `The top bit is on, so it is negative. Flip (${flipBits(bits)}), add 1 (${toByte(-value)} = ${-value}) — the byte means ${value}.`,
      };
    }
    case "gates": {
      const gate = GATES[Math.floor(rng() * GATES.length)] ?? GATES[0]!;
      const a = (rng() < 0.5 ? 0 : 1) as 0 | 1;
      const b = (rng() < 0.5 ? 0 : 1) as 0 | 1;
      const out = gate.run(a, b);
      return {
        moduleId,
        prompt:
          gate.inputs === 1
            ? `A ${gate.name} gate gets the input ${a}. What comes out?`
            : `A ${gate.name} gate gets the inputs ${a} and ${b}. What comes out?`,
        answer: String(out),
        working: `${gate.plain} So the output is ${out}.`,
      };
    }
    case "bitwise": {
      const a = randomByte(rng);
      const b = randomByte(rng);
      const op = (["AND", "OR", "XOR"] as const)[Math.floor(rng() * 3)] ?? "AND";
      const out = bitwise(a, b, op) ?? "";
      return {
        moduleId,
        prompt: `Bitwise ${op}: ${a} ${op} ${b} = ?`,
        answer: out,
        working: `Line the bytes up and run ${op} down each column: ${a} ${op} ${b} = ${out}.`,
      };
    }
    case "bases": {
      const bits = randomByte(rng);
      if (rng() < 0.5) {
        return {
          moduleId,
          prompt: `Write the byte ${bits} in hexadecimal.`,
          answer: byteToHex(bits) ?? "",
          working: `Group in fours: ${bits.slice(0, 4)} = ${parseInt(bits.slice(0, 4), 2)} = ${HEX_DIGITS[parseInt(bits.slice(0, 4), 2)]}, ${bits.slice(4)} = ${parseInt(bits.slice(4), 2)} = ${HEX_DIGITS[parseInt(bits.slice(4), 2)]} — so ${byteToHex(bits)}.`,
        };
      }
      const hex = byteToHex(bits) ?? "00";
      return {
        moduleId,
        prompt: `What byte does the hex number ${hex} stand for?`,
        answer: bits,
        working: `Each hex digit is four bits: ${hex[0]} = ${toBits(parseInt(hex[0]!, 16), 4)}, ${hex[1]} = ${toBits(parseInt(hex[1]!, 16), 4)} — together ${bits}.`,
      };
    }
    case "realworld": {
      const side = pick(rng, [100, 500, 1000, 1920]);
      const rows = pick(rng, [100, 500, 1000, 1080]);
      const bytes = side * rows * 3;
      return {
        moduleId,
        prompt: `A picture is ${side} × ${rows} pixels, 3 bytes per pixel (one each for red, green, blue). How many bytes is the picture, before any shrinking?`,
        answer: String(bytes),
        working: `${side} × ${rows} = ${side * rows} pixels, × 3 bytes = ${bytes} bytes.`,
      };
    }
    case "floating": {
      return {
        moduleId,
        prompt: "Why can't a computer store the number 0.1 exactly in binary?",
        answer: "B",
        choices: [
          "A — 0.1 is too small for a computer",
          "B — In binary, 0.1 is a fraction that repeats forever, so the computer must round it",
          "C — Computers only store whole numbers",
        ],
        working:
          "Just as 1/3 repeats forever in decimal (0.333…), 0.1 repeats forever in binary. The computer keeps as many bits as it has and rounds the rest — close enough to work with, never exact.",
      };
    }
    case "errors": {
      const bits = randomByte(rng);
      return {
        moduleId,
        prompt: `Even parity: what parity bit goes with the byte ${bits}?`,
        answer: parityBit(bits) ?? "0",
        working: `Count the 1s in ${bits}: there are ${bits.split("").filter((c) => c === "1").length}. Even parity makes the total count even, so the parity bit is ${parityBit(bits)}.`,
      };
    }
    default: {
      const bits = randomByte(rng);
      return {
        moduleId: "places",
        prompt: `Read this byte: ${bits}. What number is it?`,
        answer: String(byteValue(bits) ?? 0),
        working: `Add the places where a 1 sits — the answer is ${byteValue(bits) ?? 0}.`,
      };
    }
  }
}

/** The counting sum words for a value (shared with the drills). */
function countingWordsFor(value: number): string {
  const steps: number[] = [];
  let remaining = value;
  let place = 1;
  while (place * 2 <= value) place *= 2;
  while (remaining > 0) {
    if (place <= remaining) {
      steps.push(place);
      remaining -= place;
    }
    place /= 2;
  }
  return steps.length ? steps.join(" + ") : "nothing on";
}

/** Normalize a typed answer the way drills expect: no spaces, uppercase. */
export function normalizeAnswer(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/* Progress — saved in his area (localStorage), so it is there
   every time he logs in, on the copy he is using. */

export interface BinaryProgress {
  /** Module ids he has completed (drill passed or marked learned). */
  done: string[];
  attempts: number;
  correct: number;
  /** Best score on the final mastery pass (out of 10). */
  masteryBest: number;
}

export const BINARY_PROGRESS_KEY = "augi.binary.progress.v1";

const EMPTY_PROGRESS: BinaryProgress = { done: [], attempts: 0, correct: 0, masteryBest: 0 };

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadBinaryProgress(storage: StorageLike | null = defaultStorage()): BinaryProgress {
  if (!storage) return { ...EMPTY_PROGRESS };
  try {
    const raw = storage.getItem(BINARY_PROGRESS_KEY);
    if (!raw) return { ...EMPTY_PROGRESS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { ...EMPTY_PROGRESS };
    const p = parsed as Partial<BinaryProgress>;
    return {
      done: Array.isArray(p.done) ? p.done.filter((d): d is string => typeof d === "string") : [],
      attempts: typeof p.attempts === "number" ? p.attempts : 0,
      correct: typeof p.correct === "number" ? p.correct : 0,
      masteryBest: typeof p.masteryBest === "number" ? p.masteryBest : 0,
    };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

export function saveBinaryProgress(
  progress: BinaryProgress,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(BINARY_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // A full or blocked store never breaks the lesson.
  }
}
