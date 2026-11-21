import { describe, expect, it } from "vitest";
import {
  BOOK_FULL,
  LIBRARY_SHELVES,
  shelfAvailability,
  type LibraryShelf,
} from "@/avatar/libraryShelves";

/**
 * THE SHELVES (2026-11-21) — Domenick's organization of the
 * offline library. Pinned here: the DNA shelves come first in his
 * order with his percentages; every shelf names at least one
 * carrying book and at least three starter questions; and shelf
 * state is DERIVED from the live catalog — a book still
 * downloading is pending, never claimed present.
 */
describe("the shelves — data integrity", () => {
  it("opens with the six DNA shelves, in his order, with his percentages", () => {
    const firstSix = LIBRARY_SHELVES.slice(0, 6).map((s) => s.title);
    expect(firstSix).toEqual([
      "Nigeria — 81.5%",
      "West Africa — 6.5%",
      "Central Africa — 5.8%",
      "Egypt — 1.4%",
      "Portugal — 3.6%",
      "Spain · Catalonia · Basque — 1.2%",
    ]);
  });

  it("carries his standing knowledge rounds after the DNA shelves", () => {
    const rest = LIBRARY_SHELVES.slice(6).map((s) => s.title);
    expect(rest).toEqual([
      "Law",
      "Medicine & Healing",
      "Survival & Repair",
      "Science & Physics",
      "Metaphysics, Time & Alchemy",
      "Archaeology",
      "The Academy Shelf",
    ]);
  });

  it("every shelf names at least one book and at least three starter questions", () => {
    for (const shelf of LIBRARY_SHELVES) {
      expect(shelf.books.length, shelf.id).toBeGreaterThanOrEqual(1);
      expect(shelf.queries.length, shelf.id).toBeGreaterThanOrEqual(3);
      for (const query of shelf.queries) expect(query.trim().length, shelf.id).toBeGreaterThan(0);
    }
  });

  it("shelf ids are unique", () => {
    const ids = LIBRARY_SHELVES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("medicine rides on WikiMed; survival rides on Appropedia and Wikibooks", () => {
    const medicine = LIBRARY_SHELVES.find((s) => s.id === "medicine")!;
    expect(medicine.books.map((b) => b.name)).toContain("wikipedia_en_medicine");
    const survival = LIBRARY_SHELVES.find((s) => s.id === "survival")!;
    expect(survival.books.map((b) => b.name)).toEqual(
      expect.arrayContaining(["appropedia_en_all", "wikibooks_en_all"]),
    );
  });
});

describe("shelf availability — derived from the live catalog", () => {
  const liveNames = new Set([
    "alpinelinux_en_all",
    "appropedia_en_all",
    "wikipedia_en_medicine",
    "wikipedia_en-simple_all",
    "wikibooks_en_all",
    // wikipedia_en_all (full) is still downloading in this fixture.
  ]);

  it("a shelf with a landed book is ready; the missing book is pending, named", () => {
    const nigeria = LIBRARY_SHELVES.find((s) => s.id === "nigeria")!;
    const state = shelfAvailability(nigeria, liveNames);
    expect(state.ready).toBe(true);
    expect(state.available.map((b) => b.name)).toEqual(["wikipedia_en-simple_all"]);
    expect(state.pending.map((b) => b.name)).toEqual(["wikipedia_en_all"]);
  });

  it("a shelf whose only book is still downloading is not ready", () => {
    const onlyFull: LibraryShelf = {
      id: "test",
      title: "Test",
      note: "",
      books: [BOOK_FULL],
      queries: ["a", "b", "c"],
    };
    const state = shelfAvailability(onlyFull, liveNames);
    expect(state.ready).toBe(false);
    expect(state.available).toEqual([]);
    expect(state.pending.map((b) => b.label)).toEqual(["Wikipedia (full)"]);
  });

  it("an empty catalog leaves every shelf pending — nothing is claimed present", () => {
    for (const shelf of LIBRARY_SHELVES) {
      const state = shelfAvailability(shelf, new Set());
      expect(state.ready, shelf.id).toBe(false);
      expect(state.available, shelf.id).toEqual([]);
    }
  });
});
