/**
 * THE WORKING KEYBOARD — ANUBIS TYPING (owner order
 * 2026-11-28 ~07:21 CST, his word "engage" given): he tested
 * the effect in the sandbox — the keyboard rising at the base
 * of the Living Portrait with the binary streaming on top —
 * and approved it in his own words: "that keyboard effect pop
 * up for my Anubis... you can already get the keyboard with
 * the binary showing on top when Anubis is working — go ahead
 * and do that." So while Anubis WORKS (the stage's real
 * working read — the bridge's THINKING state or presenting,
 * the same signal that lights his --acting dress), a keyboard
 * rises at the base of his medallion, its keys light as if
 * struck, and a stream of binary types out above it. When the
 * work ends, the effect settles away.
 *
 * THE PAWS ARE NOT IN (same order): the sandbox version's two
 * little paw figures stay in the sandbox until he perfects
 * them there — "without those two little things until we
 * perfect it." This module and its component render the
 * keyboard and the binary ONLY: no paw, no minion, no figure
 * of any kind, and the tests pin that absence.
 *
 * This module is the plain data and rhythm — the key layout,
 * the stream's growth, the struck key's choice, the cadence —
 * kept free of the DOM so it is unit-testable per the repo's
 * rules (AGENTS.md). The component (WorkingKeyboard.tsx) only
 * renders what this module decides.
 */

/** The keyboard's rows, top to bottom — plain key labels. */
export const WORKING_KEY_ROWS: readonly (readonly string[])[] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

/** Every key on the board, space bar included. */
export const WORKING_KEY_COUNT =
  WORKING_KEY_ROWS.reduce((sum, row) => sum + row.length, 0) + 1;

/** The stream never grows past this — the tail is what reads. */
export const WORKING_STREAM_MAX = 48;

/** How long the keyboard stands while it settles away. */
export const WORKING_KEYBOARD_EXIT_MS = 340;

/** One typed bit: a "0" or a "1" from the given random source. */
export function workingBit(random: () => number): string {
  return random() >= 0.5 ? "1" : "0";
}

/** One byte of the stream — eight bits, the house's own unit. */
export function workingByte(random: () => number): string {
  let byte = "";
  for (let i = 0; i < 8; i += 1) byte += workingBit(random);
  return byte;
}

/** The stream grows by one bit; the oldest fall off the front. */
export function appendWorkingBit(stream: string, random: () => number): string {
  const next = stream + workingBit(random);
  return next.length > WORKING_STREAM_MAX ? next.slice(next.length - WORKING_STREAM_MAX) : next;
}

/**
 * The next key struck: a real key on the board, and never the
 * same key twice in a row — a typing hand moves.
 */
export function nextLitKeyIndex(random: () => number, current: number, count: number): number {
  if (count <= 1) return 0;
  let next = Math.floor(random() * count);
  if (next === current) next = (next + 1) % count;
  return next;
}

/**
 * The typing cadence: a human-ish uneven rhythm, 70–170ms
 * between strikes — never a metronome.
 */
export function workingKeyDelay(random: () => number): number {
  return 70 + Math.floor(random() * 100);
}
