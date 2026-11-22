import { describe, expect, it } from "vitest";
import { DEPARTMENTS, departmentDef } from "../avatar/departments";
import { isLawBook, rankLawResults, LAW_HONESTY_LINE } from "../avatar/lawDesk.server";
import { parseRoomCommand } from "../avatar/command/roomCommands";
import { learnerCanAccess } from "../avatar/learner/learnerProfile";

describe("Part 10 — office analytics departments", () => {
  it("covers every department Domenick named, social media included", () => {
    const ids = DEPARTMENTS.map((d) => d.id);
    expect(ids).toContain("social");
    expect(ids).toContain("security");
    expect(ids).toContain("knowledge");
    expect(ids).toContain("brain");
    expect(ids).toContain("academy");
    expect(ids).toContain("systems");
    expect(ids).toContain("finance");
    expect(departmentDef("social").label).toMatch(/Social Media/);
  });

  it("opens from the room command phrases", () => {
    expect(parseRoomCommand("open office analytics")).toBe("office-analytics");
    expect(parseRoomCommand("department status")).toBe("office-analytics");
  });
});

describe("Part 11 — law desk grounding helpers", () => {
  it("recognizes law books and ranks them first", () => {
    expect(isLawBook({ id: "a", name: "Constitutional Law", title: "Constitutional Law" })).toBe(true);
    expect(isLawBook({ id: "b", name: "Simple English Wikipedia", title: "Simple English Wikipedia" })).toBe(false);
    const books = new Map([
      ["a", { id: "a", name: "Constitutional Law", title: "Constitutional Law" }],
      ["b", { id: "b", name: "Simple English Wikipedia", title: "Simple English Wikipedia" }],
    ]) as never;
    const ranked = rankLawResults(
      [
        { bookId: "b", bookTitle: "Simple English Wikipedia", title: "Courts", path: "Courts", snippet: "" },
        { bookId: "a", bookTitle: "Constitutional Law", title: "Rights", path: "Rights", snippet: "" },
      ] as never,
      books,
    );
    expect(ranked[0]!.bookId).toBe("a");
  });

  it("carries the honesty line verbatim", () => {
    expect(LAW_HONESTY_LINE).toMatch(/not a licensed attorney/);
  });

  it("opens from the room command phrases", () => {
    expect(parseRoomCommand("open the law desk")).toBe("law-desk");
    expect(parseRoomCommand("law")).toBe("law-desk");
  });
});

describe("Parts 10/11 — Khadija's wall still excludes both operator windows' routes", () => {
  it("denies law/analytics server functions and avatar routes", () => {
    expect(learnerCanAccess("/avatar")).toBe(false);
    expect(learnerCanAccess("/api/learner/ask")).toBe(true);
  });
});
