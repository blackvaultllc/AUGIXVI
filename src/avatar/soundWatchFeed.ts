/**
 * THE SOUND WATCH FEED (cybernetic pass, 2026-11-26) — the shared
 * record of what Sound Watch has classified lately, kept OUTSIDE
 * the Sound Watch window so two other honest readers can use it:
 *
 *   · THE ALERT RING (alertRing.ts) — an alert-flagged sound the
 *     Captain has not acknowledged keeps the ring in ALERT.
 *     Acknowledgment happens HERE, on the record, in the Sound
 *     Watch window's Alerts section — the one owning surface.
 *   · THE IDENTIFIER (IdentifyWindow) — "Heard it" answers from
 *     the last classification on this record, or says plainly
 *     that Sound Watch has classified nothing it can show.
 *
 * The window's own log stays the window's (in-memory, clearable);
 * this feed is the durable tail: the newest classifications,
 * persisted in this browser's storage so an answer survives the
 * window closing. It stores LABELS AND TIMES ONLY — no audio, no
 * fingerprints (the window's rule: fingerprints are numbers, not
 * sound; the feed doesn't need even those).
 *
 * TRUTH LAW: an entry exists here only because Sound Watch
 * actually classified it. Nothing is synthesized; an empty feed
 * reads as "nothing heard", never as "all quiet".
 */
import type { SoundEventEntry, SoundLabelSource } from "./soundWatch";

export const SOUND_FEED_KEY = "augi.soundwatch.feed.v1";
export const SOUND_FEED_MAX = 40;

export interface SoundFeedEntry {
  id: string;
  at: number;
  /** The label Sound Watch settled on; null = UNCLASSIFIED. */
  label: string | null;
  source: SoundLabelSource;
  confidence: number | null;
  /** Sound Watch flagged this one as an alert when it was heard. */
  alert: boolean;
  /** The Captain has seen and acknowledged this alert. */
  acknowledged: boolean;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function sanitizeEntry(v: unknown): SoundFeedEntry | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  if (typeof r["id"] !== "string" || typeof r["at"] !== "number") return null;
  const source =
    r["source"] === "library" || r["source"] === "classifier" || r["source"] === "unclassified"
      ? r["source"]
      : "unclassified";
  return {
    id: r["id"],
    at: r["at"],
    label: typeof r["label"] === "string" && r["label"].trim() ? r["label"] : null,
    source,
    confidence: typeof r["confidence"] === "number" ? r["confidence"] : null,
    alert: r["alert"] === true,
    acknowledged: r["acknowledged"] === true,
  };
}

export function loadSoundFeed(storage: StorageLike | null = defaultStorage()): SoundFeedEntry[] {
  if (!storage) return [...memoryFeed];
  try {
    const raw = storage.getItem(SOUND_FEED_KEY);
    if (!raw) return [...memoryFeed];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...memoryFeed];
    return parsed
      .map(sanitizeEntry)
      .filter((e): e is SoundFeedEntry => e !== null)
      .slice(0, SOUND_FEED_MAX);
  } catch {
    return [...memoryFeed];
  }
}

function saveSoundFeed(
  entries: SoundFeedEntry[],
  storage: StorageLike | null = defaultStorage(),
): void {
  memoryFeed = entries.slice(0, SOUND_FEED_MAX);
  if (storage) {
    try {
      storage.setItem(SOUND_FEED_KEY, JSON.stringify(memoryFeed));
    } catch {
      /* storage full/blocked — the in-memory feed still stands */
    }
  }
  for (const fn of listeners) fn([...memoryFeed]);
}

/* The in-page live copy: components subscribe instead of polling,
 * the same pattern as the presence watch (presence.ts). */
let memoryFeed: SoundFeedEntry[] = [];
let hydrated = false;
const listeners = new Set<(feed: SoundFeedEntry[]) => void>();

export function subscribeSoundFeed(fn: (feed: SoundFeedEntry[]) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The current feed, hydrating from storage on first read. */
export function currentSoundFeed(storage: StorageLike | null = defaultStorage()): SoundFeedEntry[] {
  if (!hydrated) {
    hydrated = true;
    memoryFeed = loadSoundFeed(storage);
  }
  return [...memoryFeed];
}

/**
 * Record one classification Sound Watch just made. A re-publish
 * of the same entry id keeps its acknowledgment — being heard
 * again does not un-see what the Captain already acknowledged
 * for THAT entry; a NEW alert entry starts unacknowledged.
 */
export function publishSoundEntry(
  entry: SoundEventEntry,
  storage: StorageLike | null = defaultStorage(),
): SoundFeedEntry[] {
  const feed = currentSoundFeed(storage);
  const existing = feed.find((e) => e.id === entry.id);
  const record: SoundFeedEntry = {
    id: entry.id,
    at: entry.at,
    label: entry.label,
    source: entry.source,
    confidence: entry.confidence,
    alert: entry.alert,
    acknowledged: existing?.acknowledged ?? false,
  };
  const next = [record, ...feed.filter((e) => e.id !== entry.id)];
  saveSoundFeed(next, storage);
  return [...memoryFeed];
}

/** The Captain acknowledges one alert — the ring's release for it. */
export function acknowledgeSoundAlert(
  id: string,
  storage: StorageLike | null = defaultStorage(),
): SoundFeedEntry[] {
  const feed = currentSoundFeed(storage);
  const next = feed.map((e) => (e.id === id ? { ...e, acknowledged: true } : e));
  saveSoundFeed(next, storage);
  return [...memoryFeed];
}

/** The Captain acknowledges every standing sound alert at once. */
export function acknowledgeAllSoundAlerts(
  storage: StorageLike | null = defaultStorage(),
): SoundFeedEntry[] {
  const feed = currentSoundFeed(storage);
  const next = feed.map((e) => (e.alert && !e.acknowledged ? { ...e, acknowledged: true } : e));
  saveSoundFeed(next, storage);
  return [...memoryFeed];
}

/** The most recent classification on the record, if any. */
export function lastClassifiedSound(feed: SoundFeedEntry[]): SoundFeedEntry | null {
  return feed.length > 0 ? feed[0]! : null;
}

/** Alert-flagged sounds still waiting for the Captain's eyes. */
export function unacknowledgedSoundAlerts(feed: SoundFeedEntry[]): SoundFeedEntry[] {
  return feed.filter((e) => e.alert && !e.acknowledged);
}

/** Test seam: drop the in-memory feed and its hydration. */
export function resetSoundFeedForTest(): void {
  memoryFeed = [];
  hydrated = false;
  listeners.clear();
}
