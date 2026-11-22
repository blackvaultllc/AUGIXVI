import { beforeEach, describe, expect, it } from "vitest";
import { expressionCues, perceptionSentence, voiceCues } from "../avatar/perception";
import { parseHeartRateMeasurement } from "../avatar/watchBle";
import { displayStatus, loadTestLedger, saveTestResult } from "../avatar/testArea";
import { parseRoomCommand } from "../avatar/command/roomCommands";
import { learnerCanAccess } from "../avatar/learner/learnerProfile";

/**
 * Parts 25 / 20 / 24 against the merged tree's modules (merge of
 * 2026-11-22): perception cues and the Test Area ledger use the main
 * line's modules (expressionCues returns cue strings; the ledger is
 * loadTestLedger/saveTestResult/displayStatus); the BLE heart-rate
 * parser is the learner-build line's watchBle, unchanged.
 */

/** A synthetic 478-point face in the main line's landmark geometry:
 *  face width 234→454, height 10→152, mouth corners 61/291. */
function fakeFace(mouthHalfWidth = 0.1): { x: number; y: number }[] {
  const pts = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const set = (i: number, x: number, y: number) => { pts[i] = { x, y }; };
  set(234, 0.2, 0.5); set(454, 0.8, 0.5); // face width 0.6
  set(10, 0.5, 0.1); set(152, 0.5, 0.95); // face height 0.85
  set(61, 0.5 - mouthHalfWidth, 0.72); set(291, 0.5 + mouthHalfWidth, 0.72);
  set(13, 0.5, 0.7); set(14, 0.5, 0.74); // mouth barely open
  // eyes: width 0.12, vertical opening 0.04 → aspect ~0.33 (open)
  set(33, 0.3, 0.45); set(133, 0.42, 0.45); set(159, 0.36, 0.43); set(145, 0.36, 0.47);
  set(158, 0.39, 0.43); set(153, 0.39, 0.47);
  set(362, 0.58, 0.45); set(263, 0.7, 0.45); set(386, 0.64, 0.43); set(374, 0.64, 0.47);
  set(385, 0.61, 0.43); set(380, 0.61, 0.47);
  // brows: wide gap, mid height → no brow cue
  set(55, 0.36, 0.38); set(285, 0.64, 0.38);
  return pts;
}

describe("Part 25 — perception cues are geometry, labeled as estimates", () => {
  it("reads a wide mouth as smile-like and a narrow one as not", () => {
    const flat = expressionCues(fakeFace(0.1)); // ratio 0.33 — no mouth cue
    const wide = expressionCues(fakeFace(0.14)); // ratio ~0.47 — smile-like
    expect(flat.join(" ")).not.toMatch(/smile-like/);
    expect(wide).toContain("mouth wide — smile-like");
    expect(wide).toContain("eyes open");
  });

  it("never claims identity or feelings as fact — 'Cues suggest' only", () => {
    const sentence = perceptionSentence(expressionCues(fakeFace(0.14)), ["voice mid-range (~150 Hz)"]);
    expect(sentence).toMatch(/^Cues suggest: /);
    expect(sentence).toMatch(/smile-like/);
    expect(sentence).not.toMatch(/is happy|is sad|is angry/);
  });

  it("says nothing when there is nothing honest to say", () => {
    expect(expressionCues([{ x: 0, y: 0 }])).toEqual([]);
    expect(perceptionSentence([], [])).toBeNull();
  });

  it("voice cues: a clean 150 Hz tone reads mid-range; silence reads nothing", () => {
    const rate = 16000;
    const samples = new Float32Array(rate / 4);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = 0.5 * Math.sin((2 * Math.PI * 150 * i) / rate);
    }
    const cues = voiceCues(samples, rate);
    expect(cues.pitchHz).not.toBeNull();
    expect(Math.abs(cues.pitchHz! - 150)).toBeLessThanOrEqual(6);
    expect(cues.cues.join(" ")).toMatch(/voice mid-range/);
    expect(voiceCues(new Float32Array(1024), rate).cues).toEqual([]);
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
    saveTestResult("vision", { status: "works", at: now - 1000, reason: "ok" });
    const ledger = loadTestLedger();
    expect(ledger["vision"]!.status).toBe("works");
    expect(displayStatus(ledger["vision"], now)).toBe("WORKS");
    expect(displayStatus({ status: "works", at: now - 25 * 60 * 60 * 1000, reason: "old" }, now)).toBe("STALE");
    expect(displayStatus(undefined, now)).toBe("NOT RUN");
  });

  it("opens from its room phrases", () => {
    expect(parseRoomCommand("open the test area")).toBe("test-area");
    expect(parseRoomCommand("test area")).toBe("test-area");
  });
});
