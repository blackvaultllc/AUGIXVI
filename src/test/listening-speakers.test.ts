import { beforeEach, describe, expect, it } from "vitest";
import { buildRecap, containsWakeWord } from "../avatar/listening";
import {
  assignSpeakerLabel,
  loadOtherSpeakers,
  recordOtherUtterance,
  OPERATOR_LABEL,
} from "../avatar/speakerStores";
import { parseRoomCommand } from "../avatar/command/roomCommands";

describe("Part 12 — wake word + honest recap", () => {
  it("wakes only on the wake words", () => {
    expect(containsWakeWord("Osiris, are you there")).toBe(true);
    expect(containsWakeWord("say usir and he wakes")).toBe(true);
    expect(containsWakeWord("the osiris myth is old")).toBe(true); // the word itself wakes him — by design
    expect(containsWakeWord("a perfectly ordinary sentence")).toBe(false);
  });

  it("recaps what was actually said — and refuses to invent an empty one", () => {
    expect(buildRecap([])).toMatch(/will not invent/);
    const recap = buildRecap([
      { at: 1, text: "first line", speaker: "Voice" },
      { at: 2, text: "second line", speaker: "Voice" },
    ]);
    expect(recap).toContain("first line");
    expect(recap).toContain("second line");
  });

  it("opens from its room phrases", () => {
    expect(parseRoomCommand("open listening mode")).toBe("listening");
    expect(parseRoomCommand("listening")).toBe("listening");
  });
});

describe("Part 13 — speaker separation never merges into the operator", () => {
  beforeEach(() => localStorage.clear());

  it("labels the operator as the operator, others as fresh numbered stores", () => {
    expect(assignSpeakerLabel(true, [])).toBe(OPERATOR_LABEL);
    expect(assignSpeakerLabel(false, [])).toBe("Speaker 2");
    const others = [{ label: "Speaker 2", utterances: 3, firstHeard: 1, lastHeard: 2 }];
    expect(assignSpeakerLabel(false, others, "Speaker 2")).toBe("Speaker 2");
    expect(assignSpeakerLabel(false, others)).toBe("Speaker 3");
  });

  it("refuses to record the operator into the other-voice stores", () => {
    recordOtherUtterance(OPERATOR_LABEL);
    expect(loadOtherSpeakers()).toHaveLength(0);
    recordOtherUtterance("Speaker 2");
    recordOtherUtterance("Speaker 2");
    const others = loadOtherSpeakers();
    expect(others).toHaveLength(1);
    expect(others[0]!.utterances).toBe(2);
  });
});
