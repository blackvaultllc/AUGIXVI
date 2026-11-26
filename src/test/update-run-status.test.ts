/**
 * UPDATE RUN STATUS — the plain reading of the updater's run log
 * (owner order 2026-11-26: his own update button, plain progress,
 * plain result). The derivation reads only the script's marker
 * lines; a run with no ending marker is never read as succeeded.
 */
import { describe, expect, it } from "vitest";
import { deriveUpdateRun, updateRunWords } from "@/avatar/updateRunStatus";

const START = "=== update started 2026-11-26T18:00:00-06:00 ===";
const DONE =
  "=== update complete 2026-11-26T18:04:00-06:00 — now at 461b6f1abc123 ===";
const FAIL = "UPDATE FAILED at step: build (2026-11-26T18:02:00-06:00)";

describe("deriveUpdateRun", () => {
  it("reads an empty log as idle", () => {
    expect(deriveUpdateRun([])).toEqual({ phase: "idle" });
    expect(updateRunWords(deriveUpdateRun([]))).toBeNull();
  });

  it("reads a started run with no ending marker as running — never succeeded", () => {
    const run = deriveUpdateRun([START, "npm run build", "> vite build"]);
    expect(run).toEqual({ phase: "running" });
    expect(updateRunWords(run)).toContain("running now");
  });

  it("reads a completed run as succeeded with its stamp", () => {
    const run = deriveUpdateRun([START, "target: abc", DONE]);
    expect(run).toEqual({ phase: "succeeded", at: "461b6f1abc123" });
    expect(updateRunWords(run)).toContain("finished");
  });

  it("reads a failed run as failed, naming the step, and says nothing changed", () => {
    const run = deriveUpdateRun([START, "cloning…", FAIL]);
    expect(run).toEqual({ phase: "failed", step: "build" });
    const words = updateRunWords(run) ?? "";
    expect(words).toContain("build");
    expect(words).toContain("Nothing was changed");
  });

  it("the LAST run in the log decides — a new start supersedes an old success", () => {
    expect(deriveUpdateRun([START, DONE, START])).toEqual({ phase: "running" });
    expect(deriveUpdateRun([START, FAIL, START, DONE])).toEqual({
      phase: "succeeded",
      at: "461b6f1abc123",
    });
  });

  it("ignores lookalike lines that are not the script's markers", () => {
    const run = deriveUpdateRun([
      "some build output mentioning update complete in prose",
      "note: UPDATE FAILED at step: build (mentioned, not at line start)",
      "  === update started but indented ===",
    ]);
    // The indented start line still matches the ^ anchor? No — the
    // marker must start the line; prose and indented lines do not.
    expect(run.phase).toBe("idle");
  });
});
