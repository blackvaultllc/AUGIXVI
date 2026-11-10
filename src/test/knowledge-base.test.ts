import { describe, expect, it } from "vitest";
import {
  CURRICULUM_PACKS,
  KNOWLEDGE_SOURCES,
  MARTIAL_ARTS,
  US_STATES,
  lookupKnowledge,
} from "@/avatar/knowledgeBase";

describe("sourced knowledge catalog", () => {
  it("provides a structured curriculum index and official sources without claiming complete coverage", () => {
    expect(CURRICULUM_PACKS.map((pack) => pack.level)).toEqual([
      "Pre-K",
      "Elementary",
      "Middle school",
      "High school",
      "College and adult learning",
    ]);
    expect(CURRICULUM_PACKS.every((pack) => pack.sources.length > 0)).toBe(true);
    expect(KNOWLEDGE_SOURCES.every((source) => source.url.startsWith("https://"))).toBe(true);
    expect(lookupKnowledge("what is NGSS")).toContain("topic index");
  });

  it("indexes all states but declines to invent unloaded state facts", () => {
    expect(US_STATES).toHaveLength(50);
    expect(lookupKnowledge("What is the population of a state?")).toContain("will not guess");
  });

  it("describes named martial arts without claiming physical ability", () => {
    expect(MARTIAL_ARTS.length).toBeGreaterThanOrEqual(10);
    expect(lookupKnowledge("Tell me about Judo")).toContain("grappling sport");
    expect(lookupKnowledge("martial arts")).toContain("do not physically perform");
  });
});
