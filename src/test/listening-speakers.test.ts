import { describe, expect, it } from "vitest";
import { buildRecap, containsWakeWord } from "../avatar/listening";
import {
  isOtherSpeakerLabel,
  parseOtherVoices,
  summarizeOtherVoices,
  OPERATOR_LABEL,
  type OtherVoiceEntry,
} from "../avatar/speakerStores";
import { parseRoomCommand } from "../avatar/command/roomCommands";

/**
 * Parts 12 + 13 against the final-five service contracts (the merge
 * of 2026-11-22 kept the final-five line's listening/speaker modules:
 * separation lives in the Parrot ear service, and the app side parses
 * its payloads — the operator's label can never enter the
 * other-voices store, by construction of the parser).
 */

describe("Part 12 — wake word + honest recap", () => {
  it("wakes only on the wake words", () => {
    expect(containsWakeWord("Osiris, are you there")).toBe(true);
    expect(containsWakeWord("say usir and he wakes")).toBe(true);
    expect(containsWakeWord("the osiris myth is old")).toBe(true); // the word itself wakes him — by design
    expect(containsWakeWord("a perfectly ordinary sentence")).toBe(false);
  });

  it("recaps what was actually said — and refuses to invent an empty one", () => {
    expect(buildRecap({ recorded: false, sessionId: null, lines: [] })).toMatch(/will not invent/);
    const recap = buildRecap({
      recorded: true,
      sessionId: "s1",
      lines: [
        { at: null, text: "first line", speaker: "Voice", wake: false },
        { at: null, text: "second line", speaker: "Voice", wake: false },
      ],
    });
    expect(recap).toContain("first line");
    expect(recap).toContain("second line");
  });

  it("opens from its room phrases", () => {
    expect(parseRoomCommand("open listening mode")).toBe("listening");
    expect(parseRoomCommand("listening")).toBe("listening");
  });
});

describe("Part 13 — speaker separation never merges into the operator", () => {
  it("only Speaker N labels are other-voice labels — never the operator's", () => {
    expect(OPERATOR_LABEL).toBe("Operator");
    expect(isOtherSpeakerLabel(OPERATOR_LABEL)).toBe(false);
    expect(isOtherSpeakerLabel("Speaker 2")).toBe(true);
    expect(isOtherSpeakerLabel("Speaker 10")).toBe(true);
    expect(isOtherSpeakerLabel("Voice")).toBe(false);
  });

  it("the parser drops operator-labeled entries by construction", () => {
    const view = parseOtherVoices({
      enrolled: true,
      separationAvailable: true,
      entries: [
        { label: "Operator", transcript: "his own words", timestamp: "2026-11-21T10:00:00Z" },
        { label: "Speaker 2", transcript: "someone else", timestamp: "2026-11-21T10:01:00Z" },
        { label: "Speaker 2", transcript: "and again", timestamp: "2026-11-21T10:02:00Z" },
      ],
    });
    expect(view).not.toBeNull();
    expect(view!.entries).toHaveLength(2);
    expect(view!.entries.every((e) => e.label === "Speaker 2")).toBe(true);
  });

  it("summaries count each label's utterances with first and last heard", () => {
    const entries: OtherVoiceEntry[] = [
      { label: "Speaker 2", timestamp: "2026-11-21T10:01:00Z", similarity: null, transcript: "a", durationS: null },
      { label: "Speaker 3", timestamp: "2026-11-21T10:03:00Z", similarity: null, transcript: "b", durationS: null },
      { label: "Speaker 2", timestamp: "2026-11-21T10:05:00Z", similarity: null, transcript: "c", durationS: null },
    ];
    const summary = summarizeOtherVoices(entries);
    expect(summary.map((s) => s.label)).toEqual(["Speaker 2", "Speaker 3"]);
    expect(summary[0]).toMatchObject({
      utterances: 2,
      firstHeard: "2026-11-21T10:01:00Z",
      lastHeard: "2026-11-21T10:05:00Z",
    });
    expect(summary[1]).toMatchObject({ utterances: 1 });
  });
});
