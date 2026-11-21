/**
 * Client half of the offline library — the Library window's hands.
 *
 * Talks only to the app's own /api/library/* routes, which proxy to
 * kiwix-serve on this machine (see library.server.ts). Nothing here
 * reaches the internet, and nothing reaches Kiwix directly. Server
 * errors arrive as plain-words messages and are thrown as Errors
 * carrying those words, so the window can show them as-is.
 */

export type LibraryBookInfo = {
  id: string;
  name: string;
  title: string;
  summary: string;
  articleCount: number | null;
};

export type LibraryResultInfo = {
  bookId: string;
  bookTitle: string;
  title: string;
  path: string;
  snippet: string;
  words: number | null;
};

export type LibraryArticleInfo = {
  bookId: string;
  path: string;
  title: string;
  html: string;
};

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

async function getJson<T>(url: string, fetchFn: FetchFn): Promise<T> {
  const response = await fetchFn(url, { method: "GET" });
  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    /* an unreadable body falls through to the status-based message */
  }
  if (!response.ok) {
    throw new Error(
      typeof payload["error"] === "string"
        ? payload["error"]
        : "The library answered with an error.",
    );
  }
  return payload as T;
}

/** The books the library is serving right now. */
export async function fetchLibraryCatalog(fetchFn: FetchFn = fetch): Promise<LibraryBookInfo[]> {
  const payload = await getJson<{ books: LibraryBookInfo[] }>("/api/library/catalog", fetchFn);
  return payload.books;
}

/** Full-text search; pass book ids to keep results inside one shelf. */
export async function searchLibrary(
  query: string,
  bookIds: readonly string[] = [],
  fetchFn: FetchFn = fetch,
): Promise<LibraryResultInfo[]> {
  const params = new URLSearchParams({ q: query });
  if (bookIds.length > 0) params.set("books", bookIds.join(","));
  const payload = await getJson<{ results: LibraryResultInfo[] }>(
    `/api/library/search?${params.toString()}`,
    fetchFn,
  );
  return payload.results;
}

/** One article, sanitized server-side and ready to read. */
export async function fetchLibraryArticle(
  bookId: string,
  path: string,
  fetchFn: FetchFn = fetch,
): Promise<LibraryArticleInfo> {
  const params = new URLSearchParams({ book: bookId, path });
  const payload = await getJson<{ article: LibraryArticleInfo }>(
    `/api/library/article?${params.toString()}`,
    fetchFn,
  );
  return payload.article;
}
