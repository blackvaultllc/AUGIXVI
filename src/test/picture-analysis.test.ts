import { describe, expect, it } from "vitest";
import { collectGenerateStream, pickVisionModel } from "@/avatar/PictureAnalysis";
import { parseAnalysis } from "@/avatar/analysisParsing";

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

describe("streamed generate responses (defect fix 2026-11-22)", () => {
  it("accumulates NDJSON fragments and reports the running text as it lands", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // A line split across two chunks must still parse whole.
        controller.enqueue(encoder.encode('{"response":"A desk"}\n{"respo'));
        controller.enqueue(encoder.encode('nse":" with a monitor."}\n{"response":"","done":true}\n'));
        controller.close();
      },
    });
    const seen: string[] = [];
    const full = await collectGenerateStream(new Response(stream), (text) => {
      seen.push(text);
    });
    expect(full).toBe("A desk with a monitor.");
    expect(seen).toEqual(["A desk", "A desk with a monitor."]);
  });

  it("falls back to a plain JSON body when the response has no stream", async () => {
    const seen: string[] = [];
    const res = new Response(JSON.stringify({ response: "One-shot answer." }), {
      headers: { "Content-Type": "application/json" },
    });
    // A Response built from a string HAS a body stream; emulate the
    // no-body case by nulling it the way some runtimes do.
    Object.defineProperty(res, "body", { value: null });
    const full = await collectGenerateStream(res, (text) => {
      seen.push(text);
    });
    expect(full).toBe("One-shot answer.");
    expect(seen).toEqual(["One-shot answer."]);
  });
});

describe("picture analysis findings split (Part 27)", () => {
  it("splits the summary from the FINDINGS list and strips the bullets", () => {
    const parsed = parseAnalysis(
      "A desk with a monitor in a dim room.\nFINDINGS:\n- computer monitor\n- desk\n• a mug\n1. window",
    );
    expect(parsed.summary).toBe("A desk with a monitor in a dim room.");
    expect(parsed.findings).toEqual(["computer monitor", "desk", "a mug", "window"]);
  });

  it("keeps the whole answer as the summary when the model skips the format", () => {
    const parsed = parseAnalysis("Just a plain description.");
    expect(parsed.summary).toBe("Just a plain description.");
    expect(parsed.findings).toEqual([]);
  });

  it("drops empty lines from the findings list", () => {
    const parsed = parseAnalysis("Summary.\nFINDINGS:\n- one\n\n- \n- two");
    expect(parsed.findings).toEqual(["one", "two"]);
  });
});
