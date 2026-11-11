/**
 * THE BOOK OF SECRETS — Anubis's grimoire (owner order).
 * Operator-only, ENCRYPTED at rest with a key derived from the operator
 * session — never in client code, never public, never in the repo. Anubis
 * writes; Osiris keeps and learns from it.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

type RequestWithCloudflareEnv = Request & {
  runtime?: { cloudflare?: { env?: Record<string, unknown> } };
};

type BookPage = { id: string; title: string; body: string; written: number };

type Binding = {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => { fetch: (request: Request) => Promise<Response> };
};

function getBinding(): Binding | null {
  const request = getRequest() as RequestWithCloudflareEnv;
  const binding: unknown = request.runtime?.cloudflare?.env?.["OSIRIS_BOOK_OF_SECRETS"];
  if (typeof binding !== "object" || binding === null || !("idFromName" in binding)) return null;
  return binding as Binding;
}

function getOperatorToken(): string | null {
  return (
    getRequest()
      .headers.get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() || null
  );
}

async function deriveKey(token: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 150_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPages(
  key: CryptoKey,
  pages: BookPage[],
): Promise<{ iv: string; payload: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(pages)),
  );
  return {
    iv: btoa(String.fromCharCode(...iv)),
    payload: btoa(String.fromCharCode(...new Uint8Array(payload))),
  };
}

async function decryptPages(
  key: CryptoKey,
  blob: { iv: string; payload: string },
): Promise<BookPage[]> {
  const iv = Uint8Array.from(atob(blob.iv), (c) => c.charCodeAt(0));
  const bytes = Uint8Array.from(atob(blob.payload), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, bytes);
  return JSON.parse(new TextDecoder().decode(plain)) as BookPage[];
}

async function readBook(token: string): Promise<BookPage[] | null> {
  const binding = getBinding();
  if (!binding) return null;
  const id = binding.idFromName("grimoire");
  const stub = binding.get(id);
  const res = await stub.fetch(
    new Request("https://book/read", { headers: { Authorization: `Bearer ${token}` } }),
  );
  if (!res.ok) return null;
  const blob = (await res.json()) as { iv: string; payload: string } | null;
  if (!blob) return [];
  const salt = new TextEncoder().encode("augi-grimoire-v1");
  return decryptPages(await deriveKey(token, salt), blob);
}

async function writeBook(token: string, pages: BookPage[]): Promise<boolean> {
  const binding = getBinding();
  if (!binding) return false;
  const salt = new TextEncoder().encode("augi-grimoire-v1");
  const encrypted = await encryptPages(await deriveKey(token, salt), pages);
  const id = binding.idFromName("grimoire");
  const stub = binding.get(id);
  const res = await stub.fetch(
    new Request("https://book/write", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(encrypted),
    }),
  );
  return res.ok;
}

/** "write this in the Book of Secrets: <text>" — operator only. */
export const writeSecret = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { title?: string; body?: string }).body !== "string"
    ) {
      throw new Error("Invalid secret entry");
    }
    const i = input as { title?: string; body?: string };
    return {
      title: (i.title ?? "Untitled secret").slice(0, 120),
      body: (i.body as string).slice(0, 8000),
    };
  })
  .handler(async ({ data }): Promise<{ ok: boolean; error: string | null }> => {
    const token = getOperatorToken();
    if (!token) return { ok: false, error: "The Book opens for Anubis only." };
    const pages = (await readBook(token)) ?? [];
    pages.unshift({
      id: `p-${Date.now()}`,
      title: data.title,
      body: data.body,
      written: Date.now(),
    });
    const ok = await writeBook(token, pages.slice(0, 500));
    return { ok, error: ok ? null : "The Book's vault binding is not configured." };
  });

/** "open the Book" — operator only, decrypted in memory only. */
export const readSecrets = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ pages: BookPage[]; error: string | null }> => {
    const token = getOperatorToken();
    if (!token) return { pages: [], error: "The Book opens for Anubis only." };
    const pages = await readBook(token);
    if (pages === null)
      return {
        pages: [],
        error: "The Book's vault binding is not configured (OSIRIS_BOOK_OF_SECRETS).",
      };
    return { pages, error: null };
  },
);
