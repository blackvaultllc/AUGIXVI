import { describe, expect, it } from "vitest";
import {
  deriveHearingStatus,
  pushLevel,
  stageStatusLabel,
  LEVEL_HISTORY_MAX,
} from "@/avatar/voiceHearing";
import type { HearingSnapshot } from "@/avatar/localEar";

/**
 * The voice indicator's state logic (owner order 2026-11-22): the
 * graph and the HEARING label are the truth or they do not ship.
 * HEARING only while the ear is really listening; every other state
 * is NOT HEARING with its reason in plain words — never a false
 * green.
 */

const snap = (over: Partial<HearingSnapshot>): HearingSnapshot => ({
  state: "idle",
  supported: true,
  lastError: null,
  ...over,
});

describe("hearing status", () => {
  it("is HEARING only while the ear is listening", () => {
    expect(deriveHearingStatus(snap({ state: "listening" }))).toEqual({
      hearing: true,
      reason: null,
    });
  });

  it("reads NOT HEARING with the reason for every other real state", () => {
    expect(deriveHearingStatus(snap({ state: "idle" })).hearing).toBe(false);
    expect(deriveHearingStatus(snap({ state: "idle" })).reason).toContain(
      "microphone is off",
    );
    expect(deriveHearingStatus(snap({ state: "starting" })).reason).toContain(
      "starting",
    );
    const writing = deriveHearingStatus(snap({ state: "transcribing" }));
    expect(writing.hearing).toBe(false);
    expect(writing.reason).toContain("Heard you");
  });

  it("carries the ear's own plain-words failure as the reason", () => {
    const status = deriveHearingStatus(
      snap({
        state: "error",
        lastError: "Microphone unavailable: permission was denied.",
      }),
    );
    expect(status.hearing).toBe(false);
    expect(status.reason).toContain("permission was denied");
  });

  it("never paints a false green for an unsupported browser or a strange state", () => {
    expect(deriveHearingStatus(snap({ supported: false, state: "listening" })).hearing).toBe(
      false,
    );
    const strange = deriveHearingStatus(
      snap({ state: "bogus" as HearingSnapshot["state"] }),
    );
    expect(strange.hearing).toBe(false);
    expect(strange.reason).toBeTruthy();
  });
});

describe("level history", () => {
  it("keeps only measured samples, clamped to the window", () => {
    let history: number[] = [];
    history = pushLevel(history, 0.4);
    history = pushLevel(history, 2); // over-range input clamps to 1
    history = pushLevel(history, -1); // and under-range to 0
    expect(history).toEqual([0.4, 1, 0]);
    for (let i = 0; i < LEVEL_HISTORY_MAX + 10; i += 1) {
      history = pushLevel(history, 0.5);
    }
    expect(history).toHaveLength(LEVEL_HISTORY_MAX);
  });
});

describe("stage STATUS — one truth on screen (owner eye-check 2026-11-23)", () => {
  it("a resting bridge with the mic off reads MIC OFF, never LISTENING", () => {
    expect(stageStatusLabel("LISTENING", "idle")).toBe("MIC OFF");
    expect(stageStatusLabel("LISTENING", "error")).toBe("MIC OFF");
    expect(stageStatusLabel("LISTENING", null)).toBe("MIC OFF");
  });

  it("an ear that is actually capturing keeps the LISTENING readout", () => {
    expect(stageStatusLabel("LISTENING", "starting")).toBe("LISTENING");
    expect(stageStatusLabel("LISTENING", "listening")).toBe("LISTENING");
    expect(stageStatusLabel("LISTENING", "transcribing")).toBe("LISTENING");
  });

  it("every other bridge state passes through untouched", () => {
    expect(stageStatusLabel("SPEAKING", "idle")).toBe("SPEAKING");
    expect(stageStatusLabel("THINKING", "idle")).toBe("THINKING");
    expect(stageStatusLabel("IDLE", "idle")).toBe("IDLE");
  });
});
