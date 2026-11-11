import { describe, expect, it } from "vitest";
import { extractYouTubeId, resolvePlayerSource } from "@/avatar/windows/windows";
import { SLASH_COMMANDS, filterSlashCommands } from "@/avatar/command/slashCommands";

describe("YouTube player window", () => {
  it("extracts ids from every link shape I paste", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("falls back to a name search when there is no link", () => {
    const resolved = resolvePlayerSource("pharaohs rumble");
    expect(resolved).not.toBeNull();
    expect(resolved?.videoId).toContain("search:");
  });
});

describe("universal slash-command menu — nothing hidden", () => {
  it("lists the new windows and the clear-screen hot key in plain words", () => {
    const commands = SLASH_COMMANDS.map((c) => c.command);
    expect(commands).toContain("/notepad");
    expect(commands).toContain("/chalkboard");
    expect(commands).toContain("/player");
    expect(commands).toContain("/help");
    const clear = SLASH_COMMANDS.find((c) => c.command === "/clear screen");
    expect(clear?.description).toContain("Hot key: C");
  });

  it("filters by name and description", () => {
    const results = filterSlashCommands("player");
    expect(results.some((c) => c.command === "/player")).toBe(true);
  });
});
