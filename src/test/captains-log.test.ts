import { describe, expect, it } from "vitest";
import { entryTitle, exportFilename } from "@/avatar/captainsLog";

/** PART 32 — the log's pure shaping: titles carry the date, export
 * names are filesystem-safe and carry the recording's format. */
describe("captain's log shaping", () => {
  it("titles an entry with its date", () => {
    const at = new Date(2026, 10, 21, 22, 30).getTime();
    expect(entryTitle(at)).toContain("Captain's Log");
    expect(entryTitle(at)).toContain("2026");
  });

  it("export filenames are stamped and keep the real format", () => {
    const at = new Date(2026, 10, 21, 22, 30, 5).getTime();
    expect(exportFilename(at, "video/webm")).toBe("captains-log-20261121-223005.webm");
    expect(exportFilename(at, "video/mp4;codecs=avc1")).toBe("captains-log-20261121-223005.mp4");
  });
});
