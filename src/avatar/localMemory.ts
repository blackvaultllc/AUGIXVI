export type LocalMemoryRecord = {
  id: string;
  kind: "highlight" | "document";
  title: string;
  content: string;
  source: string;
  createdAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type MemoryMatch = { record: LocalMemoryRecord; score: number };

const STORAGE_KEY = "augi.osiris.local-memory.v1";
const MAX_RECORDS = 300;
const MAX_RECORD_LENGTH = 24_000;
const MAX_DOCUMENT_LENGTH = 500_000;

function isRecord(value: unknown): value is LocalMemoryRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<LocalMemoryRecord>;
  return (
    typeof record.id === "string" &&
    (record.kind === "highlight" || record.kind === "document") &&
    typeof record.title === "string" &&
    typeof record.content === "string" &&
    typeof record.source === "string" &&
    typeof record.createdAt === "string"
  );
}

function normalize(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createLocalMemory(storageOverride?: StorageLike) {
  const getStorage = () => storageOverride ?? globalThis.localStorage;
  const list = (): LocalMemoryRecord[] => {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isRecord)) {
      throw new Error("Local memory has an invalid format. Export it before replacing it.");
    }
    return parsed;
  };

  const save = (records: LocalMemoryRecord[]): number => {
    if (!records.every(isRecord))
      throw new TypeError("Only valid local memory records can be saved.");
    const next = [...list(), ...records].slice(-MAX_RECORDS);
    getStorage().setItem(STORAGE_KEY, JSON.stringify(next));
    return next.length;
  };

  const search = (query: string): LocalMemoryRecord | null => {
    const terms = normalize(query)
      .split(" ")
      .filter((term) => term.length > 2);
    if (terms.length === 0) return null;
    let best: MemoryMatch | null = null;
    for (const record of list()) {
      const haystack = normalize(`${record.title} ${record.content}`);
      const overlap = terms.filter((term) => haystack.includes(term)).length / terms.length;
      const exactPhrase = haystack.includes(normalize(query)) ? 0.35 : 0;
      const score = overlap + exactPhrase;
      if (score >= 0.65 && (!best || score > best.score)) best = { record, score };
    }
    return best?.record ?? null;
  };

  return { list, save, search };
}

export function createHighlight(
  question: string,
  answer: string,
  now: Date = new Date(),
): LocalMemoryRecord {
  if (!question.trim() || !answer.trim())
    throw new TypeError("A question and answer are required.");
  return {
    id: createId(),
    kind: "highlight",
    title: question.trim().slice(0, 200),
    content: answer.trim().slice(0, MAX_RECORD_LENGTH),
    source: "conversation highlight",
    createdAt: now.toISOString(),
  };
}

export function splitDocument(
  name: string,
  text: string,
  now: Date = new Date(),
): LocalMemoryRecord[] {
  if (text.length > MAX_DOCUMENT_LENGTH) {
    throw new RangeError("Documents must be 500 KB or smaller.");
  }
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  for (const paragraph of paragraphs) {
    for (let offset = 0; offset < paragraph.length; offset += MAX_RECORD_LENGTH) {
      chunks.push(paragraph.slice(offset, offset + MAX_RECORD_LENGTH));
    }
  }
  if (chunks.length === 0) throw new TypeError("The selected document contains no readable text.");
  return chunks.map((content, index) => ({
    id: createId(),
    kind: "document",
    title: `${name} · ${index + 1}`,
    content,
    source: name,
    createdAt: now.toISOString(),
  }));
}

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `memory-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function findLocalAnswer(
  query: string,
  memory: ReturnType<typeof createLocalMemory>,
): { answer: string; source: "saved memory" | "local knowledge" } | null {
  const remembered = memory.search(query);
  if (remembered) {
    const terms = normalize(query)
      .split(" ")
      .filter((term) => term.length > 2);
    const sentences = remembered.content.match(/[^.!?\n]+(?:[.!?]+|$)/g) ?? [remembered.content];
    const excerpt =
      sentences
        .map((sentence) => ({
          sentence: sentence.trim(),
          score: terms.filter((term) => normalize(sentence).includes(term)).length,
        }))
        .sort((left, right) => right.score - left.score)[0]?.sentence || remembered.content.trim();
    return {
      answer: `From ${remembered.source}: ${excerpt.slice(0, 800)}`,
      source: "saved memory",
    };
  }
  return null;
}
