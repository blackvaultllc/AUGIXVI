import { describe, expect, it } from "vitest";
import {
  buildRecap,
  containsWakeWord,
  listeningIndicatorText,
  parseListeningRecap,
  parseListeningStatus,
  type ListeningRecap,
} from "@/avatar/listening";
import {
  isOtherSpeakerLabel,
  parseOtherVoices,
  separationStateText,
  summarizeOtherVoices,
  type OtherVoiceEntry,
} from "@/avatar/speakerStores";
import { parseRoomCommand } from "@/avatar/command/roomCommands";

/**
 * LISTENING MODE + SPEAKER SEPARATION (Parts 12 + 13) — the pure
 * contract. The doctrine pinned here: the wake word is a whole word,
 * a recap repeats ONLY recorded lines and refuses in words when
 * empty, the indicator text never hides an armed session, and the
 * other-voices store can never carry the operator's label.
 */

describe("containsWakeWord", () => {
  it("hears Osiris and Usir as whole words, any case", () => {
    expect(containsWakeWord("Osiris, are you there?")).toBe(true);
    expect(containsWakeWord("someone said usir quietly")).toBe(true);
    expect(containsWakeWord("OSIRIS")).toBe(true);
  });

  it("does not fire on lookalikes or ordinary speech", () => {
    expect(containsWakeWord("the meeting starts at noon")).toBe(false);
    expect(containsWakeWord("osirisopen the cube")).toBe(false);
    expect(containsWakeWord("")).toBe(false);
  });
});

describe("parseListeningStatus", () => {
  it("reads the service's armed status verbatim", () => {
    expect(
      parseListeningStatus({
        armed: true,
        sessionId: "listen-1",
        startedAt: "2026-11-22T09:20:57Z",
        lineCount: 3,
        wakeHeard: true,
      }),
    ).toEqual({
      armed: true,
      sessionId: "listen-1",
      startedAt: "2026-11-22T09:20:57Z",
      lineCount: 3,
      wakeHeard: true,
    });
  });

  it("refuses a shape the contract does not promise", () => {
    expect(parseListeningStatus(null)).toBeNull();
    expect(parseListeningStatus({ lineCount: 2 })).toBeNull();
    expect(parseListeningStatus("armed")).toBeNull();
  });
});

describe("recap honesty", () => {
  it("an empty session refuses in words — never an invented conversation", () => {
    const recap = parseListeningRecap({
      recorded: false,
      sessionId: "listen-2",
      lines: [],
      message: "Nothing was recorded in this session.",
    });
    expect(recap?.recorded).toBe(false);
    expect(buildRecap(recap!)).toBe("Nothing was recorded in this session.");
  });

  it("drops lines without text — a recap line is only ever a recorded one", () => {
    const recap = parseListeningRecap({
      recorded: true,
      sessionId: "listen-3",
      lines: [
        { at: "2026-11-22T09:20:58Z", text: "Hello there.", speaker: "Voice", wake: false },
        { at: "2026-11-22T09:20:59Z", speaker: "Voice", wake: false },
        "garbage",
      ],
    });
    expect(recap?.lines).toHaveLength(1);
    expect(recap?.recorded).toBe(true);
  });

  it("builds the recap from the recorded lines, labeled, in order", () => {
    const recap: ListeningRecap = {
      recorded: true,
      sessionId: "listen-4",
      lines: [
        { at: null, text: "The meeting starts at noon.", speaker: "Operator", wake: false },
        { at: null, text: "I will bring the papers.", speaker: "Speaker 2", wake: false },
      ],
    };
    expect(buildRecap(recap)).toBe(
      "Here is what was said. Operator: The meeting starts at noon. Speaker 2: I will bring the papers.",
    );
  });
});

describe("listeningIndicatorText", () => {
  it("says OFF plainly when disarmed", () => {
    expect(
      listeningIndicatorText({
        armed: false,
        sessionId: null,
        startedAt: null,
        lineCount: 0,
        wakeHeard: false,
      }),
    ).toContain("OFF");
  });

  it("announces LISTENING while armed, and the wake once heard", () => {
    const armed = {
      armed: true,
      sessionId: "listen-5",
      startedAt: "2026-11-22T09:20:57Z",
      lineCount: 1,
      wakeHeard: false,
    };
    expect(listeningIndicatorText(armed)).toContain("LISTENING");
    expect(listeningIndicatorText({ ...armed, wakeHeard: true })).toContain("awake");
  });
});

describe("speaker stores contract", () => {
  it("the operator's label is never an other-speaker label", () => {
    expect(isOtherSpeakerLabel("Operator")).toBe(false);
    expect(isOtherSpeakerLabel("Speaker 2")).toBe(true);
    expect(isOtherSpeakerLabel("Speaker 10")).toBe(true);
    expect(isOtherSpeakerLabel("Voice")).toBe(false);
  });

  it("parseOtherVoices drops anything labeled as the operator", () => {
    const view = parseOtherVoices({
      enrolled: true,
      separationAvailable: true,
      state: "ready",
      kept: "embeddings and transcripts only — raw audio is never retained",
      entries: [
        {
          timestamp: "t1",
          label: "Speaker 2",
          similarity: 0.15,
          transcript: "hello",
          duration_s: 2,
        },
        {
          timestamp: "t2",
          label: "Operator",
          similarity: 0.9,
          transcript: "must never land",
          duration_s: 2,
        },
      ],
      speakers: [{ label: "Speaker 2", utterances: 1, firstHeard: "t1", lastHeard: "t1" }],
    });
    expect(view?.entries).toHaveLength(1);
    expect(view?.entries[0]?.transcript).toBe("hello");
    expect(view?.speakers).toHaveLength(1);
  });

  it("summarizeOtherVoices counts per label with first and last heard", () => {
    const entries: OtherVoiceEntry[] = [
      { timestamp: "t1", label: "Speaker 2", similarity: 0.1, transcript: "a", durationS: 1 },
      { timestamp: "t2", label: "Speaker 3", similarity: 0.2, transcript: "b", durationS: 1 },
      { timestamp: "t3", label: "Speaker 2", similarity: 0.1, transcript: "c", durationS: 1 },
    ];
    expect(summarizeOtherVoices(entries)).toEqual([
      { label: "Speaker 2", utterances: 2, firstHeard: "t1", lastHeard: "t3" },
      { label: "Speaker 3", utterances: 1, firstHeard: "t2", lastHeard: "t2" },
    ]);
  });

  it("the not-enrolled state says separation is not running, in words", () => {
    const view = parseOtherVoices({
      enrolled: false,
      separationAvailable: false,
      state: "not-enrolled",
      entries: [],
      speakers: [],
    });
    expect(separationStateText(view!)).toContain("not running");
    expect(separationStateText(view!)).toContain("no operator voiceprint is enrolled");
  });
});

describe("room command — listening", () => {
  it("opens Listening Mode from its phrases", () => {
    expect(parseRoomCommand("listening")).toBe("listening");
    expect(parseRoomCommand("listening mode")).toBe("listening");
    expect(parseRoomCommand("open listening mode")).toBe("listening");
    expect(parseRoomCommand("Open the listening mode.")).toBe("listening");
  });

  it("does not swallow longer sentences or other rooms", () => {
    expect(parseRoomCommand("open listening mode and fly")).toBeNull();
    expect(parseRoomCommand("open the cube")).toBe("ar-cube");
    expect(parseRoomCommand("open the library")).toBe("library");
  });
});
