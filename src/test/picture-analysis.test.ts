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
