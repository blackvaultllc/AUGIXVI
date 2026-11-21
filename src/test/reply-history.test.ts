import { beforeEach, describe, expect, it } from "vitest";
import {
  appendReplyHistory,
  clearReplyHistory,
  loadReplyHistory,
  type ReplyHistoryEntry,
} from "@/avatar/replyHistory";

describe("reply history", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty, appends in order, and persists across loads", () => {
    expect(loadReplyHistory()).toEqual([]);
    let entries: ReplyHistoryEntry[] = appendReplyHistory([], {
      at: 1,
      question: "are you there",
      answer: "Yes, Domenick.",
    });
    entries = appendReplyHistory(entries, { at: 2, question: "", answer: "Second reply." });
    expect(entries.map((e) => e.answer)).toEqual(["Yes, Domenick.", "Second reply."]);
    expect(loadReplyHistory()).toEqual(entries);
  });

  it("caps at 100 entries, keeping the newest", () => {
    let entries: ReplyHistoryEntry[] = [];
    for (let i = 0; i < 105; i++) {
      entries = appendReplyHistory(entries, { at: i, question: "", answer: `reply ${i}` });
    }
    expect(entries).toHaveLength(100);
    expect(entries[0]?.at).toBe(5);
    expect(entries[99]?.at).toBe(104);
  });

  it("clear empties the store", () => {
    appendReplyHistory([], { at: 1, question: "", answer: "x" });
    expect(clearReplyHistory()).toEqual([]);
    expect(loadReplyHistory()).toEqual([]);
  });
});
