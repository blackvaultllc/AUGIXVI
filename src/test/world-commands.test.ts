import { describe, expect, it } from "vitest";
import { isCameraVisionRequest, parseWorldCommand } from "@/avatar/worldCommands";

describe("world command parser", () => {
  it.each([
    ["shrink", { type: "shrink" }],
    ["walk around", { type: "walk" }],
    ["look around", { type: "look" }],
    ["come back", { type: "come-back" }],
    ["grow", { type: "grow" }],
    ["drive the car", { type: "drive" }],
    ["make a car", { type: "make", kind: "car" }],
    ["make an air balloon", { type: "make", kind: "balloon" }],
    ["move those mountains", { type: "move", target: "mountain", direction: "right" }],
    ["move the car left", { type: "move", target: "car", direction: "left" }],
    ["reshape the mountain into trees", { type: "reshape", target: "mountain", kind: "tree" }],
    ["remove the box", { type: "remove", target: "box" }],
  ])("parses %s as a local world command", (text, expected) => {
    expect(parseWorldCommand(text)).toEqual(expected);
  });

  it("reports unsupported materializations rather than claiming success", () => {
    expect(parseWorldCommand("make a dragon")).toEqual({
      type: "unsupported",
      operation: "make",
      request: "dragon",
    });
    expect(parseWorldCommand("reshape the mountain into a dragon")).toEqual({
      type: "unsupported",
      operation: "reshape",
      request: "a dragon",
    });
    expect(parseWorldCommand("tell me a story")).toBeNull();
  });

  it("recognizes explicit camera vision requests only", () => {
    expect(isCameraVisionRequest("What do you see?")).toBe(true);
    expect(isCameraVisionRequest("Describe the scene")).toBe(true);
    expect(isCameraVisionRequest("Tell me about Osiris")).toBe(false);
  });
});
