/**
 * THE SHELVES — Domenick's organization of his offline library
 * (order 2026-11-21). The library opens on these shelves, not on a
 * raw book list. The first six are anchored on his verified DNA
 * results, in his order and with his percentages; the rest are his
 * standing knowledge rounds: law, medicine and the quest of curing
 * a body, survival and repair, every category of science,
 * metaphysics/time/alchemy and the quest of immortality,
 * archaeology, and the Academy shelf for education.
 *
 * A shelf names the books that carry it (by their stable OPDS
 * <name>) and a handful of starter questions. Whether a book is
 * actually on the shelf is NEVER hard-coded here — it is derived
 * from the live Kiwix catalog at runtime, so a book still
 * downloading says so honestly and joins its shelves the moment it
 * lands. Pure data + one pure derivation — unit-testable, no DOM.
 */

export type ShelfBookRef = {
  /** Stable OPDS <name> of the book, the same across editions. */
  name: string;
  /** The name Domenick sees for the book. */
  label: string;
};

export type LibraryShelf = {
  id: string;
  title: string;
  note: string;
  books: readonly ShelfBookRef[];
  queries: readonly string[];
};

export const BOOK_FULL: ShelfBookRef = { name: "wikipedia_en_all", label: "Wikipedia (full)" };
export const BOOK_SIMPLE: ShelfBookRef = {
  name: "wikipedia_en-simple_all",
  label: "Simple English Wikipedia",
};
export const BOOK_MEDICINE: ShelfBookRef = { name: "wikipedia_en_medicine", label: "WikiMed" };
export const BOOK_WIKIBOOKS: ShelfBookRef = { name: "wikibooks_en_all", label: "Wikibooks" };
export const BOOK_APPROPEDIA: ShelfBookRef = { name: "appropedia_en_all", label: "Appropedia" };
export const BOOK_ALPINE: ShelfBookRef = {
  name: "alpinelinux_en_all",
  label: "Alpine Linux Wiki",
};

export const LIBRARY_SHELVES: readonly LibraryShelf[] = [
  {
    id: "nigeria",
    title: "Nigeria — 81.5%",
    note: "The largest root. The peoples, kingdoms, food, faith and healing of Nigeria — and the Louisiana and southeastern Texas lines that carried it here.",
    books: [BOOK_FULL, BOOK_SIMPLE],
    queries: ["Nigeria", "Yoruba people", "Igbo people", "Benin Kingdom", "Hausa people"],
  },
  {
    id: "west-africa",
    title: "West Africa — 6.5%",
    note: "Ghana, Mali, Senegal and the empires of the western Sudan — gold, scholarship and the Akan world.",
    books: [BOOK_FULL, BOOK_SIMPLE],
    queries: ["Ghana", "Akan people", "Mali Empire", "Ashanti Empire", "Senegal"],
  },
  {
    id: "central-africa",
    title: "Central Africa — 5.8%",
    note: "The Congo basin and the Bantu world — the Kongo kingdom, the river, and the languages that crossed with it.",
    books: [BOOK_FULL, BOOK_SIMPLE],
    queries: ["Kingdom of Kongo", "Congo River", "Lingala", "Bantu peoples", "Central Africa"],
  },
  {
    id: "egypt",
    title: "Egypt — 1.4%",
    note: "The thread he believed in before the DNA ever said it: pharaohs, hieroglyphs, the Nile, and the oldest medicine on record.",
    books: [BOOK_FULL, BOOK_SIMPLE, BOOK_MEDICINE],
    queries: [
      "Ancient Egypt",
      "Pharaoh",
      "Egyptian hieroglyphs",
      "Nile",
      "Ancient Egyptian medicine",
    ],
  },
  {
    id: "portugal",
    title: "Portugal — 3.6%",
    note: "A seafaring thread: the language, the age of discovery, and the ports that touched every coast in this list.",
    books: [BOOK_FULL, BOOK_SIMPLE],
    queries: [
      "Portugal",
      "Portuguese language",
      "Age of Discovery",
      "Lisbon",
      "Portuguese cuisine",
    ],
  },
  {
    id: "iberia",
    title: "Spain · Catalonia · Basque — 1.2%",
    note: "Three peoples in one small share: Castilian Spain, Catalonia, and the Basque country with its ancient language.",
    books: [BOOK_FULL, BOOK_SIMPLE],
    queries: ["Spain", "Catalonia", "Catalan language", "Basque language", "Basque Country"],
  },
  {
    id: "law",
    title: "Law",
    note: "Law and analytical ground: constitutions, contracts, courts and how legal systems are built.",
    books: [BOOK_FULL, BOOK_WIKIBOOKS],
    queries: ["Law", "Constitution", "Contract", "Criminal law", "Court"],
  },
  {
    id: "medicine",
    title: "Medicine & Healing",
    note: "The quest of curing a body, from the first healers to modern surgery — WikiMed is the working shelf, and the ground under the emergency medicine mode.",
    books: [BOOK_MEDICINE, BOOK_FULL],
    queries: ["First aid", "Surgery", "History of medicine", "Wound", "Herbal medicine"],
  },
  {
    id: "survival",
    title: "Survival & Repair",
    note: "How to make, fix and keep things alive with the lights off: solar, water, soil, food, shelter — the 90-day shelf.",
    books: [BOOK_APPROPEDIA, BOOK_WIKIBOOKS],
    queries: [
      "Solar panel",
      "Water purification",
      "Rainwater harvesting",
      "Vegetable gardening",
      "Composting",
    ],
  },
  {
    id: "science",
    title: "Science & Physics",
    note: "Every category of science: physics, the elements (including the hunt for the missing ones), electricity, the sky.",
    books: [BOOK_SIMPLE, BOOK_WIKIBOOKS, BOOK_FULL],
    queries: ["Physics", "Periodic table", "Electricity", "Astronomy", "Atom"],
  },
  {
    id: "metaphysics",
    title: "Metaphysics, Time & Alchemy",
    note: "The deep shelves: alchemy, the elixir traditions, the quest of immortality, time itself, and what lies past the physical.",
    books: [BOOK_FULL, BOOK_WIKIBOOKS],
    queries: ["Alchemy", "Elixir of life", "Philosopher's stone", "Immortality", "Time"],
  },
  {
    id: "archaeology",
    title: "Archaeology",
    note: "The archaeologist's shelf: digs, artifacts, lost cities, and the stones that learned to talk again.",
    books: [BOOK_FULL, BOOK_SIMPLE],
    queries: ["Archaeology", "Rosetta Stone", "Pyramids of Giza", "Excavation", "Artifact"],
  },
  {
    id: "academy",
    title: "The Academy Shelf",
    note: "DIJA'S Academy's own shelf — the schoolbooks: mathematics, the life sciences, chemistry, computing.",
    books: [BOOK_WIKIBOOKS, BOOK_SIMPLE, BOOK_ALPINE],
    queries: ["Algebra", "Biology", "Chemistry", "Computer programming", "Linux"],
  },
] as const;

export type ShelfAvailability = {
  /** Books of this shelf that the live catalog is serving now. */
  available: ShelfBookRef[];
  /** Books of this shelf not in the live catalog yet. */
  pending: ShelfBookRef[];
  /** True when at least one carrying book can be read right now. */
  ready: boolean;
};

/**
 * Derive a shelf's state from the live catalog (books keyed by
 * their OPDS <name>). A book still downloading is pending, never
 * silently dropped and never claimed present.
 */
export function shelfAvailability(
  shelf: LibraryShelf,
  catalogNames: ReadonlySet<string>,
): ShelfAvailability {
  const available = shelf.books.filter((book) => catalogNames.has(book.name));
  const pending = shelf.books.filter((book) => !catalogNames.has(book.name));
  return { available, pending, ready: available.length > 0 };
}
