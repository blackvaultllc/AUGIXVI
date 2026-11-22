import { beforeEach, describe, expect, it } from "vitest";
import { buildCaptureBundle, captureFileName } from "../avatar/capture";
import {
  deleteConfigVersion,
  loadConfigVersions,
  saveConfigVersion,
} from "../avatar/configVersions";
import { defaultSettings } from "../avatar/settings";
import { parseRoomCommand } from "../avatar/command/roomCommands";
import { learnerCanAccess } from "../avatar/learner/learnerProfile";

describe("Part 15 — the capture bundle is honest about its contents", () => {
  it("carries the exchange + settings, and labels what it excludes", () => {
    const bundle = buildCaptureBundle({
      at: 1_700_000_000_000,
      url: "http://localhost/avatar",
      userAgent: "test",
      lastCommand: "open the logs",
      lastAnswer: "Logs are open.",
      responseSource: "room",
      settings: { bloom: 0.4 },
      replyHistory: [{ question: "hi", answer: "hello" }],
      openWindows: ["logs"],
    });
    expect(bundle.kind).toBe("augie-capture");
    expect(bundle.exchange.lastCommand).toBe("open the logs");
    expect(bundle.includes.join(" ")).toMatch(/reply history/);
    expect(bundle.excludes.join(" ")).toMatch(/screenshot/);
    expect(bundle.excludes.join(" ")).toMatch(/Khadija/);
    expect(captureFileName(1_700_000_000_000)).toMatch(/^augie-capture-.*\.json$/);
  });
});

describe("Part 17 — config versions save, restore, delete (same settings store)", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a named version exactly", () => {
    const settings = { ...defaultSettings(), bloom: 0.9, maxParticles: 60000 };
    saveConfigVersion("Battle Ready", settings, 123);
    const versions = loadConfigVersions();
    expect(versions).toHaveLength(1);
    expect(versions[0]!.name).toBe("Battle Ready");
    expect(versions[0]!.settings.bloom).toBe(0.9);
    expect(versions[0]!.settings.maxParticles).toBe(60000);
    expect(deleteConfigVersion("Battle Ready")).toHaveLength(0);
  });

  it("re-saving the same name replaces that version, not duplicates it", () => {
    saveConfigVersion("Calm", defaultSettings(), 1);
    saveConfigVersion("Calm", { ...defaultSettings(), bloom: 0.1 }, 2);
    const versions = loadConfigVersions();
    expect(versions).toHaveLength(1);
    expect(versions[0]!.settings.bloom).toBe(0.1);
  });

  it("opens from room phrases and stays outside Khadija's wall", () => {
    expect(parseRoomCommand("open anatomy")).toBe("anatomy");
    expect(parseRoomCommand("show me the logs")).toBe("logs");
    expect(learnerCanAccess("/avatar")).toBe(false);
  });
});

describe("Part 22 — room phrases", () => {
  it("routes logs phrases", () => {
    expect(parseRoomCommand("logs")).toBe("logs");
    expect(parseRoomCommand("open the logs")).toBe("logs");
  });
});
