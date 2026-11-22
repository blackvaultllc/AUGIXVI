/**
 * LAW DESK — Part 11 (Domenick's order 2026-11-21): Augie answers law
 * questions grounded in the Library, with citations.
 *
 * Method, in order:
 *  1. The caller's operator session is verified (same check as the
 *     gate log) — the desk is operator-only.
 *  2. The live Kiwix catalog is read. Books whose names/titles mark
 *     them as law books form the LAW SHELF. If no dedicated law book
 *     has landed yet, the desk says so plainly and still answers
 *     from the general books (law lives inside Wikipedia and
 *     WikiBooks too) — with the shelf state reported, never hidden.
 *  3. The question is searched across the library; results from law
 *     books rank first. The top articles are read and fed to the
 *     local brain with a strict instruction: answer only from the
 *     book words, cite every claim as [Book — Article], and close
 *     with the honesty line. If the brain is unavailable, the book
 *     excerpts themselves are returned with their citations.
 *  4. If the library has nothing, the desk says so. It never
 *     invents law.
 *
 * HONEST LIMIT, stated in every answer: this is knowledge from
 * books, not a licensed attorney and not legal advice.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import {
  forwardLibraryArticle,
  forwardLibraryCatalog,
  forwardLibrarySearch,
  type LibraryBook,
  type LibrarySearchResult,
} from "./library.server";

export const LAW_HONESTY_LINE =
  "I am Augie, answering from the books on this machine — I am not a licensed attorney, and this is knowledge, not legal advice.";

const LAW_BOOK_PATTERN =
  /\b(law|legal|juris|constitution|court|attorney|statute|rights|crime|criminal|civil)\b/i;

export function isLawBook(book: Pick<LibraryBook, "name" | "id" | "title">): boolean {
  return LAW_BOOK_PATTERN.test(`${book.name} ${book.id} ${book.title ?? ""}`);
}

/** Law-shelf results first, then the library's own order. */
export function rankLawResults(
  results: LibrarySearchResult[],
  booksById: Map<string, LibraryBook>,
): LibrarySearchResult[] {
  return results
    .map((result, index) => ({
      result,
      index,
      law: booksById.has(result.bookId) && isLawBook(booksById.get(result.bookId)!) ? 0 : 1,
    }))
    .sort((a, b) => a.law - b.law || a.index - b.index)
    .map((entry) => entry.result);
}

export interface LawCitation {
  bookTitle: string;
  articleTitle: string;
}

export interface LawAnswer {
  authorized: boolean;
  answer: string;
  citations: LawCitation[];
  /** True when a dedicated law book is among the books serving. */
  lawShelfLanded: boolean;
  mode: "brain" | "excerpt" | "none" | "library-down" | "unauthorized";
}

type LawInput = { accessToken: string; question: string };

function isLawInput(input: unknown): input is LawInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "accessToken" in input &&
    typeof input.accessToken === "string" &&
    input.accessToken.length > 0 &&
    input.accessToken.length <= 16_384 &&
    "question" in input &&
    typeof input.question === "string" &&
    input.question.trim().length > 0 &&
    input.question.length <= 500
  );
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const LAW_SYSTEM =
  "You are Augie at the Law Desk, answering Domenick's law question from the book words given. " +
  "Use ONLY those book words — never add law that is not in them. " +
  "Write clearly and completely, in plain strong language, at most 10 sentences. " +
  "After every claim, cite its source exactly like [Book Title — Article Title] using the sources named in the text. " +
  `End with this exact line: ${LAW_HONESTY_LINE} ` +
  "If the book words do not answer the question, say exactly: The books I have do not answer that.";

async function askBrain(
  question: string,
  context: string,
  fetchFn: typeof fetch,
  env: Record<string, string | undefined>,
): Promise<string | null> {
  const base = (env["OLLAMA_API_BASE_URL"]?.trim() || "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = env["AUGIE_LAW_MODEL"]?.trim() || "llama3.1:8b";
  try {
    const response = await fetchFn(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: LAW_SYSTEM },
          { role: "user", content: `Question: ${question}\n\nBook words:\n${context}` },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { message?: { content?: string } };
    const text = body.message?.content?.trim();
    if (!text || text.startsWith("The books I have do not answer that")) return null;
    return text;
  } catch {
    return null;
  }
}

/** The desk's work, with fetch + env injectable for tests. */
export async function answerLawQuestion(
  question: string,
  fetchFn: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<Omit<LawAnswer, "authorized">> {
  let books: LibraryBook[];
  try {
    const catalogResponse = await forwardLibraryCatalog(fetchFn);
    if (!catalogResponse.ok) {
      return { answer: "", citations: [], lawShelfLanded: false, mode: "library-down" };
    }
    books = ((await catalogResponse.json()) as { books?: LibraryBook[] }).books ?? [];
  } catch {
    return { answer: "", citations: [], lawShelfLanded: false, mode: "library-down" };
  }
  const booksById = new Map(books.map((book) => [book.id, book]));
  const lawShelfLanded = books.some((book) => isLawBook(book));

  const searchUrl = `http://local/api/library/search?q=${encodeURIComponent(question)}`;
  const searchResponse = await forwardLibrarySearch(new Request(searchUrl), fetchFn);
  if (!searchResponse.ok) {
    return { answer: "", citations: [], lawShelfLanded, mode: "library-down" };
  }
  const searchBody = (await searchResponse.json()) as { results?: LibrarySearchResult[] };
  const ranked = rankLawResults(searchBody.results ?? [], booksById).slice(0, 3);
  if (ranked.length === 0) {
    return {
      answer:
        "I searched the library for that, and the books on this machine do not answer it. I will not invent law. " +
        LAW_HONESTY_LINE,
      citations: [],
      lawShelfLanded,
      mode: "none",
    };
  }

  const citations: LawCitation[] = [];
  const excerpts: string[] = [];
  for (const result of ranked) {
    const book = booksById.get(result.bookId);
    const bookTitle = book?.title || result.bookId;
    const articleUrl =
      `http://local/api/library/article?book=${encodeURIComponent(result.bookId)}` +
      `&path=${encodeURIComponent(result.path)}`;
    try {
      const articleResponse = await forwardLibraryArticle(new Request(articleUrl), fetchFn);
      if (!articleResponse.ok) continue;
      const articleBody = (await articleResponse.json()) as {
        article?: { title?: string; html?: string };
      };
      const text = htmlToText(articleBody.article?.html ?? "").slice(0, 2200);
      if (!text) continue;
      const articleTitle = articleBody.article?.title || result.title;
      citations.push({ bookTitle, articleTitle });
      excerpts.push(`[${bookTitle} — ${articleTitle}]\n${text}`);
    } catch {
      // A single unreadable article never sinks the desk.
    }
  }
  if (excerpts.length === 0) {
    return {
      answer:
        "The search found matches, but I could not open their pages to read them. I will not answer from titles alone. " +
        LAW_HONESTY_LINE,
      citations: [],
      lawShelfLanded,
      mode: "none",
    };
  }

  const context = excerpts.join("\n\n");
  const brainAnswer = await askBrain(question, context, fetchFn, env);
  if (brainAnswer) {
    return { answer: brainAnswer, citations, lawShelfLanded, mode: "brain" };
  }
  return {
    answer:
      excerpts.map((excerpt) => excerpt.slice(0, 700)).join("\n\n") + `\n\n${LAW_HONESTY_LINE}`,
    citations,
    lawShelfLanded,
    mode: "excerpt",
  };
}

export const askLawDesk = createServerFn({ method: "POST" })
  .validator((input: unknown): LawInput => {
    if (!isLawInput(input)) {
      throw new Error("Invalid law desk request.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<LawAnswer> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) {
      return { authorized: false, answer: "", citations: [], lawShelfLanded: false, mode: "unauthorized" };
    }
    const result = await answerLawQuestion(data.question.trim());
    return { authorized: true, ...result };
  });
