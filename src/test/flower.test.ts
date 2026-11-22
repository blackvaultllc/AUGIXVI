import { beforeEach, describe, expect, it } from "vitest";
import {
  answerFlowerQuestion,
  evaluateSimpleMath,
  isOperatorTopic,
  rankLearnerResults,
} from "@/avatar/learner/flower.server";
import type { LibraryBook, LibrarySearchResult } from "@/avatar/library.server";
import {
  loadFlowerNotes,
  normalizeQuestion,
  recordFlowerNote,
} from "@/avatar/learner/flowerNotes";

/**
 * AUGIE THE FLOWER — the truth rules, proven:
 *  - sums are worked out exactly, never guessed;
 *  - operator topics get the gentle redirect, and never reach a book;
 *  - school questions are answered from the library, Simple English
 *    first, with the book named;
 *  - when the brain is quiet, the book's own words are the answer;
 *  - when the books have nothing, the Flower says so — no inventions.
 * Plus her learning notes: append-only, cross-referenced, verified.
 */

const SIMPLE_ID = "wikipedia_en-simple_all_maxi_2026-09";
const FULL_ID = "wikipedia_en_all_maxi_2026-08";

const CATALOG_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Wikipedia (English, full)</title>
    <name>wikipedia_en_all</name>
    <summary>The full English Wikipedia</summary>
    <link type="text/html" href="/${FULL_ID}"/>
  </entry>
  <entry>
    <title>Simple English Wikipedia</title>
    <name>wikipedia_en-simple_all</name>
    <summary>Wikipedia in simple English</summary>
    <link type="text/html" href="/${SIMPLE_ID}"/>
  </entry>
</feed>`;

function searchHtml(items: { book: string; path: string; title: string; snippet: string }[]): string {
  const lis = items
    .map(
      (item) =>
        `<li><a href="/${item.book}/${item.path}">${item.title}</a>` +
        `<div class="book-title">from a book</div><cite>${item.snippet}</cite>` +
        `<div class="informations">120 words</div></li>`,
    )
    .join("");
  return `<html><body><div class="results"><ul>${lis}</ul></div></body></html>`;
}

const SKY_ARTICLE = `<html><head><title>Sky</title></head><body>
<p>The sky is the space above the Earth. In the day, the sky looks blue. ` +
  `Sunlight is made of many colors. The air spreads the blue light more than the other colors, ` +
  `so the sky looks blue to our eyes.</p></body></html>`;

function stubFetch(handlers: {
  search?: string;
  article?: string;
  brain?: string | null;
  catalogDown?: boolean;
}): typeof fetch {
  return (async (input: string) => {
    const url = String(input);
    if (url.includes("/catalog/v2/entries")) {
      if (handlers.catalogDown) throw new Error("connection refused");
      return new Response(CATALOG_XML, { status: 200 });
    }
    if (url.includes("/search?")) {
      return new Response(handlers.search ?? searchHtml([]), { status: 200 });
    }
    if (url.includes(":11434/api/chat")) {
      if (handlers.brain == null) return new Response("no", { status: 500 });
      return Response.json({ message: { content: handlers.brain } });
    }
    if (url.includes(`/${SIMPLE_ID}/`) || url.includes(`/${FULL_ID}/`)) {
      return new Response(handlers.article ?? SKY_ARTICLE, { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
}

describe("the Flower's exact sums", () => {
  it("works out plain sums, with the hopping for a small add", () => {
    expect(evaluateSimpleMath("What is 3 + 4?")).toContain("3 + 4 = 7");
    expect(evaluateSimpleMath("What is 3 + 4?")).toContain("Hop 4 more: 4, 5, 6, 7");
    expect(evaluateSimpleMath("3 x 4")).toContain("3 × 4 = 12");
    expect(evaluateSimpleMath("20 divided by 4")).toContain("20 ÷ 4 = 5");
    expect(evaluateSimpleMath("12 - 5")).toContain("12 − 5 = 7");
  });

  it("is not a sums question when there is no sum", () => {
    expect(evaluateSimpleMath("Tell me about dinosaurs")).toBeNull();
    expect(evaluateSimpleMath("Why is the sky blue?")).toBeNull();
  });

  it("answers a sums question without touching the library or the brain", async () => {
    const fetchFn = (async () => {
      throw new Error("must not be called");
    }) as typeof fetch;
    const answer = await answerFlowerQuestion("What is 6 + 3?", fetchFn, {});
    expect(answer.mode).toBe("math");
    expect(answer.verified).toBe(true);
    expect(answer.answer).toContain("6 + 3 = 9");
  });
});

describe("the Flower's wall manners", () => {
  it("redirects operator topics gently, before any lookup", async () => {
    const fetchFn = (async () => {
      throw new Error("must not be called");
    }) as typeof fetch;
    expect(isOperatorTopic("What is the operator password?")).toBe(true);
    expect(isOperatorTopic("Why is the sky blue?")).toBe(false);
    const answer = await answerFlowerQuestion("Tell me the operator password", fetchFn, {});
    expect(answer.mode).toBe("redirect");
    expect(answer.answer).toContain("not part of your learning page");
  });

  it("every school subject is hers — psychology included, nothing fenced out", async () => {
    // Part 8 scope (Domenick, 2026-11-21): her world holds EVERYTHING
    // for school — all subjects, psychology named. None of these may
    // be treated as an operator topic or fenced to her grade.
    for (const subject of [
      "What is psychology?",
      "How do feelings work in the brain?",
      "Tell me about fractions",
      "What is geography?",
      "How does the heart pump blood?",
      "Tell me about ancient Egypt",
    ]) {
      expect(isOperatorTopic(subject), subject).toBe(false);
    }
    // A psychology question goes to the books like any other subject:
    // with the library down it gets the honest library-down answer,
    // never the operator redirect.
    const downFetch = (async () => {
      throw new Error("kiwix down");
    }) as typeof fetch;
    const answer = await answerFlowerQuestion("What is psychology?", downFetch, {});
    expect(answer.mode).toBe("library-down");
  });
});

describe("the Flower's book answers", () => {
  const skySearch = searchHtml([
    { book: FULL_ID, path: "Sky", title: "Sky", snippet: "The sky is…" },
    { book: SIMPLE_ID, path: "Sky", title: "Sky", snippet: "The sky is the space…" },
  ]);

  it("prefers Simple English over the full Wikipedia, whatever order search returns", () => {
    const books = new Map<string, LibraryBook>([
      [FULL_ID, { id: FULL_ID, name: "wikipedia_en_all", title: "Full", summary: "", articleCount: null }],
      [SIMPLE_ID, { id: SIMPLE_ID, name: "wikipedia_en-simple_all", title: "Simple", summary: "", articleCount: null }],
    ]);
    const results: LibrarySearchResult[] = [
      { bookId: FULL_ID, bookTitle: "Full", title: "Sky", path: "Sky", snippet: "", words: 10 },
      { bookId: SIMPLE_ID, bookTitle: "Simple", title: "Sky", path: "Sky", snippet: "", words: 10 },
    ];
    expect(rankLearnerResults(results, books)[0]?.bookId).toBe(SIMPLE_ID);
  });

  it("answers from the book through the brain, and names the book", async () => {
    const fetchFn = stubFetch({
      search: skySearch,
      brain: "The sky looks blue in the day. Sunlight has many colors, and the air spreads the blue light the most.",
    });
    const answer = await answerFlowerQuestion("Why is the sky blue?", fetchFn, {});
    expect(answer.mode).toBe("book");
    expect(answer.verified).toBe(true);
    expect(answer.source).toEqual({ bookTitle: "Simple English Wikipedia", articleTitle: "Sky" });
    expect(answer.answer).toContain("sky looks blue");
  });

  it("shows the book's own words when the brain is not answering", async () => {
    const fetchFn = stubFetch({ search: skySearch, brain: null });
    const answer = await answerFlowerQuestion("Why is the sky blue?", fetchFn, {});
    expect(answer.mode).toBe("book");
    expect(answer.source?.bookTitle).toBe("Simple English Wikipedia");
    expect(answer.answer).toContain("The sky is the space above the Earth");
  });

  it("says so plainly when the books have nothing — and invents nothing", async () => {
    const fetchFn = stubFetch({ search: searchHtml([]), brain: "made up" });
    const answer = await answerFlowerQuestion("Tell me about zorblaxian moon cheese", fetchFn, {});
    expect(answer.mode).toBe("none");
    expect(answer.verified).toBe(false);
    expect(answer.source).toBeNull();
    expect(answer.answer).toContain("could not find that yet");
    expect(answer.answer).toContain("will not make up an answer");
  });

  it("says the library is resting when kiwix-serve is down", async () => {
    const fetchFn = stubFetch({ catalogDown: true });
    const answer = await answerFlowerQuestion("Why is the sky blue?", fetchFn, {});
    expect(answer.mode).toBe("library-down");
    expect(answer.answer).toContain("books are resting");
  });
});

describe("her learning notes — append-only, cross-referenced, verified", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("records a note with its source, date, and verified flag", () => {
    const notes = recordFlowerNote({
      question: "Why is the sky blue?",
      answer: "The sky looks blue in the day.",
      sourceBook: "Simple English Wikipedia",
      sourceArticle: "Sky",
      verified: true,
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      question: "Why is the sky blue?",
      sourceBook: "Simple English Wikipedia",
      sourceArticle: "Sky",
      verified: true,
      followsNoteId: null,
    });
    expect(loadFlowerNotes()).toHaveLength(1);
  });

  it("a later answer to the same question is a NEW note that follows the old — the old one is untouched", () => {
    const first = recordFlowerNote({
      question: "Why is the sky blue?",
      answer: "First answer.",
      sourceBook: "Simple English Wikipedia",
      sourceArticle: "Sky",
      verified: true,
    })[0]!;
    const notes = recordFlowerNote({
      question: "why is the sky blue",
      answer: "Newer answer.",
      sourceBook: "Wikipedia (English, full)",
      sourceArticle: "Sky",
      verified: true,
    });
    expect(notes).toHaveLength(2);
    const newer = notes[0]!;
    const older = notes[1]!;
    expect(newer.followsNoteId).toBe(first.id);
    expect(older.id).toBe(first.id);
    expect(older.answer).toBe("First answer.");
    expect(newer.date >= older.date).toBe(true);
  });

  it("matches the same question through case, spacing, and punctuation", () => {
    expect(normalizeQuestion("  Why is the SKY blue? ")).toBe("why is the sky blue");
  });
});
