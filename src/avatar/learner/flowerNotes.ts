/**
 * HER LEARNING NOTES — the Flower's memory of what it taught her,
 * kept the way her dad ordered (2026-11-21): information is not
 * changed or updated unless it is verified first; where an older
 * note and a newer note both exist, they are cross-referenced —
 * both are kept, the newer one points back at the older one, and
 * nothing is ever silently overwritten.
 *
 * The shape is deliberately simple, organized around the question:
 * one note per answered question, carrying the question, the answer
 * she was given, where it came from (source book + article, or
 * "worked out by counting" for sums), the date, and a verified flag
 * that is true only when the answer is grounded — a named book from
 * the library, or exact arithmetic. When she asks the same question
 * again and gets an answer again, that is a NEW note whose
 * `followsNoteId` points at the earlier note for the same question;
 * the earlier note stays exactly as it was. "Newer" is the later
 * date plus that link — anyone reading the list can walk the chain.
 *
 * Stored on her device under a learner-only key, in the same
 * local-first style as her squishy gallery and homework store.
 * Unverified outcomes (the books had nothing, a redirect) are never
 * saved as notes: a note is a fact she was taught, and facts here
 * carry their proof or they do not get written down.
 */

export const FLOWER_NOTES_STORAGE_KEY = "augi.learner.flower-notes.v1";
export const FLOWER_NOTES_LIMIT = 60;

export type FlowerNote = {
  id: string;
  /** The question she asked, as she asked it. */
  question: string;
  /** The answer she was given. */
  answer: string;
  /** Where the answer came from: a book title, or "Counting" for sums. */
  sourceBook: string;
  /** The article inside the book, when the answer came from one. */
  sourceArticle: string | null;
  /** ISO date the note was written. */
  date: string;
  /** True only for grounded answers (named book, or exact arithmetic). */
  verified: boolean;
  /** The earlier note for the same question, when this note follows one. */
  followsNoteId: string | null;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function store(override?: StorageLike): StorageLike {
  return override ?? globalThis.localStorage;
}

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `flower-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function normalizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ").toLocaleLowerCase().replace(/[?.!]+$/, "");
}

export function loadFlowerNotes(storageOverride?: StorageLike): FlowerNote[] {
  try {
    const raw = store(storageOverride).getItem(FLOWER_NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as FlowerNote[]).filter(
      (note) =>
        note &&
        typeof note.id === "string" &&
        typeof note.question === "string" &&
        typeof note.answer === "string" &&
        typeof note.sourceBook === "string" &&
        typeof note.date === "string" &&
        typeof note.verified === "boolean",
    );
  } catch {
    return [];
  }
}

/**
 * Record one grounded answer as a note. Append-only: if an earlier
 * note exists for the same question, the new note cross-references
 * it through followsNoteId and the old note is left untouched.
 * Returns the full list, newest first.
 */
export function recordFlowerNote(
  input: {
    question: string;
    answer: string;
    sourceBook: string;
    sourceArticle?: string | null;
    verified: boolean;
  },
  storageOverride?: StorageLike,
  now: Date = new Date(),
): FlowerNote[] {
  const notes = loadFlowerNotes(storageOverride);
  const key = normalizeQuestion(input.question);
  const earlier = notes.find((note) => normalizeQuestion(note.question) === key);
  const note: FlowerNote = {
    id: createId(),
    question: input.question.trim(),
    answer: input.answer,
    sourceBook: input.sourceBook,
    sourceArticle: input.sourceArticle ?? null,
    date: now.toISOString(),
    verified: input.verified,
    followsNoteId: earlier?.id ?? null,
  };
  const next = [note, ...notes].slice(0, FLOWER_NOTES_LIMIT);
  store(storageOverride).setItem(FLOWER_NOTES_STORAGE_KEY, JSON.stringify(next));
  return next;
}
