import { describe, expect, it } from "vitest";
import { formatLawCitation, LAW_DISCLAIMER } from "@/avatar/lawDesk";

/** PART 11 — citations name book + article + shelf, and the
 * disclaimer never hides the not-a-lawyer limit. */
describe("law desk", () => {
  it("formats a full citation", () => {
    expect(formatLawCitation("Wikipedia (full)", "Contract")).toBe(
      "Source: “Contract” — Wikipedia (full) (offline Library, Law shelf)",
    );
  });

  it("the disclaimer states the limit plainly", () => {
    expect(LAW_DISCLAIMER).toContain("not a licensed attorney");
    expect(LAW_DISCLAIMER).toContain("names its source");
  });
});
