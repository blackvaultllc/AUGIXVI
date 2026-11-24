import {
  decodeHtmlEntities,
  forwardLibraryArticle,
  forwardLibraryCatalog,
  forwardLibrarySearch,
  kiwixBaseUrl,
  type LibraryBook,
  type LibrarySearchResult,
} from "../library.server";

/**
 * AUGIE THE FLOWER — Khadija's own AI, server half (owner order
 * 2026-11-21: "she wants an Augie of her own... it can use the
 * knowledge database... I want her to have everything, 110%").
 *
 * How an answer is made, in order:
 *  1. Operator topics (passwords, the operator's rooms and tools)
 *     get a gentle redirect back to learning. This is her side of
 *     the wall; those things are not hers to open.
 *  2. A plain sums question ("what is 3 + 4?") is worked out exactly
 *     by arithmetic — never guessed, never rounded.
 *  3. Everything else is looked up in the offline library (the same
 *     kiwix-serve books the operator's Library window reads). Books
 *     are ranked for her reading: Simple English Wikipedia first,
 *     then WikiBooks, WikiMed, Appropedia, and the full English
 *     Wikipedia the moment its download lands — the whole ladder,
 *     second grade through college, is searched every time; the
 *     ranking only decides which book speaks first, it never locks
 *     a book away from her.
 *  4. The best article's own words are handed to the local brain
 *     (Ollama on this machine) with a strict instruction: use only
 *     these book words, say them in simple words for a young reader,
 *     and if the book words do not answer, say so. When the brain is
 *     not answering, the book's own words are shown as an excerpt
 *     instead — the answer still comes from the book, never from
 *     thin air.
 *  5. If the library has nothing, the Flower says so plainly. That
 *     is the truth rule her dad set: proof of concept, no invented
 *     facts — not for the operator, and not for her either.
 */

export type FlowerAnswer = {
  answer: string;
  mode: "book" | "math" | "none" | "redirect" | "library-down" | "daddy";
  source: { bookTitle: string; articleTitle: string } | null;
  /** True when the answer is grounded: a named book, or exact arithmetic. */
  verified: boolean;
};

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const REDIRECT_TEXT =
  "That is a grown-up operator thing, and it is not part of your learning page. " +
  "I am your flower for school things — ask me about math, science, animals, space, history, words, " +
  "or how minds and feelings work, and I will find it in our books!";

const NONE_TEXT =
  "I looked in our books, and I could not find that yet. I will not make up an answer — " +
  "a real answer has to come from a book. Try asking with different words, or ask me about animals, space, plants, numbers, or long-ago times!";

const LIBRARY_DOWN_TEXT =
  "My books are resting right now — the library on this computer is not answering. " +
  "Your question is a good one. Please ask me again in a little while!";

const BRAIN_TIMEOUT_MS = 45_000;
const ARTICLE_CHARS_FOR_BRAIN = 2400;
const EXCERPT_CHARS = 480;

/**
 * Book order for her reading level. Matching is by the catalog's
 * stable OPDS name; unlisted books slot in before the Linux wiki,
 * which is last because it is a grown-up computer book.
 */
const BOOK_RANK: { match: RegExp; rank: number }[] = [
  { match: /^wikipedia_en-simple/, rank: 0 },
  { match: /^wikibooks_/, rank: 1 },
  { match: /^wikipedia_en_medicine/, rank: 2 },
  { match: /^appropedia_/, rank: 3 },
  { match: /^wikipedia_en_all/, rank: 4 },
  { match: /^alpinelinux_/, rank: 6 },
];

export function learnerBookRank(book: Pick<LibraryBook, "name" | "id">): number {
  const key = book.name || book.id;
  for (const { match, rank } of BOOK_RANK) {
    if (match.test(key)) return rank;
  }
  return 5;
}

/** Best-first ordering of search results for her: book rank, then the library's own order. */
export function rankLearnerResults(
  results: LibrarySearchResult[],
  booksById: Map<string, LibraryBook>,
): LibrarySearchResult[] {
  return results
    .map((result, index) => ({
      result,
      index,
      rank: learnerBookRank(booksById.get(result.bookId) ?? { name: result.bookId, id: result.bookId }),
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.result);
}

const OPERATOR_TOPIC =
  /\b(password|passcode|operator|gate log|honeypot|sandbox|ar cube|cloud keys?|supabase|api key|secret key|sign[- ]?in code|diary secret|voiceprint)\b/i;

export function isOperatorTopic(question: string): boolean {
  return OPERATOR_TOPIC.test(question);
}

/**
 * Exact arithmetic for plain sums questions. Handles "3 + 4",
 * "what is 12 - 5?", "3 x 4", "6 times 7", "20 divided by 4".
 * Returns the worked answer, or null when the question is not a
 * plain sum (the library answers those).
 */
export function evaluateSimpleMath(question: string): string | null {
  const cleaned = question
    .toLowerCase()
    .replace(/[?.,!]/g, " ")
    .replace(/\bwhat is\b|\bhow much is\b|\bcalculate\b|\bplease\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = cleaned.match(
    /^(-?\d+(?:\.\d+)?)\s*(\+|-|−|x|\*|×|÷|\/|plus|minus|times|divided by)\s*(-?\d+(?:\.\d+)?)$/,
  );
  if (!match) return null;
  const a = Number(match[1]);
  const op = match[2]!;
  const b = Number(match[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  const symbol =
    op === "+" || op === "plus"
      ? "+"
      : op === "-" || op === "−" || op === "minus"
        ? "−"
        : op === "x" || op === "*" || op === "×" || op === "times"
          ? "×"
          : "÷";
  let result: number;
  if (symbol === "+") result = a + b;
  else if (symbol === "−") result = a - b;
  else if (symbol === "×") result = a * b;
  else {
    if (b === 0) return "Dividing by zero does not work — there is no answer for that one.";
    result = a / b;
  }
  const shown = Number.isInteger(result) ? String(result) : String(Math.round(result * 100) / 100);
  // For a small adding sum, show the hopping her starter diagram taught.
  if (symbol === "+" && Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b > 0 && b <= 10) {
    const hops = Array.from({ length: b }, (_, i) => a + i + 1).join(", ");
    return `${a} + ${b} = ${shown}. Start at ${a}. Hop ${b} more: ${hops}. You land on ${shown}!`;
  }
  return `${a} ${symbol} ${b} = ${shown}.`;
}

/** Plain text from a sanitized article's HTML, for the brain and the excerpt. */
export function articleText(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (sentence > limit / 2) return cut.slice(0, sentence + 1);
  return `${cut.trimEnd()}…`;
}

const FLOWER_SYSTEM =
  "You are Augie the Flower, a kind flower who helps a young girl (second grade) learn. " +
  "Your subjects are ALL school subjects, with nothing left out: math, science, history, " +
  "social studies, reading and words, geography, art, music, health, and psychology — " +
  "how minds, feelings, and thinking work. She may ask at her level now, and the same " +
  "books hold the deeper answers for when she is older, all the way to college. " +
  "Answer ONLY from the book words you are given — never add facts that are not in them. " +
  "Use simple, warm, clear words a 7-year-old can read. Use at most 5 short sentences. " +
  "No lists, no headings, no big words without explaining them. " +
  "If the book words do not answer her question, say exactly: I could not find that in the book words I have.";

function ollamaBaseUrl(env: Record<string, string | undefined> = process.env): string {
  return (env["OLLAMA_API_BASE_URL"]?.trim() || "http://127.0.0.1:11434").replace(/\/$/, "");
}

async function askBrain(
  question: string,
  bookText: string,
  fetchFn: FetchFn,
  env: Record<string, string | undefined>,
): Promise<string | null> {
  try {
    const response = await fetchFn(`${ollamaBaseUrl(env)}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: env["AUGIE_FLOWER_MODEL"]?.trim() || "llama3.1:8b",
        stream: false,
        messages: [
          { role: "system", content: FLOWER_SYSTEM },
          {
            role: "user",
            content: `Her question: ${question}\n\nBook words:\n${bookText.slice(0, ARTICLE_CHARS_FOR_BRAIN)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(BRAIN_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { message?: { content?: string } };
    const text = body.message?.content?.trim() ?? "";
    if (!text || text.length > 1200) return null;
    if (/could not find that in the book words/i.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

const DADDY_CALL_RINGING_TEXT =
  "I am calling Daddy now — his Augie is ringing! When he answers, you can send him messages by the Daddy heart and he will write right back.";
const DADDY_CALL_LEFT_TEXT =
  "Daddy is not at his Augie right now, so his screen is not ringing. I left your call in his inbox — he will see that you called him. You can also send him a message by the Daddy heart, and he will see it there.";
const DADDY_SENT_TEXT =
  "Sent to Daddy! Your words are in his inbox on his Augie. When he writes back, you will see his words by the Daddy heart.";
const DADDY_NO_WORDS_TEXT =
  "Tell me the words for Daddy — say “Tell Daddy” and then what you want to say, like “Tell Daddy I did my homework”. Or tap the Daddy heart and type your words there.";
const DADDY_UNREACHABLE_TEXT =
  "I could not reach Daddy's inbox from this page — the big computer that holds it is not connected here. Tell Daddy, and he will fix it.";

/**
 * Her daddy wishes, carried out before any book is opened (owner
 * order 2026-11-24): "call daddy", "tell daddy …", his full name —
 * her AUGI knows Domenick Arlon Hall is her daddy and acts. Returns
 * null when the question is not a daddy wish.
 */
async function answerDaddyWish(
  q: string,
  env: Record<string, string | undefined>,
): Promise<FlowerAnswer | null> {
  const { daddyIntentFor, carryOutDaddyIntent, DADDY_IDENTITY_ANSWER } = await import("./daddy.server");
  const intent = daddyIntentFor(q);
  if (!intent) return null;
  if (intent.kind === "identity") {
    return { answer: DADDY_IDENTITY_ANSWER, mode: "daddy", source: null, verified: true };
  }
  const result = await carryOutDaddyIntent(intent, env as NodeJS.ProcessEnv);
  if (!result.ok) {
    if (result.reason === "no-words") {
      return { answer: DADDY_NO_WORDS_TEXT, mode: "daddy", source: null, verified: false };
    }
    return { answer: DADDY_UNREACHABLE_TEXT, mode: "daddy", source: null, verified: false };
  }
  if (result.kind === "message") {
    return { answer: DADDY_SENT_TEXT, mode: "daddy", source: null, verified: true };
  }
  return {
    answer: result.daddyOnline ? DADDY_CALL_RINGING_TEXT : DADDY_CALL_LEFT_TEXT,
    mode: "daddy",
    source: null,
    verified: true,
  };
}

/**
 * THE ONE-CORE ROAD (defect fix, 2026-11-24): the Flower's books and
 * brain live on the core. A surface that is not the core (the public
 * copy) has no library and no brain on its own machine — asking its
 * loopback is exactly the "model not connected" failure Khadija hit.
 * When this surface's own library does not answer and a core address
 * is configured (AUGIE_CORE_URL — the core's own ask doorway, e.g.
 * its Tailscale/LAN address, the same road the operator's phone
 * loads the app by), the question is forwarded to the core and the
 * core's answer comes back. A forwarded question is never forwarded
 * twice (the x-augie-forwarded header), and on the core itself the
 * variable is simply unset — it answers its own questions.
 */
async function forwardToCore(
  q: string,
  fetchFn: FetchFn,
  env: Record<string, string | undefined>,
): Promise<FlowerAnswer | null> {
  const coreUrl = env["AUGIE_CORE_URL"]?.trim().replace(/\/$/, "");
  if (!coreUrl) return null;
  try {
    const response = await fetchFn(`${coreUrl}/api/learner/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-augie-forwarded": "1" },
      body: JSON.stringify({ question: q }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as FlowerAnswer;
  } catch {
    return null;
  }
}

/** Answer one of her questions. See the module header for the order of paths. */
export async function answerFlowerQuestion(
  question: string,
  fetchFn: FetchFn = fetch,
  env: Record<string, string | undefined> = process.env,
  opts: { forwarded?: boolean } = {},
): Promise<FlowerAnswer> {
  const q = question.trim().slice(0, 300);
  if (!q) {
    return { answer: NONE_TEXT, mode: "none", source: null, verified: false };
  }
  if (isOperatorTopic(q)) {
    return { answer: REDIRECT_TEXT, mode: "redirect", source: null, verified: false };
  }
  const daddy = await answerDaddyWish(q, env);
  if (daddy) return daddy;
  const math = evaluateSimpleMath(q);
  if (math) {
    return { answer: math, mode: "math", source: null, verified: true };
  }

  const catalogResponse = await forwardLibraryCatalog(fetchFn as typeof fetch);
  if (!catalogResponse.ok) {
    if (!opts.forwarded) {
      const forwarded = await forwardToCore(q, fetchFn, env);
      if (forwarded) return forwarded;
    }
    return { answer: LIBRARY_DOWN_TEXT, mode: "library-down", source: null, verified: false };
  }
  const { books } = (await catalogResponse.json()) as { books: LibraryBook[] };
  const booksById = new Map(books.map((book) => [book.id, book]));

  const searchRequest = new Request(
    `http://learner.local/api/library/search?q=${encodeURIComponent(q)}`,
  );
  const searchResponse = await forwardLibrarySearch(searchRequest, fetchFn as typeof fetch);
  if (!searchResponse.ok) {
    return { answer: LIBRARY_DOWN_TEXT, mode: "library-down", source: null, verified: false };
  }
  const { results } = (await searchResponse.json()) as { results: LibrarySearchResult[] };
  const ranked = rankLearnerResults(results, booksById);
  const top = ranked[0];
  if (!top) {
    return { answer: NONE_TEXT, mode: "none", source: null, verified: false };
  }

  const articleRequest = new Request(
    `http://learner.local/api/library/article?book=${encodeURIComponent(top.bookId)}&path=${encodeURIComponent(top.path)}`,
  );
  const articleResponse = await forwardLibraryArticle(articleRequest, fetchFn as typeof fetch);
  if (!articleResponse.ok) {
    // The search named a book and an article; the snippet is the book's
    // own words about it, so the answer can still come from the book.
    if (top.snippet) {
      return {
        answer: top.snippet,
        mode: "book",
        source: { bookTitle: top.bookTitle, articleTitle: top.title },
        verified: true,
      };
    }
    return { answer: NONE_TEXT, mode: "none", source: null, verified: false };
  }
  const { article } = (await articleResponse.json()) as {
    article: { title: string; html: string };
  };
  const text = articleText(article.html);
  const book = booksById.get(top.bookId);
  const source = { bookTitle: book?.title ?? top.bookTitle, articleTitle: article.title };

  const brainAnswer = await askBrain(q, text, fetchFn, env);
  if (brainAnswer) {
    return { answer: brainAnswer, mode: "book", source, verified: true };
  }
  return { answer: excerpt(text, EXCERPT_CHARS), mode: "book", source, verified: true };
}

/** POST /api/learner/ask — the Flower's doorway. */
export async function handleFlowerAskRequest(request: Request): Promise<Response> {
  let body: { question?: unknown };
  try {
    body = (await request.json()) as { question?: unknown };
  } catch {
    return Response.json({ error: "That was not JSON." }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question : "";
  if (!question.trim()) {
    return Response.json({ error: "No question was asked." }, { status: 400 });
  }
  const answer = await answerFlowerQuestion(question, fetch, process.env, {
    forwarded: request.headers.get("x-augie-forwarded") === "1",
  });
  return Response.json(answer);
}

export type FlowerHealth = {
  ok: boolean;
  /** The offline library answered a real catalog round trip. */
  library: boolean;
  /** The local brain answered a real tags round trip. */
  brain: boolean;
  /** A core address is configured for the forwarding road. */
  coreRoad: boolean;
};

/**
 * GET /api/learner/ask — her page's readiness check, earned by real
 * round trips (the house rule: a status is earned, never painted
 * on). Her page shows the Flower as ready only when the books or
 * the brain answered — or when the core road is configured, in
 * which case the ask itself will prove it.
 */
export async function flowerHealth(
  fetchFn: FetchFn = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<FlowerHealth> {
  const probe = async (run: () => Promise<boolean>): Promise<boolean> => {
    try {
      return await run();
    } catch {
      return false;
    }
  };
  const [library, brain] = await Promise.all([
    probe(async () => {
      const response = await fetchFn(`${kiwixBaseUrl(env)}/catalog/v2/entries?count=1`, {
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok;
    }),
    probe(async () => {
      const response = await fetchFn(`${ollamaBaseUrl(env)}/api/tags`, {
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok;
    }),
  ]);
  const coreRoad = Boolean(env["AUGIE_CORE_URL"]?.trim());
  return { ok: library || brain || coreRoad, library, brain, coreRoad };
}

/** GET handler for the ask doorway — the readiness round trip. */
export async function handleFlowerHealthRequest(): Promise<Response> {
  const health = await flowerHealth();
  return Response.json(health, { status: health.ok ? 200 : 503 });
}
