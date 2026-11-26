import { describe, expect, it } from "vitest";
import {
  SILENT_SENSOR_CONFIRM_WINDOW_MS,
  SILENT_SENSOR_HONESTY_NOTE,
  SILENT_SENSOR_NAME,
  SILENT_SENSOR_TRIP_COOLDOWN_MS,
  SILENT_SENSOR_TRIP_ID_PREFIX,
  SOUND_LEVEL_REFERENCE,
  SOUND_LEVEL_REFERENCE_BASIS,
  candidateFromSound,
  enrollProfileFromCandidate,
  heardLevelText,
  isSilentSensorCandidateSound,
  isSilentSensorMatch,
  sanitizeSilentSensorState,
  silentSensorDraftText,
  silentSensorOnMatch,
  silentSensorSimilarity,
  silentSensorSoundReading,
  silentSensorTripText,
  soundFramesFromSamples,
  soundLevelReferenceLine,
  type SilentSensorCandidate,
} from "@/avatar/cameras/silentSensor";
import { SoundEventDetector, fingerprintOf, type DetectedSound } from "@/avatar/soundWatch";
import {
  emptyPresenceFile,
  sanitizePresenceFile,
} from "@/avatar/cameras/cameraPresence";
import {
  emptySectorWatchFile,
  sanitizeSectorWatchFile,
  type SectorWatchFile,
  type WatchLogEntry,
} from "@/avatar/cameras/sectorWatch";
import { deriveNotifications, type InboxSources } from "@/avatar/cameras/anubisInbox";

/**
 * MONTU SILENT SENSOR (owner orders 2026-11-26) — the PIR
 * motion sensors cannot talk, so their siren's sound is the
 * signal. These pins hold the laws of the feature:
 *
 *   · HE NAMES IT — no profile exists until a candidate the
 *     system kept is enrolled by his word; an unmatched sound
 *     is called nothing.
 *   · THE SECOND LOOK — a first match is a draft; only a
 *     second match at the same camera inside the window is a
 *     trip, and a trip stands behind a cooldown.
 *   · THE HONESTY BOUND — levels are the level as that camera
 *     heard it (dBFS, its own scale); the reference table is
 *     labeled knowledge, never a measurement, and no text
 *     converts a camera reading into a dB SPL claim.
 *   · THE NOTIFICATION STANDS ON THE LOG — a confirmed trip
 *     in the watch log derives exactly one inbox entry citing
 *     it; a draft hearing derives none.
 */

const T0 = 1_700_000_000_000;

function fingerprint(seed: number): number[] {
  const raw = Array.from({ length: 8 }, (_, i) => Math.abs(Math.sin(seed * (i + 3))) + 0.05);
  const norm = Math.sqrt(raw.reduce((a, v) => a + v * v, 0));
  return raw.map((v) => v / norm);
}

function detected(peakDb: number, durationMs: number, fp = fingerprint(1)): DetectedSound {
  return { at: T0, durationMs, peakDb, fingerprint: fp, dominantHz: 2400 };
}

function candidate(over: Partial<SilentSensorCandidate> = {}): SilentSensorCandidate {
  return {
    fingerprint: fingerprint(1),
    at: T0,
    cameraId: "command-front-window",
    cameraName: "Command",
    peakDbfs: -9,
    durationMs: 2400,
    ...over,
  };
}

describe("the name", () => {
  it("is the War God's name with Silent Sensor after it", () => {
    expect(SILENT_SENSOR_NAME).toBe("Montu Silent Sensor");
  });
});

describe("the reference table — seeded knowledge, labeled as knowledge", () => {
  it("carries the classes he named: alarms, talking, screaming", () => {
    const labels = SOUND_LEVEL_REFERENCE.map((r) => r.label.toLowerCase()).join(" · ");
    expect(labels).toContain("alarm");
    expect(labels).toContain("conversation");
    expect(labels).toContain("screaming");
  });

  it("every row is a sane range with a stated basis", () => {
    for (const row of SOUND_LEVEL_REFERENCE) {
      expect(row.lowDb).toBeGreaterThan(0);
      expect(row.highDb).toBeGreaterThan(row.lowDb);
      expect(row.note.length).toBeGreaterThan(0);
      expect(soundLevelReferenceLine(row)).toContain("reference range");
    }
    expect(SOUND_LEVEL_REFERENCE_BASIS).toContain("not measured by any camera");
  });
});

describe("the honesty bound", () => {
  it("the standing note says a camera mic is not a calibrated meter", () => {
    expect(SILENT_SENSOR_HONESTY_NOTE).toContain("not a calibrated sound-level meter");
    expect(SILENT_SENSOR_HONESTY_NOTE).toContain("never a true sound-pressure");
  });

  it("a heard level is always spoken as the camera's own scale", () => {
    const text = heardLevelText(-9.4);
    expect(text).toContain("dBFS");
    expect(text).toContain("as that camera heard it");
    expect(text).toContain("not a calibrated dB SPL measurement");
  });

  it("the trip text names only the hearing camera and keeps the bound", () => {
    const text = silentSensorTripText("Command", -8);
    expect(text).toContain("Command");
    expect(text).toContain("no other camera is claimed to have heard it");
    expect(text).toContain("not a calibrated dB SPL measurement");
    expect(text).toContain("a back motion sensor has tripped");
    expect(silentSensorDraftText("Command", -8)).toContain("FIRST hearing");
    expect(silentSensorSoundReading("Command", -8)).toContain("library match");
  });
});

describe("the candidate call — loud and sustained, or it is not this feature's business", () => {
  it("a loud sustained sound qualifies", () => {
    expect(isSilentSensorCandidateSound(detected(-10, 2000))).toBe(true);
  });
  it("a loud slam does not — too short", () => {
    expect(isSilentSensorCandidateSound(detected(-6, 120))).toBe(false);
  });
  it("a sustained quiet sound does not — too quiet", () => {
    expect(isSilentSensorCandidateSound(detected(-48, 4000))).toBe(false);
  });
});

describe("he names it — enrollment stands on his word alone", () => {
  it("a candidate becomes the profile under the fixed name, keeping its camera and level", () => {
    const c = candidate();
    const profile = enrollProfileFromCandidate(c, T0 + 1000);
    expect(profile.cameraId).toBe("command-front-window");
    expect(profile.cameraName).toBe("Command");
    expect(profile.peakDbfs).toBe(-9);
    expect(profile.enrolledAt).toBe(T0 + 1000);
    expect(profile.fingerprint).toEqual(c.fingerprint);
  });

  it("with no profile, similarity is null and nothing can match", () => {
    expect(silentSensorSimilarity(fingerprint(1), null)).toBeNull();
    expect(isSilentSensorMatch(null)).toBe(false);
    expect(isSilentSensorMatch(silentSensorSimilarity(fingerprint(1), null))).toBe(false);
  });

  it("the enrolled fingerprint matches itself; a different sound does not", () => {
    const profile = enrollProfileFromCandidate(candidate(), T0);
    expect(isSilentSensorMatch(silentSensorSimilarity(fingerprint(1), profile))).toBe(true);
    expect(isSilentSensorMatch(silentSensorSimilarity(fingerprint(7), profile))).toBe(false);
  });
});

describe("the Second Look for a sound", () => {
  it("first match is a first hearing; a second inside the window is the trip", () => {
    const first = silentSensorOnMatch({ pending: null, lastTripAt: null, cameraId: "cam", now: T0 });
    expect(first.outcome).toBe("first-hearing");
    const second = silentSensorOnMatch({
      pending: first.pending,
      lastTripAt: null,
      cameraId: "cam",
      now: T0 + SILENT_SENSOR_CONFIRM_WINDOW_MS - 1,
    });
    expect(second.outcome).toBe("trip");
    expect(second.pending).toBeNull();
  });

  it("a second hearing after the window starts over as a first hearing", () => {
    const first = silentSensorOnMatch({ pending: null, lastTripAt: null, cameraId: "cam", now: T0 });
    const late = silentSensorOnMatch({
      pending: first.pending,
      lastTripAt: null,
      cameraId: "cam",
      now: T0 + SILENT_SENSOR_CONFIRM_WINDOW_MS + 1,
    });
    expect(late.outcome).toBe("first-hearing");
  });

  it("a different camera's hearing does not confirm the first camera's", () => {
    const first = silentSensorOnMatch({ pending: null, lastTripAt: null, cameraId: "cam-a", now: T0 });
    const other = silentSensorOnMatch({
      pending: first.pending,
      lastTripAt: null,
      cameraId: "cam-b",
      now: T0 + 1000,
    });
    expect(other.outcome).toBe("first-hearing");
  });

  it("after a trip, the cooldown holds — matches are noted, not re-raised", () => {
    const during = silentSensorOnMatch({
      pending: null,
      lastTripAt: T0,
      cameraId: "cam",
      now: T0 + SILENT_SENSOR_TRIP_COOLDOWN_MS - 1,
    });
    expect(during.outcome).toBe("cooldown");
    const after = silentSensorOnMatch({
      pending: null,
      lastTripAt: T0,
      cameraId: "cam",
      now: T0 + SILENT_SENSOR_TRIP_COOLDOWN_MS + 1,
    });
    expect(after.outcome).toBe("first-hearing");
  });
});

describe("the record shapes survive their sanitizers — and garbage does not", () => {
  it("profile + candidate + lastTripAt round-trip", () => {
    const state = sanitizeSilentSensorState({
      profile: enrollProfileFromCandidate(candidate(), T0),
      candidate: candidate({ at: T0 + 5 }),
      lastTripAt: T0 + 9,
    });
    expect(state.profile?.cameraName).toBe("Command");
    expect(state.candidate?.cameraId).toBe("command-front-window");
    expect(state.lastTripAt).toBe(T0 + 9);
  });

  it("a wrong-shaped profile is dropped, never trusted", () => {
    const state = sanitizeSilentSensorState({
      profile: { fingerprint: [1, 2], enrolledAt: T0, cameraId: "cam", peakDbfs: -9 },
      candidate: { fingerprint: "nope" },
      lastTripAt: "yesterday",
    });
    expect(state.profile).toBeNull();
    expect(state.candidate).toBeNull();
    expect(state.lastTripAt).toBeNull();
  });

  it("the presence file carries the silent-sensor record at its honest default", () => {
    const empty = emptyPresenceFile();
    expect(empty.silentSensor).toEqual({ profile: null, candidate: null, lastTripAt: null });
    const round = sanitizePresenceFile(JSON.parse(JSON.stringify(empty)));
    expect(round.silentSensor.profile).toBeNull();
  });
});

describe("the notification stands on the watch log", () => {
  function logEntry(id: string, kind: WatchLogEntry["kind"], text: string): WatchLogEntry {
    return {
      id,
      at: T0,
      cameraId: "command-front-window",
      cameraName: "Command",
      zone: "front",
      kind,
      text,
    };
  }

  function sources(sector: SectorWatchFile): InboxSources {
    return { sector, householdCount: 0, coreEvents: [] };
  }

  it("a confirmed trip derives exactly one entry, citing the log line", () => {
    const sector = sanitizeSectorWatchFile({
      ...emptySectorWatchFile(),
      log: [logEntry(`${SILENT_SENSOR_TRIP_ID_PREFIX}${T0}-command-front-window`, "event", silentSensorTripText("Command", -8))],
    });
    const derived = deriveNotifications(sources(sector)).filter((e) =>
      e.id.startsWith("ntf-silent-"),
    );
    expect(derived).toHaveLength(1);
    expect(derived[0]?.title).toContain(SILENT_SENSOR_NAME);
    expect(derived[0]?.sourceEventId).toBe(`${SILENT_SENSOR_TRIP_ID_PREFIX}${T0}-command-front-window`);
    expect(derived[0]?.cameraName).toBe("Command");
  });

  it("a first (draft) hearing derives NOTHING", () => {
    const sector = sanitizeSectorWatchFile({
      ...emptySectorWatchFile(),
      log: [logEntry(`silent-draft-${T0}-command-front-window`, "draft", silentSensorDraftText("Command", -8))],
    });
    const derived = deriveNotifications(sources(sector)).filter((e) =>
      e.id.startsWith("ntf-silent-"),
    );
    expect(derived).toHaveLength(0);
  });
});

describe("the measured road — samples to frames to a detected sound", () => {
  it("a loud tonal burst over quiet becomes ONE detected sound with its pitch", () => {
    const sampleRate = 16000;
    const quiet = new Float32Array(sampleRate * 2).map(() => (Math.random() - 0.5) * 0.002);
    const burst = new Float32Array(sampleRate * 2);
    for (let i = 0; i < burst.length; i++) {
      burst[i] = 0.6 * Math.sin((2 * Math.PI * 2400 * i) / sampleRate);
    }
    const tail = new Float32Array(sampleRate * 2).map(() => (Math.random() - 0.5) * 0.002);
    const all = new Float32Array(quiet.length + burst.length + tail.length);
    all.set(quiet, 0);
    all.set(burst, quiet.length);
    all.set(tail, quiet.length + burst.length);

    const frames = soundFramesFromSamples(all, sampleRate, T0 + 6000);
    expect(frames.length).toBeGreaterThan(30);
    const detector = new SoundEventDetector();
    const found: DetectedSound[] = [];
    for (const frame of frames) {
      const d = detector.feed(frame);
      if (d) found.push(d);
    }
    expect(found).toHaveLength(1);
    const sound = found[0]!;
    expect(sound.peakDb).toBeGreaterThan(-20);
    expect(sound.dominantHz).toBeGreaterThan(2000);
    expect(sound.dominantHz).toBeLessThan(2800);
    // And it qualifies as a candidate, and its own fingerprint matches itself.
    expect(isSilentSensorCandidateSound(sound)).toBe(true);
    const profile = enrollProfileFromCandidate(candidateFromSound(sound, "cam", "Command"), T0);
    expect(isSilentSensorMatch(silentSensorSimilarity(sound.fingerprint, profile))).toBe(true);
    expect(fingerprintOf).toBeTypeOf("function");
  });

  it("silence alone detects nothing", () => {
    const sampleRate = 16000;
    const quiet = new Float32Array(sampleRate * 3).map(() => (Math.random() - 0.5) * 0.002);
    const frames = soundFramesFromSamples(quiet, sampleRate, T0 + 3000);
    const detector = new SoundEventDetector();
    for (const frame of frames) {
      expect(detector.feed(frame)).toBeNull();
    }
  });
});
