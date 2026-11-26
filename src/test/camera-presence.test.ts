import { describe, expect, it } from "vitest";
import {
  analyticsConfigTokenFromProfiles,
  analyticsItemValue,
  auxiliaryCommands,
  defaultPresenceState,
  describeIntent,
  flipAnalyticsEnable,
  followVelocity,
  hearsAnubisName,
  imagingFieldNames,
  motionCentroidIn,
  parseCameraCommand,
  parseStrictYesNo,
  patrolVelocityAt,
  presenceFor,
  resolveCommandCamera,
  sanitizeHearingEvent,
  sanitizePresenceFile,
  sanitizePresenceState,
  spotlightDoorFromAux,
  spotlightDoorFromImaging,
  trackingDoorFromAnalytics,
  PATROL_SPEED,
  type CameraNameRef,
} from "@/avatar/cameras/cameraPresence";

/**
 * CAMERA PRESENCE (2026-11-26) — the pure core's truth rules:
 * a stored state survives only in its exact shape; the command
 * set is small and explicit (everything else is speech for
 * Anubis, never an accidental order); the patrol and follow are
 * plain math over measured inputs; motion is never called a
 * person; and a spotlight or tracking SWITCH exists only where
 * the unit's own ONVIF answers expose a real door.
 */

const CAMERAS: CameraNameRef[] = [
  { id: "desk", name: "Desk Camera" },
  { id: "bed", name: "Bedroom" },
  { id: "front", name: "Command" },
];

describe("presence state sanitize", () => {
  it("defaults to everything off and unprobed", () => {
    const s = defaultPresenceState();
    expect(s.hearing).toBe(false);
    expect(s.commands).toBe(false);
    expect(s.patrol.active).toBe(false);
    expect(s.follow.active).toBe(false);
    expect(s.spotlight.door).toBeNull();
    expect(s.tracking.door).toBeNull();
  });

  it("drops malformed claims back to the honest default", () => {
    const s = sanitizePresenceState({ hearing: "yes", patrol: { active: 1, sweepMs: 5 } });
    expect(s.hearing).toBe(false);
    expect(s.patrol.active).toBe(false);
    expect(s.patrol.sweepMs).toBe(6000);
    const f = sanitizePresenceFile({ cameras: { a: { hearing: true } }, hearing: [{ id: 1 }] });
    expect(f.cameras["a"]?.hearing).toBe(true);
    expect(f.hearing).toHaveLength(0);
    expect(f.enrollment).toBeNull();
  });

  it("keeps a well-formed hearing event and rejects a shapeless one", () => {
    const ok = sanitizeHearingEvent({
      id: "h1",
      at: 123,
      cameraId: "bed",
      cameraName: "Bedroom",
      text: "Anubis, patrol the area",
      kind: "command",
      acted: "Started patrol",
      routed: false,
    });
    expect(ok?.kind).toBe("command");
    expect(sanitizeHearingEvent({ id: "h2", at: 1, cameraId: "bed", text: "" })).toBeNull();
    expect(sanitizeHearingEvent(null)).toBeNull();
  });

  it("presenceFor returns the stored state or the default", () => {
    const file = sanitizePresenceFile({ cameras: { bed: { hearing: true, commands: true } } });
    expect(presenceFor(file, "bed").commands).toBe(true);
    expect(presenceFor(file, "nope").hearing).toBe(false);
  });
});

describe("hearing his name", () => {
  it("matches Anubis as a whole word only", () => {
    expect(hearsAnubisName("Anubis, are you there?")).toBe(true);
    expect(hearsAnubisName("hey anubis")).toBe(true);
    expect(hearsAnubisName("that dog is anubislike")).toBe(false);
    expect(hearsAnubisName("nothing here")).toBe(false);
  });
});

describe("camera command parser", () => {
  it("hears the Captain's own patrol example as a patrol order", () => {
    const intent = parseCameraCommand(
      "use this camera to keep monitoring this area left and right",
      CAMERAS,
      "front",
    );
    expect(intent).toEqual({ type: "patrol-start", cameraId: "front" });
  });

  it("parses the spotlight both ways", () => {
    expect(parseCameraCommand("turn off the spotlight", CAMERAS, "bed")).toEqual({
      type: "spotlight",
      cameraId: "bed",
      on: false,
    });
    expect(parseCameraCommand("spotlight on", CAMERAS, "bed")).toEqual({
      type: "spotlight",
      cameraId: "bed",
      on: true,
    });
  });

  it("parses patrol stop before the bare stop, and follow/record both ways", () => {
    expect(parseCameraCommand("stop patrolling", CAMERAS, "bed")?.type).toBe("patrol-stop");
    expect(parseCameraCommand("stop", CAMERAS, "bed")?.type).toBe("stop-motion");
    expect(parseCameraCommand("follow me", CAMERAS, "bed")?.type).toBe("follow-start");
    expect(parseCameraCommand("stop following me", CAMERAS, "bed")?.type).toBe("follow-stop");
    expect(parseCameraCommand("start recording", CAMERAS, "bed")?.type).toBe("record-start");
    expect(parseCameraCommand("stop recording", CAMERAS, "bed")?.type).toBe("record-stop");
  });

  it("parses directions and turn-to-me", () => {
    expect(parseCameraCommand("turn left", CAMERAS, "bed")).toEqual({
      type: "ptz",
      cameraId: "bed",
      pan: -1,
      tilt: 0,
    });
    expect(parseCameraCommand("look up", CAMERAS, "bed")).toEqual({
      type: "ptz",
      cameraId: "bed",
      pan: 0,
      tilt: 1,
    });
    expect(parseCameraCommand("turn to me", CAMERAS, "bed")?.type).toBe("turn-to-speaker");
  });

  it("a named camera wins over the camera that heard him", () => {
    expect(resolveCommandCamera("bedroom camera, start patrolling", CAMERAS, "front")).toBe("bed");
    const intent = parseCameraCommand("bedroom, turn off the spotlight", CAMERAS, "front");
    expect(intent).toEqual({ type: "spotlight", cameraId: "bed", on: false });
    expect(resolveCommandCamera("turn left", CAMERAS, "front")).toBe("front");
  });

  it("ordinary speech is NOT a camera command", () => {
    expect(parseCameraCommand("tell me a story about a patrol in the desert", CAMERAS, "bed")).toBeNull();
    expect(parseCameraCommand("the weather is nice today", CAMERAS, "bed")).toBeNull();
    expect(parseCameraCommand("i recorded a song yesterday", CAMERAS, "bed")).toBeNull();
    expect(parseCameraCommand("following the game last night was fun", CAMERAS, "bed")).toBeNull();
  });

  it("describes intents in plain words for the hearing record", () => {
    expect(describeIntent({ type: "patrol-start", cameraId: "bed" }, "Bedroom")).toContain("Bedroom");
    expect(describeIntent({ type: "spotlight", cameraId: "bed", on: false }, "Bedroom")).toContain("off");
  });
});

describe("patrol pattern", () => {
  it("sweeps out, rests, sweeps back, rests — and wraps", () => {
    const sweep = 6000;
    expect(patrolVelocityAt(0, sweep)).toBe(-PATROL_SPEED);
    expect(patrolVelocityAt(sweep - 1, sweep)).toBe(-PATROL_SPEED);
    expect(patrolVelocityAt(sweep + 100, sweep)).toBe(0);
    expect(patrolVelocityAt(sweep + 1200 + 100, sweep)).toBe(PATROL_SPEED);
    expect(patrolVelocityAt(2 * sweep + 1200 + 100, sweep)).toBe(0);
    expect(patrolVelocityAt(2 * sweep + 2400 + 10, sweep)).toBe(-PATROL_SPEED);
    expect(patrolVelocityAt(-5, sweep)).toBe(0);
  });
});

describe("motion centroid + follow step", () => {
  const W = 8;
  const H = 4;
  function frame(blocks: [number, number][]): Uint8Array {
    const f = new Uint8Array(W * H);
    for (const [x, y] of blocks) f[y * W + x] = 200;
    return f;
  }

  it("identical frames are not a subject", () => {
    const a = frame([[1, 1]]);
    expect(motionCentroidIn(a, a, W, H)).toBeNull();
  });

  it("finds the centroid of what changed", () => {
    const prev = frame([]);
    const curr = frame([
      [6, 1],
      [7, 1],
      [6, 2],
      [7, 2],
    ]);
    const c = motionCentroidIn(prev, curr, W, H);
    expect(c).not.toBeNull();
    expect(c!.x).toBeGreaterThan(0.8);
    expect(c!.coverage).toBeGreaterThan(0.1);
  });

  it("a whisper of change under the floor is not a subject", () => {
    const prev = frame([]);
    const curr = new Uint8Array(W * H);
    curr[0] = 200;
    expect(motionCentroidIn(prev, curr, W, H, 28, 0.2)).toBeNull();
  });

  it("follow holds still inside the deadband and steers outside it", () => {
    expect(followVelocity({ x: 0.52, y: 0.48 })).toBeNull();
    const right = followVelocity({ x: 0.9, y: 0.5 });
    expect(right?.pan).toBeGreaterThan(0);
    expect(right?.tilt).toBe(0);
    const up = followVelocity({ x: 0.5, y: 0.1 });
    expect(up?.tilt).toBeGreaterThan(0);
    const clamped = followVelocity({ x: 1, y: 0 });
    expect(clamped?.pan).toBeLessThanOrEqual(0.6);
    expect(clamped?.tilt).toBeLessThanOrEqual(0.6);
  });
});

describe("strict yes/no verdicts", () => {
  it("only a reply that begins yes or no is a verdict", () => {
    expect(parseStrictYesNo("Yes")).toBe(true);
    expect(parseStrictYesNo("yes, there is")).toBe(true);
    expect(parseStrictYesNo("No.")).toBe(false);
    expect(parseStrictYesNo("I believe there might be a person")).toBeNull();
    expect(parseStrictYesNo("")).toBeNull();
    expect(parseStrictYesNo("yesterday was fine")).toBeNull();
  });
});

describe("spotlight door probe", () => {
  it("IR-only imaging is NOT a spotlight door — and the note says why", () => {
    const xml = `<ImagingSettings><Brightness>50</Brightness><IrCutFilter>ON</IrCutFilter><Exposure/></ImagingSettings>`;
    const fields = imagingFieldNames(xml);
    const verdict = spotlightDoorFromImaging(fields);
    expect(verdict.door).toBeNull();
    expect(verdict.note).toContain("IR");
    expect(verdict.note).toContain("no switch");
  });

  it("a white-light imaging field IS a door", () => {
    const verdict = spotlightDoorFromImaging(["Brightness", "WhiteLightMode", "IrCutFilter"]);
    expect(verdict.door).toBe("WhiteLightMode");
  });

  it("an advertised lamp auxiliary command IS a door", () => {
    const caps = `<Capabilities><AuxiliaryCommands><AuxiliaryCommand>tt:Wiper|On</AuxiliaryCommand><AuxiliaryCommand>tt:Lamp|On</AuxiliaryCommand></AuxiliaryCommands></Capabilities>`;
    const commands = auxiliaryCommands(caps);
    expect(commands).toContain("tt:Lamp|On");
    const verdict = spotlightDoorFromAux(commands);
    expect(verdict?.door).toBe("aux:tt:Lamp");
    expect(spotlightDoorFromAux(["tt:Wiper|On"])).toBeNull();
  });
});

describe("unit tracking door probe", () => {
  it("a tracking configuration with an enable item IS a door, and flips", () => {
    const xml = `<GetVideoAnalyticsConfigurationsResponse><Configurations><VideoAnalyticsConfiguration token="AT0"><Name>AutoTracking</Name><Parameters><SimpleItem Name="Enabled" Value="false"/></Parameters></VideoAnalyticsConfiguration></Configurations></GetVideoAnalyticsConfigurationsResponse>`;
    const verdict = trackingDoorFromAnalytics(xml);
    expect(verdict.door).toBe("analytics:AT0:Enabled");
    expect(analyticsItemValue(xml, "Enabled")).toBe(false);
    const flipped = flipAnalyticsEnable(xml, "Enabled", true);
    expect(flipped).toContain('Name="Enabled" Value="true"');
    expect(analyticsItemValue(flipped!, "Enabled")).toBe(true);
  });

  it("detection rules are NOT tracking — no door, and the note names them", () => {
    const xml = `<Configurations><VideoAnalyticsConfiguration token="MD0"><Name>MotionDetection</Name><Parameters><SimpleItem Name="Enabled" Value="true"/></Parameters></VideoAnalyticsConfiguration></Configurations>`;
    const verdict = trackingDoorFromAnalytics(xml);
    expect(verdict.door).toBeNull();
    expect(verdict.note).toContain("MotionDetection");
    expect(verdict.note).toContain("not tracking");
  });

  it("no analytics at all reads as no door", () => {
    const verdict = trackingDoorFromAnalytics("<Capabilities/>");
    expect(verdict.door).toBeNull();
  });

  it("reads the analytics token out of a profiles reply", () => {
    const profiles = `<Profiles token="P0"><VideoAnalyticsConfiguration token="AT0"/></Profiles>`;
    expect(analyticsConfigTokenFromProfiles(profiles)).toBe("AT0");
    expect(analyticsConfigTokenFromProfiles("<Profiles/>")).toBeNull();
  });
});
