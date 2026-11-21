/**
 * Server half of /api/library/* — the offline library's doorway.
 *
 * Augie's books live in kiwix-serve on this same machine
 * (augie-knowledge.service, 127.0.0.1:8180, localhost only). The
 * browser never talks to Kiwix directly: these forwarders read its
 * OPDS catalog, its search page, and its article pages server-side
 * and hand the window clean JSON. That keeps the library working
 * from the operator's phone over LAN/Tailscale later, avoids CORS,
 * and keeps every answer sourced: a result names its book or it
 * does not ship.
 *
 * Reading choices, stated plainly: article HTML is sanitized here
 * (scripts, styles, forms, the Kiwix toolbar and every picture are
 * removed — pictures are left out to keep pages light; the words
 * are the book's own). Links between articles are rewritten so the
 * reader can follow them inside the window; links off the machine
 * are reduced to their text, because this library is offline.
 *
 * Failures keep the house style: 400 missing input · 404 the book
 * or article is not there · 502 Kiwix answered with an error ·
 * 503 the library is not answering at all. Nothing is ever faked:
 * when Kiwix is down the window says so.
 */

export const KIWIX_BASE_URL_DEFAULT = "http://127.0.0.1:8180";
const CATALOG_TIMEOUT_MS = 30_000;
const SEARCH_TIMEOUT_MS = 60_000;
const ARTICLE_TIMEOUT_MS = 60_000;
const SEARCH_PAGE_LENGTH = 30;

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

function defaultEnv(): Record<string, string | undefined> {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env ?? {};
}

/** Where kiwix-serve listens; AUGIE_KIWIX_URL overrides for dev. */
export function kiwixBaseUrl(env: Record<string, string | undefined> = defaultEnv()): string {
  return (env["AUGIE_KIWIX_URL"]?.trim() || KIWIX_BASE_URL_DEFAULT).replace(/\/$/, "");
}

export type LibraryBook = {
  /** Content path segment on the Kiwix server, e.g. "wikibooks_en_all_maxi_2026-10". */
  id: string;
  /** Stable OPDS name across editions, e.g. "wikibooks_en_all". */
  name: string;
  title: string;
  summary: string;
  articleCount: number | null;
};

export type LibrarySearchResult = {
  bookId: string;
  bookTitle: string;
  title: string;
  /** Article path inside the book, e.g. "GCSE_Science/Photosynthesis". */
  path: string;
  snippet: string;
  words: number | null;
};

export type LibraryArticle = {
  bookId: string;
  path: string;
  title: string;
  html: string;
};

/** Decode the small set of HTML entities Kiwix pages actually use. */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function cleanText(html: string): string {
  return decodeHtmlEntities(stripTags(html)).replace(/\s+/g, " ").trim();
}

/** Parse the OPDS catalog feed (GET /catalog/v2/entries) into books. */
export function parseKiwixCatalog(xml: string): LibraryBook[] {
  const books: LibraryBook[] = [];
  const entryPattern = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch: RegExpExecArray | null;
  while ((entryMatch = entryPattern.exec(xml)) !== null) {
    const entry = entryMatch[1]!;
    const title = cleanText(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const name = cleanText(entry.match(/<name>([\s\S]*?)<\/name>/)?.[1] ?? "");
    const summary = cleanText(entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? "");
    const countRaw = entry.match(/<articleCount>(\d+)<\/articleCount>/)?.[1];
    // The book's home link is the one typed text/html; its href is the
    // content path segment ("/wikibooks_en_all_maxi_2026-10").
    let id = "";
    const linkPattern = /<link\b[^>]*>/g;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkPattern.exec(entry)) !== null) {
      const tag = linkMatch[0];
      if (!/type="text\/html"/.test(tag)) continue;
      const href = tag.match(/href="([^"]+)"/)?.[1];
      if (href) {
        id = href.replace(/^\//, "").replace(/\/$/, "");
        break;
      }
    }
    if (!id || !title) continue;
    books.push({
      id,
      name: name || id,
      title,
      summary,
      articleCount: countRaw ? parseInt(countRaw, 10) : null,
    });
  }
  return books;
}

/**
 * Trim a Kiwix search snippet to the readable part: the raw cite text
 * starts mid-sentence and, on Wikipedia books, trails off into
 * category bookkeeping that is not the article talking.
 */
export function cleanSnippet(rawHtml: string): string {
  let text = cleanText(rawHtml);
  text = text.replace(/^…\s*/, "").replace(/^\.\.\.\s*/, "");
  for (const marker of ["Categories:", "Hidden categories"]) {
    const at = text.indexOf(marker);
    if (at > 0) text = text.slice(0, at).trim();
  }
  if (text.length > 240) text = `${text.slice(0, 237).trimEnd()}…`;
  return text;
}

/** Parse a Kiwix search results page (GET /search?pattern=…) into results. */
export function parseKiwixSearch(html: string): LibrarySearchResult[] {
  const results: LibrarySearchResult[] = [];
  const listMatch = html.match(/<div class="results">([\s\S]*?)<\/ul>/);
  if (!listMatch) return results;
  const itemPattern = /<li>([\s\S]*?)<\/li>/g;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemPattern.exec(listMatch[1]!)) !== null) {
    const item = itemMatch[1]!;
    const anchor = item.match(/<a href="\/([^"]+)">([\s\S]*?)<\/a>/);
    if (!anchor) continue;
    const href = decodeHtmlEntities(anchor[1]!);
    const slash = href.indexOf("/");
    if (slash <= 0) continue;
    const bookId = href.slice(0, slash);
    const path = href.slice(slash + 1);
    const bookTitle = cleanText(
      item.match(/<div class="book-title">([\s\S]*?)<\/div>/)?.[1] ?? "",
    ).replace(/^from\s+/i, "");
    const snippet = cleanSnippet(item.match(/<cite>([\s\S]*?)<\/cite>/)?.[1] ?? "");
    const wordsRaw = item
      .match(/<div class="informations">([\s\S]*?)<\/div>/)?.[1]
      ?.replace(/[^\d]/g, "");
    results.push({
      bookId,
      bookTitle,
      title: cleanText(anchor[2]!),
      path,
      snippet,
      words: wordsRaw ? parseInt(wordsRaw, 10) : null,
    });
  }
  return results;
}

/**
 * Remove one element (and its contents) by id, counting nested
 * depth of the same tag. Kiwix wraps its toolbar in a <span> on
 * some books and a <div> on others, so the tag is read from the
 * match, never assumed.
 */
function removeElementById(html: string, id: string): string {
  const start = new RegExp(`<(\\w+)\\b[^>]*\\bid="${id}"[^>]*>`).exec(html);
  if (!start) return html;
  const tagName = start[1]!;
  let depth = 1;
  let index = start.index + start[0].length;
  const tagPattern = new RegExp(`</?${tagName}\\b[^>]*>`, "g");
  tagPattern.lastIndex = index;
  let tag: RegExpExecArray | null;
  while ((tag = tagPattern.exec(html)) !== null) {
    if (tag[0].startsWith("</")) depth -= 1;
    else if (!tag[0].endsWith("/>")) depth += 1;
    if (depth === 0) {
      index = tag.index + tag[0].length;
      return html.slice(0, start.index) + html.slice(index);
    }
  }
  return html;
}

const REMOVED_PAIRED_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "form",
  "noscript",
  "video",
  "audio",
  "button",
  "head",
  "title",
] as const;

/**
 * Sanitize one Kiwix article page for the reader. Returns the
 * article's own title and a body safe to render: no scripts, styles,
 * forms, toolbars or pictures; event handlers and javascript: URLs
 * stripped; in-library links rewritten to data-lib-* anchors the
 * reader window can follow; off-machine links reduced to text.
 */
export function sanitizeArticleHtml(
  html: string,
  current: { bookId: string; path: string },
): { title: string; html: string } {
  const title = cleanText(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "") || "Untitled";
  let body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? html;

  body = removeElementById(body, "kiwixtoolbar");
  for (const tag of REMOVED_PAIRED_TAGS) {
    body = body.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi"), "");
  }
  body = body.replace(/<(?:link|meta|img|input|embed|source|track)\b[^>]*>/gi, "");
  // Event handlers and inline styles never survive.
  body = body.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  body = body.replace(/\s+style\s*=\s*("[^"]*"|'[^']*')/gi, "");

  // Links: follow inside the library, or keep the words only.
  body = body.replace(
    /<a\b([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi,
    (_whole, _pre: string, rawHref: string, _post: string, inner: string) => {
      const href = decodeHtmlEntities(rawHref).trim();
      const target = resolveLibraryLink(href, current);
      if (!target) return inner;
      return `<a href="#" data-lib-book="${target.bookId}" data-lib-path="${escapeAttr(target.path)}">${inner}</a>`;
    },
  );
  return { title, html: body.trim() };
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Resolve an article link to a library target, or null when the link
 * leaves the library (anchors, external URLs, media files).
 */
export function resolveLibraryLink(
  href: string,
  current: { bookId: string; path: string },
): { bookId: string; path: string } | null {
  if (!href || href.startsWith("#")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return null; // http:, mailto:, javascript: …
  const clean = href.split("#")[0]!.split("?")[0]!;
  if (!clean) return null;
  if (clean.startsWith("/")) {
    const rest = clean.replace(/^\//, "");
    const slash = rest.indexOf("/");
    if (slash <= 0) return null;
    return { bookId: rest.slice(0, slash), path: decodePath(rest.slice(slash + 1)) };
  }
  // Relative to the current article: climb with ../, then descend.
  const segments = current.path.split("/").slice(0, -1);
  for (const part of clean.split("/")) {
    if (part === "..") segments.pop();
    else if (part !== "." && part !== "") segments.push(part);
  }
  const path = decodePath(segments.join("/"));
  if (!path) return null;
  return { bookId: current.bookId, path };
}

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function libraryDown(): Response {
  return Response.json(
    {
      error:
        "The library is not answering — kiwix-serve is not responding on this machine. The books themselves are safe on disk; check the augie-knowledge service, then try again.",
    },
    { status: 503 },
  );
}

async function fetchKiwix(path: string, timeoutMs: number, fetchFn: FetchFn): Promise<Response> {
  return fetchFn(`${kiwixBaseUrl()}${path}`, {
    method: "GET",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** GET /api/library/catalog — the books kiwix-serve is serving right now. */
export async function forwardLibraryCatalog(fetchFn: FetchFn = fetch): Promise<Response> {
  let response: Response;
  try {
    response = await fetchKiwix("/catalog/v2/entries", CATALOG_TIMEOUT_MS, fetchFn);
  } catch {
    return libraryDown();
  }
  if (!response.ok) {
    return Response.json({ error: "The library catalog answered with an error." }, { status: 502 });
  }
  const books = parseKiwixCatalog(await response.text());
  return Response.json({ books });
}

/** GET /api/library/search?q=…&books=id1,id2 — full-text search across the books. */
export async function forwardLibrarySearch(
  request: Request,
  fetchFn: FetchFn = fetch,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim();
  if (!query) {
    return Response.json({ error: "No search words were given." }, { status: 400 });
  }
  const bookFilter = new Set(
    (params.get("books") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  let response: Response;
  try {
    response = await fetchKiwix(
      `/search?pattern=${encodeURIComponent(query)}&pageLength=${SEARCH_PAGE_LENGTH}`,
      SEARCH_TIMEOUT_MS,
      fetchFn,
    );
  } catch {
    return libraryDown();
  }
  if (!response.ok) {
    return Response.json({ error: "The library search answered with an error." }, { status: 502 });
  }
  let results = parseKiwixSearch(await response.text());
  if (bookFilter.size > 0) results = results.filter((r) => bookFilter.has(r.bookId));
  return Response.json({ query, results });
}

/** GET /api/library/article?book=…&path=… — one article, sanitized for reading. */
export async function forwardLibraryArticle(
  request: Request,
  fetchFn: FetchFn = fetch,
): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const bookId = (params.get("book") ?? "").trim();
  const path = (params.get("path") ?? "").trim();
  if (!bookId || !path) {
    return Response.json(
      { error: "An article needs both its book and its path." },
      { status: 400 },
    );
  }
  let response: Response;
  try {
    response = await fetchKiwix(`/${bookId}/${encodePath(path)}`, ARTICLE_TIMEOUT_MS, fetchFn);
  } catch {
    return libraryDown();
  }
  if (response.status === 404) {
    return Response.json(
      { error: `That article is not in ${bookId} — it may have moved in a newer edition.` },
      { status: 404 },
    );
  }
  if (!response.ok) {
    return Response.json({ error: "The library answered with an error." }, { status: 502 });
  }
  const { title, html } = sanitizeArticleHtml(await response.text(), { bookId, path });
  const article: LibraryArticle = { bookId, path, title, html };
  return Response.json({ article });
}
