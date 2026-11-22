import { beforeEach, describe, expect, it } from "vitest";
import { buildCaptureBundle, captureFilename } from "../avatar/capture";
import {
  deleteConfigVersion,
  loadConfigVersions,
  saveConfigVersion,
} from "../avatar/configVersions";
import { defaultSettings } from "../avatar/settings";
import { parseRoomCommand } from "../avatar/command/roomCommands";
import { learnerCanAccess } from "../avatar/learner/learnerProfile";

describe("Part 15 — the capture bundle is honest about its contents", () => {
  // Merge note (2026-11-22): the main line's capture module won the
  // merge (it is the one the Test Area window uses); this describe
  // asserts the same honesty contract — every section labeled with
  // what it is and where it came from — against that module's shape.
  it("labels every section with what it is and where it came from", () => {
    const bundle = buildCaptureBundle({
      now: 1_700_000_000_000,
      userAgent: "test",
      settings: { bloom: 0.4 },
      scanState: { watcher: { active: true } },
      recentReplies: [{ question: "hi", answer: "hello" }],
      ledger: {},
      visibleError: null,
    });
    expect(bundle.kind).toBe("augie-capture");
    expect(bundle.capturedAt).toBe(new Date(1_700_000_000_000).toISOString());
    expect(bundle.sections.settings.label).toMatch(/settings/i);
    expect(bundle.sections.settings.value).toEqual({ bloom: 0.4 });
    expect(bundle.sections.scanState.label).toMatch(/scan-state/i);
    expect(bundle.sections.recentReplies.label).toMatch(/reply history/i);
    expect(bundle.sections.recentReplies.value).toEqual([{ question: "hi", answer: "hello" }]);
    expect(bundle.sections.testLedger.label).toMatch(/Test Area ledger/i);
    expect(bundle.sections.visibleError.value).toBeNull();
    expect(captureFilename(1_700_000_000_000)).toMatch(/^augie-capture-\d{8}-\d{6}\.json$/);
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
