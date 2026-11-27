import { describe, expect, it } from "vitest";
import {
  addEscalationAction,
  advanceEscalation,
  alarmMayFire,
  answerWithGesture,
  assessHeardThreat,
  captainOverrideEscalation,
  chainComplete,
  countNods,
  countShakes,
  dangerLogText,
  gradeDanger,
  interactionLight,
  isWakeOnlyLine,
  matchWakePhrase,
  newEscalation,
  noGesture,
  numberGesture,
  sanitizeAgamossState,
  sanitizeWakePhrases,
  voiceMayCommand,
  yesGesture,
  DEFAULT_WAKE_PHRASES,
  GESTURE_BEAT_MS,
  type GestureChecks,
} from "@/avatar/cameras/agamoss";
import { sanitizePresenceFile } from "@/avatar/cameras/cameraPresence";
import { deriveNotifications, type InboxSources } from "@/avatar/cameras/anubisInbox";
import {
  emptySectorWatchFile,
  type SectorWatchFile,
  type WatchLogEntry,
} from "@/avatar/cameras/sectorWatch";

/**
 * AGAMOSS — WAKE, SPOTLIGHT, GESTURES, ALARM LAW (2026-11-26).
 * The pins:
 *   · THE WAKE — a full phrase or nothing: the bare name never
 *     opens a session, each phrase family does, and the list
 *     is the core config's own (sanitized, never name-only).
 *   · THE VOICE GATE — captain-matched or nothing.
 *   · THE HEAD CODE — yes is two nods, no is three shakes, a
 *     number turns right for its first digit and left for its
 *     second; answers stand only on real checks.
 *   · THE SPOTLIGHT DERIVES — listening ⇒ on; no door ⇒ the
 *     state says so instead of faking a lit proof.
 *   · THE ALARM LAW — non-danger NEVER fires the alarm path;
 *     the chain advances one honest step at a time, and an
 *     action is chain-approved only after the chain ran (or
 *     the Captain overrode it).
 */

describe("the wake — full phrases only", () => {
  it("rejects the bare name, in every dress", () => {
    for (const line of [
      "agamoss",
      "Agamoss!",
      "hey agamoss",
      "agamoss is a snake",
      "i was talking about agamoss earlier",
      "agamoss agamoss",
    ]) {
      expect(matchWakePhrase(line, DEFAULT_WAKE_PHRASES)).toBeNull();
    }
  });

  it("accepts each wake phrase family", () => {
    expect(matchWakePhrase("Agamoss wake up", DEFAULT_WAKE_PHRASES)).toBe("agamoss wake up");
    expect(matchWakePhrase("yo Agamoss wake up", DEFAULT_WAKE_PHRASES)).toBe("yo agamoss wake up");
    expect(matchWakePhrase("Agamoss, can you hear me?", DEFAULT_WAKE_PHRASES)).toBe(
      "agamoss can you hear me",
    );
    expect(matchWakePhrase("Agamoss I need your help", DEFAULT_WAKE_PHRASES)).toBe(
      "agamoss i need your help",
    );
  });

  it("accepts a phrase inside a longer line, and the STT spelling of his name", () => {
    expect(matchWakePhrase("okay yo agamoss wake up please", DEFAULT_WAKE_PHRASES)).toBe(
      "yo agamoss wake up",
    );
    expect(matchWakePhrase("Agamos wake up", DEFAULT_WAKE_PHRASES)).toBe("agamoss wake up");
  });

  it("honors the core config's own list over the defaults", () => {
    const custom = ["agamoss rise and shine"];
    expect(matchWakePhrase("agamoss rise and shine", custom)).toBe("agamoss rise and shine");
    expect(matchWakePhrase("agamoss wake up", custom)).toBeNull();
  });

  it("knows a wake-only line from a wake with words after it", () => {
    expect(isWakeOnlyLine("yo agamoss wake up", DEFAULT_WAKE_PHRASES)).toBe(true);
    expect(isWakeOnlyLine("agamoss can you hear me", DEFAULT_WAKE_PHRASES)).toBe(true);
    expect(isWakeOnlyLine("agamoss wake up and watch the door", DEFAULT_WAKE_PHRASES)).toBe(false);
  });

  it("sanitizes the stored list: no bare name, no dupes, defaults when unusable", () => {
    expect(sanitizeWakePhrases(["agamoss"])).toEqual(DEFAULT_WAKE_PHRASES);
    expect(sanitizeWakePhrases([])).toEqual(DEFAULT_WAKE_PHRASES);
    expect(sanitizeWakePhrases("nope")).toEqual(DEFAULT_WAKE_PHRASES);
    expect(
      sanitizeWakePhrases(["Agamoss Rise", "agamoss rise", "no name here", 42]),
    ).toEqual(["agamoss rise"]);
  });
});

describe("the voice gate", () => {
  it("admits only the captain-matched voice", () => {
    expect(voiceMayCommand("captain")).toBe(true);
    expect(voiceMayCommand("another")).toBe(false);
    expect(voiceMayCommand(null)).toBe(false);
  });
});

describe("the head code — gesture shapes", () => {
  it("YES is exactly two nods, all tilt", () => {
    const steps = yesGesture();
    expect(countNods(steps)).toBe(2);
    expect(steps.every((s) => s.axis === "tilt")).toBe(true);
    expect(steps).toHaveLength(4);
  });

  it("NO is exactly three shakes, all pan", () => {
    const steps = noGesture();
    expect(countShakes(steps)).toBe(3);
    expect(steps.every((s) => s.axis === "pan")).toBe(true);
    expect(steps).toHaveLength(6);
  });

  it("a number turns right, nods the first digit, turns left, nods the second (86)", () => {
    const steps = numberGesture(86);
    expect(steps).not.toBeNull();
    const seq = steps!;
    // First move: a right turn.
    expect(seq[0]).toMatchObject({ axis: "pan" });
    expect(seq[0]!.velocity).toBeGreaterThan(0);
    // Nods before the left turn: 8. After it: 6.
    const leftTurnIdx = seq.findIndex((s, i) => i > 0 && s.axis === "pan" && s.velocity < 0);
    expect(leftTurnIdx).toBeGreaterThan(0);
    expect(countNods(seq.slice(0, leftTurnIdx))).toBe(8);
    expect(countNods(seq.slice(leftTurnIdx))).toBe(6);
    expect(countNods(seq)).toBe(14);
  });

  it("a zero digit is one SLOW nod, never a silent gap", () => {
    const steps = numberGesture(8)!; // 0 then 8
    const firstTilt = steps.find((s) => s.axis === "tilt");
    expect(firstTilt?.ms).toBe(GESTURE_BEAT_MS * 2);
    expect(countNods(steps)).toBe(1 + 8);
  });

  it("refuses numbers the head cannot say", () => {
    expect(numberGesture(100)).toBeNull();
    expect(numberGesture(-1)).toBeNull();
    expect(numberGesture(4.5)).toBeNull();
    expect(numberGesture(Number.NaN)).toBeNull();
  });
});

describe("gesture answers — real checks or no gesture", () => {
  const checks: GestureChecks = {
    heardCaptain: true,
    personPresent: null,
    rainChancePercent: null,
    temperatureF: null,
  };

  it("answers 'can you hear me' yes — he was heard", () => {
    expect(answerWithGesture("agamoss can you hear me", checks)).toMatchObject({ kind: "yes" });
    expect(answerWithGesture("can you hear me", { ...checks, heardCaptain: false })).toBeNull();
  });

  it("answers the rain percent from the live feed, within tolerance", () => {
    const withFeed = { ...checks, rainChancePercent: 22 };
    expect(answerWithGesture("is the weather around 20% today", withFeed)).toMatchObject({
      kind: "yes",
    });
    expect(answerWithGesture("is the rain chance 80 percent", withFeed)).toMatchObject({
      kind: "no",
    });
    // No feed, no gesture.
    expect(answerWithGesture("is the weather around 20% today", checks)).toBeNull();
  });

  it("signs the temperature as a number — only from a feed, only two digits", () => {
    expect(
      answerWithGesture("how many degrees is it", { ...checks, temperatureF: 86.2 }),
    ).toMatchObject({ kind: "number", value: 86 });
    expect(answerWithGesture("how many degrees is it", checks)).toBeNull();
    expect(
      answerWithGesture("what is the temperature", { ...checks, temperatureF: 104 }),
    ).toBeNull();
  });

  it("spends a person answer only on a person reading", () => {
    expect(answerWithGesture("is anyone there", checks)).toBeNull();
    expect(
      answerWithGesture("is anyone there", { ...checks, personPresent: true }),
    ).toMatchObject({ kind: "yes" });
    expect(
      answerWithGesture("is anybody in there", { ...checks, personPresent: false }),
    ).toMatchObject({ kind: "no" });
  });

  it("gives no gesture to a question no check can carry", () => {
    expect(answerWithGesture("what do you think of the raven poem", checks)).toBeNull();
    expect(answerWithGesture("tell me a story", checks)).toBeNull();
  });
});

describe("the spotlight — derived from the listening state", () => {
  it("listening with a door: on, drivable", () => {
    const light = interactionLight({ listening: true, spotlightDoor: "WhiteLight" });
    expect(light.shouldBeOn).toBe(true);
    expect(light.canDrive).toBe(true);
  });

  it("listening without a door: still derives on, and says the proof cannot be shown", () => {
    const light = interactionLight({ listening: true, spotlightDoor: null });
    expect(light.shouldBeOn).toBe(true);
    expect(light.canDrive).toBe(false);
    expect(light.note).toContain("no spotlight door");
  });

  it("not listening: off, whatever the door", () => {
    expect(interactionLight({ listening: false, spotlightDoor: "WhiteLight" }).shouldBeOn).toBe(
      false,
    );
    expect(interactionLight({ listening: false, spotlightDoor: null }).shouldBeOn).toBe(false);
  });
});

describe("the threat pattern and the alarm gate", () => {
  it("reads harm + Khadija as the alarm-grade pattern", () => {
    const a = assessHeardThreat("i will hurt khadija if you do that");
    expect(a.threatTowardKhadija).toBe(true);
    expect(a.concerning).toBe(true);
    const b = assessHeardThreat("tell your daughter i will shoot");
    expect(b.threatTowardKhadija).toBe(true);
  });

  it("reads harm without Khadija as concerning only — recorded, never alarmed", () => {
    const a = assessHeardThreat("i will hurt you for this");
    expect(a.threatTowardKhadija).toBe(false);
    expect(a.concerning).toBe(true);
  });

  it("reads ordinary speech as neither", () => {
    const a = assessHeardThreat("khadija drew a picture of a bird at school today");
    expect(a.threatTowardKhadija).toBe(false);
    expect(a.concerning).toBe(false);
    expect(a.matched).toBeNull();
  });

  it("the gate: non-danger NEVER fires; each pure-danger signal does", () => {
    expect(alarmMayFire(gradeDanger({ weaponConfirmed: false, threatTowardKhadija: false }))).toBe(
      false,
    );
    expect(alarmMayFire(gradeDanger({ weaponConfirmed: true, threatTowardKhadija: false }))).toBe(
      true,
    );
    expect(alarmMayFire(gradeDanger({ weaponConfirmed: false, threatTowardKhadija: true }))).toBe(
      true,
    );
    expect(alarmMayFire("none")).toBe(false);
  });
});

describe("the chain — logged stages, honest stamps", () => {
  const base = () =>
    newEscalation({
      id: "agamoss-danger-1-cam",
      at: 1000,
      cameraId: "cam",
      cameraName: "Bes",
      reason: "a test flag",
    });

  it("advances one step at a time — skipping is refused", () => {
    const rec = base();
    expect(rec.stage).toBe("flagged");
    expect(advanceEscalation(rec, "deity-review", 1001)).toBe(rec); // skip refused
    expect(advanceEscalation(rec, "chain-approved", 1001)).toBe(rec);
    const step1 = advanceEscalation(rec, "anubis-notified", 1001);
    expect(step1.stage).toBe("anubis-notified");
    expect(advanceEscalation(step1, "anubis-notified", 1002)).toBe(step1); // no repeats
    const step2 = advanceEscalation(step1, "deity-review", 1002);
    const step3 = advanceEscalation(step2, "chain-approved", 1003);
    expect(step3.stage).toBe("chain-approved");
    expect(step3.history.map((h) => h.stage)).toEqual([
      "flagged",
      "anubis-notified",
      "deity-review",
      "chain-approved",
    ]);
    expect(chainComplete(step3)).toBe(true);
  });

  it("stamps chain-approved ONLY after the chain ran", () => {
    const early = addEscalationAction(base(), "acted too soon", 1001);
    expect(early.actions[0]?.chainApproved).toBe(false);
    let rec = base();
    rec = advanceEscalation(rec, "anubis-notified", 1001);
    rec = advanceEscalation(rec, "deity-review", 1002);
    const mid = addEscalationAction(rec, "still mid-chain", 1003);
    expect(mid.actions[0]?.chainApproved).toBe(false);
    rec = advanceEscalation(rec, "chain-approved", 1004);
    const done = addEscalationAction(rec, "the alarm action", 1005);
    expect(done.actions[0]?.chainApproved).toBe(true);
  });

  it("the Captain's override completes the chain from any stage", () => {
    const rec = captainOverrideEscalation(base(), 1001);
    expect(rec.stage).toBe("captain-override");
    expect(chainComplete(rec)).toBe(true);
    const acted = addEscalationAction(rec, "his word, acted on", 1002);
    expect(acted.actions[0]?.chainApproved).toBe(true);
  });

  it("the state survives the presence file's sanitizer, records and list together", () => {
    const file = sanitizePresenceFile({
      agamoss: {
        wakePhrases: ["agamoss rise and shine"],
        escalations: [base(), { id: 7 }, null],
      },
    });
    expect(file.agamoss.wakePhrases).toEqual(["agamoss rise and shine"]);
    expect(file.agamoss.escalations).toHaveLength(1);
    expect(file.agamoss.escalations[0]?.stage).toBe("flagged");
    const empty = sanitizePresenceFile(null);
    expect(empty.agamoss.wakePhrases).toEqual(DEFAULT_WAKE_PHRASES);
    expect(empty.agamoss.escalations).toEqual([]);
    expect(sanitizeAgamossState(undefined).wakePhrases).toEqual(DEFAULT_WAKE_PHRASES);
  });

  it("the flag's log line names the chain it ran", () => {
    expect(dangerLogText("Bes", "a test reason")).toContain("AGAMOSS DANGER FLAG");
    expect(dangerLogText("Bes", "a test reason")).toContain("deity review");
  });
});

describe("Anubis is notified — the inbox derives from the flag's own log line", () => {
  function sourcesWithLog(log: WatchLogEntry[]): InboxSources {
    const sector: SectorWatchFile = { ...emptySectorWatchFile(), log };
    return { sector, householdCount: 0, coreEvents: [] };
  }

  const flagLine: WatchLogEntry = {
    id: "agamoss-danger-123-cam",
    at: 5000,
    cameraId: "cam",
    cameraName: "Bes",
    zone: "front",
    kind: "event",
    text: "Bes: AGAMOSS DANGER FLAG — a test reason",
  };

  it("a danger flag's event line becomes a SYSTEM entry", () => {
    const entries = deriveNotifications(sourcesWithLog([flagLine]));
    const hit = entries.find((e) => e.id === "ntf-agamoss-agamoss-danger-123-cam");
    expect(hit).toBeDefined();
    expect(hit?.kind).toBe("system");
    expect(hit?.title).toContain("DANGER FLAG");
    expect(hit?.sourceEventId).toBe("agamoss-danger-123-cam");
  });

  it("a draft with the prefix, and ordinary lines, derive nothing", () => {
    const entries = deriveNotifications(
      sourcesWithLog([
        { ...flagLine, id: "agamoss-danger-9-cam", kind: "draft" },
        {
          id: "watch-1-cam",
          at: 4000,
          cameraId: "cam",
          cameraName: "Bes",
          zone: "front",
          kind: "event",
          text: "an ordinary watch line",
        },
      ]),
    );
    expect(entries.filter((e) => e.id.startsWith("ntf-agamoss-"))).toHaveLength(0);
  });
});
