/**
 * REPLY HISTORY — every line Augie speaks, kept on this device.
 *
 * The brain's conversation context lives in memory only, and the stage
 * used to show just the single latest reply — so the operator could
 * never scroll back through what Augie said. This module persists each
 * spoken reply (with the question that prompted it, when there was one)
 * to localStorage: newest last, capped, device-local, never sent
 * anywhere. Plain module, unit-testable, per the repo's avatar rules.
 */

export type ReplyHistoryEntry = {
  /** Epoch milliseconds when the reply was spoken. */
  at: number;
  /** The operator's words that prompted the reply ("" for greetings). */
  question: string;
  /** What Augie said. */
  answer: string;
  /**
   * How the operator's words arrived (speaking protocol, owner
   * order 2026-11-22): "typed" — his character, the Black Hatter,
   * is the speaker of record; "voice" — the operator himself, on
   * the mic. Absent on entries kept before the protocol landed.
   */
  source?: "typed" | "voice";
};

const STORAGE_KEY = "augi.reply-history.v1";
const MAX_ENTRIES = 100;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function isEntry(value: unknown): value is ReplyHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<ReplyHistoryEntry>;
  return (
    typeof entry.at === "number" &&
    typeof entry.question === "string" &&
    typeof entry.answer === "string"
  );
}

function persist(entries: ReplyHistoryEntry[], storageOverride?: StorageLike) {
  try {
    (storageOverride ?? globalThis.localStorage)?.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage can be unavailable (private mode); history then lives in
    // component state for the session only.
  }
}

/** All kept replies, oldest first. Never throws. */
export function loadReplyHistory(storageOverride?: StorageLike): ReplyHistoryEntry[] {
  try {
    const raw = (storageOverride ?? globalThis.localStorage)?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}

/** Append one reply, persist, and return the new list (capped at 100). */
export function appendReplyHistory(
  previous: ReplyHistoryEntry[],
  entry: ReplyHistoryEntry,
  storageOverride?: StorageLike,
): ReplyHistoryEntry[] {
  const next = [...previous, entry].slice(-MAX_ENTRIES);
  persist(next, storageOverride);
  return next;
}

/** Forget everything, on disk and in the returned list. */
export function clearReplyHistory(storageOverride?: StorageLike): ReplyHistoryEntry[] {
  persist([], storageOverride);
  return [];
}
