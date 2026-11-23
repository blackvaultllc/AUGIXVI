import { describe, expect, it } from "vitest";
import { NO_BRAIN_LINE, anyBrainCanAnswer, brainStateLine } from "@/avatar/brainState";

/**
 * BRAIN STATE IN PLAIN WORDS (2026-11-23) — the Captain's phone
 * screenshot: CORE: NOT CONFIGURED + PHONE BRAIN: NOT DOWNLOADED and
 * the thread sitting at a bare "No response yet." The stage must say
 * why nothing can answer and name the doors — never silent.
 */
describe("brain state line", () => {
  it("no core + no phone brain → the plain-words line with all three doors named", () => {
    const line = brainStateLine({ core: "not-configured", phoneBrain: "not-downloaded" });
    expect(line).toBe(NO_BRAIN_LINE);
    expect(line).toContain("connect the core in Settings");
    expect(line).toContain("download the on-phone brain");
    expect(line).toContain("cloud key in Connections");
  });

  it("a connected core answers — no standing line", () => {
    expect(brainStateLine({ core: "connected", phoneBrain: "not-downloaded" })).toBeNull();
  });

  it("a configured core with queued exchanges is a set-up door — no standing line", () => {
    expect(brainStateLine({ core: "queued", phoneBrain: "unsupported" })).toBeNull();
  });

  it("a ready on-phone brain answers — no standing line", () => {
    expect(brainStateLine({ core: "not-configured", phoneBrain: "ready" })).toBeNull();
  });

  it("while the phone brain is still being checked, nothing is declared", () => {
    expect(brainStateLine({ core: "not-configured", phoneBrain: null })).toBeNull();
    expect(anyBrainCanAnswer({ core: "not-configured", phoneBrain: null })).toBe(false);
  });

  it("no WebGPU + nothing downloaded is still the no-brain state", () => {
    expect(brainStateLine({ core: "not-configured", phoneBrain: "unsupported" })).toBe(
      NO_BRAIN_LINE,
    );
  });
});
