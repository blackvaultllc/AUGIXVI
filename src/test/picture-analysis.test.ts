import { describe, expect, it } from "vitest";
import { pickVisionModel } from "@/avatar/PictureAnalysis";

describe("picture analysis vision-model choice", () => {
  it("prefers llava:7b when it is installed", () => {
    expect(pickVisionModel(["llama3.1:8b", "llava:7b"])).toBe("llava:7b");
  });

  it("accepts another installed vision model when llava is absent", () => {
    expect(pickVisionModel(["llama3.2-vision:latest"])).toBe("llama3.2-vision:latest");
    expect(pickVisionModel(["qwen2.5vl:7b"])).toBe("qwen2.5vl:7b");
  });

  it("returns null when only text models are installed — the room must say unavailable", () => {
    expect(pickVisionModel(["llama3.1:8b", "qwen2.5:7b", "llama3.2:3b"])).toBeNull();
    expect(pickVisionModel([])).toBeNull();
  });
});

describe("Part 27 — findings parsing for the analytic window", () => {
  it("splits the summary from the FINDINGS list", async () => {
    const { parseFindings } = await import("../avatar/PictureAnalysis");
    const parsed = parseFindings(
      "A desk with a laptop in a bright room.\nFINDINGS:\n- A wooden desk\n- One laptop, screen on\n- A coffee cup",
    );
    expect(parsed.summary).toContain("A desk with a laptop");
    expect(parsed.findings).toEqual(["A wooden desk", "One laptop, screen on", "A coffee cup"]);
  });

  it("never invents a list the model did not return", async () => {
    const { parseFindings } = await import("../avatar/PictureAnalysis");
    const parsed = parseFindings("Just a plain description with no list shape.");
    expect(parsed.findings).toEqual([]);
    expect(parsed.summary).toContain("plain description");
  });
});
