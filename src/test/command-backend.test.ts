import { describe, expect, it } from "vitest";
import { parseRoomAnalyzeRequest } from "@/avatar/command/analyze-requests";
import { parseInteractionCommand } from "@/avatar/interactionControls";
import { commandKnowledgeSection, commandToolsPrompt } from "@/avatar/command/commandKnowledge";

describe("room analyze requests (Command scope)", () => {
  it("opens the analyzer for room phrases", () => {
    expect(parseRoomAnalyzeRequest("analyze the room")).toBe(true);
    expect(parseRoomAnalyzeRequest("scan the room, Osiris")).toBe(true);
    expect(parseRoomAnalyzeRequest("analyze the area")).toBe(true);
    expect(parseRoomAnalyzeRequest("what's in my room")).toBe(true);
  });

  it("stays quiet on unrelated speech", () => {
    expect(parseRoomAnalyzeRequest("make a mountain")).toBe(false);
    expect(parseRoomAnalyzeRequest("what do you see")).toBe(false);
    expect(parseRoomAnalyzeRequest("go home")).toBe(false);
  });
});

describe("wake words", () => {
  it('wakes on "Usir" (oo-SEER) and on "Osiris" as backup', () => {
    expect(parseInteractionCommand("Usir")).toEqual({ type: "wake", remainder: "" });
    expect(parseInteractionCommand("hey Usir, analyze the room")).toEqual({
      type: "wake",
      remainder: "analyze the room",
    });
    expect(parseInteractionCommand("Osiris")).toEqual({ type: "wake", remainder: "" });
  });

  it("keeps the silence rule: silent until woken by name", () => {
    expect(parseInteractionCommand("I'll talk to you in a minute")).toEqual({
      type: "silence",
    });
    expect(parseInteractionCommand("stop answering, Osiris, wait till I call your name")).toEqual({
      type: "silence",
    });
  });

  it("never wakes on lookalike words that merely contain the syllable", () => {
    expect(parseInteractionCommand("design the building")).toBeNull();
  });
});

describe("Command knowledge backend", () => {
  it("injects the deck's knowledge, analysis protocol and analyze rules", () => {
    expect(commandKnowledgeSection).toContain("MITRE ATT&CK");
    expect(commandKnowledgeSection).toContain("PROBABILITY");
    expect(commandToolsPrompt).toContain("ROOM ANALYZE");
    expect(commandToolsPrompt).toContain("NEVER name a person from a face");
  });
});
