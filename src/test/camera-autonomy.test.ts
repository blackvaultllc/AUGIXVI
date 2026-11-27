import { describe, expect, it } from "vitest";
import {
  applyEyeChange,
  defaultEyeState,
  describeEyeChange,
  eyeLabel,
  sanitizeEyeMode,
  sanitizeEyeState,
  CAMERA_EYE_MODES,
} from "@/avatar/cameras/cameraEyes";
import { sanitizePresenceFile, sanitizePresenceState } from "@/avatar/cameras/cameraPresence";
import {
  autonomousLookAt,
  autonomyByOrder,
  defaultSectorSettings,
  sanitizeSectorSettings,
  ZONE_LOOK_TARGETS,
} from "@/avatar/cameras/sectorWatch";
import {
  cameraGestureByName,
  gestureStepsFor,
  matchConstructWake,
  CAMERA_GESTURES,
  CONSTRUCT_WAKE_PHRASES,
} from "@/avatar/cameras/agamoss";
import {
  findCameraBySerial,
  normalizeSerial,
  redetectCamera,
  sanitizeCamera,
} from "@/avatar/cameras/cameraRegistry";

describe("the eyes — red always (owner order 2026-11-27)", () => {
  it("default to red, standing on the order itself", () => {
    const eyes = defaultEyeState();
    expect(eyes.mode).toBe("red");
    expect(eyes.by).toBe("the standing order");
    expect(eyes.reason).toContain("2026-11-27");
  });

  it("there is no off among the modes — the type's own list refuses it", () => {
    expect(CAMERA_EYE_MODES).toEqual(["red", "night-vision", "spotlight"]);
    expect(sanitizeEyeMode("off")).toBe("red");
    expect(sanitizeEyeMode("dark")).toBe("red");
    expect(sanitizeEyeMode(undefined)).toBe("red");
    expect(sanitizeEyeMode("night-vision")).toBe("night-vision");
  });

  it("a stored non-red state stands only with its recorded by + reason", () => {
    expect(sanitizeEyeState({ mode: "night-vision", since: 5, by: "Agamoss", reason: "the yard is pitch black" }).mode).toBe(
      "night-vision",
    );
    expect(sanitizeEyeState({ mode: "night-vision", since: 5, by: "", reason: "" }).mode).toBe("red");
    expect(sanitizeEyeState({ mode: "off", since: 5, by: "x", reason: "y" }).mode).toBe("red");
    expect(sanitizeEyeState(null).mode).toBe("red");
  });

  it("a change lands with who and why, and the log line names both", () => {
    const applied = applyEyeChange(defaultEyeState(), {
      id: "e1",
      at: 100,
      cameraId: "cam-1",
      cameraName: "Bes",
      to: "night-vision",
      by: "Agamoss",
      reason: "the yard is pitch black — night vision sees it better",
    });
    expect(applied).not.toBeNull();
    expect(applied!.state.mode).toBe("night-vision");
    expect(applied!.entry.from).toBe("red");
    expect(describeEyeChange(applied!.entry)).toContain("Agamoss");
    expect(describeEyeChange(applied!.entry)).toContain("pitch black");
  });

  it("a change with no reason, or no one standing behind it, is refused", () => {
    const base = defaultEyeState();
    expect(
      applyEyeChange(base, { id: "e", at: 1, cameraId: "c", cameraName: "Bes", to: "spotlight", by: "Agamoss", reason: "  " }),
    ).toBeNull();
    expect(
      applyEyeChange(base, { id: "e", at: 1, cameraId: "c", cameraName: "Bes", to: "spotlight", by: "", reason: "why" }),
    ).toBeNull();
    expect(
      applyEyeChange(base, { id: "e", at: 1, cameraId: "c", cameraName: "Bes", to: "red", by: "Agamoss", reason: "why" }),
    ).toBeNull();
  });

  it("presence state carries the eyes through its sanitizer", () => {
    const state = sanitizePresenceState(undefined);
    expect(state.eyes.mode).toBe("red");
    const file = sanitizePresenceFile(undefined);
    expect(file.eyeChanges).toEqual([]);
    expect(eyeLabel("red")).toBe("red");
  });
});

describe("autonomy — on until a recorded order turns it off (2026-11-27)", () => {
  it("the default settings stand autonomous", () => {
    const settings = defaultSectorSettings();
    expect(settings.autonomy.enabled).toBe(true);
    expect(settings.autonomy.since).toBeNull();
  });

  it("a stored off stands only as a recorded order — a bare off reads as on", () => {
    const recorded = sanitizeSectorSettings({
      ...defaultSectorSettings(),
      autonomy: { enabled: false, since: 1234, note: "turned off by a recorded order" },
    });
    expect(recorded.autonomy.enabled).toBe(false);
    expect(recorded.autonomy.since).toBe(1234);
    const bare = sanitizeSectorSettings({
      ...defaultSectorSettings(),
      autonomy: { enabled: false },
    });
    expect(bare.autonomy.enabled).toBe(true);
  });

  it("autonomyByOrder is the recorded road both ways", () => {
    const off = autonomyByOrder(false, 500);
    expect(off.enabled).toBe(false);
    expect(off.since).toBe(500);
    expect(off.note).toContain("recorded order");
    const on = autonomyByOrder(true, 600);
    expect(on.enabled).toBe(true);
    expect(on.since).toBe(600);
  });

  it("the autonomous look walks the zone's own targets, deterministically", () => {
    const first = autonomousLookAt("front", 0);
    expect(ZONE_LOOK_TARGETS.front).toContain(first.target);
    expect(autonomousLookAt("front", 0)).toEqual(first);
    const later = autonomousLookAt("front", 9000);
    expect(later.targetIndex).not.toBe(first.targetIndex);
    const bedroom = autonomousLookAt("bedroom", 0);
    expect(ZONE_LOOK_TARGETS.bedroom).toContain(bedroom.target);
    expect(bedroom.target).not.toBe(first.target);
  });
});

describe("construct wakes — Montu and Anubis (2026-11-27)", () => {
  it("the full phrases match, whole and in order", () => {
    expect(matchConstructWake("Montu awaken")?.construct).toBe("montu");
    expect(matchConstructWake("anubis awaken")?.construct).toBe("anubis");
    expect(matchConstructWake("Anubis, wake up.")?.construct).toBe("anubis");
    expect(matchConstructWake("montu wake up please")?.construct).toBe("montu");
  });

  it("the bare name never matches — the name alone wakes no one", () => {
    expect(matchConstructWake("Montu")).toBeNull();
    expect(matchConstructWake("Anubis")).toBeNull();
    expect(matchConstructWake("is Anubis there")).toBeNull();
    expect(matchConstructWake("montu is awake now")).toBeNull();
    expect(CONSTRUCT_WAKE_PHRASES.montu).toContain("montu awaken");
    expect(CONSTRUCT_WAKE_PHRASES.anubis).toContain("anubis awaken");
  });
});

describe("named PTZ gestures — nod yes, shake no (2026-11-27)", () => {
  it("the registry carries both behaviors by their callable names", () => {
    expect(CAMERA_GESTURES.map((g) => g.name)).toEqual(["nod-yes", "shake-no"]);
    expect(cameraGestureByName("nod-yes")?.kind).toBe("yes");
    expect(cameraGestureByName("shake-no")?.kind).toBe("no");
    expect(cameraGestureByName("wave")?.kind).toBeUndefined();
  });

  it("the steps behind the names are the head code: yes works the tilt axis, no works the pan axis", () => {
    const yes = gestureStepsFor("yes");
    expect(yes.length).toBeGreaterThan(0);
    expect(yes.every((s) => s.axis === "tilt")).toBe(true);
    const no = gestureStepsFor("no");
    expect(no.length).toBeGreaterThan(0);
    expect(no.every((s) => s.axis === "pan")).toBe(true);
  });
});

describe("serial re-detection — the registry keys on the serial (2026-11-27)", () => {
  const registered = sanitizeCamera({
    id: "cam-bes",
    name: "Bes",
    host: "10.0.0.43",
    onvifPort: 10080,
    rtspPort: 10554,
    username: "admin",
    serial: "VE8633581MTFH",
    ownerConfirmed: true,
    controlGranted: true,
    lenses: [{ id: "lens-1", label: "PTZ", kind: "ptz", rtspPath: "/ucast/11" }],
    addedAt: 42,
  })!;

  it("serials compare without case or separators", () => {
    expect(normalizeSerial("ve8633 581-mtfh")).toBe("VE8633581MTFH");
    expect(normalizeSerial("")).toBeNull();
    expect(normalizeSerial(undefined)).toBeNull();
    expect(findCameraBySerial([registered], "ve8633581mtfh")?.id).toBe("cam-bes");
    expect(findCameraBySerial([registered], "VE0000000XXXX")).toBeNull();
  });

  it("a sighting with the camera's own serial re-attaches the registration at the new address", () => {
    const moved = redetectCamera(registered, { serial: "VE8633581MTFH", host: "10.0.0.87" });
    expect(moved).not.toBeNull();
    expect(moved!.host).toBe("10.0.0.87");
    expect(moved!.id).toBe("cam-bes");
    expect(moved!.name).toBe("Bes");
    expect(moved!.ownerConfirmed).toBe(true);
    expect(moved!.controlGranted).toBe(true);
    expect(moved!.addedAt).toBe(42);
    expect(moved!.lenses).toEqual(registered.lenses);
  });

  it("a sighting with a different serial moves nothing", () => {
    expect(redetectCamera(registered, { serial: "VE9999999ZZZZ", host: "10.0.0.87" })).toBeNull();
    expect(redetectCamera(registered, { serial: "VE8633581MTFH", host: "  " })).toBeNull();
  });
});
