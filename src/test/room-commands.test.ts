import { describe, expect, it } from "vitest";
import { parseRoomCommand } from "@/avatar/command/roomCommands";

/**
 * Regression guard for the "open the cube" incident (2026-11-21):
 * Domenick typed/spoke "open the cube", no matcher claimed it, and the
 * phrase fell through to the LLM chat, which refused ("I'm a simulated
 * world governor, I don't have the ability to physically open or
 * interact with the cube…"). Room phrases now resolve in ONE pure
 * decider; AvatarStage returns on any non-null result, so a resolved
 * phrase can never reach the chat path. These tables pin the routing:
 * every natural open-phrase lands on its room, the Metatron "My Cube"
 * panel keeps its own distinct triggers, and non-room sentences —
 * including longer sentences that merely contain a room phrase —
 * resolve to null.
 */
describe("room routing — deterministic and terminal", () => {
  it.each([
    "open the cube",
    "open cube",
    "show me the cube",
    "show the cube",
    "ar cube",
    "open the ar cube",
    "open ar cube",
    "show me the ar cube",
    "cube",
    "/cube",
    "/ar cube",
    "Open the cube.",
    "open the cube!",
  ])("routes %j to the AR Cube room", (phrase) => {
    expect(parseRoomCommand(phrase)).toBe("ar-cube");
  });

  it.each([
    "open my cube",
    "my cube",
    "metatron's cube",
    "metatron cube",
    "open metatron's cube",
    "pull up the cube",
    "Pull up the cube!",
  ])("routes %j to the Metatron My Cube panel — its own trigger", (phrase) => {
    expect(parseRoomCommand(phrase)).toBe("my-cube");
  });

  it.each([
    "picture analysis",
    "open picture analysis",
    "open the picture analysis",
    "analytic window",
    "open the analytic window",
    "show me the analytic window",
    "/picture analysis",
  ])("routes %j to Picture Analysis", (phrase) => {
    expect(parseRoomCommand(phrase)).toBe("picture-analysis");
  });

  it.each([
    "game",
    "open the game",
    "open game",
    "play the game",
    "show me the game",
    "legend of logic",
    "open legend of logic",
    "open the legend of logic",
    "play the legend of logic",
    "/game",
    "/legend of logic",
  ])("routes %j to the Legend of Logic game room", (phrase) => {
    expect(parseRoomCommand(phrase)).toBe("game");
  });

  it.each([
    "reply history",
    "open reply history",
    "open the reply history",
    "show reply history",
    "show me the reply history",
    "/reply history",
  ])("routes %j to the Reply history window", (phrase) => {
    expect(parseRoomCommand(phrase)).toBe("reply-history");
  });

  it.each([
    "pulse",
    "open pulse",
    "open the pulse",
    "show pulse",
    "show me the pulse",
    "/pulse",
    "Open pulse.",
  ])("routes %j to the Pulse window", (phrase) => {
    expect(parseRoomCommand(phrase)).toBe("pulse");
  });

  it.each([
    "gate log",
    "open gate log",
    "open the gate log",
    "show gate log",
    "show me the gate log",
    "/gate log",
    "honeypot",
    "open honeypot",
    "open the honeypot",
    "Open gate log.",
  ])("routes %j to the Gate Log window", (phrase) => {
    expect(parseRoomCommand(phrase)).toBe("gate-log");
  });

  it.each([
    "logs",
    "open logs",
    "show me the logs",
    "updates",
    "open updates",
    "check for updates",
    "service log",
  ])("routes %j to the Logs window (Part 22)", (phrase) => {
    expect(parseRoomCommand(phrase)).toBe("logs");
  });

  it.each([
    "sandbox",
    "open sandbox",
    "open the sandbox",
    "show sandbox",
    "show me the sandbox",
    "/sandbox",
    "Open sandbox.",
  ])("routes %j to the Sandbox window", (phrase) => {
    expect(parseRoomCommand(phrase)).toBe("sandbox");
  });

  it.each([
    "library",
    "open library",
    "open the library",
    "show library",
    "show me the library",
    "/library",
    "Open the library.",
  ])("routes %j to the Library window", (phrase) => {
    expect(parseRoomCommand(phrase)).toBe("library");
  });

  // World of Logic is a DIFFERENT game from Legend of Logic — the
  // deck's cyber security battles, not the mom's-game room. The two
  // must never cross: "world of logic" lands on the world room,
  // "legend of logic" (above) lands on the game room.
  it.each([
    "world of logic",
    "open world of logic",
    "open the world of logic",
    "play world of logic",
    "play the world of logic",
    "show world of logic",
    "show me the world of logic",
    "/world of logic",
    "Open world of logic.",
  ])("routes %j to the World of Logic room — never the Legend room", (phrase) => {
    expect(parseRoomCommand(phrase)).toBe("world");
  });

  it.each([
    // The room analyzer is a different feature — not a room phrase.
    "analyze the room",
    "what do you see",
    // World commands that merely mention a cube.
    "make a cube",
    "reshape the cube into a wall",
    // Longer sentences are not terminal room commands.
    "open the cube and fly",
    "check my pulse and tell me a story",
    "pulse is a good movie",
    // Gate phrases that are not the Gate Log room.
    "open the gate",
    "the gate is open",
    "open gate log and tell me a story",
    // Sandbox phrases that are not the Sandbox room command.
    "open the sandbox and run a scenario",
    "the sandbox is over there",
    // Library phrases that are not the Library room command — the
    // Knowledge panel ("open knowledge") is a different surface.
    "take me to the library",
    "the library is downtown",
    "open the library and read me a story",
    // World of Logic phrases that are not the room command — and
    // near-misses that must not fall into either game room.
    "open world of logic and fight something",
    "world of logic is a game",
    "take me to the world of logic",
    "legend of logic and world of logic",
    "world",
    "pull up the cube and run a command",
    "open the cube please and thank you",
    // Ordinary chat must keep falling through to chat.
    "how are you today",
    "tell me about cubes",
    "",
    "   ",
  ])("does not route %j to any room", (phrase) => {
    expect(parseRoomCommand(phrase)).toBeNull();
  });
});
