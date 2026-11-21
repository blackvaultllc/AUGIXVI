import { describe, expect, it, vi } from "vitest";
import {
  forwardLibraryArticle,
  forwardLibraryCatalog,
  forwardLibrarySearch,
  parseKiwixCatalog,
  parseKiwixSearch,
  resolveLibraryLink,
  sanitizeArticleHtml,
} from "@/avatar/library.server";

/**
 * LIBRARY PROXY (Knowledge Phase 2, 2026-11-21) — the doorway
 * between Augie and kiwix-serve on this machine. Fixtures mirror
 * the live server's real shapes (OPDS catalog entries, the search
 * results list, a MediaWiki article page), verified against the
 * running kiwix-serve before this code was written. The rules
 * pinned here: every result names its book; snippets are cleaned
 * of category bookkeeping; articles are sanitized (no scripts, no
 * pictures, no toolbar); and when Kiwix does not answer, the proxy
 * says so honestly instead of inventing anything.
 */

const CATALOG_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="https://specs.opds.io/opds-1.2">
  <title>All Entries</title>
  <entry>
    <id>urn:uuid:31c3bd61-e278-7206-d3dc-9465f909cf97</id>
    <title>Alpine Linux Wiki</title>
    <summary>Alpine Linux is a security-oriented, lightweight Linux distribution</summary>
    <language>eng</language>
    <name>alpinelinux_en_all</name>
    <flavour>maxi</flavour>
    <articleCount>1030</articleCount>
    <link rel="http://opds-spec.org/image/thumbnail" href="/catalog/v2/illustration/alpinelinux_en_all_maxi_2026-10/?size=48" type="image/png;width=48;height=48;scale=1"/>
    <link type="text/html" href="/alpinelinux_en_all_maxi_2026-10" />
  </entry>
  <entry>
    <id>urn:uuid:4448bebc-ab7f-39c6-dd4d-736fe694a55f</id>
    <title>Wikibooks</title>
    <summary>The open-content textbooks collection</summary>
    <language>eng</language>
    <name>wikibooks_en_all</name>
    <flavour>maxi</flavour>
    <articleCount>131297</articleCount>
    <link type="text/html" href="/wikibooks_en_all_maxi_2026-10" />
  </entry>
</feed>`;

const SEARCH_HTML = `<html><body>
<div class="results">
  <ul>
    <li>
      <a href="/wikipedia_en_medicine_maxi_2026-10/Photosynthesis">
        Photosynthesis
      </a>
      <cite>...Plant nutrition Plant physiology Quantum biology Categories: Cell biology Cellular respiration Hidden categories: Articles with short description</cite>
      <div class="book-title">from WikiMed Medical Encyclopedia</div>
      <div class="informations">12,500 words</div>
    </li>
    <li>
      <a href="/wikibooks_en_all_maxi_2026-10/GCSE_Science/Photosynthesis">
        GCSE Science/Photosynthesis
      </a>
      <cite>Plants make their own food from sunlight, water and air.</cite>
      <div class="book-title">from Wikibooks</div>
      <div class="informations">1,492 words</div>
    </li>
  </ul>
</div>
</body></html>`;

const ARTICLE_HTML = `<html><head><title>Photosynthesis</title><script src="/skin/x.js"></script></head>
<body>
<span class="kiwix"><span id="kiwixtoolbar" class="ui-widget-header"><span class="kiwix_centered">toolbar junk</span></span></span>
<h1>Photosynthesis</h1>
<button type="button">chrome button</button>
<script>alert("boom")</script>
<style>.leaf { color: red; }</style>
<p onclick="evil()">Plants turn <a href="/wikipedia_en_medicine_maxi_2026-10/Chlorophyll">chlorophyll</a> and <a href="Light">light</a> into food. <a href="https://example.com/elsewhere">An outside page</a> and <a href="#cite_note">a footnote</a>.</p>
<img src="/wikipedia_en_medicine_maxi_2026-10/I/leaf.png" alt="leaf" />
<form action="/search"><input type="text" /></form>
</body></html>`;

function kiwixFetch(routes: Record<string, { status?: number; body: string }>) {
  return vi.fn(async (input: string) => {
    const url = String(input);
    for (const [needle, reply] of Object.entries(routes)) {
      if (url.includes(needle)) {
        return new Response(reply.body, { status: reply.status ?? 200 });
      }
    }
    return new Response("not found", { status: 404 });
  });
}

describe("library proxy — catalog", () => {
  it("parses OPDS entries into books with ids, names, and counts", () => {
    const books = parseKiwixCatalog(CATALOG_XML);
    expect(books).toHaveLength(2);
    expect(books[0]).toMatchObject({
      id: "alpinelinux_en_all_maxi_2026-10",
      name: "alpinelinux_en_all",
      title: "Alpine Linux Wiki",
      articleCount: 1030,
    });
    expect(books[1]).toMatchObject({
      id: "wikibooks_en_all_maxi_2026-10",
      name: "wikibooks_en_all",
      title: "Wikibooks",
      articleCount: 131297,
    });
  });

  it("forwards the catalog as JSON", async () => {
    const fetchFn = kiwixFetch({ "/catalog/v2/entries": { body: CATALOG_XML } });
    const response = await forwardLibraryCatalog(fetchFn as never);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { books: unknown[] };
    expect(payload.books).toHaveLength(2);
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain("127.0.0.1:8180/catalog/v2/entries");
  });

  it("says the library is not answering when Kiwix is down — never a fake catalog", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    const response = await forwardLibraryCatalog(fetchFn as never);
    expect(response.status).toBe(503);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toMatch(/not answering/);
  });
});

describe("library proxy — search", () => {
  it("parses results with their book, a cleaned snippet, and a word count", () => {
    const results = parseKiwixSearch(SEARCH_HTML);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      bookId: "wikipedia_en_medicine_maxi_2026-10",
      bookTitle: "WikiMed Medical Encyclopedia",
      title: "Photosynthesis",
      path: "Photosynthesis",
      words: 12500,
    });
    // The category bookkeeping trailing the raw cite is not the article talking.
    expect(results[0]!.snippet).toContain("Plant nutrition");
    expect(results[0]!.snippet).not.toContain("Categories:");
    expect(results[0]!.snippet).not.toContain("Hidden categories");
    expect(results[1]).toMatchObject({
      bookId: "wikibooks_en_all_maxi_2026-10",
      path: "GCSE_Science/Photosynthesis",
      words: 1492,
    });
  });

  it("returns an empty list for a no-results page", () => {
    expect(parseKiwixSearch(`<div class="results"></div><p>No results were found</p>`)).toEqual([]);
  });

  it("filters results to the requested books (one shelf)", async () => {
    const fetchFn = kiwixFetch({ "/search?": { body: SEARCH_HTML } });
    const request = new Request(
      "http://localhost/api/library/search?q=photosynthesis&books=wikibooks_en_all_maxi_2026-10",
    );
    const response = await forwardLibrarySearch(request, fetchFn as never);
    const payload = (await response.json()) as { results: { bookId: string }[] };
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]!.bookId).toBe("wikibooks_en_all_maxi_2026-10");
  });

  it("rejects an empty query with honest words", async () => {
    const response = await forwardLibrarySearch(
      new Request("http://localhost/api/library/search"),
      kiwixFetch({}) as never,
    );
    expect(response.status).toBe(400);
  });

  it("says the library is not answering when Kiwix is down", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    const response = await forwardLibrarySearch(
      new Request("http://localhost/api/library/search?q=photosynthesis"),
      fetchFn as never,
    );
    expect(response.status).toBe(503);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toMatch(/not answering/);
  });
});

describe("library proxy — article", () => {
  it("extracts the title and sanitizes the body", () => {
    const { title, html } = sanitizeArticleHtml(ARTICLE_HTML, {
      bookId: "wikipedia_en_medicine_maxi_2026-10",
      path: "Photosynthesis",
    });
    expect(title).toBe("Photosynthesis");
    expect(html).toContain("Plants turn");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert");
    expect(html).not.toContain("toolbar junk");
    expect(html).not.toContain("kiwixtoolbar");
    expect(html).not.toContain("chrome button");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<style");
  });

  it("rewrites in-library links for the reader and reduces outside links to text", () => {
    const { html } = sanitizeArticleHtml(ARTICLE_HTML, {
      bookId: "wikipedia_en_medicine_maxi_2026-10",
      path: "Photosynthesis",
    });
    expect(html).toContain('data-lib-book="wikipedia_en_medicine_maxi_2026-10"');
    expect(html).toContain('data-lib-path="Chlorophyll"');
    // A relative link resolves inside the same book.
    expect(html).toContain('data-lib-path="Light"');
    // Off-machine and anchor links keep their words, lose their href.
    expect(html).toContain("An outside page");
    expect(html).not.toContain("example.com");
    expect(html).toContain("a footnote");
    expect(html).not.toContain("#cite_note");
  });

  it("resolves relative links against the current article's folder", () => {
    expect(
      resolveLibraryLink("../Cellular_respiration", {
        bookId: "wikibooks_en_all_maxi_2026-10",
        path: "GCSE_Science/Photosynthesis",
      }),
    ).toEqual({ bookId: "wikibooks_en_all_maxi_2026-10", path: "Cellular_respiration" });
    expect(
      resolveLibraryLink("Light", {
        bookId: "wikibooks_en_all_maxi_2026-10",
        path: "GCSE_Science/Photosynthesis",
      }),
    ).toEqual({ bookId: "wikibooks_en_all_maxi_2026-10", path: "GCSE_Science/Light" });
    expect(resolveLibraryLink("https://example.com", { bookId: "b", path: "p" })).toBeNull();
    expect(resolveLibraryLink("#section", { bookId: "b", path: "p" })).toBeNull();
  });

  it("forwards an article and 404s honestly when the book does not hold it", async () => {
    const fetchFn = kiwixFetch({
      "/wikipedia_en_medicine_maxi_2026-10/Photosynthesis": { body: ARTICLE_HTML },
    });
    const ok = await forwardLibraryArticle(
      new Request(
        "http://localhost/api/library/article?book=wikipedia_en_medicine_maxi_2026-10&path=Photosynthesis",
      ),
      fetchFn as never,
    );
    expect(ok.status).toBe(200);
    const payload = (await ok.json()) as { article: { title: string; bookId: string } };
    expect(payload.article.title).toBe("Photosynthesis");
    expect(payload.article.bookId).toBe("wikipedia_en_medicine_maxi_2026-10");

    const missing = await forwardLibraryArticle(
      new Request(
        "http://localhost/api/library/article?book=wikipedia_en_medicine_maxi_2026-10&path=No_Such_Page",
      ),
      fetchFn as never,
    );
    expect(missing.status).toBe(404);
  });

  it("requires both book and path", async () => {
    const response = await forwardLibraryArticle(
      new Request("http://localhost/api/library/article?book=x"),
      kiwixFetch({}) as never,
    );
    expect(response.status).toBe(400);
  });
});
