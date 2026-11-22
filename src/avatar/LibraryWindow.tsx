/**
 * LIBRARY WINDOW — Augie's offline library, on Domenick's shelves.
 *
 * Opens on THE SHELVES (libraryShelves.ts): his DNA-anchored
 * organization first, then law, medicine, survival, science, the
 * deep shelves, archaeology, and the Academy shelf. Shelf state is
 * derived from the LIVE Kiwix catalog — a book still downloading
 * says "still downloading" and joins the moment it lands. Search
 * runs across the books (or inside one shelf), every result names
 * its book, and articles open in a reader that follows in-library
 * links. Everything is read from the books on this machine through
 * /api/library/* — no internet, no editing, no downloads.
 *
 * Pictures are left out of articles on purpose (server-side, see
 * library.server.ts): the pages stay light and the words are the
 * book's own. The footer says so, plainly.
 */
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import {
  fetchLibraryArticle,
  fetchLibraryCatalog,
  searchLibrary,
  type LibraryArticleInfo,
  type LibraryBookInfo,
  type LibraryResultInfo,
} from "./library";
import { LIBRARY_SHELVES, shelfAvailability, type LibraryShelf } from "./libraryShelves";
import { formatLawCitation, LAW_DISCLAIMER, LAW_SHELF_ID } from "./lawDesk";

type CatalogState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; books: LibraryBookInfo[] };

type View =
  | { kind: "shelves" }
  | { kind: "shelf"; shelf: LibraryShelf }
  | {
      kind: "results";
      heading: string;
      query: string;
      results: LibraryResultInfo[] | null;
      error: string | null;
      /** True when this search ran on the Law shelf (Part 11):
       * results carry citation lines and the desk's disclaimer. */
      law?: boolean;
    }
  | {
      kind: "article";
      bookId: string;
      path: string;
      article: LibraryArticleInfo | null;
      error: string | null;
    };

export function LibraryWindow({ onClose }: { onClose: () => void }) {
  const [catalog, setCatalog] = useState<CatalogState>({ kind: "loading" });
  const [trail, setTrail] = useState<View[]>([]);
  const [draft, setDraft] = useState("");
  const view: View = trail[trail.length - 1] ?? { kind: "shelves" };

  const loadCatalog = useCallback(async () => {
    setCatalog({ kind: "loading" });
    try {
      const books = await fetchLibraryCatalog();
      setCatalog({ kind: "ready", books });
    } catch (error) {
      setCatalog({
        kind: "error",
        message: error instanceof Error ? error.message : "The library is not answering.",
      });
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const books = catalog.kind === "ready" ? catalog.books : [];
  const catalogNames = useMemo(() => new Set(books.map((b) => b.name)), [books]);
  const bookByName = useMemo(() => new Map(books.map((b) => [b.name, b])), [books]);
  const bookById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);

  const go = useCallback((next: View) => setTrail((prev) => [...prev, next]), []);
  const back = useCallback(() => setTrail((prev) => prev.slice(0, -1)), []);
  const replaceTop = useCallback((next: View) => {
    setTrail((prev) => [...prev.slice(0, -1), next]);
  }, []);

  const runSearch = useCallback(
    (query: string, heading: string, bookIds: readonly string[], law = false) => {
      const pending: View = { kind: "results", heading, query, results: null, error: null, law };
      go(pending);
      void (async () => {
        try {
          const results = await searchLibrary(query, bookIds);
          replaceTop({ kind: "results", heading, query, results, error: null, law });
        } catch (error) {
          replaceTop({
            kind: "results",
            heading,
            query,
            results: null,
            error: error instanceof Error ? error.message : "The library search failed.",
            law,
          });
        }
      })();
    },
    [go, replaceTop],
  );

  const openArticle = useCallback(
    (bookId: string, path: string) => {
      const pending: View = { kind: "article", bookId, path, article: null, error: null };
      go(pending);
      void (async () => {
        try {
          const article = await fetchLibraryArticle(bookId, path);
          replaceTop({ kind: "article", bookId, path, article, error: null });
        } catch (error) {
          replaceTop({
            kind: "article",
            bookId,
            path,
            article: null,
            error: error instanceof Error ? error.message : "That article could not be read.",
          });
        }
      })();
    },
    [go, replaceTop],
  );

  const onArticleClick = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest<HTMLElement>("[data-lib-book]");
    if (!anchor) return;
    event.preventDefault();
    const bookId = anchor.dataset["libBook"];
    const path = anchor.dataset["libPath"];
    if (bookId && path) openArticle(bookId, path);
  };

  return (
    <FloatingWindow
      id="library"
      title="Library"
      onClose={onClose}
      initialWidth={500}
      initialHeight={440}
    >
      <div className="window-library">
        {trail.length > 0 && (
          <button type="button" className="window-btn window-library__back" onClick={back}>
            ← Back
          </button>
        )}

        {catalog.kind === "loading" && view.kind === "shelves" && (
          <p className="window-library__note">Opening the library…</p>
        )}
        {catalog.kind === "error" && view.kind === "shelves" && (
          <>
            <p className="window-library__note">{catalog.message}</p>
            <button type="button" className="window-btn" onClick={() => void loadCatalog()}>
              Try again
            </button>
          </>
        )}

        {catalog.kind === "ready" && view.kind === "shelves" && (
          <>
            <form
              className="window-library__search"
              onSubmit={(event) => {
                event.preventDefault();
                const query = draft.trim();
                if (query) runSearch(query, `Results for “${query}”`, []);
              }}
            >
              <input
                className="window-library__input"
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Search every book on the shelves…"
                aria-label="Search the library"
              />
              <button type="submit" className="window-btn">
                Search
              </button>
            </form>
            <p className="window-library__count">
              {books.length} book{books.length === 1 ? "" : "s"} on the shelves —{" "}
              {books.reduce((sum, b) => sum + (b.articleCount ?? 0), 0).toLocaleString()} articles,
              all on this machine.
            </p>
            <button
              type="button"
              className="window-btn"
              onClick={() => {
                const lawShelf = LIBRARY_SHELVES.find((s) => s.id === LAW_SHELF_ID);
                if (lawShelf) go({ kind: "shelf", shelf: lawShelf });
              }}
            >
              Law Desk — cited sources from the Law shelf
            </button>
            <div className="window-library__shelves">
              {LIBRARY_SHELVES.map((shelf) => {
                const state = shelfAvailability(shelf, catalogNames);
                return (
                  <button
                    key={shelf.id}
                    type="button"
                    className="window-library__shelf"
                    onClick={() => go({ kind: "shelf", shelf })}
                  >
                    <span className="window-library__shelf-title">{shelf.title}</span>
                    <span className="window-library__shelf-status">
                      {state.ready
                        ? `On the shelf: ${state.available.map((b) => b.label).join(" · ")}`
                        : "Still downloading — not on the shelf yet"}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {view.kind === "shelf" && (
          <div className="window-library__shelfview">
            <h3 className="window-library__heading">{view.shelf.title}</h3>
            <p className="window-library__note">{view.shelf.note}</p>
            <ul className="window-library__books">
              {view.shelf.books.map((ref) => {
                const live = bookByName.get(ref.name);
                return (
                  <li key={ref.name} className="window-library__book">
                    <span>{ref.label}</span>
                    <span className="window-library__book-status">
                      {live
                        ? `In the library — ${(live.articleCount ?? 0).toLocaleString()} articles`
                        : "Still downloading"}
                    </span>
                  </li>
                );
              })}
            </ul>
            {view.shelf.id === LAW_SHELF_ID && (
              <p className="window-library__note">{LAW_DISCLAIMER}</p>
            )}
            <p className="window-library__note">Start with a question:</p>
            <div className="window-library__chips">
              {view.shelf.queries.map((query) => {
                const state = shelfAvailability(view.shelf, catalogNames);
                const bookIds = state.available
                  .map((ref) => bookByName.get(ref.name)?.id)
                  .filter((id): id is string => Boolean(id));
                return (
                  <button
                    key={query}
                    type="button"
                    className="window-library__chip"
                    disabled={!state.ready}
                    onClick={() =>
                      runSearch(
                        query,
                        `${view.shelf.title} — “${query}”`,
                        bookIds,
                        view.shelf.id === LAW_SHELF_ID,
                      )
                    }
                  >
                    {query}
                  </button>
                );
              })}
            </div>
            {!shelfAvailability(view.shelf, catalogNames).ready && (
              <p className="window-library__note">
                This shelf's books are still downloading. They will appear here on their own when
                they land.
              </p>
            )}
          </div>
        )}

        {view.kind === "results" && (
          <div className="window-library__results">
            <h3 className="window-library__heading">{view.heading}</h3>
            {view.law && <p className="window-library__note">{LAW_DISCLAIMER}</p>}
            {view.results === null && view.error === null && (
              <p className="window-library__note">Searching the shelves…</p>
            )}
            {view.error !== null && <p className="window-library__note">{view.error}</p>}
            {view.results !== null && view.results.length === 0 && (
              <p className="window-library__note">
                No results in the library for “{view.query}”. The words may live in a book still
                downloading, or under a different name.
              </p>
            )}
            {view.results !== null && view.results.length > 0 && (
              <ol className="window-library__list">
                {view.results.map((result) => (
                  <li key={`${result.bookId}/${result.path}`}>
                    <button
                      type="button"
                      className="window-library__result"
                      onClick={() => openArticle(result.bookId, result.path)}
                    >
                      <span className="window-library__result-title">{result.title}</span>
                      <span className="window-library__result-book">
                        from {result.bookTitle}
                        {result.words !== null ? ` · ${result.words.toLocaleString()} words` : ""}
                      </span>
                      {view.law && (
                        <span className="window-library__result-book">
                          {formatLawCitation(result.bookTitle, result.title)}
                        </span>
                      )}
                      {result.snippet && (
                        <span className="window-library__result-snippet">{result.snippet}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {view.kind === "article" && (
          <div className="window-library__article">
            {view.article === null && view.error === null && (
              <p className="window-library__note">Opening the article…</p>
            )}
            {view.error !== null && <p className="window-library__note">{view.error}</p>}
            {view.article !== null && (
              <>
                <h3 className="window-library__heading">{view.article.title}</h3>
                <p className="window-library__result-book">
                  from {bookById.get(view.article.bookId)?.title ?? view.article.bookId}
                </p>
                <div
                  className="window-library__body"
                  onClick={onArticleClick}
                  dangerouslySetInnerHTML={{ __html: view.article.html }}
                />
              </>
            )}
          </div>
        )}

        <p className="window-library__footer">
          Read from the books on this machine — no internet involved. Pictures are left out of
          articles to keep the pages light; every word is the book's own.
        </p>
      </div>
    </FloatingWindow>
  );
}
