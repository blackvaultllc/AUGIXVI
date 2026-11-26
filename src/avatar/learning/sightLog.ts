/**
 * THE SIGHT LOG — owner-only (owner orders 2026-11-26).
 * A plain private record of his impressions: what he saw or
 * picked up, timestamped automatically, in his own words —
 * and later the outcome, marked by him: came to pass / did
 * not / not yet known.
 *
 * The system does NOT analyze, score, or judge any entry.
 * The record is his, so the pattern is there for HIM to see
 * (his fact-and-concurrence doctrine). Nothing here feeds
 * any other system.
 */

export type SightOutcome = "came-to-pass" | "did-not" | "not-yet-known";

export interface SightEntry {
  id: string;
  /** Epoch ms, set automatically when the entry is recorded. */
  at: number;
  /** His words, verbatim. */
  text: string;
  outcome: SightOutcome;
}

export const SIGHT_OUTCOME_LABELS: Record<SightOutcome, string> = {
  "came-to-pass": "Came to pass",
  "did-not": "Did not",
  "not-yet-known": "Not yet known",
};

export function isSightOutcome(value: unknown): value is SightOutcome {
  return value === "came-to-pass" || value === "did-not" || value === "not-yet-known";
}

const MAX_TEXT = 4000;
const MAX_ENTRIES = 5000;

export function sanitizeSightEntry(raw: unknown): SightEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row["id"] === "string" && row["id"].trim() ? row["id"].slice(0, 80) : null;
  const at = typeof row["at"] === "number" && Number.isFinite(row["at"]) && row["at"] > 0 ? row["at"] : null;
  const text = typeof row["text"] === "string" ? row["text"].slice(0, MAX_TEXT) : "";
  if (!id || at === null || !text.trim()) return null;
  return { id, at, text, outcome: isSightOutcome(row["outcome"]) ? row["outcome"] : "not-yet-known" };
}

export function sanitizeSightEntries(raw: unknown): SightEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SightEntry[] = [];
  for (const item of raw) {
    const entry = sanitizeSightEntry(item);
    if (entry) out.push(entry);
  }
  out.sort((a, b) => b.at - a.at);
  return out.slice(0, MAX_ENTRIES);
}
