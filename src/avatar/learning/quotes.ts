/**
 * THE QUOTES — a quote of the day and a quote of the night
 * (owner order 2026-11-26): when he logs in, a couple of times
 * a day, the construct reads a quick quote out loud — one for
 * the day, and one for the night before he goes to sleep.
 *
 * TRUTH DISCIPLINE (the standing law): every quote here is a
 * REAL quote, carried with its author and the work it comes
 * from. Nothing invented, nothing attributed on a guess —
 * popular lines whose attribution cannot be stood behind are
 * NOT in this list. The Sun Tzu lines are the exact words of
 * the Giles translation shipped on his Art of War shelf.
 *
 * ROTATION: deterministic by his calendar day (America/
 * Chicago). Each day consumes two consecutive slots on the
 * ring — day first, night second — so the day quote and the
 * night quote always differ, tomorrow's pair differs from
 * today's, and no quote repeats until the whole ring has
 * been walked (30 quotes → a 15-day walk).
 */
import { chicagoDayNumber } from "./time";

export type QuoteSlot = "day" | "night";

export interface Quote {
  text: string;
  author: string;
  /** The work the quote comes from — named, never vague. */
  source: string;
}

/** The night quote's hour: from 19:00 his time, the evening belongs to the night quote. */
export const NIGHT_START_HOUR = 19;

export const QUOTES: readonly Quote[] = [
  {
    text: "All warfare is based on deception.",
    author: "Sun Tzu",
    source: "The Art of War, Chapter I (Giles translation)",
  },
  {
    text: "If you know the enemy and know yourself, you need not fear the result of a hundred battles.",
    author: "Sun Tzu",
    source: "The Art of War, Chapter III (Giles translation)",
  },
  {
    text: "Supreme excellence consists in breaking the enemy's resistance without fighting.",
    author: "Sun Tzu",
    source: "The Art of War, Chapter III (Giles translation)",
  },
  {
    text: "He will win who knows when to fight and when not to fight.",
    author: "Sun Tzu",
    source: "The Art of War, Chapter III (Giles translation)",
  },
  {
    text: "To secure ourselves against defeat lies in our own hands, but the opportunity of defeating the enemy is provided by the enemy himself.",
    author: "Sun Tzu",
    source: "The Art of War, Chapter IV (Giles translation)",
  },
  {
    text: "In war the victorious strategist only seeks battle after the victory has been won, whereas he who is destined to defeat first fights and afterwards looks for victory.",
    author: "Sun Tzu",
    source: "The Art of War, Chapter IV (Giles translation)",
  },
  {
    text: "Let your plans be dark and impenetrable as night, and when you move, fall like a thunderbolt.",
    author: "Sun Tzu",
    source: "The Art of War, Chapter VII (Giles translation)",
  },
  {
    text: "Rapidity is the essence of war: take advantage of the enemy's unreadiness, make your way by unexpected routes, and attack unguarded spots.",
    author: "Sun Tzu",
    source: "The Art of War, Chapter XI (Giles translation)",
  },
  {
    text: "Move not unless you see an advantage; use not your troops unless there is something to be gained; fight not unless the position is critical.",
    author: "Sun Tzu",
    source: "The Art of War, Chapter XII (Giles translation)",
  },
  {
    text: "The skillful leader subdues the enemy's troops without any fighting; he captures their cities without laying siege to them.",
    author: "Sun Tzu",
    source: "The Art of War, Chapter III (Giles translation)",
  },
  {
    text: "You have power over your mind — not outside events. Realize this, and you will find strength.",
    author: "Marcus Aurelius",
    source: "Meditations",
  },
  {
    text: "Waste no more time arguing what a good man should be. Be one.",
    author: "Marcus Aurelius",
    source: "Meditations, Book X",
  },
  {
    text: "The impediment to action advances action. What stands in the way becomes the way.",
    author: "Marcus Aurelius",
    source: "Meditations, Book V",
  },
  {
    text: "If it is not right do not do it; if it is not true do not say it.",
    author: "Marcus Aurelius",
    source: "Meditations, Book XII",
  },
  {
    text: "Dwell on the beauty of life. Watch the stars, and see yourself running with them.",
    author: "Marcus Aurelius",
    source: "Meditations, Book VII (Hays translation)",
  },
  {
    text: "We suffer more often in imagination than in reality.",
    author: "Seneca",
    source: "Letters to Lucilius, Letter 13",
  },
  {
    text: "It is not that we have a short time to live, but that we waste a great deal of it.",
    author: "Seneca",
    source: "On the Shortness of Life",
  },
  {
    text: "Men are disturbed not by things, but by the views which they take of them.",
    author: "Epictetus",
    source: "Enchiridion, 5",
  },
  {
    text: "No man is free who is not master of himself.",
    author: "Epictetus",
    source: "Discourses",
  },
  {
    text: "First say to yourself what you would be; and then do what you have to do.",
    author: "Epictetus",
    source: "Discourses, Book III",
  },
  {
    text: "Everything can be taken from a man but one thing: the last of the human freedoms — to choose one's attitude in any given set of circumstances, to choose one's own way.",
    author: "Viktor E. Frankl",
    source: "Man's Search for Meaning (1946)",
  },
  {
    text: "When we are no longer able to change a situation, we are challenged to change ourselves.",
    author: "Viktor E. Frankl",
    source: "Man's Search for Meaning (1946)",
  },
  {
    text: "Everyone sees what you appear to be; few really know what you are.",
    author: "Niccolò Machiavelli",
    source: "The Prince, Chapter XVIII",
  },
  {
    text: "He who conquers others is strong; he who conquers himself is mighty.",
    author: "Lao Tzu",
    source: "Tao Te Ching, Chapter 33",
  },
  {
    text: "If there is no struggle, there is no progress.",
    author: "Frederick Douglass",
    source: "Speech at Canandaigua, New York (1857)",
  },
  {
    text: "I prayed for freedom for twenty years, but received no answer until I prayed with my legs.",
    author: "Frederick Douglass",
    source: "Attributed to Frederick Douglass",
  },
  {
    text: "Not everything that is faced can be changed, but nothing can be changed until it is faced.",
    author: "James Baldwin",
    source: "“As Much Truth As One Can Bear,” The New York Times (1962)",
  },
  {
    text: "There is no greater agony than bearing an untold story inside you.",
    author: "Maya Angelou",
    source: "I Know Why the Caged Bird Sings (1969)",
  },
  {
    text: "Do nothing that is of no use.",
    author: "Miyamoto Musashi",
    source: "The Book of Five Rings",
  },
  {
    text: "You must understand that there is more than one path to the top of the mountain.",
    author: "Miyamoto Musashi",
    source: "The Book of Five Rings, the Book of Earth",
  },
  {
    text: "The Way of the Samurai is found in death.",
    author: "Yamamoto Tsunetomo",
    source: "Hagakure",
  },
  {
    text: "The unexamined life is not worth living.",
    author: "Socrates",
    source: "Plato, Apology (38a)",
  },
];

/** Which slot of the ring a given day number and slot land on. */
export function quoteIndexFor(dayNumber: number, slot: QuoteSlot, count: number): number {
  if (count <= 0) return 0;
  const step = slot === "night" ? 1 : 0;
  return (((dayNumber * 2 + step) % count) + count) % count;
}

/** The quote for one of his calendar days, by slot. */
export function quoteForDay(dayNumber: number, slot: QuoteSlot): Quote {
  return QUOTES[quoteIndexFor(dayNumber, slot, QUOTES.length)] ?? QUOTES[0]!;
}

/** The quote for an instant, by slot — keyed to HIS calendar day. */
export function quoteForInstant(at: Date | number, slot: QuoteSlot): Quote {
  return quoteForDay(chicagoDayNumber(at), slot);
}

/** Which quote the hour calls for: the day's, or the night's (from 19:00 his time). */
export function quoteSlotForHour(hour: number): QuoteSlot {
  return hour >= NIGHT_START_HOUR ? "night" : "day";
}

/** The spoken form — what the construct actually reads aloud. */
export function spokenQuote(quote: Quote, slot: QuoteSlot): string {
  const lead = slot === "night" ? "Your quote of the night" : "Your quote of the day";
  return `${lead}: “${quote.text}” — ${quote.author}.`;
}

/* ------------------------- shown marks (client) ------------------------- */

const SHOWN_KEY = "augi.learning.quote-shown.v1";

type ShownMap = Record<string, true>;

function loadShown(storage?: Pick<Storage, "getItem">): ShownMap {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(SHOWN_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as ShownMap;
  } catch {
    return {};
  }
}

/** Has this slot's quote already been offered on this one of his days? */
export function quoteShown(dateISO: string, slot: QuoteSlot, storage?: Pick<Storage, "getItem">): boolean {
  return loadShown(storage)[`${dateISO}:${slot}`] === true;
}

export function markQuoteShown(
  dateISO: string,
  slot: QuoteSlot,
  storage?: Pick<Storage, "getItem" | "setItem">,
): void {
  try {
    const map = loadShown(storage);
    map[`${dateISO}:${slot}`] = true;
    // Keep only the newest handful of marks — the map is a
    // courtesy record, not an archive.
    const keys = Object.keys(map).sort();
    for (const key of keys.slice(0, Math.max(0, keys.length - 14))) delete map[key];
    (storage ?? globalThis.localStorage)?.setItem(SHOWN_KEY, JSON.stringify(map));
  } catch {
    /* a mark that cannot save must never break the stage */
  }
}
