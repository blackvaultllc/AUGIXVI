/**
 * OPERATOR MEMORY — real memory that sticks (owner order 2026-11-10).
 * Osiris remembers the operator, family, deals, and the last conversation —
 * offline-first in localStorage. The Supabase write slot stays EMPTY until
 * the Nov 13 merge (sync hook provided, deliberately a no-op now).
 */
import type { LocalMemoryRecord } from "./localMemory";

export const OPERATOR_MEMORY_KEY = "augi.osiris.operator-memory.v1";
export const OPERATOR_MEMORY_MAX = 120;

export type OperatorFactCategory =
  "identity" | "family" | "deal" | "preference" | "commitment" | "conversation";

export type OperatorFact = {
  id: string;
  category: OperatorFactCategory;
  /** "remember my daughter's name is X" → content "daughter's name is X" */
  content: string;
  createdAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function isFact(value: unknown): value is OperatorFact {
  if (!value || typeof value !== "object") return false;
  const fact = value as Partial<OperatorFact>;
  return (
    typeof fact.id === "string" &&
    typeof fact.category === "string" &&
    ["identity", "family", "deal", "preference", "commitment", "conversation"].includes(
      fact.category,
    ) &&
    typeof fact.content === "string" &&
    typeof fact.createdAt === "string"
  );
}

export function createOperatorFact(
  text: string,
  category: OperatorFactCategory = "conversation",
  now: Date = new Date(),
): OperatorFact {
  return {
    id: `fact-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    category,
    content: text.trim().slice(0, 600),
    createdAt: now.toISOString(),
  };
}

/** Phrases that mean "store this about me". */
export function parseRememberRequest(text: string): { content: string } | null {
  const match = text.match(/^(?:please\s+)?remember(?:\s+(?:that|this))?\s*[:,]?\s*([\s\S]+)$/i);
  return match ? { content: match[1]!.trim() } : null;
}

/** Classify a remembered statement by its leading noun pattern. */
export function classifyFact(content: string): OperatorFactCategory {
  const lower = content.toLowerCase();
  if (/\b(my name|i am|call me)\b/.test(lower)) return "identity";
  if (/\b(daughter|son|wife|husband|mother|father|sister|brother|family|kid)\b/.test(lower))
    return "family";
  if (/\b(deal|client|contract|invoice|buyer|offer|quote)\b/.test(lower)) return "deal";
  if (/\b(i (?:like|prefer|love|hate|always|never)|favorite)\b/.test(lower)) return "preference";
  if (/\b(i will|tomorrow|next week|deadline|promised)\b/.test(lower)) return "commitment";
  return "conversation";
}

export function createOperatorMemory(storage?: StorageLike) {
  const getStorage = () => storage ?? globalThis.localStorage;

  const list = (): OperatorFact[] => {
    try {
      const raw = getStorage().getItem(OPERATOR_MEMORY_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isFact) : [];
    } catch {
      return [];
    }
  };

  const save = (fact: OperatorFact): number => {
    const next = [
      ...list().filter((f) => f.content.toLowerCase() !== fact.content.toLowerCase()),
      fact,
    ].slice(-OPERATOR_MEMORY_MAX);
    try {
      getStorage().setItem(OPERATOR_MEMORY_KEY, JSON.stringify(next));
    } catch {
      /* storage refused; keep in-session only */
    }
    return next.length;
  };

  /** Keyword recall: what Osiris pulls up when a relevant topic appears. */
  const recall = (query: string, limit = 3): OperatorFact[] => {
    const terms = query
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2);
    if (!terms.length) return [];
    return list()
      .map((fact) => {
        const haystack = fact.content.toLowerCase();
        const score = terms.filter((term) => haystack.includes(term)).length;
        return { fact, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || b.fact.createdAt.localeCompare(a.fact.createdAt))
      .slice(0, limit)
      .map((entry) => entry.fact);
  };

  /** Prompt block: what the brain sees at the top of every conversation. */
  const asPrompt = (): string => {
    const facts = list();
    if (!facts.length) return "";
    const recent = facts.slice(-10).map((fact) => `- (${fact.category}) ${fact.content}`);
    return `\n[WHAT YOU REMEMBER ABOUT YOUR OPERATOR — use it, never ask twice]\n${recent.join("\n")}\n`;
  };

  /** Nov 13 merge slot — stays a no-op until the Supabase table exists. */
  const syncToSupabase = async (): Promise<{ written: number }> => ({ written: 0 });

  return { list, save, recall, asPrompt, syncToSupabase };
}

/** Convert operator facts into memory records so Knowledge can export them too. */
export function toMemoryRecords(facts: OperatorFact[]): LocalMemoryRecord[] {
  return facts.map((fact) => ({
    id: fact.id,
    kind: "highlight" as const,
    title: fact.content.slice(0, 200),
    content: fact.content,
    source: `operator memory · ${fact.category}`,
    createdAt: fact.createdAt,
  }));
}
