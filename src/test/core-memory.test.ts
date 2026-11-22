import { describe, expect, it } from "vitest";
import {
  createCoreExchange,
  extractFacts,
  parseCoreMemory,
  recallCoreMemory,
  serializeCoreRecord,
  type CoreRecord,
} from "@/avatar/coreMemory";

const now = new Date("2026-11-22T10:00:00.000Z");

describe("core memory records", () => {
  it("round-trips through JSONL and skips torn lines", () => {
    const exchange = createCoreExchange({
      question: "remember my call sign is Captain",
      answer: "Kept.",
      provider: "Ollama",
      surface: "stage",
      now,
      id: "ex-1",
    });
    const text = `${serializeCoreRecord(exchange)}{"torn\nnot json\n`;
    const parsed = parseCoreMemory(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual(exchange);
  });

  it("extracts a linked fact from an explicit remember statement only", () => {
    const exchange = createCoreExchange({
      question: "remember my daughter's name is Khadija",
      answer: "Kept.",
      provider: "Ollama",
      surface: "phone",
      now,
      id: "ex-2",
    });
    const facts = extractFacts(exchange);
    expect(facts).toHaveLength(1);
    expect(facts[0]!.category).toBe("family");
    expect(facts[0]!.content).toContain("Khadija");
    expect(facts[0]!.sourceExchangeId).toBe("ex-2");

    const smallTalk = createCoreExchange({
      question: "what time is it",
      answer: "Ten.",
      provider: "Ollama",
      surface: "phone",
      now,
      id: "ex-3",
    });
    expect(extractFacts(smallTalk)).toEqual([]);
  });

  it("recalls facts before exchanges and never invents a match", () => {
    const exchange = createCoreExchange({
      question: "remember my daughter's name is Khadija",
      answer: "Kept. I will remember that your daughter's name is Khadija.",
      provider: "Ollama",
      surface: "stage",
      now,
      id: "ex-4",
    });
    const records: CoreRecord[] = [exchange, ...extractFacts(exchange)];
    const hits = recallCoreMemory(records, "what is my daughter's name");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.kind).toBe("fact");
    expect(recallCoreMemory(records, "quantum chromodynamics lecture")).toEqual([]);
  });
});
