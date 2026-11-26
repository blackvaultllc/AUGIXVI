/**
 * THE LOGIN GATE — pure core (Captain's order 2026-11-26).
 * The phrase matching, the match / no-match / no-verdict outcome
 * rule (never locked out on a no-verdict; only a positive voiceprint
 * no-match refuses), and the attempt-record discipline: verdicts
 * only, never a score; Khadija's entries never flagged.
 */
import { describe, expect, it } from "vitest";
import {
  GATE_PHRASE,
  gateAttemptFlagged,
  gateAttemptResultWords,
  gatePhraseHeard,
  gateVoiceOutcome,
  isGatePhotoName,
  learnerWordHeard,
  normalizeSpeech,
  parseGateAttempts,
  serializeGateAttempt,
  type GateAttemptRecord,
} from "@/avatar/loginGate";

describe("the gate words", () => {
  it("hears the creed phrase through case, punctuation, and extra words", () => {
    expect(gatePhraseHeard("Cast in the name of God, ye not guilty.")).toBe(true);
    expect(gatePhraseHeard("um, cast in the name of god ye not guilty")).toBe(true);
    expect(gatePhraseHeard(GATE_PHRASE)).toBe(true);
  });

  it("does not hear the phrase when the words are not there", () => {
    expect(gatePhraseHeard("open the gate please")).toBe(false);
    expect(gatePhraseHeard("cast in the name of god")).toBe(false);
    expect(gatePhraseHeard("")).toBe(false);
  });

  it("normalizes curly apostrophes and stray punctuation", () => {
    expect(normalizeSpeech("God’s  own!!")).toBe("god's own");
  });

  it("hears Khadija's gate word — her name", () => {
    expect(learnerWordHeard("Khadija")).toBe(true);
    expect(learnerWordHeard("hi, khadija is here")).toBe(true);
    expect(learnerWordHeard("daddy")).toBe(false);
  });
});

describe("the voice outcome rule", () => {
  it("match: his voice and his words together", () => {
    expect(
      gateVoiceOutcome({
        servicesAnswered: true,
        enrolled: true,
        voiceMatch: true,
        phraseHeard: true,
      }),
    ).toBe("match");
  });

  it("no-match only when the voiceprint plainly says not his voice", () => {
    expect(
      gateVoiceOutcome({
        servicesAnswered: true,
        enrolled: true,
        voiceMatch: false,
        phraseHeard: true,
      }),
    ).toBe("no-match");
    expect(
      gateVoiceOutcome({
        servicesAnswered: true,
        enrolled: true,
        voiceMatch: false,
        phraseHeard: false,
      }),
    ).toBe("no-match");
  });

  it("no-verdict — never a refusal — when the check cannot judge", () => {
    // Not enrolled yet.
    expect(
      gateVoiceOutcome({
        servicesAnswered: true,
        enrolled: false,
        voiceMatch: null,
        phraseHeard: true,
      }),
    ).toBe("no-verdict");
    // Speech service silent.
    expect(
      gateVoiceOutcome({
        servicesAnswered: false,
        enrolled: true,
        voiceMatch: true,
        phraseHeard: true,
      }),
    ).toBe("no-verdict");
    // His voice, but the words unheard through noise: fallback, not a bar.
    expect(
      gateVoiceOutcome({
        servicesAnswered: true,
        enrolled: true,
        voiceMatch: true,
        phraseHeard: false,
      }),
    ).toBe("no-verdict");
    // No voice answer at all.
    expect(
      gateVoiceOutcome({
        servicesAnswered: true,
        enrolled: true,
        voiceMatch: null,
        phraseHeard: false,
      }),
    ).toBe("no-verdict");
  });
});

describe("attempt records", () => {
  const record = (overrides: Partial<GateAttemptRecord>): GateAttemptRecord => ({
    ts: "2026-11-26T14:22:00.000Z",
    door: "operator",
    result: "voice-match",
    namedAs: "Zero",
    note: "",
    photoFile: "attempt-20261126142200-1.jpg",
    ...overrides,
  });

  it("round-trips through the JSONL line format", () => {
    const one = record({});
    const two = record({ result: "learner-entry", door: "learner", namedAs: "One" });
    const text = serializeGateAttempt(one) + serializeGateAttempt(two);
    expect(parseGateAttempts(text)).toEqual([one, two]);
  });

  it("skips malformed lines instead of losing the log", () => {
    const text = `${serializeGateAttempt(record({}))}not json\n{"door":"operator"}\n`;
    expect(parseGateAttempts(text)).toHaveLength(1);
  });

  it("never carries a voice score — verdicts only", () => {
    const line = serializeGateAttempt(record({}));
    expect(line).not.toMatch(/score/i);
    expect(Object.keys(record({}))).not.toContain("score");
  });

  it("flags refused and failed operator attempts for his review", () => {
    expect(gateAttemptFlagged(record({ result: "voice-no-match" }))).toBe(true);
    expect(gateAttemptFlagged(record({ result: "sign-in-failed" }))).toBe(true);
    expect(gateAttemptFlagged(record({ result: "permission-denied", photoFile: null }))).toBe(true);
    expect(gateAttemptFlagged(record({ result: "no-camera", photoFile: null }))).toBe(true);
    expect(gateAttemptFlagged(record({ result: "voice-match" }))).toBe(false);
    expect(gateAttemptFlagged(record({ result: "credentials-fallback" }))).toBe(false);
  });

  it("never flags Khadija's own entries — she is One", () => {
    expect(
      gateAttemptFlagged(record({ door: "learner", result: "learner-entry", namedAs: "One" })),
    ).toBe(false);
  });

  it("speaks every result in plain words", () => {
    for (const result of [
      "voice-match",
      "credentials-fallback",
      "voice-no-match",
      "sign-in-failed",
      "permission-denied",
      "no-camera",
      "learner-entry",
    ] as const) {
      expect(gateAttemptResultWords(result).length).toBeGreaterThan(10);
    }
  });

  it("accepts only core-made photo names", () => {
    expect(isGatePhotoName("attempt-20261126142200-1.jpg")).toBe(true);
    expect(isGatePhotoName("../attempt-20261126142200-1.jpg")).toBe(false);
    expect(isGatePhotoName("attempt-20261126142200-1.png")).toBe(false);
    expect(isGatePhotoName("photo.jpg")).toBe(false);
  });
});
