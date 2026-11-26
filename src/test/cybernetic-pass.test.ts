import { beforeEach, describe, expect, it, vi } from "vitest";
import { ringPresenceState, ringSegments } from "@/avatar/presenceRing";
import { alertRingReading } from "@/avatar/alertRing";
import {
  acknowledgeAllSoundAlerts,
  acknowledgeSoundAlert,
  currentSoundFeed,
  publishSoundEntry,
  resetSoundFeedForTest,
  unacknowledgedSoundAlerts,
  type SoundFeedEntry,
} from "@/avatar/soundWatchFeed";
import type { SoundEventEntry } from "@/avatar/soundWatch";
import {
  emptyDeviceCoreState,
  lawInForce,
  lawInForceLine,
  mergeAllStop,
  mergeLocalIntoCore,
  proposeFlagChange,
  resolveFlagRequest,
  sanitizeDeviceCoreState,
  seedDeviceCoreState,
  setAllStop,
  WEPWAWET_SOLD_AT,
  type DeviceCoreState,
} from "@/avatar/devices/deviceStoreCore";
import {
  ALL_STOP_NOTE,
  createSimulatedPrinterChannel,
  loadCommandLog,
  sendDeviceCommand,
} from "@/avatar/devices/commandModule";
import { PRINTER_GCODE_PROFILE } from "@/avatar/devices/commandProfiles";
import { runDeviceFrame } from "@/avatar/devices/deviceBridge.server";
import type { DeviceProfile } from "@/avatar/devices/deviceRegistry";
import { summonsLine, summonsTransitions } from "@/avatar/devices/presence";
import {
  parseSecondLookAnswer,
  runSecondLook,
  secondLookPrompt,
} from "@/avatar/secondLook";
import { heardAnswer, remoteAnswer, signalAnswer } from "@/avatar/identify";
import {
  formationRows,
  parityLine,
  sensesCensusLine,
  type FormationProbe,
} from "@/avatar/formation";
import { earnedMaps, earnedMapsLine } from "@/avatar/devices/earnedMaps";
import { checkSeal, parseSealManifest, type SealFileEntry } from "@/avatar/goDriveSeal";

/**
 * THE CYBERNETIC PASS (2026-11-26) — the eight ranked builds from
 * the survey dossier, pinned at the logic layer:
 *   1. The Identifier — registry first, library second, UNKNOWN
 *      never guessed, unavailable said aloud.
 *   2. The All-Stop + the Law in Force — the halt refuses at the
 *      engine AND at the bridge; the counts are derived, never
 *      stored.
 *   3. Second Look — yes confirms, anything else does not; an
 *      unreachable model is FIRST PASS ONLY, never fake stamps.
 *   4. The Alert Ring — real records only (sound feed + daddy
 *      ring); acknowledgment is the only release.
 *   5. The Summons — flagged devices only, strength-and-trend
 *      words only.
 *   6. The Formation — probed rows, plain-words parity, NO LIVE
 *      READING where no probe can read.
 *   7. Earned Maps — the dog's map stands as TEMPLATE; unbound
 *      profiles do not appear.
 *   8. Seal Check — MATCH / MISSING / CHANGED, and NO SEAL is
 *      never a pass.
 */

function device(overrides: Partial<DeviceProfile> = {}): DeviceProfile {
  return {
    id: "device-printer",
    displayName: "Shop Printer",
    kind: "other",
    transport: "usb",
    externalId: "PRN-1",
    source: "manual",
    declaredServices: [],
    capabilities: [],
    limitations: [],
    batteryLevel: null,
    measured: {},
    presence: "unknown",
    presenceEvents: [],
    firstSeen: 1000,
    lastSeen: 2000,
    ownerConfirmed: true,
    controlGranted: true,
    ...overrides,
  };
}

function stateWith(registry: DeviceProfile[]): DeviceCoreState {
  return { ...emptyDeviceCoreState(), registry };
}

/* --------------------------- 4. Alert Ring --------------------------- */

describe("the Alert Ring — the ring's ALERT state", () => {
  it("outranks speaking, listening, thinking, and even connecting", () => {
    expect(
      ringPresenceState({ ready: true, speaking: true, listening: true, acting: true, alert: true }),
    ).toBe("alert");
    expect(
      ringPresenceState({ ready: false, speaking: false, listening: false, acting: false, alert: true }),
    ).toBe("alert");
    expect(
      ringPresenceState({ ready: true, speaking: true, listening: false, acting: false }),
    ).toBe("speaking");
  });

  it("lights all 24 segments in the alert tone", () => {
    const segments = ringSegments("alert");
    expect(segments).toHaveLength(24);
    expect(segments.every((s) => s.tone === "alert")).toBe(true);
  });
});

function soundEntry(overrides: Partial<SoundEventEntry> = {}): SoundEventEntry {
  return {
    id: "sound-1",
    at: 5000,
    label: "glass breaking",
    source: "library",
    confidence: null,
    peakDb: -12,
    distanceBand: "NEAR",
    distanceIsEstimate: true,
    durationMs: 800,
    character: "peak -12 dB",
    fingerprint: [1, 2, 3],
    alert: true,
    ...overrides,
  };
}

describe("the sound feed + alert reading — acknowledgment is the only release", () => {
  beforeEach(() => {
    resetSoundFeedForTest();
    localStorage.clear();
  });

  it("a published alert stands unacknowledged until the Captain acknowledges it", () => {
    publishSoundEntry(soundEntry());
    const feed = currentSoundFeed();
    expect(unacknowledgedSoundAlerts(feed)).toHaveLength(1);
    expect(alertRingReading({ soundFeed: feed, daddyCallRinging: false }).active).toBe(true);

    const after = acknowledgeSoundAlert("sound-1");
    expect(unacknowledgedSoundAlerts(after)).toHaveLength(0);
    expect(alertRingReading({ soundFeed: after, daddyCallRinging: false }).active).toBe(false);
  });

  it("acknowledgment survives a re-publish of the same entry; a NEW alert stands again", () => {
    publishSoundEntry(soundEntry());
    acknowledgeSoundAlert("sound-1");
    publishSoundEntry(soundEntry());
    expect(unacknowledgedSoundAlerts(currentSoundFeed())).toHaveLength(0);
    publishSoundEntry(soundEntry({ id: "sound-2", at: 6000 }));
    expect(unacknowledgedSoundAlerts(currentSoundFeed())).toHaveLength(1);
    acknowledgeAllSoundAlerts();
    expect(unacknowledgedSoundAlerts(currentSoundFeed())).toHaveLength(0);
  });

  it("non-alert sounds never raise the ring; the daddy ring raises it alone", () => {
    publishSoundEntry(soundEntry({ id: "sound-3", alert: false, label: "birds" }));
    const feed = currentSoundFeed();
    expect(alertRingReading({ soundFeed: feed, daddyCallRinging: false }).active).toBe(false);
    const ringing = alertRingReading({ soundFeed: feed, daddyCallRinging: true });
    expect(ringing.active).toBe(true);
    expect(ringing.sourcesLine).toContain("Khadija's call is ringing");
  });

  it("the feed persists across a fresh read of the storage", () => {
    publishSoundEntry(soundEntry());
    const raw = localStorage.getItem("augi.soundwatch.feed.v1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as SoundFeedEntry[];
    expect(parsed[0]).toMatchObject({ id: "sound-1", alert: true, acknowledged: false });
  });
});

/* --------------------- 2. All-Stop + Law in Force -------------------- */

describe("the All-Stop — the core store's halt flag", () => {
  it("sanitize carries the flag; a missing flag reads as live, never as stopped", () => {
    expect(sanitizeDeviceCoreState({ allStop: { active: true, at: 42 } }).allStop).toEqual({
      active: true,
      at: 42,
    });
    expect(sanitizeDeviceCoreState({}).allStop).toEqual({ active: false, at: 0 });
    expect(sanitizeDeviceCoreState(null).allStop).toEqual({ active: false, at: 0 });
  });

  it("merges take the later change, and a tie fails toward STOPPED", () => {
    expect(mergeAllStop({ active: false, at: 10 }, { active: true, at: 20 })).toEqual({
      active: true,
      at: 20,
    });
    expect(mergeAllStop({ active: true, at: 20 }, { active: false, at: 10 })).toEqual({
      active: true,
      at: 20,
    });
    expect(mergeAllStop({ active: false, at: 20 }, { active: true, at: 20 })).toEqual({
      active: true,
      at: 20,
    });
    const merged = mergeLocalIntoCore(
      { ...emptyDeviceCoreState(), allStop: { active: true, at: 99 } },
      emptyDeviceCoreState(),
    );
    expect(merged.allStop).toEqual({ active: true, at: 99 });
  });

  it("engaging and releasing are both written to the device command log", () => {
    const stopped = setAllStop(emptyDeviceCoreState(), true, 1000);
    expect(stopped.allStop).toEqual({ active: true, at: 1000 });
    expect(stopped.log).toHaveLength(1);
    expect(stopped.log[0]).toMatchObject({
      deviceId: "all-stop",
      commandName: "ALL-STOP engaged",
      result: "refused",
      at: 1000,
    });
    const released = setAllStop(stopped, false, 2000);
    expect(released.allStop).toEqual({ active: false, at: 2000 });
    expect(released.log).toHaveLength(2);
    expect(released.log[1]).toMatchObject({ commandName: "ALL-STOP released", at: 2000 });
    // No change, no record: engaging an engaged stop writes nothing.
    expect(setAllStop(stopped, true, 3000)).toBe(stopped);
  });

  it("the send engine refuses under the halt BEFORE the channel — the peer hears nothing", async () => {
    localStorage.clear();
    const peer = createSimulatedPrinterChannel();
    const move = PRINTER_GCODE_PROFILE.commands.find((c) => c.id === "move")!;
    const outcome = await sendDeviceCommand({
      device: device(),
      profile: PRINTER_GCODE_PROFILE,
      command: move,
      values: { x: "10", y: "20", feed: "3000" },
      channel: peer,
      allStopActive: true,
      now: 7000,
    });
    expect(outcome.result).toBe("refused");
    expect(outcome.note).toBe(ALL_STOP_NOTE);
    expect(peer.received).toEqual([]);
    const log = loadCommandLog();
    expect(log[log.length - 1]).toMatchObject({ result: "refused", note: ALL_STOP_NOTE });

    // And without the halt, the same granted send goes through.
    const peer2 = createSimulatedPrinterChannel();
    const ok = await sendDeviceCommand({
      device: device(),
      profile: PRINTER_GCODE_PROFILE,
      command: move,
      values: { x: "10", y: "20", feed: "3000" },
      channel: peer2,
      now: 8000,
    });
    expect(ok.result).toBe("sent");
    expect(peer2.received.length).toBeGreaterThan(0);
  });

  it("the bridge checks the halt on every request — 423, sender never runs", async () => {
    const seed = seedDeviceCoreState();
    const liveDog: DeviceCoreState = {
      ...seed,
      registry: seed.registry.map((d) => ({
        ...d,
        retired: undefined,
        ownerConfirmed: true as const,
        controlGranted: true as const,
      })),
      allStop: { active: true, at: 1234 },
    };
    const runner = vi.fn(async () => "should never print");
    const run = await runDeviceFrame(
      { deviceId: "wepwawet", hex: "00".repeat(23), holdMs: 500, live: true },
      { env: { HOME: "/home/captain" }, state: liveDog, senderRunner: runner },
    );
    expect(run.ok).toBe(false);
    if (!run.ok) {
      expect(run.status).toBe(423);
      expect(run.error).toContain("ALL-STOP");
    }
    expect(runner).not.toHaveBeenCalled();
  });
});

describe("the Law in Force — counted from the registry, never stored", () => {
  it("counts grants, no-control cards, and waiting requests as they stand", () => {
    const state = stateWith([
      device({ id: "a" }),
      device({ id: "b", controlGranted: undefined }),
      device({ id: "c", retired: { at: 5, note: "gone" } }),
    ]);
    const law = lawInForce(state);
    expect(law).toEqual({
      registered: 3,
      controlGranted: 1,
      noControl: 2,
      flagRequestsWaiting: 0,
      allStopActive: false,
    });
    expect(lawInForceLine(law)).toContain("3 devices registered");
    expect(lawInForceLine(law)).toContain("1 with control granted");
    expect(lawInForceLine({ ...law, allStopActive: true })).toContain("ALL-STOP IN FORCE");
  });
});

/* ------------------------------ 5. Summons ---------------------------- */

describe("the Summons — flagged signals raise, others never do", () => {
  const flagged = (overrides: Partial<DeviceProfile> = {}): DeviceProfile =>
    device({ id: "wand-x", displayName: "Porch Light", summonsMe: true, ...overrides });

  it("appearing and vanishing transitions fire for flagged devices only", () => {
    const before = [flagged({ presence: "gone" }), device({ id: "plain", presence: "gone" })];
    const after = [
      flagged({ presence: "active", lastSeenRssi: -52 }),
      device({ id: "plain", presence: "active" }),
    ];
    const transitions = summonsTransitions(before, after, 9000);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({ kind: "appeared", rssi: -52 });

    const down = summonsTransitions(after, before, 9500);
    expect(down).toHaveLength(1);
    expect(down[0]).toMatchObject({ kind: "vanished" });
  });

  it("a retired device never summons, and no transition fires without movement", () => {
    const before = [flagged({ presence: "gone", retired: { at: 1, note: "sold" } })];
    const after = [flagged({ presence: "active", retired: { at: 1, note: "sold" } })];
    expect(summonsTransitions(before, after, 1)).toEqual([]);
    const still = [flagged({ presence: "active" })];
    expect(summonsTransitions(still, still, 1)).toEqual([]);
  });

  it("the line reports strength only — never a distance, never a battery", () => {
    const line = summonsLine({
      device: flagged(),
      kind: "appeared",
      at: 1,
      rssi: -52,
    });
    expect(line).toContain("-52 dBm (strength only)");
    expect(line.toLowerCase()).not.toContain("meter");
    expect(line.toLowerCase()).not.toContain("feet");
    expect(line.toLowerCase()).not.toContain("battery");
  });

  it("the Summons rides the flag-request road: proposed, never self-applied, landed by Confirm", () => {
    const base = stateWith([device({ id: "lamp", summonsMe: undefined })]);
    const proposed = proposeFlagChange(base, {
      deviceId: "lamp",
      summonsMe: true,
      reason: "Raise me when the porch light's signal appears.",
      now: 100,
    });
    expect(proposed).not.toBeNull();
    expect(proposed!.state.registry[0]!.summonsMe).toBeUndefined();
    expect(proposed!.request.summonsMe).toBe(true);
    const applied = resolveFlagRequest(proposed!.state, proposed!.request.id, "applied", 200);
    expect(applied.registry[0]!.summonsMe).toBe(true);
    const denied = resolveFlagRequest(proposed!.state, proposed!.request.id, "denied", 200);
    expect(denied.registry[0]!.summonsMe).toBeUndefined();
  });
});

/* ----------------------------- 3. Second Look ------------------------- */

describe("Second Look — the answer must begin with yes or no", () => {
  it("parses strict answers and refuses to read tea leaves", () => {
    expect(parseSecondLookAnswer("YES — a red door, centered.")).toEqual({
      confirmed: true,
      seen: "a red door, centered.",
    });
    expect(parseSecondLookAnswer("No. The wall is bare.")).toEqual({
      confirmed: false,
      seen: "The wall is bare.",
    });
    expect(parseSecondLookAnswer("It seems there might be a door")).toBeNull();
    expect(parseSecondLookAnswer("")).toBeNull();
  });

  it("asks the dossier's question, one finding at a time", () => {
    expect(secondLookPrompt("a red door", 2)).toContain('Is there a a red door at mark 2?');
    expect(secondLookPrompt("a red door", 2)).toContain("Answer only yes or no");
  });
});

function secondLookFetch(answers: (string | Error)[]) {
  let generateCalls = 0;
  return vi.fn(async (url: string) => {
    if (url.endsWith("/api/tags")) {
      return { ok: true, json: async () => ({ models: [{ name: "llava:7b" }] }) };
    }
    const answer = answers[generateCalls++] ?? "YES";
    if (answer instanceof Error) throw answer;
    return { ok: true, json: async () => ({ response: answer }) };
  }) as unknown as typeof fetch;
}

describe("Second Look — the pass", () => {
  it("stamps each finding from its own check", async () => {
    const fetchFn = secondLookFetch(["YES — it is there.", "NO — bare wall."]);
    const outcome = await runSecondLook({
      brain: "http://brain",
      base64: "AAAA",
      findings: ["a door", "a window"],
      fetchFn,
    });
    expect(outcome).toEqual({
      status: "done",
      verdicts: [
        { text: "a door", verdict: "verified", seen: "it is there." },
        { text: "a window", verdict: "not-confirmed", seen: "bare wall." },
      ],
    });
  });

  it("an unclear answer confirms nothing", async () => {
    const fetchFn = secondLookFetch(["There is possibly a door"]);
    const outcome = await runSecondLook({
      brain: "http://brain",
      base64: "AAAA",
      findings: ["a door"],
      fetchFn,
    });
    expect(outcome).toEqual({
      status: "done",
      verdicts: [{ text: "a door", verdict: "not-confirmed" }],
    });
  });

  it("an unreachable model is FIRST PASS ONLY — unavailable, no stamps faked", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    const outcome = await runSecondLook({
      brain: "http://brain",
      base64: "AAAA",
      findings: ["a door"],
      fetchFn,
    });
    expect(outcome.status).toBe("unavailable");
  });

  it("a mid-pass failure leaves earlier verdicts standing and the rest NOT CONFIRMED", async () => {
    const fetchFn = secondLookFetch(["YES — there.", new Error("cut off")]);
    const outcome = await runSecondLook({
      brain: "http://brain",
      base64: "AAAA",
      findings: ["a door", "a window"],
      fetchFn,
    });
    expect(outcome).toEqual({
      status: "done",
      verdicts: [
        { text: "a door", verdict: "verified", seen: "there." },
        { text: "a window", verdict: "not-confirmed" },
      ],
    });
  });
});

/* ----------------------------- 1. Identifier -------------------------- */

describe("the Identifier — registry first, then the library, else UNKNOWN", () => {
  it("Heard it: no record says NO RECORD; his named sound answers with his name", () => {
    expect(heardAnswer([], []).tone).toBe("unavailable");
    const feed: SoundFeedEntry[] = [
      {
        id: "s1",
        at: 5000,
        label: "Jax barking",
        source: "library",
        confidence: null,
        alert: false,
        acknowledged: false,
      },
    ];
    const library = [
      {
        id: "lib1",
        name: "Jax barking",
        fingerprint: [1],
        createdAt: 1000,
        hits: 3,
        alert: false,
      },
    ];
    const answer = heardAnswer(feed, library);
    expect(answer.headline).toBe("Jax barking");
    expect(answer.detail).toContain("you named it on");
    const unclassified = heardAnswer(
      [{ ...feed[0]!, label: null, source: "unclassified" }],
      library,
    );
    expect(unclassified.headline).toBe("UNCLASSIFIED");
  });

  it("Saw its signal: his SSID answers yours; a stranger's answers UNKNOWN; no scanner says so", () => {
    const mine = device({ id: "cam", displayName: "Porch Cam", ssid: "PORCH-CAM" });
    const sightings = [{ ssid: "PORCH-CAM", rssi: -60, source: "parrot-watcher" as const, seenAt: 10 }];
    expect(signalAnswer(sightings, [mine]).headline).toBe("Yours — Porch Cam");
    expect(
      signalAnswer([{ ssid: "NEIGHBOR-5G", source: "parrot-watcher" as const, seenAt: 10 }], [mine])
        .headline,
    ).toBe("UNKNOWN — not identified");
    expect(signalAnswer(null, [mine]).headline).toBe("SCAN UNAVAILABLE");
    expect(signalAnswer([], [mine]).headline).toBe("NO SIGHTINGS");
  });

  it("Remote or device: registry beats library; library answers second; else UNKNOWN", () => {
    const mine = device({ id: "tv", displayName: "Living Room TV" });
    expect(remoteAnswer("Living Room TV", [mine], null).tone).toBe("yours");
    expect(
      remoteAnswer("Samsung", [mine], [{ brand: "Samsung", device: "TV remote" }]).headline,
    ).toContain("Samsung");
    expect(remoteAnswer("Zorblax", [mine], []).headline).toBe("UNKNOWN — not identified");
    expect(remoteAnswer("Zorblax", [mine], null).headline).toBe("LIBRARY UNAVAILABLE");
  });
});

/* ----------------------------- 6. Formation --------------------------- */

const probeBase: FormationProbe = {
  coreStatus: "connected",
  thisHost: "parrot.local:8081",
  onlineHost: false,
  servingStamp: "abc1234deadbeef",
  latestStamp: "abc1234deadbeef",
  osiris: "answered",
  probedAt: 1000,
};

describe("the Formation — probed rows and the parity line", () => {
  it("a connected core reads REACHED; a silent one never borrows a state", () => {
    const rows = formationRows(probeBase);
    expect(rows.find((r) => r.id === "parrot-core")).toMatchObject({ state: "reached" });
    const down = formationRows({ ...probeBase, coreStatus: "not-configured" });
    expect(down.find((r) => r.id === "parrot-core")!.detail).toContain("NO LIVE READING");
  });

  it("the online copy reads NO LIVE READING from another surface — and IS this surface on its own host", () => {
    const rows = formationRows(probeBase);
    expect(rows.find((r) => r.id === "online-copy")).toMatchObject({
      state: "no-live-reading",
    });
    const online = formationRows({ ...probeBase, onlineHost: true, thisHost: "augixvi.space" });
    expect(online.find((r) => r.id === "online-copy")!.detail).toContain("IS the online copy");
    expect(formationRows(probeBase).find((r) => r.id === "phone-copy")).toMatchObject({
      state: "no-live-reading",
    });
  });

  it("parity is stated in plain words: current, behind, or unreadable", () => {
    expect(parityLine(probeBase)).toContain("carries the newest build");
    expect(parityLine({ ...probeBase, servingStamp: "0000000aaaa" })).toContain("BEHIND");
    expect(parityLine({ ...probeBase, servingStamp: null })).toContain("NO LIVE READING");
    expect(parityLine({ ...probeBase, latestStamp: null })).toContain("could not be checked");
  });

  it("the census counts records and labels an unavailable watcher", () => {
    const line = sensesCensusLine({
      soundClassified: 4,
      soundAlertsWaiting: 1,
      devicesRegistered: 3,
      devicesPresent: 2,
      watcher: "unavailable",
    });
    expect(line).toContain("classified 4 sounds");
    expect(line).toContain("1 alert waiting");
    expect(line).toContain("UNAVAILABLE");
  });
});

/* ----------------------------- 7. Earned Maps ------------------------- */

describe("Earned Maps — the shelf of earned control maps", () => {
  it("the sold dog's profile stands as TEMPLATE, earned from Wepwawet, retired 2026-11-24", () => {
    const maps = earnedMaps(seedDeviceCoreState());
    expect(maps).toHaveLength(1);
    expect(maps[0]).toMatchObject({
      earnedFrom: "Wepwawet",
      standing: "template",
      retiredAt: WEPWAWET_SOLD_AT,
    });
    expect(earnedMapsLine(maps)).toContain("0 active, 1 template");
  });

  it("a live device's bound profile stands ACTIVE; a profile nobody carries never appears", () => {
    const state: DeviceCoreState = {
      ...emptyDeviceCoreState(),
      registry: [device({ id: "printer-1" })],
      bindings: {
        "printer-1": { deviceId: "printer-1", profileId: PRINTER_GCODE_PROFILE.id, address: "" },
      },
    };
    const maps = earnedMaps(state);
    expect(maps).toHaveLength(1);
    expect(maps[0]).toMatchObject({ standing: "active", earnedFrom: "Shop Printer" });
    expect(earnedMaps(emptyDeviceCoreState())).toEqual([]);
    expect(earnedMapsLine([])).toBe("No control maps earned yet.");
  });
});

/* ----------------------------- 8. Seal Check -------------------------- */

describe("Seal Check — a drive proves it is itself", () => {
  const entry = (path: string, sha256: string, size = 3): SealFileEntry => ({ path, sha256, size });
  const sha = "a".repeat(64);

  it("parses a real seal and refuses a non-seal", () => {
    const manifest = parseSealManifest(
      JSON.stringify({ version: 1, createdAt: "2026-11-26", files: [entry("a.txt", sha)] }),
    );
    expect(manifest?.files).toHaveLength(1);
    expect(parseSealManifest("not json")).toBeNull();
    expect(parseSealManifest(JSON.stringify({ version: 2, files: [] }))).toBeNull();
    expect(
      parseSealManifest(JSON.stringify({ version: 1, files: [entry("../evil", sha)] })),
    ).toEqual({ version: 1, createdAt: "", files: [] });
  });

  it("no manifest is NO SEAL — never a pass", () => {
    const result = checkSeal(null, [entry("a.txt", sha)]);
    expect(result.sealed).toBe(false);
    expect(result.verdictLine).toContain("NO SEAL ON THIS DRIVE");
  });

  it("MATCH, MISSING, and CHANGED are judged by hash and size; extras are said aloud", () => {
    const manifest = parseSealManifest(
      JSON.stringify({
        version: 1,
        createdAt: "2026-11-26",
        files: [entry("a.txt", sha), entry("b.txt", "b".repeat(64)), entry("c.txt", "c".repeat(64))],
      }),
    )!;
    const result = checkSeal(manifest, [
      entry("a.txt", sha),
      entry("b.txt", "d".repeat(64)),
      entry("extra.txt", "e".repeat(64)),
    ]);
    expect(result.verdicts).toEqual([
      { path: "a.txt", verdict: "match" },
      { path: "b.txt", verdict: "changed" },
      { path: "c.txt", verdict: "missing" },
    ]);
    expect(result.unsealedFiles).toBe(1);
    expect(result.verdictLine).toContain("THE SEAL DOES NOT HOLD");

    const holds = checkSeal(manifest, [
      entry("a.txt", sha),
      entry("b.txt", "b".repeat(64)),
      entry("c.txt", "c".repeat(64)),
    ]);
    expect(holds.verdictLine).toContain("THE SEAL HOLDS");
  });
});
