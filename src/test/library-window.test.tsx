import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryWindow } from "@/avatar/LibraryWindow";

/**
 * LIBRARY WINDOW (Knowledge Phase 2, 2026-11-21) — the shelves,
 * the search, and the reader, with the /api/library/* answers
 * faked at the fetch seam. Pinned here: the window opens on
 * Domenick's shelves with honest per-book state (the full
 * Wikipedia is still downloading in this fixture and must SAY
 * so), a search shows results that name their book, and a result
 * opens its article in the reader with a way back. When the
 * library does not answer, the window says so — never a fake
 * shelf.
 */

const CATALOG = {
  books: [
    {
      id: "alpinelinux_en_all_maxi_2026-10",
      name: "alpinelinux_en_all",
      title: "Alpine Linux Wiki",
      summary: "Alpine Linux is a security-oriented, lightweight Linux distribution",
      articleCount: 1030,
    },
    {
      id: "appropedia_en_all_maxi_2026-02",
      name: "appropedia_en_all",
      title: "Appropedia",
      summary: "Shared knowledge to build rich, sustainable lives",
      articleCount: 30736,
    },
    {
      id: "wikipedia_en_medicine_maxi_2026-10",
      name: "wikipedia_en_medicine",
      title: "WikiMed Medical Encyclopedia",
      summary: "Medical articles",
      articleCount: 371615,
    },
    {
      id: "wikipedia_en-simple_all_maxi_2026-09",
      name: "wikipedia_en-simple_all",
      title: "Wikipedia in simple English",
      summary: "Simple English Wikipedia",
      articleCount: 400061,
    },
    {
      id: "wikibooks_en_all_maxi_2026-10",
      name: "wikibooks_en_all",
      title: "Wikibooks",
      summary: "The open-content textbooks collection",
      articleCount: 131297,
    },
    // wikipedia_en_all (full Wikipedia) is NOT here — still downloading.
  ],
};

const SEARCH = {
  query: "photosynthesis",
  results: [
    {
      bookId: "wikipedia_en_medicine_maxi_2026-10",
      bookTitle: "WikiMed Medical Encyclopedia",
      title: "Photosynthesis",
      path: "Photosynthesis",
      snippet: "Plant nutrition Plant physiology Quantum biology",
      words: 12500,
    },
    {
      bookId: "wikibooks_en_all_maxi_2026-10",
      bookTitle: "Wikibooks",
      title: "GCSE Science/Photosynthesis",
      path: "GCSE_Science/Photosynthesis",
      snippet: "Plants make their own food from sunlight, water and air.",
      words: 1492,
    },
  ],
};

const ARTICLE = {
  article: {
    bookId: "wikipedia_en_medicine_maxi_2026-10",
    path: "Photosynthesis",
    title: "Photosynthesis",
    html: "<p>Plants turn light into food.</p>",
  },
};

function libraryFetch() {
  return vi.fn(async (input: string) => {
    const url = String(input);
    const reply = (payload: unknown) => ({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    if (url.includes("/api/library/catalog")) return reply(CATALOG);
    if (url.includes("/api/library/search")) return reply(SEARCH);
    if (url.includes("/api/library/article")) return reply(ARTICLE);
    return reply({});
  });
}

beforeEach(() => {
  localStorage.clear();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Library window", () => {
  it("opens on the shelves, DNA first, with the live book count", async () => {
    vi.stubGlobal("fetch", libraryFetch());
    render(<LibraryWindow onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Nigeria — 81.5%")).toBeTruthy();
    });
    expect(screen.getByText("Egypt — 1.4%")).toBeTruthy();
    expect(screen.getByText("Medicine & Healing")).toBeTruthy();
    expect(screen.getByText("The Academy Shelf")).toBeTruthy();
    expect(screen.getByText(/5 books on the shelves/)).toBeTruthy();
    expect(screen.getByText(/no internet involved/)).toBeTruthy();
  });

  it("shows a still-downloading book honestly inside its shelf", async () => {
    vi.stubGlobal("fetch", libraryFetch());
    render(<LibraryWindow onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Nigeria — 81.5%")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("Nigeria — 81.5%"));
    // Full Wikipedia has not landed: named, and marked as downloading.
    expect(screen.getByText("Wikipedia (full)")).toBeTruthy();
    expect(screen.getByText("Still downloading")).toBeTruthy();
    expect(screen.getByText(/In the library — 400,061 articles/)).toBeTruthy();
    // Starter questions are tappable because Simple English carries the shelf.
    expect(screen.getByRole("button", { name: "Yoruba people" })).toBeTruthy();
  });

  it("search → results that name their book → article in the reader → back", async () => {
    vi.stubGlobal("fetch", libraryFetch());
    render(<LibraryWindow onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Nigeria — 81.5%")).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText("Search the library"), {
      target: { value: "photosynthesis" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => {
      expect(screen.getByText("GCSE Science/Photosynthesis")).toBeTruthy();
    });
    expect(screen.getByText(/from WikiMed Medical Encyclopedia · 12,500 words/)).toBeTruthy();
    expect(screen.getByText(/from Wikibooks · 1,492 words/)).toBeTruthy();

    fireEvent.click(screen.getByText("Photosynthesis"));
    await waitFor(() => {
      expect(screen.getByText("Plants turn light into food.")).toBeTruthy();
    });
    expect(screen.getByText("from WikiMed Medical Encyclopedia")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    await waitFor(() => {
      expect(screen.getByText("GCSE Science/Photosynthesis")).toBeTruthy();
    });
  });

  it("says the library is not answering when the catalog fails — never a fake shelf", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({
          error: "The library is not answering — kiwix-serve is not responding on this machine.",
        }),
      })),
    );
    render(<LibraryWindow onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/The library is not answering/)).toBeTruthy();
    });
    expect(screen.queryByText("Nigeria — 81.5%")).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
