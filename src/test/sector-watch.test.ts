import { describe, expect, it } from "vitest";
import {
  audioBand,
  crossExamLogText,
  decideBedroom,
  decideCommon,
  decideFront,
  decideFrontTruck,
  decideWeapon,
  defaultSectorConfig,
  defaultZoneForCamera,
  descriptionFromAnswer,
  emptySectorWatchFile,
  isNotableReading,
  judgmentDue,
  judgmentText,
  motionBand,
  plateNoteFor,
  plateReadingFromAnswer,
  sanitizeCrossExam,
  sanitizeSectorEvent,
  sanitizeSectorJudgment,
  sanitizeSectorWatchFile,
  sanitizeWatchLogEntry,
  sectorConfigFor,
  unacknowledgedJudgments,
  unacknowledgedSectorEvents,
  zoneLabel,
} from "@/avatar/cameras/sectorWatch";
import {
  effectiveFlags,
  emptyPermissionsProfile,
  itemKey,
  planPermissionsReconcile,
  sanitizePermissionsProfile,
  seedProfileFromFleet,
  type PermissionItemState,
} from "@/avatar/permissionsProfile";
import {
  defaultPresenceState,
  effectiveHousehold,
  followMaySteer,
  sanitizeHouseholdEnrollment,
  sanitizePresenceFile,
  sanitizePresenceState,
  streamFollowsPtzFromCoverage,
  streamProbeNote,
} from "@/avatar/cameras/cameraPresence";
import { alertRingReading } from "@/avatar/alertRing";

/**
 * SECTOR WATCH (2026-11-26) — the pure core's truth rules:
 * zones are born from the Captain's layout and stay editable
 * data; a first YES from the analyzer is a DRAFT and only a
 * second YES makes an event; the bedroom clears only an
 * enrolled face and never pretends recognition exists before
 * enrollment; common areas log presence and raise nothing; and
 * the Alert Ring counts a sector event only from the record's
 * unacknowledged count — never from nothing.
 */

describe("sector zones + defaults", () => {
  it("cameras are born into the Captain's sectors", () => {
    expect(defaultZoneForCamera("command-front-window")).toBe("front");
    expect(defaultZoneForCamera("bedroom")).toBe("bedroom");
    expect(defaultZoneForCamera("agagmoss-v1")).toBe("common");
    expect(defaultZoneForCamera("anything-else")).toBe("common");
    expect(defaultSectorConfig("bedroom").watch).toBe(true);
  });

  it("zone labels carry the rule in plain words", () => {
    expect(zoneLabel("bedroom")).toContain("Khadija");
    expect(zoneLabel("front")).toContain("vehicles");
    expect(zoneLabel("common")).toContain("expected");
  });

  it("a stored config wins; an absent one is the default", () => {
    const file = sanitizeSectorWatchFile({
      settings: {
        intervalSec: 120,
        cameras: { bedroom: { cameraId: "bedroom", zone: "common", watch: false } },
      },
    });
    expect(sectorConfigFor(file.settings, "bedroom")).toEqual({
      cameraId: "bedroom",
      zone: "common",
      watch: false,
    });
    expect(sectorConfigFor(file.settings, "command-front-window").zone).toBe("front");
    expect(file.settings.intervalSec).toBe(120);
  });

  it("the interval is clamped to its honest bounds", () => {
    expect(sanitizeSectorWatchFile({ settings: { intervalSec: 5 } }).settings.intervalSec).toBe(20);
    expect(sanitizeSectorWatchFile({ settings: { intervalSec: 99999 } }).settings.intervalSec).toBe(900);
    expect(sanitizeSectorWatchFile({ settings: { intervalSec: "soon" } }).settings.intervalSec).toBe(60);
    expect(emptySectorWatchFile().settings.intervalSec).toBe(60);
  });

  it("a malformed stored zone falls back to that camera's default sector", () => {
    const file = sanitizeSectorWatchFile({
      settings: { cameras: { bedroom: { cameraId: "bedroom", zone: "dungeon", watch: true } } },
    });
    expect(file.settings.cameras["bedroom"]?.zone).toBe("bedroom");
  });
});

describe("watch log + event sanitizers", () => {
  it("keeps a well-formed log entry and drops a shapeless one", () => {
    const ok = sanitizeWatchLogEntry({
      id: "w1",
      at: 100,
      cameraId: "bedroom",
      cameraName: "Bedroom",
      zone: "bedroom",
      kind: "draft",
      text: "NOT CONFIRMED",
    });
    expect(ok?.kind).toBe("draft");
    expect(sanitizeWatchLogEntry({ id: "w2", at: 1, cameraId: "x", text: "" })).toBeNull();
    expect(sanitizeWatchLogEntry(null)).toBeNull();
  });

  it("keeps a well-formed event; acknowledged survives only as true", () => {
    const ok = sanitizeSectorEvent({
      id: "e1",
      at: 100,
      cameraId: "bedroom",
      cameraName: "Bedroom",
      zone: "bedroom",
      kind: "bedroom-no-access",
      summary: "NO ACCESS",
      reading: "both looks agreed",
      frames: ["a.jpg"],
      acknowledged: "yes",
    });
    expect(ok?.kind).toBe("bedroom-no-access");
    expect(ok?.acknowledged).toBe(false);
    expect(ok?.frames).toEqual(["a.jpg"]);
  });

  it("counts only unacknowledged events for the ring", () => {
    const file = sanitizeSectorWatchFile({
      events: [
        { id: "e1", at: 1, cameraId: "c", summary: "s", zone: "front", kind: "front-threat", acknowledged: true },
        { id: "e2", at: 2, cameraId: "c", summary: "s", zone: "front", kind: "front-threat", acknowledged: false },
      ],
    });
    expect(unacknowledgedSectorEvents(file)).toHaveLength(1);
    expect(unacknowledgedSectorEvents(file)[0]?.id).toBe("e2");
  });
});

describe("front decision — a draft is not an event", () => {
  it("no verdict is unavailable; a no is quiet", () => {
    expect(decideFront(null, null, "Command").outcome).toBe("unavailable");
    expect(decideFront(false, null, "Command").outcome).toBe("quiet");
  });

  it("a first yes the second look denies stays a NOT CONFIRMED draft", () => {
    const denied = decideFront(true, false, "Command");
    expect(denied.outcome).toBe("draft");
    expect(denied.text).toContain("NOT CONFIRMED");
    const silent = decideFront(true, null, "Command");
    expect(silent.outcome).toBe("draft");
  });

  it("only two yeses make an event — and the words still call it a reading", () => {
    const event = decideFront(true, true, "Command");
    expect(event.outcome).toBe("event");
    expect(event.text).toContain("second look");
    expect(event.text).toContain("model's reading");
  });
});

describe("bedroom decision — the room rule", () => {
  it("no person is quiet; an unconfirmed person is a draft, never an event", () => {
    expect(decideBedroom(false, null, { state: "none-enrolled" }, "Bedroom").outcome).toBe("quiet");
    expect(decideBedroom(true, false, { state: "none-enrolled" }, "Bedroom").outcome).toBe("draft");
    expect(decideBedroom(true, null, { state: "match", name: "The Captain" }, "Bedroom").outcome).toBe("draft");
  });

  it("a confirmed person matching an enrolled face is logged, no alert", () => {
    const ok = decideBedroom(true, true, { state: "match", name: "Khadija" }, "Bedroom");
    expect(ok.outcome).toBe("person");
    expect(ok.text).toContain("Khadija");
    expect(ok.text).toContain("no alert");
  });

  it("a confirmed person with no match is a NO ACCESS event", () => {
    const event = decideBedroom(true, true, { state: "no-match" }, "Bedroom");
    expect(event.outcome).toBe("event");
    expect(event.text).toContain("NO ACCESS");
  });

  it("a confirmed person with no face verdict is a NO ACCESS event", () => {
    expect(decideBedroom(true, true, { state: "no-verdict" }, "Bedroom").outcome).toBe("event");
  });

  it("with nobody enrolled, any confirmed person is NO ACCESS — and the text says why", () => {
    const event = decideBedroom(true, true, { state: "none-enrolled" }, "Bedroom");
    expect(event.outcome).toBe("event");
    expect(event.text).toContain("No face is enrolled yet");
  });
});

describe("common decision — Sid's rule", () => {
  it("a person in a common area is logged presence, never an event", () => {
    const seen = decideCommon(true, "Desk Camera");
    expect(seen.outcome).toBe("person");
    expect(seen.text).toContain("raises nothing");
    expect(decideCommon(false, "Desk Camera").outcome).toBe("quiet");
    expect(decideCommon(null, "Desk Camera").outcome).toBe("unavailable");
  });
});

describe("household enrollment", () => {
  it("sanitizes a member and rejects a frameless claim", () => {
    const ok = sanitizeHouseholdEnrollment({
      name: "Khadija",
      cameraId: "bedroom",
      cameraName: "Bedroom",
      frames: ["member-khadija-1-0.jpg"],
      at: 42,
    });
    expect(ok?.name).toBe("Khadija");
    expect(sanitizeHouseholdEnrollment({ name: "X", cameraId: "c", frames: [], at: 1 })).toBeNull();
  });

  it("the household list wins; the creator enrollment stands in as the Captain until then", () => {
    const legacyOnly = sanitizePresenceFile({
      enrollment: { cameraId: "bedroom", cameraName: "Bedroom", frames: ["creator-1.jpg"], at: 7 },
    });
    const standing = effectiveHousehold(legacyOnly);
    expect(standing).toHaveLength(1);
    expect(standing[0]?.name).toBe("The Captain");

    const withHousehold = sanitizePresenceFile({
      enrollment: { cameraId: "bedroom", cameraName: "Bedroom", frames: ["creator-1.jpg"], at: 7 },
      household: [
        { name: "Khadija", cameraId: "bedroom", cameraName: "Bedroom", frames: ["m.jpg"], at: 9 },
      ],
    });
    expect(effectiveHousehold(withHousehold).map((m) => m.name)).toEqual(["Khadija"]);

    expect(effectiveHousehold(sanitizePresenceFile(null))).toEqual([]);
  });

  it("the presence file round-trips the household list", () => {
    const file = sanitizePresenceFile({
      household: [
        { name: "The Captain", cameraId: "bedroom", cameraName: "Bedroom", frames: ["a.jpg"], at: 3 },
        { name: "Khadija", cameraId: "bedroom", cameraName: "Bedroom", frames: ["b.jpg"], at: 4 },
      ],
    });
    expect(file.household.map((m) => m.name)).toEqual(["The Captain", "Khadija"]);
  });
});

describe("alert ring — the sector record joins the named sources", () => {
  it("no sector input reads as zero — the ring never invents a sector alert", () => {
    const reading = alertRingReading({ soundFeed: [], daddyCallRinging: false });
    expect(reading.active).toBe(false);
    expect(reading.sectorAlertsWaiting).toBe(0);
    expect(reading.sourcesLine).toBe("No alert stands.");
  });

  it("unacknowledged sector events raise the ring and name themselves", () => {
    const one = alertRingReading({ soundFeed: [], daddyCallRinging: false, sectorAlertsWaiting: 1 });
    expect(one.active).toBe(true);
    expect(one.sourcesLine).toContain("one Sector Watch security event");
    const two = alertRingReading({ soundFeed: [], daddyCallRinging: true, sectorAlertsWaiting: 2 });
    expect(two.active).toBe(true);
    expect(two.sourcesLine).toContain("2 Sector Watch security events");
    expect(two.sourcesLine).toContain("Khadija's call");
  });
});

describe("the stream probe — stream-follows-PTZ is measured, never assumed", () => {
  it("a camera is born unmeasured — no claim either way", () => {
    const state = defaultPresenceState();
    expect(state.streamFollowsPtz).toBeNull();
    expect(state.streamProbedAt).toBeNull();
  });

  it("the verdict comes from the measured change, evidence included", () => {
    expect(streamFollowsPtzFromCoverage(null)).toBeNull();
    expect(streamFollowsPtzFromCoverage(Number.NaN)).toBeNull();
    expect(streamFollowsPtzFromCoverage(0.02)).toBe(false);
    expect(streamFollowsPtzFromCoverage(0.15)).toBe(true);
    expect(streamFollowsPtzFromCoverage(0.62)).toBe(true);
    expect(streamProbeNote(0.62)).toContain("62%");
    expect(streamProbeNote(0.62)).toContain("FOLLOWS");
    expect(streamProbeNote(0.02)).toContain("does NOT follow");
    expect(streamProbeNote(null)).toContain("could not compare");
  });

  it("the measurement survives the store round-trip; garbage reads as unmeasured", () => {
    const measured = sanitizePresenceState({ streamFollowsPtz: false, streamProbedAt: 9, streamNote: "x" });
    expect(measured.streamFollowsPtz).toBe(false);
    expect(measured.streamProbedAt).toBe(9);
    expect(sanitizePresenceState({ streamFollowsPtz: "yes" }).streamFollowsPtz).toBeNull();
  });

  it("follow steering stands only where the stream follows (or is unmeasured)", () => {
    expect(followMaySteer(true)).toBe(true);
    expect(followMaySteer(null)).toBe(true);
    expect(followMaySteer(false)).toBe(false);
  });
});

describe("the Captain's truck — the bedroom law on the front sector", () => {
  it("no truck answer claims nothing; no person at the truck falls through", () => {
    expect(decideFrontTruck(null, null, { state: "none-enrolled" }, "Command").outcome).toBe("unavailable");
    expect(decideFrontTruck(false, null, { state: "none-enrolled" }, "Command").outcome).toBe("quiet");
  });

  it("a truck draft stays a draft — never an event", () => {
    const d = decideFrontTruck(true, false, { state: "none-enrolled" }, "Command");
    expect(d.outcome).toBe("draft");
    expect(d.text).toContain("NOT CONFIRMED");
  });

  it("a confirmed person at the truck who matches the household is logged, no event", () => {
    const d = decideFrontTruck(true, true, { state: "match", name: "The Captain" }, "Command");
    expect(d.outcome).toBe("person");
    expect(d.text).toContain("The Captain");
  });

  it("a confirmed person at the truck who does not match is an event", () => {
    expect(decideFrontTruck(true, true, { state: "no-match" }, "Command").outcome).toBe("event");
    expect(decideFrontTruck(true, true, { state: "no-verdict" }, "Command").outcome).toBe("event");
    const none = decideFrontTruck(true, true, { state: "none-enrolled" }, "Command");
    expect(none.outcome).toBe("event");
    expect(none.text).toContain("No face is enrolled yet");
  });
});

describe("evidence answers — the still is the evidence, the words are an index", () => {
  it("plate readings survive only as plausible plate shapes", () => {
    expect(plateReadingFromAnswer("ABC 123")).toBe("ABC 123");
    expect(plateReadingFromAnswer("  xyz-789 ")).toBe("XYZ-789");
    expect(plateReadingFromAnswer("NONE")).toBeNull();
    expect(plateReadingFromAnswer("none visible")).toBeNull();
    expect(plateReadingFromAnswer("")).toBeNull();
    expect(plateReadingFromAnswer(null)).toBeNull();
    expect(plateReadingFromAnswer("123456")).toBeNull();
    expect(plateReadingFromAnswer("the plate is on the car")).toBeNull();
  });

  it("plate notes say plainly when nothing was readable", () => {
    expect(plateNoteFor(null)).toContain("No plate readable");
    expect(plateNoteFor("ABC 123")).toContain("ABC 123");
    expect(plateNoteFor("ABC 123")).toContain("still is the evidence");
  });

  it("descriptions clean up and NONE means none", () => {
    expect(descriptionFromAnswer("NONE")).toBe("");
    expect(descriptionFromAnswer(null)).toBe("");
    expect(descriptionFromAnswer(" A  tall man in a red shirt. ")).toBe("A tall man in a red shirt.");
  });

  it("events round-trip their evidence; path-shaped still names are refused", () => {
    const event = sanitizeSectorEvent({
      id: "e1",
      at: 5,
      cameraId: "command-front-window",
      zone: "front",
      kind: "front-truck",
      summary: "truck",
      evidence: [
        { file: "e1-ev1.jpg", at: 6, plate: "ABC 123", plateNote: "n" },
        { file: "../escape.jpg", at: 6, plate: null, plateNote: "n" },
      ],
      personReading: "A man in a dark hoodie.",
    });
    expect(event?.kind).toBe("front-truck");
    expect(event?.evidence).toHaveLength(1);
    expect(event?.evidence[0]?.plate).toBe("ABC 123");
    expect(event?.personReading).toContain("hoodie");
  });

  it("judgments round-trip and count until acknowledged", () => {
    const j = sanitizeSectorJudgment({
      id: "j1",
      at: 5,
      cameraId: "bedroom",
      zone: "bedroom",
      text: "look",
      still: "j1.jpg",
    });
    expect(j?.still).toBe("j1.jpg");
    const file = sanitizeSectorWatchFile({ judgments: [j] });
    expect(unacknowledgedJudgments(file)).toHaveLength(1);
  });
});

describe("Anubis's judgment — the notable band and its cooldown", () => {
  it("only front/bedroom drafts are notable — never common, never events", () => {
    const draft = decideFront(true, false, "Command");
    expect(isNotableReading("front", draft)).toBe(true);
    expect(isNotableReading("bedroom", draft)).toBe(true);
    expect(isNotableReading("common", draft)).toBe(false);
    expect(isNotableReading("front", decideFront(true, true, "Command"))).toBe(false);
    expect(isNotableReading("front", decideFront(false, null, "Command"))).toBe(false);
  });

  it("the cooldown holds for fifteen minutes per camera", () => {
    expect(judgmentDue(null, 1_000)).toBe(true);
    expect(judgmentDue(1_000, 1_000 + 60_000)).toBe(false);
    expect(judgmentDue(1_000, 1_000 + 15 * 60_000)).toBe(true);
  });

  it("the judgment line names itself a judgment call, not an event", () => {
    expect(judgmentText("front", "Command")).toContain("wants you to look");
    expect(judgmentText("bedroom", "Bedroom")).toContain("Not an event");
  });
});

describe("the weapon flag — top tier in any zone", () => {
  it("two yeses are an event; anything less never is", () => {
    const event = decideWeapon(true, true, "Bedroom");
    expect(event.outcome).toBe("event");
    expect(event.text).toContain("TOP TIER");
    expect(decideWeapon(true, false, "Bedroom").outcome).toBe("draft");
    expect(decideWeapon(true, null, "Bedroom").outcome).toBe("draft");
    expect(decideWeapon(false, null, "Bedroom").outcome).toBe("quiet");
    expect(decideWeapon(null, null, "Bedroom").outcome).toBe("unavailable");
  });

  it("an unconfirmed weapon draft says plainly it never becomes a judgment item", () => {
    expect(decideWeapon(true, false, "Command").text).toContain("never becomes a judgment item");
  });

  it("weapon events round-trip with their kind", () => {
    const event = sanitizeSectorEvent({
      id: "w1",
      at: 5,
      cameraId: "bedroom",
      zone: "bedroom",
      kind: "weapon",
      summary: "WEAPON",
    });
    expect(event?.kind).toBe("weapon");
  });
});

describe("cross-examination — measurable indicators, honestly labeled", () => {
  it("the sound band reads the measured level and labels itself an indicator", () => {
    expect(audioBand(null)).toContain("UNAVAILABLE");
    expect(audioBand(0.004)).toContain("quiet");
    expect(audioBand(0.04)).toContain("audible activity");
    expect(audioBand(0.3)).toContain("loud");
    expect(audioBand(0.04)).toContain("INDICATOR");
    expect(audioBand(0.04)).toContain("does not say anyone is doing wrong");
  });

  it("the motion band reads the measured change the same way", () => {
    expect(motionBand(null)).toContain("UNAVAILABLE");
    expect(motionBand(0.01)).toContain("held still");
    expect(motionBand(0.4)).toContain("much of the scene");
    expect(motionBand(0.4)).toContain("INDICATOR");
  });

  it("no band ever claims a heart rate or a certainty", () => {
    for (const line of [audioBand(0.04), motionBand(0.4), audioBand(null), motionBand(null)]) {
      expect(line.toLowerCase()).not.toContain("heart");
      expect(line.toLowerCase()).not.toContain("bpm");
    }
  });

  it("cross-exam entries sanitize to known tools with readings", () => {
    const entries = sanitizeCrossExam([
      { tool: "sound", reading: "audio level RMS 0.040" },
      { tool: "pulse", reading: "invented" },
      { tool: "motion", reading: "40% changed" },
      { tool: "picture", reading: "" },
    ]);
    expect(entries.map((e) => e.tool)).toEqual(["sound", "motion"]);
    expect(crossExamLogText("an event", entries)).toContain("never merged into a certainty");
  });
});

describe("uniform permissions — one shared profile, deviations only by his hand", () => {
  const granted: PermissionItemState = {
    kind: "camera",
    id: "bedroom",
    retired: false,
    current: { ownerConfirmed: true, controlGranted: true },
  };
  const ungrantedDevice: PermissionItemState = {
    kind: "device",
    id: "watch",
    retired: false,
    current: { ownerConfirmed: false, controlGranted: false },
  };

  it("the seed follows the fleet as found", () => {
    expect(seedProfileFromFleet([granted])).toEqual({ ownerConfirmed: true, controlGranted: true });
    expect(seedProfileFromFleet([ungrantedDevice])).toEqual({
      ownerConfirmed: false,
      controlGranted: false,
    });
  });

  it("first sight adopts items as found — a differing standing state becomes a deviation", () => {
    const file = emptyPermissionsProfile();
    file.born = true;
    file.profile = { ownerConfirmed: true, controlGranted: true };
    const plan = planPermissionsReconcile(file, [granted, ungrantedDevice]);
    expect(plan.writes.size).toBe(0);
    expect(plan.nextFile.applied[itemKey("camera", "bedroom")]).toEqual(granted.current);
    expect(plan.nextFile.deviations[itemKey("device", "watch")]).toEqual(ungrantedDevice.current);
  });

  it("an untouched item takes a changed shared profile at once", () => {
    const file = emptyPermissionsProfile();
    file.born = true;
    file.profile = { ownerConfirmed: false, controlGranted: false };
    file.applied[itemKey("camera", "bedroom")] = { ownerConfirmed: true, controlGranted: true };
    const plan = planPermissionsReconcile(file, [granted]);
    expect(plan.writes.get(itemKey("camera", "bedroom"))).toEqual({
      ownerConfirmed: false,
      controlGranted: false,
    });
  });

  it("an item changed by his hand elsewhere is adopted, never stripped", () => {
    const file = emptyPermissionsProfile();
    file.born = true;
    file.profile = { ownerConfirmed: false, controlGranted: false };
    file.applied[itemKey("camera", "bedroom")] = { ownerConfirmed: false, controlGranted: false };
    const plan = planPermissionsReconcile(file, [granted]);
    expect(plan.writes.size).toBe(0);
    expect(plan.nextFile.deviations[itemKey("camera", "bedroom")]).toEqual(granted.current);
  });

  it("a deviation wins over the shared profile for its item only", () => {
    const file = emptyPermissionsProfile();
    file.profile = { ownerConfirmed: true, controlGranted: true };
    file.deviations[itemKey("device", "watch")] = { controlGranted: false };
    expect(effectiveFlags(file, "device", "watch")).toEqual({
      ownerConfirmed: true,
      controlGranted: false,
    });
    expect(effectiveFlags(file, "camera", "bedroom")).toEqual({
      ownerConfirmed: true,
      controlGranted: true,
    });
  });

  it("a retired device is never written and never adopted", () => {
    const file = emptyPermissionsProfile();
    file.born = true;
    file.profile = { ownerConfirmed: true, controlGranted: true };
    const retired: PermissionItemState = {
      kind: "device",
      id: "wepwawet",
      retired: true,
      current: { ownerConfirmed: false, controlGranted: false },
    };
    const plan = planPermissionsReconcile(file, [retired]);
    expect(plan.writes.size).toBe(0);
    expect(plan.nextFile.applied[itemKey("device", "wepwawet")]).toBeUndefined();
    expect(plan.nextFile.deviations[itemKey("device", "wepwawet")]).toBeUndefined();
  });

  it("the profile file round-trips through its sanitizer", () => {
    const file = sanitizePermissionsProfile({
      born: true,
      profile: { ownerConfirmed: true, controlGranted: false },
      deviations: { "camera:bedroom": { controlGranted: true } },
      version: 3,
    });
    expect(file.profile.controlGranted).toBe(false);
    expect(file.deviations["camera:bedroom"]).toEqual({ controlGranted: true });
    expect(file.version).toBe(3);
  });
});
