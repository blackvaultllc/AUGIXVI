/**
 * WORLD OF LOGIC — BLOSSOM BELL, the protector's giant turn.
 * Ported from the VoiceWave Command Deck (blackvaultllc/voicewave-
 * command-deck @ 7653d36, src/lib/blossom-bell.ts): the semantics are
 * the deck's — her giant turn is ready on any day it has not yet fired,
 * and firing records the day. Only the giant-day slice of her store
 * crosses over (her asks and zaps belong to the deck's office), under
 * the deck's own key. The deck counts an in-world living day; this
 * room has no living-day sim, so the day is the real calendar day —
 * once per day, the same rule on an honest clock.
 */
export const BLOSSOM_BELL_KEY = "augi.blossom-bell.v1";

export interface BlossomGiantStore {
  giantDay: number | null;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The day number the giant rule counts — one per calendar day. */
export function todayNumber(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 86_400_000);
}

export function loadBlossomGiantStore(
  store: KeyValueStore | null = defaultStore(),
): BlossomGiantStore {
  if (!store) return { giantDay: null };
  try {
    const raw = store.getItem(BLOSSOM_BELL_KEY);
    if (!raw) return { giantDay: null };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return { giantDay: null };
    const v = parsed as Record<string, unknown>;
    return {
      giantDay:
        typeof v["giantDay"] === "number" && Number.isFinite(v["giantDay"])
          ? Math.floor(v["giantDay"] as number)
          : null,
    };
  } catch {
    return { giantDay: null };
  }
}

export function saveBlossomGiantStore(
  data: BlossomGiantStore,
  store: KeyValueStore | null = defaultStore(),
): void {
  if (!store) return;
  try {
    store.setItem(BLOSSOM_BELL_KEY, JSON.stringify({ giantDay: data.giantDay }));
  } catch {
    // A full or blocked store never breaks the world.
  }
}

/** Her giant turn is ready on a day it has not yet fired. */
export function giantReadyForDay(data: BlossomGiantStore, day: number): boolean {
  return data.giantDay !== day;
}

/** Record that she turned giant on this day — spent until tomorrow. */
export function recordGiantTurn(data: BlossomGiantStore, day: number): BlossomGiantStore {
  return { ...data, giantDay: day };
}
