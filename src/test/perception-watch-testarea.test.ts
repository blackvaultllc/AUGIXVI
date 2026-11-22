import { beforeEach, describe, expect, it } from "vitest";
import { expressionCues, perceptionLines } from "../avatar/perception";
import { parseHeartRateMeasurement } from "../avatar/watchBle";
import { recordVerdict, loadLedger, verdictFreshness } from "../avatar/testArea";
import { parseRoomCommand } from "../avatar/command/roomCommands";
import { learnerCanAccess } from "../avatar/learner/learnerProfile";

/** A synthetic 478-point face: neutral geometry we can bend. */
function fakeFace(smileLift = 0): { x: number; y: number }[] {
  const pts = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const set = (i: number, x: number, y: number) => { pts[i] = { x, y }; };
  // face extents
  set(0, 0.2, 0.5); set(1, 0.8, 0.5); set(2, 0.5, 0.1); set(3, 0.5, 0.95);
  // mouth: corners at y 0.72 - lift, center 0.72
  set(61, 0.38, 0.72 - smileLift); set(291, 0.62, 0.72 - smileLift);
  set(13, 0.5, 0.70); set(14, 0.5, 0.74);
  // brows + eyes
  set(70, 0.35, 0.38); set(300, 0.65, 0.38);
  set(107, 0.44, 0.40); set(336, 0.56, 0.40);
  set(159, 0.35, 0.45); set(145, 0.35, 0.50);
  set(386, 0.65, 0.45); set(374, 0.65, 0.50);
  return pts;
}

describe("Part 25 — perception cues are geometry, labeled as estimates", () => {
  it("reads a lifted-corner mouth as more of a smile than a flat one", () => {
    const flat = expressionCues(fakeFace(0))!;
    const smiling = expressionCues(fakeFace(0.05))!;
    expect(smiling.smile).toBeGreaterThan(flat.smile);
    expect(smiling.eyeOpen).toBeGreaterThan(0.2);
  });

  it("never claims identity or feelings as fact — 'cues suggest' only", () => {
    const lines = perceptionLines(expressionCues(fakeFace(0.05)), { dominantHz: 220, energy: 0.3 });
    const joined = lines.join(" ");
    expect(joined).toMatch(/cues suggest/i);
    expect(joined).toMatch(/not a reading of anyone's mind/);
    expect(joined).toMatch(/Audio cues/);
  });

  it("says plainly when there is no face", () => {
    expect(perceptionLines(null, { dominantHz: null, energy: 0 })[0]).toMatch(/No face cues/);
    expect(expressionCues([{ x: 0, y: 0 }])).toBeNull();
  });
});

describe("Part 20 — BLE heart-rate parsing takes only real readings", () => {
  it("parses 8-bit and 16-bit measurements, rejects garbage", () => {
    const v8 = new DataView(new Uint8Array([0, 72]).buffer);
    expect(parseHeartRateMeasurement(v8)).toBe(72);
    const v16 = new DataView(new Uint8Array([1, 0x50, 0x00]).buffer);
    expect(parseHeartRateMeasurement(v16)).toBe(80);
    expect(parseHeartRateMeasurement(new DataView(new Uint8Array([0, 0]).buffer))).toBeNull();
    expect(parseHeartRateMeasurement(new DataView(new Uint8Array([0]).buffer))).toBeNull();
  });

  it("keeps the phone bridge and say route outside Khadija's wall", () => {
    expect(learnerCanAccess("/phone-bridge")).toBe(false);
    expect(learnerCanAccess("/api/say")).toBe(false);
  });
});

describe("Part 24 — the ledger: verdicts age to STALE, never fake-fresh", () => {
  beforeEach(() => localStorage.clear());

  it("records and ages verdicts", () => {
    const now = Date.now();
    recordVerdict("vision-model", { works: true, at: now - 1000, reason: "ok" });
    expect(loadLedger()["vision-model"]!.works).toBe(true);
    expect(verdictFreshness(loadLedger()["vision-model"], now)).toBe("fresh");
    expect(verdictFreshness({ works: true, at: now - 25 * 60 * 60 * 1000, reason: "old" }, now)).toBe("stale");
    expect(verdictFreshness(undefined, now)).toBe("never");
  });

  it("opens from its room phrases", () => {
    expect(parseRoomCommand("open the test area")).toBe("test-area");
    expect(parseRoomCommand("test area")).toBe("test-area");
  });
});
