import { describe, expect, it } from "vitest";
import {
  createHighlight,
  createLocalMemory,
  findLocalAnswer,
  splitDocument,
} from "@/avatar/localMemory";

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("device-local knowledge memory", () => {
  it("saves, lists, and matches an explicitly highlighted answer", () => {
    const memory = createLocalMemory(fakeStorage());
    const saved = createHighlight("How do we check a backup?", "Restore-test a separate copy.");
    memory.save([saved]);

    expect(memory.list()).toEqual([saved]);
    expect(findLocalAnswer("check a backup", memory)).toEqual({
      answer: "From conversation highlight: Restore-test a separate copy.",
      source: "saved memory",
    });
  });

  it("splits text documents into bounded, sourced segments without inventing facts", () => {
    const text = `${"a".repeat(24_001)}\n\nSecond source paragraph.`;
    const chunks = splitDocument("notes.md", text, new Date("2025-01-01T00:00:00.000Z"));

    expect(chunks).toHaveLength(3);
    expect(chunks.every((chunk) => chunk.kind === "document")).toBe(true);
    expect(chunks.every((chunk) => chunk.source === "notes.md")).toBe(true);
    expect(chunks.map((chunk) => chunk.content.length)).toEqual([24_000, 1, 24]);
  });

  it("rejects oversized documents and corrupted local data", () => {
    expect(() => splitDocument("large.txt", "x".repeat(500_001))).toThrow(/500 KB/);
    const storage = fakeStorage();
    storage.setItem("augi.osiris.local-memory.v1", "not-json");
    expect(() => createLocalMemory(storage).list()).toThrow();
  });
});
