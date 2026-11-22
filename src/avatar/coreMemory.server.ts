/**
 * CORE MEMORY — operator-gated endpoints (Part 30).
 *
 * The core's memory is the operator's memory: every endpoint re-verifies
 * the operator session (verifySupabaseOperatorSession — registry
 * ownership plus MFA assurance, the same check the gate log uses)
 * before a single record is written or read. Anything unverified gets
 * authorized:false and nothing moves.
 *
 * Where the store does not exist (the Cloudflare Worker — no local
 * filesystem), the view says available:false, which the client renders
 * as NOT CONFIGURED. The status is earned by a real round trip, never
 * painted on.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import {
  createCoreExchange,
  extractFacts,
  recallCoreMemory,
  type CoreRecord,
} from "./coreMemory";
import { appendCoreRecords, readCoreRecords } from "./coreMemoryStore.server";

type TokenInput = { accessToken: string };

function isTokenInput(input: unknown): input is TokenInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "accessToken" in input &&
    typeof (input as TokenInput).accessToken === "string" &&
    (input as TokenInput).accessToken.length > 0 &&
    (input as TokenInput).accessToken.length <= 16_384
  );
}

async function authorize(accessToken: string): Promise<{ configured: boolean; authorized: boolean }> {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return { configured: verification.configured, authorized: verification.authorized };
}

export interface CoreStatusView {
  configured: boolean;
  authorized: boolean;
  /** False where the core store does not exist (e.g. the Worker). */
  available: boolean;
  exchanges: number;
  facts: number;
  lastWriteAt: string | null;
}

export const getCoreStatus = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid core status request.");
    return input;
  })
  .handler(async ({ data }): Promise<CoreStatusView> => {
    const auth = await authorize(data.accessToken);
    if (!auth.authorized) {
      return { ...auth, available: false, exchanges: 0, facts: 0, lastWriteAt: null };
    }
    const { available, records } = await readCoreRecords();
    if (!available) {
      return { configured: true, authorized: true, available: false, exchanges: 0, facts: 0, lastWriteAt: null };
    }
    const exchanges = records.filter((r) => r.kind === "exchange").length;
    const facts = records.filter((r) => r.kind === "fact").length;
    const lastWriteAt = records.length ? records[records.length - 1]!.at : null;
    return { configured: true, authorized: true, available: true, exchanges, facts, lastWriteAt };
  });

export type AppendExchangeInput = TokenInput & {
  question: string;
  answer: string;
  provider: string;
  surface: string;
  /** Client-generated id so a retried flush never double-writes. */
  exchangeId?: string;
};

export interface AppendExchangeView {
  configured: boolean;
  authorized: boolean;
  available: boolean;
  /** True when this call wrote the record; false when it was already there. */
  written: boolean;
  factsWritten: number;
}

export const appendCoreExchange = createServerFn({ method: "POST" })
  .validator((input: unknown): AppendExchangeInput => {
    if (!isTokenInput(input)) throw new Error("Invalid core append request.");
    const d = input as AppendExchangeInput;
    if (
      typeof d.question !== "string" ||
      typeof d.answer !== "string" ||
      typeof d.provider !== "string" ||
      typeof d.surface !== "string"
    ) {
      throw new Error("Invalid core append request.");
    }
    return {
      accessToken: d.accessToken,
      question: d.question.slice(0, 4_000),
      answer: d.answer.slice(0, 30_000),
      provider: d.provider.slice(0, 120),
      surface: d.surface.slice(0, 60),
      ...(typeof d.exchangeId === "string" ? { exchangeId: d.exchangeId.slice(0, 80) } : {}),
    };
  })
  .handler(async ({ data }): Promise<AppendExchangeView> => {
    const auth = await authorize(data.accessToken);
    if (!auth.authorized) {
      return { ...auth, available: false, written: false, factsWritten: 0 };
    }
    const exchange = createCoreExchange({
      question: data.question,
      answer: data.answer,
      provider: data.provider,
      surface: data.surface,
      ...(data.exchangeId ? { id: data.exchangeId } : {}),
    });
    if (data.exchangeId) {
      const { available, records } = await readCoreRecords();
      if (!available) {
        return { configured: true, authorized: true, available: false, written: false, factsWritten: 0 };
      }
      if (records.some((r) => r.id === data.exchangeId)) {
        return { configured: true, authorized: true, available: true, written: false, factsWritten: 0 };
      }
    }
    const facts = extractFacts(exchange);
    const ok = await appendCoreRecords([exchange, ...facts]);
    return {
      configured: true,
      authorized: true,
      available: ok,
      written: ok,
      factsWritten: ok ? facts.length : 0,
    };
  });

export type RecallInput = TokenInput & { query: string };

export interface RecallView {
  configured: boolean;
  authorized: boolean;
  available: boolean;
  records: CoreRecord[];
}

export const recallCore = createServerFn({ method: "POST" })
  .validator((input: unknown): RecallInput => {
    if (!isTokenInput(input)) throw new Error("Invalid core recall request.");
    const d = input as RecallInput;
    if (typeof d.query !== "string") throw new Error("Invalid core recall request.");
    return { accessToken: d.accessToken, query: d.query.slice(0, 2_000) };
  })
  .handler(async ({ data }): Promise<RecallView> => {
    const auth = await authorize(data.accessToken);
    if (!auth.authorized) {
      return { ...auth, available: false, records: [] };
    }
    const { available, records } = await readCoreRecords();
    if (!available) {
      return { configured: true, authorized: true, available: false, records: [] };
    }
    return {
      configured: true,
      authorized: true,
      available: true,
      records: recallCoreMemory(records, data.query),
    };
  });

export type FactListInput = TokenInput;

export interface FactListView {
  configured: boolean;
  authorized: boolean;
  available: boolean;
  facts: {
    category: import("./operatorMemory").OperatorFactCategory;
    content: string;
    at: string;
    sourceExchangeId: string;
  }[];
}

/** Every fact in the core — the sync-down source for a fresh surface. */
export const listCoreFacts = createServerFn({ method: "POST" })
  .validator((input: unknown): FactListInput => {
    if (!isTokenInput(input)) throw new Error("Invalid core facts request.");
    return input;
  })
  .handler(async ({ data }): Promise<FactListView> => {
    const auth = await authorize(data.accessToken);
    if (!auth.authorized) return { ...auth, available: false, facts: [] };
    const { available, records } = await readCoreRecords();
    if (!available) return { configured: true, authorized: true, available: false, facts: [] };
    return {
      configured: true,
      authorized: true,
      available: true,
      facts: records
        .filter((r) => r.kind === "fact")
        .map((r) => ({
          category: r.category,
          content: r.content,
          at: r.at,
          sourceExchangeId: r.sourceExchangeId,
        })),
    };
  });
