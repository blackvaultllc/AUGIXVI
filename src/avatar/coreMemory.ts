/**
 * CORE MEMORY — the durable memory store on the operator's core machine
 * (Part 30, operator order 2026-11-21).
 *
 * The phone is a face; the core is the memory. Every surface the operator
 * talks to Augie from appends its exchanges HERE — on the Parrot's disk,
 * in the same protected directory as the operator registry and the gate
 * log — so a conversation survives the device, the browser, and the app
 * restart. Facts are extracted from exchanges (explicit "remember …"
 * statements, classified by the operator-memory rules) and LINKED back to
 * the exchange they came from.
 *
 * This module is the pure part: record shapes, JSONL shaping, recall.
 * The file store lives in coreMemoryStore.server.ts; the operator-gated
 * endpoints live in coreMemory.server.ts. Plain TS, unit-testable.
 */
import { classifyFact, createOperatorFact, parseRememberRequest } from "./operatorMemory";
import type { OperatorFactCategory } from "./operatorMemory";

export type CoreExchange = {
  kind: "exchange";
  id: string;
  at: string;
  /** Which surface the exchange happened on (stage, phone, test-area…). */
  surface: string;
  question: string;
  answer: string;
  /** The provider/source that actually answered — named, never hidden. */
  provider: string;
};

export type CoreFact = {
  kind: "fact";
  id: string;
  at: string;
  category: OperatorFactCategory;
  content: string;
  /** The exchange this fact was extracted from — the link. */
  sourceExchangeId: string;
};

export type CoreRecord = CoreExchange | CoreFact;

export const CORE_MEMORY_MAX_QUESTION = 2_000;
export const CORE_MEMORY_MAX_ANSWER = 24_000;

function isExchange(value: unknown): value is CoreExchange {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<CoreExchange>;
  return (
    r.kind === "exchange" &&
    typeof r.id === "string" &&
    typeof r.at === "string" &&
    typeof r.surface === "string" &&
    typeof r.question === "string" &&
    typeof r.answer === "string" &&
    typeof r.provider === "string"
  );
}

function isFact(value: unknown): value is CoreFact {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<CoreFact>;
  return (
    r.kind === "fact" &&
    typeof r.id === "string" &&
    typeof r.at === "string" &&
    typeof r.category === "string" &&
    typeof r.content === "string" &&
    typeof r.sourceExchangeId === "string"
  );
}

export function isCoreRecord(value: unknown): value is CoreRecord {
  return isExchange(value) || isFact(value);
}

/** One JSONL line → one record, or null when the line is torn/foreign. */
export function parseCoreMemoryLine(line: string): CoreRecord | null {
  try {
    const parsed: unknown = JSON.parse(line);
    return isCoreRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseCoreMemory(text: string): CoreRecord[] {
  return text
    .split("\n")
    .map((line) => parseCoreMemoryLine(line))
    .filter((r): r is CoreRecord => r !== null);
}

export function serializeCoreRecord(record: CoreRecord): string {
  return `${JSON.stringify(record)}\n`;
}

export function createCoreExchange(input: {
  question: string;
  answer: string;
  provider: string;
  surface: string;
  now?: Date;
  id?: string;
}): CoreExchange {
  const now = input.now ?? new Date();
  return {
    kind: "exchange",
    id:
      input.id ??
      `ex-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    at: now.toISOString(),
    surface: input.surface.slice(0, 60),
    question: input.question.trim().slice(0, CORE_MEMORY_MAX_QUESTION),
    answer: input.answer.trim().slice(0, CORE_MEMORY_MAX_ANSWER),
    provider: input.provider.slice(0, 80) || "unknown",
  };
}

/**
 * Fact extraction from one exchange. Deliberately conservative: only an
 * explicit "remember …" statement in the operator's own words becomes a
 * fact — Augie never invents facts out of small talk. The fact links
 * back to its exchange.
 */
export function extractFacts(exchange: CoreExchange): CoreFact[] {
  const remember = parseRememberRequest(exchange.question);
  if (!remember) return [];
  const fact = createOperatorFact(remember.content, classifyFact(remember.content), new Date(exchange.at));
  return [
    {
      kind: "fact",
      id: fact.id.replace(/^fact-/, "corefact-"),
      at: exchange.at,
      category: fact.category,
      content: fact.content,
      sourceExchangeId: exchange.id,
    },
  ];
}

function normalize(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Recall: facts first (they are the distilled memory), then exchanges
 * whose question/answer overlap the query. Deterministic, no embeddings,
 * nothing invented — a record either matches on its own words or it
 * does not come back.
 */
export function recallCoreMemory(
  records: CoreRecord[],
  query: string,
  limit = 5,
): CoreRecord[] {
  const terms = normalize(query)
    .split(" ")
    .filter((term) => term.length > 2);
  if (terms.length === 0) return [];
  const scored = records
    .map((record) => {
      const haystack = normalize(
        record.kind === "fact" ? record.content : `${record.question} ${record.answer}`,
      );
      const hits = terms.filter((term) => haystack.includes(term)).length;
      return { record, score: hits / terms.length, hits };
    })
    .filter((entry) => entry.hits > 0 && entry.score >= 0.34);
  scored.sort((a, b) => {
    const kindScore = (r: CoreRecord) => (r.kind === "fact" ? 1 : 0);
    return (
      b.score - a.score ||
      kindScore(b.record) - kindScore(a.record) ||
      b.record.at.localeCompare(a.record.at)
    );
  });
  return scored.slice(0, limit).map((entry) => entry.record);
}
