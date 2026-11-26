/**
 * SECTOR WATCH RUNTIME — node-only, server-side. The living
 * half of Sector Watch (owner order 2026-11-26: Anubis looks
 * through the cameras whenever HE wants, not on command only):
 *
 *   · THE LOOP — a scheduler on the core wakes every few
 *     seconds and, for each registered camera whose sector
 *     watch is on and whose ownership the Captain confirmed,
 *     runs one watch cycle when its interval comes due: pull a
 *     frame, ask the analyzer the sector question, write the
 *     verdict in the watch log. A cycle is skipped while the
 *     Captain's hand is on that camera (the PTZ pad within the
 *     last stretch, or a patrol/follow running on it) — his
 *     hand outranks the watch, always.
 *   · THE LAW — a first YES from the analyzer is a DRAFT. The
 *     Second Look (the strict question asked again) must agree
 *     before anything becomes an event. The decisions
 *     themselves are pure (cameras/sectorWatch.ts); this module
 *     only gathers the answers honestly: a camera that does
 *     not answer and an analyzer that does not answer are
 *     logged UNAVAILABLE (throttled, so a dead camera cannot
 *     flood the log), never guessed around.
 *   · EVENTS — a confirmed reading raises a security event:
 *     the stills are kept on the core (sector-events/), the
 *     event lands in the sector record AND in Augie's core
 *     events log (the Logs window's record), and the stage
 *     learns of it through the sector record — the Alert Ring
 *     reads its unacknowledged count. Nothing is sent anywhere
 *     outside the house system.
 *   · THE ALL-STOP halts the watch like everything else: while
 *     it stands, no cycle runs.
 *
 * THE LENS TRUTH (learned live 2026-11-26, corrected the same
 * day): the frames judged here come from the camera's main
 * stream path — the ONE video source ONVIF exposes per unit.
 * Whether that stream follows the moving lens is measured per
 * camera by the stream probe (the presence record's
 * streamFollowsPtz): true on the Bedroom unit, false on the
 * Command unit. The watch judges the pulled view either way,
 * claims nothing beyond it, and never moves a lens to change
 * what it sees.
 *
 * Runtime handles (the scheduler timer, due-times) live in
 * this module's memory; durable state lives in the stores. The
 * scheduler (re)starts from reconcileSectorWatch(), which the
 * sector server functions call — the same pattern the presence
 * loops use. It ALSO starts once at server boot:
 * bootSectorWatch(), called by the Nitro plugin
 * (server/plugins/sector-watch-boot.ts) when the core server
 * process starts, so after a restart the watch is alive with
 * no surface having asked — the Captain's order (2026-11-26):
 * he does not chase behind the construct. And on its first
 * tick on a core with no sector record yet, the watch lays
 * down the first-run seed from his standing orders (see
 * seededSectorWatchFile) — an existing record is never
 * overwritten.
 */
import { getCameraStore, type StoredCamera } from "./cameraStore.server";
import { getCameraPresenceStore } from "./cameraPresenceStore.server";
import { getSectorWatchStore, type SectorWatchStore } from "./sectorWatchStore.server";
import {
  allStopInForce,
  askVisionText,
  askVisionYesNo,
  measureCameraAudioLevel,
  nudgeCameraLens,
} from "./cameraPresenceRuntime.server";
import {
  effectiveHousehold,
  followVelocity,
  motionCentroidIn,
  PERSON_CHECK_PROMPT,
  type HouseholdEnrollment,
} from "./cameras/cameraPresence";
import { cameraCanControl } from "./cameras/cameraRegistry";
import {
  audioBand,
  captureReasoningForEvent,
  crossExamLogText,
  decideBedroom,
  decideCommon,
  decideFront,
  decideFrontTruck,
  decideWeapon,
  descriptionFromAnswer,
  evidenceStillReasoning,
  isNotableReading,
  judgmentDue,
  judgmentReasoning,
  judgmentText,
  motionBand,
  plateNoteFor,
  plateReadingFromAnswer,
  sectorConfigFor,
  seededSectorWatchFile,
  FRONT_THREAT_PROMPT,
  FRONT_THREAT_SECOND_PROMPT,
  FRONT_TRUCK_PROMPT,
  FRONT_TRUCK_SECOND_PROMPT,
  HOUSEHOLD_SAME_PERSON_PROMPT,
  JUDGMENT_CONFIRM_PROMPT,
  PERSON_DESCRIPTION_PROMPT,
  PLATE_READING_PROMPT,
  SECTOR_PERSON_SECOND_PROMPT,
  WEAPON_PROMPT,
  WEAPON_SECOND_PROMPT,
  type CrossExamEntry,
  type FaceCheckOutcome,
  type SectorCameraConfig,
  type SectorDecision,
  type SectorEvent,
  type SectorEvidenceStill,
  type SectorJudgment,
  type WatchLogEntry,
} from "./cameras/sectorWatch";

/* ------------------------------------------------------------------ */
/* The Captain's hand — a pad drive pauses the watch on that camera    */
/* ------------------------------------------------------------------ */

const lastDriveAt = new Map<string, number>();
const MANUAL_DRIVE_PAUSE_MS = 45_000;

/** Called by the PTZ pad's server path: his hand was just on this lens. */
export function noteManualDrive(cameraId: string): void {
  lastDriveAt.set(cameraId, Date.now());
}

/* ------------------------------------------------------------------ */
/* The scheduler                                                       */
/* ------------------------------------------------------------------ */

const TICK_MS = 5_000;
const UNAVAILABLE_LOG_EVERY_MS = 30 * 60_000;

let scheduler: NodeJS.Timeout | null = null;
const nextDueAt = new Map<string, number>();
const cycleBusy = new Set<string>();
const lastUnavailableLogAt = new Map<string, number>();
let lastPresenceReconcileAt = 0;
let lastPermissionsReconcileAt = 0;
let seedAttempted = false;

export function sectorWatchSchedulerRunning(): boolean {
  return scheduler !== null;
}

/** Start the watch scheduler if it is not already running. */
export function reconcileSectorWatch(): void {
  if (scheduler) return;
  scheduler = setInterval(() => void tickAll(), TICK_MS);
  void tickAll();
}

/**
 * BOOT — called once by the Nitro server plugin
 * (server/plugins/sector-watch-boot.ts) when the server
 * process starts, so the watch starts with the machine: no
 * window has to be opened and no surface has to ask first.
 * Off the core there is no local sector store (the Cloudflare
 * surface) and the boot is a no-op — the same way every
 * .server store degrades there. The first tick lays the
 * first-run seed if no sector record exists yet.
 */
export async function bootSectorWatch(): Promise<void> {
  const store = await getSectorWatchStore();
  if (!store) return;
  reconcileSectorWatch();
}

async function tickAll(): Promise<void> {
  try {
    // HEARING SELF-START (the Captain's correction, 2026-11-26):
    // armed-in-store must mean listening. Live failure that day:
    // he spoke commands to the Bedroom camera and ZERO hearing
    // events landed, because the presence listener only started
    // when the Cameras window was opened (reconcile ran inside
    // the panel's read). The watch scheduler is core-side and
    // always ticking once started, so the presence reconcile
    // rides it: every ~20 s the stored armed states are re-armed
    // — hearing listeners, patrols, follows — with no window
    // needing to be open. (The loops themselves still halt
    // under the ALL-STOP on their own ticks, as they always did.)
    if (Date.now() - lastPresenceReconcileAt >= 20_000) {
      lastPresenceReconcileAt = Date.now();
      const presenceRuntime = await import("./cameraPresenceRuntime.server");
      await presenceRuntime.reconcilePresence();
    }
    // UNIFORM PERMISSIONS ride the same slow beat (the Captain's
    // rule, 2026-11-26): every registered camera and device is
    // reconciled from the ONE shared profile — so a newly
    // registered device takes the shared profile on its own,
    // and a shared-profile change reaches the whole fleet
    // without a hand touching each card.
    if (Date.now() - lastPermissionsReconcileAt >= 30_000) {
      lastPermissionsReconcileAt = Date.now();
      const permissionsRuntime = await import("./permissionsProfileRuntime.server");
      await permissionsRuntime.reconcilePermissions();
    }
    // The ALL-STOP halts the watch outright — no cycle runs
    // while it stands, and the log does not pretend otherwise.
    if (await allStopInForce()) return;
    const sectorStore = await getSectorWatchStore();
    const cameraStore = await getCameraStore();
    const presenceStore = await getCameraPresenceStore();
    if (!sectorStore || !cameraStore || !presenceStore) return;
    // FIRST-RUN SEED (the Captain's standing orders,
    // 2026-11-26): if no sector record has ever been laid down
    // on this core, the first tick lays one — the front and
    // bedroom cameras watched, each in its sector, the record
    // marked plainly as seeded from his orders. seedIfAbsent
    // never overwrites an existing record, and once attempted
    // here it is not attempted again this run.
    if (!seedAttempted) {
      await sectorStore.seedIfAbsent(seededSectorWatchFile());
      seedAttempted = true;
    }
    const sectorFile = await sectorStore.read();
    const presenceFile = await presenceStore.read();
    const now = Date.now();
    for (const camera of await cameraStore.list()) {
      const config = sectorConfigFor(sectorFile.settings, camera.id);
      if (!config.watch) continue;
      // Observation stands on ownership — the Permission Law's
      // first flag. An unconfirmed camera is never watched.
      if (camera.ownerConfirmed !== true) continue;
      if (camera.lenses.length === 0) continue;
      if (cycleBusy.has(camera.id)) continue;
      // His hand outranks the watch: a running patrol or follow,
      // or a pad drive in the last stretch, pauses this camera.
      const presence = presenceFile.cameras[camera.id];
      if (presence?.patrol.active || presence?.follow.active) continue;
      if (now - (lastDriveAt.get(camera.id) ?? 0) < MANUAL_DRIVE_PAUSE_MS) continue;
      if (now < (nextDueAt.get(camera.id) ?? 0)) continue;
      nextDueAt.set(camera.id, now + sectorFile.settings.intervalSec * 1000);
      cycleBusy.add(camera.id);
      void runCycle(camera, config, sectorStore)
        .catch(() => undefined)
        .finally(() => cycleBusy.delete(camera.id));
    }
  } catch {
    // a failed tick re-decides on the next one; nothing is claimed
  }
}

/* ------------------------------------------------------------------ */
/* One watch cycle                                                     */
/* ------------------------------------------------------------------ */

async function writeLog(
  sectorStore: SectorWatchStore,
  entry: WatchLogEntry,
): Promise<void> {
  if (entry.kind === "unavailable") {
    const last = lastUnavailableLogAt.get(entry.cameraId) ?? 0;
    if (Date.now() - last < UNAVAILABLE_LOG_EVERY_MS) return;
    lastUnavailableLogAt.set(entry.cameraId, Date.now());
  }
  await sectorStore.update((file) => ({ ...file, log: [entry, ...file.log] }));
}

function logEntry(
  camera: StoredCamera,
  config: SectorCameraConfig,
  decision: SectorDecision,
): WatchLogEntry {
  const kind =
    decision.outcome === "event"
      ? "event"
      : decision.outcome === "person"
        ? "person"
        : decision.outcome === "draft"
          ? "draft"
          : decision.outcome === "unavailable"
            ? "unavailable"
            : "quiet";
  return {
    id: `watch-${Date.now()}-${camera.id}`,
    at: Date.now(),
    cameraId: camera.id,
    cameraName: camera.name,
    zone: config.zone,
    kind,
    text: decision.text,
  };
}

async function runCycle(
  camera: StoredCamera,
  config: SectorCameraConfig,
  sectorStore: SectorWatchStore,
): Promise<void> {
  const lens = camera.lenses[0];
  if (!lens) return;
  const { grabSnapshot } = await import("./cameras/cameraBridge.server");
  const frame = await grabSnapshot(camera, lens, 12_000);
  if (!frame) {
    await writeLog(sectorStore, {
      id: `watch-${Date.now()}-${camera.id}`,
      at: Date.now(),
      cameraId: camera.id,
      cameraName: camera.name,
      zone: config.zone,
      kind: "unavailable",
      text: `${camera.name}: no frame came back this cycle — the camera did not answer, so nothing was read.`,
    });
    return;
  }
  const frameB64 = frame.toString("base64");

  // THE WEAPON FLAG — asked FIRST, in every zone (the Captain's
  // order: proof of concept of protection). A first yes takes
  // its Second Look immediately; two yeses are a top-tier event
  // and the cycle ends there. An unconfirmed weapon draft is
  // logged and suppresses judgment for this cycle — a weapon
  // reading never sits in the notable band.
  let suppressJudgment = false;
  const weaponFirst = await askVisionYesNo([frameB64], WEAPON_PROMPT);
  if (weaponFirst === true) {
    suppressJudgment = true;
    const weaponSecond = await askVisionYesNo([frameB64], WEAPON_SECOND_PROMPT);
    const weaponDecision = decideWeapon(weaponFirst, weaponSecond, camera.name);
    if (weaponDecision.outcome === "event") {
      await raiseEvent(camera, config, weaponDecision, frame, sectorStore, "weapon");
      return;
    }
    await writeLog(sectorStore, logEntry(camera, config, weaponDecision));
  } else if (weaponFirst === null) {
    await writeLog(sectorStore, logEntry(camera, config, decideWeapon(null, null, camera.name)));
  }

  if (config.zone === "front") {
    await runFrontCycle(camera, config, frame, frameB64, sectorStore, suppressJudgment);
    return;
  }

  let decision: SectorDecision;
  if (config.zone === "bedroom") {
    const first = await askVisionYesNo([frameB64], PERSON_CHECK_PROMPT);
    let face: FaceCheckOutcome = { state: "none-enrolled" };
    let second: boolean | null = null;
    if (first === true) {
      second = await askVisionYesNo([frameB64], SECTOR_PERSON_SECOND_PROMPT);
      if (second === true) {
        face = await checkHouseholdFaces(frameB64);
      }
    }
    decision = decideBedroom(first, second, face, camera.name);
  } else {
    const person = await askVisionYesNo([frameB64], PERSON_CHECK_PROMPT);
    decision = decideCommon(person, camera.name);
  }

  if (decision.outcome === "event") {
    await raiseEvent(camera, config, decision, frame, sectorStore);
    return;
  }
  if (!suppressJudgment && isNotableReading(config.zone, decision)) {
    await maybeEscalateJudgment(camera, config, decision, frame, sectorStore);
  }
  await writeLog(sectorStore, logEntry(camera, config, decision));
}

/**
 * The FRONT cycle. The general threat rule runs — and inside
 * it, the Captain's truck rule (his addition, 2026-11-26: "the
 * only one that gets in this vehicle is me"). When the threat
 * reading flags a frame, the truck question is asked of the
 * same frame; a confirmed person at the pickup is cleared by
 * the household faces or becomes a truck event. Where the
 * truck is not implicated, the general rule decides on its own
 * answers — the truck rule never invents a vehicle reading the
 * analyzer did not return.
 */
async function runFrontCycle(
  camera: StoredCamera,
  config: SectorCameraConfig,
  frame: Buffer,
  frameB64: string,
  sectorStore: SectorWatchStore,
  suppressJudgment: boolean,
): Promise<void> {
  const first = await askVisionYesNo([frameB64], FRONT_THREAT_PROMPT);
  if (first !== true) {
    await writeLog(sectorStore, logEntry(camera, config, decideFront(first, null, camera.name)));
    return;
  }
  const truckFirst = await askVisionYesNo([frameB64], FRONT_TRUCK_PROMPT);
  if (truckFirst === true) {
    const truckSecond = await askVisionYesNo([frameB64], FRONT_TRUCK_SECOND_PROMPT);
    let face: FaceCheckOutcome = { state: "none-enrolled" };
    if (truckSecond === true) {
      face = await checkHouseholdFaces(frameB64);
    }
    const truckDecision = decideFrontTruck(truckFirst, truckSecond, face, camera.name);
    if (truckDecision.outcome === "person") {
      await writeLog(sectorStore, logEntry(camera, config, truckDecision));
      return;
    }
    if (truckDecision.outcome === "event") {
      await raiseEvent(camera, config, truckDecision, frame, sectorStore, "front-truck");
      return;
    }
    if (truckDecision.outcome === "draft") {
      await writeLog(sectorStore, logEntry(camera, config, truckDecision));
      if (!suppressJudgment) {
        await maybeEscalateJudgment(camera, config, truckDecision, frame, sectorStore);
      }
    }
    // quiet / unavailable: the truck is not implicated — the
    // general rule below decides on its own answers.
  }
  const second = await askVisionYesNo([frameB64], FRONT_THREAT_SECOND_PROMPT);
  const decision = decideFront(true, second, camera.name);
  if (decision.outcome === "event") {
    await raiseEvent(camera, config, decision, frame, sectorStore, "front-threat");
    return;
  }
  if (!suppressJudgment && isNotableReading(config.zone, decision)) {
    await maybeEscalateJudgment(camera, config, decision, frame, sectorStore);
  }
  await writeLog(sectorStore, logEntry(camera, config, decision));
}

/* ------------------------------------------------------------------ */
/* The bedroom face check — against the household enrollment           */
/* ------------------------------------------------------------------ */

async function readEnrollmentFrame(dataDirectory: string, frameName: string): Promise<Buffer | null> {
  const fs = await import("node:fs/promises");
  for (const folder of ["household-faces", "creator-faces"]) {
    try {
      return await fs.readFile(`${dataDirectory}/${folder}/${frameName}`);
    } catch {
      // not in this folder — try the next
    }
  }
  return null;
}

async function checkHouseholdFaces(currentFrameB64: string): Promise<FaceCheckOutcome> {
  const presenceStore = await getCameraPresenceStore();
  if (!presenceStore) return { state: "no-verdict" };
  const file = await presenceStore.read();
  const household = effectiveHousehold(file);
  if (household.length === 0) return { state: "none-enrolled" };
  let sawNoVerdict = false;
  for (const member of household) {
    const firstFrame = member.frames[0];
    if (!firstFrame) {
      sawNoVerdict = true;
      continue;
    }
    const reference = await readEnrollmentFrame(presenceStore.dataDirectory, firstFrame);
    if (!reference) {
      // The enrolled frames are missing from the core — the
      // check cannot be made for this member; that is no verdict,
      // never a silent pass and never a false no-match.
      sawNoVerdict = true;
      continue;
    }
    const verdict = await askVisionYesNo(
      [reference.toString("base64"), currentFrameB64],
      HOUSEHOLD_SAME_PERSON_PROMPT,
    );
    if (verdict === true) return { state: "match", name: member.name };
    if (verdict === null) sawNoVerdict = true;
  }
  return sawNoVerdict ? { state: "no-verdict" } : { state: "no-match" };
}

/* ------------------------------------------------------------------ */
/* Raising an event — record, kept frames, the core events log         */
/* ------------------------------------------------------------------ */

async function raiseEvent(
  camera: StoredCamera,
  config: SectorCameraConfig,
  decision: SectorDecision,
  triggerFrame: Buffer,
  sectorStore: SectorWatchStore,
  kind?: SectorEvent["kind"],
): Promise<void> {
  const fs = await import("node:fs/promises");
  const dir = `${sectorStore.dataDirectory}/sector-events`;
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const eventId = `sector-${Date.now()}-${camera.id}`;
  const frames: string[] = [];
  const triggerName = `${eventId}-a.jpg`;
  try {
    await fs.writeFile(`${dir}/${triggerName}`, triggerFrame, { mode: 0o600 });
    frames.push(triggerName);
  } catch {
    // the event stands on the record even if a still cannot be kept
  }
  // The "after" still — what the camera saw a few seconds on.
  const lens = camera.lenses[0];
  if (lens) {
    await new Promise((r) => setTimeout(r, 4000));
    try {
      const { grabSnapshot } = await import("./cameras/cameraBridge.server");
      const after = await grabSnapshot(camera, lens, 10_000);
      if (after) {
        const afterName = `${eventId}-b.jpg`;
        await fs.writeFile(`${dir}/${afterName}`, after, { mode: 0o600 });
        frames.push(afterName);
      }
    } catch {
      // one kept still is enough; the record says what it holds
    }
  }
  const eventKind: SectorEvent["kind"] =
    kind ?? (config.zone === "bedroom" ? "bedroom-no-access" : "front-threat");
  const event: SectorEvent = {
    id: eventId,
    at: Date.now(),
    cameraId: camera.id,
    cameraName: camera.name,
    zone: config.zone,
    kind: eventKind,
    summary:
      eventKind === "weapon"
        ? `WEAPON — TOP TIER: ${camera.name} read a person with a gun or something like it.`
        : eventKind === "bedroom-no-access"
          ? `NO ACCESS — a person in the Captain's room (${camera.name}) is not cleared by the house rules.`
          : eventKind === "front-truck"
            ? `The Captain's truck — a person at it (${camera.name}) is not cleared by the house rules.`
            : `Possible break-in at the front — ${camera.name} read a person at a vehicle or forcing entry.`,
    reading: decision.text,
    reasoning: captureReasoningForEvent(eventKind, camera.name),
    frames,
    evidence: [],
    personReading: "",
    crossExam: [],
    acknowledged: false,
  };
  await sectorStore.update((file) => ({
    ...file,
    events: [event, ...file.events],
    log: [logEntry(camera, config, decision), ...file.log],
  }));
  // The core events record — the append-only log the Logs
  // window reads. A note on the record; nothing is sent
  // anywhere outside the house system.
  try {
    const { appendAugieEvent } = await import("./eventsLog.server");
    await appendAugieEvent({
      type: "note",
      summary: `Sector Watch: ${event.summary}`,
      detail: `${decision.text} Stills kept on the core: ${frames.length > 0 ? frames.join(", ") : "none could be kept"}. Acknowledge it in the Cameras window's Sector Watch card.`,
    });
  } catch {
    // the sector record itself stands; the events log is a mirror
  }
  // CROSS-EXAMINATION (every event; the Captain's authority,
  // 2026-11-26): the system's other tools are consulted on
  // what was captured — sound level, motion pattern — and each
  // reading is recorded with the event and in the watch log,
  // labeled, never merged into a certainty.
  try {
    const entries = await crossExamine(camera, decision.text);
    await sectorStore.update((file) => ({
      ...file,
      events: file.events.map((e) => (e.id === eventId ? { ...e, crossExam: entries } : e)),
      log: [
        {
          id: `watch-${Date.now()}-${camera.id}`,
          at: Date.now(),
          cameraId: camera.id,
          cameraName: camera.name,
          zone: config.zone,
          kind: "cross-exam" as const,
          text: crossExamLogText(event.summary, entries),
        },
        ...file.log,
      ],
    }));
  } catch {
    // the event stands; cross-examination is a duty, not a dependency
  }
  // EVIDENCE CAPTURE (FRONT events and WEAPON events in any
  // zone; the Captain's orders, 2026-11-26 — the home setup is
  // his test for the Bellwood pattern): a burst of
  // full-resolution stills around the event, kept with it on
  // the core. Nothing leaves the core.
  if (config.zone === "front" || eventKind === "weapon") {
    try {
      await captureEvidence(eventId, camera, sectorStore, eventKind);
    } catch {
      // the event stands on its kept frames; evidence is a duty,
      // never a single point of failure for the event itself
    }
  }
}

/**
 * CROSS-EXAMINATION — the watch consults the system's other
 * analysis tools on what it captured, and records what each
 * returned. Picture: the analyzer's own reading (the decision
 * text). Sound: the camera audio's measured level (the
 * listener's RMS road) as a stress indicator. Motion: the
 * scene's frame-difference coverage between two frames a beat
 * apart, the follow engine's own math, as a stress indicator.
 * HONEST LIMIT, by the Captain's own framing: a heart rate is
 * NOT a measurable signal on these cameras and mics — no
 * heart-level reading exists here and none is ever presented.
 * Indicators can mean something stressful; they do not say
 * anyone is doing wrong, and they never become events.
 */
async function crossExamine(
  camera: StoredCamera,
  pictureReading: string,
): Promise<CrossExamEntry[]> {
  const entries: CrossExamEntry[] = [{ tool: "picture", reading: pictureReading }];
  const level = await measureCameraAudioLevel(camera).catch(() => null);
  entries.push({ tool: "sound", reading: audioBand(level ? level.rms : null) });
  let coverage: number | null = null;
  const lens = camera.lenses[0];
  if (lens) {
    try {
      const { grabGrayFrame } = await import("./cameras/cameraBridge.server");
      const g1 = await grabGrayFrame(camera, lens, 96, 54, 10_000);
      if (g1) {
        await new Promise((r) => setTimeout(r, 1500));
        const g2 = await grabGrayFrame(camera, lens, 96, 54, 10_000);
        if (g2) {
          const centroid = motionCentroidIn(g1, g2, 96, 54, 28, 0);
          coverage = centroid ? centroid.coverage : 0;
        }
      }
    } catch {
      coverage = null;
    }
  }
  entries.push({ tool: "motion", reading: motionBand(coverage) });
  return entries;
}

/**
 * The evidence burst for one front event: three full-resolution
 * main-stream stills a short beat apart, each asked for a plate
 * reading (stored as a DRAFT beside the still — the still is
 * the evidence), plus one person description from the first
 * still. The ALL-STOP halts capture like everything else: it is
 * checked before the burst and between stills, and a stopped
 * burst keeps what it already captured.
 */
async function captureEvidence(
  eventId: string,
  camera: StoredCamera,
  sectorStore: SectorWatchStore,
  eventKind: SectorEvent["kind"],
): Promise<void> {
  const lens = camera.lenses[0];
  if (!lens) return;
  if (await allStopInForce()) return;
  const fs = await import("node:fs/promises");
  const dir = `${sectorStore.dataDirectory}/sector-events`;
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const { grabSnapshot } = await import("./cameras/cameraBridge.server");
  const stills: SectorEvidenceStill[] = [];
  let firstShot: Buffer | null = null;
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 1500));
      if (await allStopInForce()) break;
    }
    const shot = await grabSnapshot(camera, lens, 12_000);
    if (!shot) continue;
    const name = `${eventId}-ev${i + 1}.jpg`;
    try {
      await fs.writeFile(`${dir}/${name}`, shot, { mode: 0o600 });
    } catch {
      continue;
    }
    if (!firstShot) firstShot = shot;
    const plate = plateReadingFromAnswer(
      await askVisionText([shot.toString("base64")], PLATE_READING_PROMPT),
    );
    stills.push({
      file: name,
      at: Date.now(),
      plate,
      plateNote: plateNoteFor(plate),
      reasoning: evidenceStillReasoning(eventKind, stills.length),
    });
  }
  const personReading = firstShot
    ? descriptionFromAnswer(
        await askVisionText([firstShot.toString("base64")], PERSON_DESCRIPTION_PROMPT),
      )
    : "";
  if (stills.length === 0 && !personReading) return;
  await sectorStore.update((file) => ({
    ...file,
    events: file.events.map((e) => (e.id === eventId ? { ...e, evidence: stills, personReading } : e)),
  }));
}

/* ------------------------------------------------------------------ */
/* Anubis's judgment — the "look at this" escalation                   */
/* ------------------------------------------------------------------ */

/**
 * When a reading lands in the notable band (a draft on the
 * front or the bedroom — see isNotableReading), Anubis may use
 * his judgment: the escalation question is asked once more
 * (Second-Looked before anything is sent); on a yes he keeps a
 * full-resolution picture — aiming the lens first where the
 * stream probe measured that this camera's stream follows its
 * lens and the follow's last movement gives a direction — and
 * raises a judgment item the stage shows the Captain. The
 * per-camera cooldown (from the record, so it survives
 * restarts) keeps judgment from becoming spam, the ALL-STOP
 * silences it, and every escalation is written into the watch
 * log with its basis. A judgment is NOT an alert: it never
 * touches the Alert Ring.
 */
async function maybeEscalateJudgment(
  camera: StoredCamera,
  config: SectorCameraConfig,
  decision: SectorDecision,
  frame: Buffer,
  sectorStore: SectorWatchStore,
): Promise<void> {
  try {
    if (await allStopInForce()) return;
    const file = await sectorStore.read();
    const last = file.judgments.find((j) => j.cameraId === camera.id)?.at ?? null;
    if (!judgmentDue(last, Date.now())) return;
    const confirm = await askVisionYesNo([frame.toString("base64")], JUDGMENT_CONFIRM_PROMPT);
    if (confirm !== true) return;
    if (await allStopInForce()) return;

    let aimNote = "the picture was taken from the camera's view as it stood";
    const presenceStore = await getCameraPresenceStore();
    const presenceFile = presenceStore ? await presenceStore.read() : null;
    const presence = presenceFile?.cameras[camera.id];
    if (
      presence?.streamFollowsPtz === true &&
      presence.follow.lastCentroid &&
      cameraCanControl(camera)
    ) {
      const velocity = followVelocity(presence.follow.lastCentroid);
      if (velocity) {
        const moved = await nudgeCameraLens(camera, velocity.pan, velocity.tilt, 700);
        if (moved) {
          aimNote =
            "Anubis aimed the lens toward the last measured movement first — this camera's stream follows its lens (stream probe)";
        }
      }
    }

    // Cross-examination informs the judgment: the other tools
    // are consulted and their readings ride with the item —
    // indicators, labeled, never a certainty and never an
    // event-maker.
    const crossExam = await crossExamine(camera, decision.text);

    const judgmentId = `judgment-${Date.now()}-${camera.id}`;
    let still = "";
    const lens = camera.lenses[0];
    if (lens) {
      const { grabSnapshot } = await import("./cameras/cameraBridge.server");
      const shot = await grabSnapshot(camera, lens, 12_000);
      if (shot) {
        const fs = await import("node:fs/promises");
        const dir = `${sectorStore.dataDirectory}/sector-events`;
        await fs.mkdir(dir, { recursive: true, mode: 0o700 });
        const name = `${judgmentId}.jpg`;
        try {
          await fs.writeFile(`${dir}/${name}`, shot, { mode: 0o600 });
          still = name;
        } catch {
          still = "";
        }
      }
    }
    const judgment: SectorJudgment = {
      id: judgmentId,
      at: Date.now(),
      cameraId: camera.id,
      cameraName: camera.name,
      zone: config.zone,
      text: judgmentText(config.zone, camera.name),
      reasoning: judgmentReasoning(camera.name),
      still,
      crossExam,
      acknowledged: false,
    };
    await sectorStore.update((f) => ({
      ...f,
      judgments: [judgment, ...f.judgments],
      log: [
        {
          id: `watch-${Date.now()}-${camera.id}`,
          at: Date.now(),
          cameraId: camera.id,
          cameraName: camera.name,
          zone: config.zone,
          kind: "draft" as const,
          text: `${judgment.text} Basis: ${decision.text} The escalation question confirmed it before this was raised; ${aimNote}. Picture kept: ${still || "none could be kept"}.`,
        },
        {
          id: `watch-x-${Date.now()}-${camera.id}`,
          at: Date.now(),
          cameraId: camera.id,
          cameraName: camera.name,
          zone: config.zone,
          kind: "cross-exam" as const,
          text: crossExamLogText(judgment.text, crossExam),
        },
        ...f.log,
      ],
    }));
  } catch {
    // judgment is an escalation, never a failure of the watch itself
  }
}

/* ------------------------------------------------------------------ */
/* Household enrollment — the Captain enrolls the faces of the house   */
/* ------------------------------------------------------------------ */

export interface EnrollResult {
  ok: boolean;
  note: string;
}

export async function enrollHouseholdMember(
  camera: StoredCamera,
  rawName: string,
): Promise<EnrollResult> {
  const name = rawName.trim().slice(0, 60);
  if (!name) return { ok: false, note: "The enrollment needs a name — whose face is this?" };
  const presenceStore = await getCameraPresenceStore();
  if (!presenceStore) return { ok: false, note: "No local presence store on this surface." };
  const lens = camera.lenses[0];
  if (!lens) return { ok: false, note: "This camera has no lens registered." };
  const { grabSnapshot } = await import("./cameras/cameraBridge.server");
  const fs = await import("node:fs/promises");
  const dir = `${presenceStore.dataDirectory}/household-faces`;
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  // Re-enrolling a name replaces it: the old frames go.
  const existing = (await presenceStore.read()).household.find(
    (m) => m.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    for (const f of existing.frames) {
      await fs.unlink(`${dir}/${f}`).catch(() => undefined);
    }
  }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member";
  const frames: string[] = [];
  for (let i = 0; i < 3; i++) {
    const frame = await grabSnapshot(camera, lens, 10_000);
    if (frame) {
      const fileName = `member-${slug}-${Date.now()}-${i}.jpg`;
      await fs.writeFile(`${dir}/${fileName}`, frame, { mode: 0o600 });
      frames.push(fileName);
    }
    if (i < 2) await new Promise((r) => setTimeout(r, 800));
  }
  if (frames.length === 0) {
    return {
      ok: false,
      note: "No frame came back from that camera — nobody was enrolled. Have them stand where it can see them and try again.",
    };
  }
  const member: HouseholdEnrollment = {
    name,
    cameraId: camera.id,
    cameraName: camera.name,
    frames,
    at: Date.now(),
  };
  await presenceStore.update((f) => ({
    ...f,
    household: [
      member,
      ...f.household.filter((m) => m.name.toLowerCase() !== name.toLowerCase()),
    ],
  }));
  return {
    ok: true,
    note: `${name} is enrolled — ${frames.length} reference frame${frames.length === 1 ? "" : "s"} from ${camera.name}, stored only on this machine. The bedroom rule can now clear this face.`,
  };
}

export async function removeHouseholdMember(rawName: string): Promise<EnrollResult> {
  const name = rawName.trim();
  const presenceStore = await getCameraPresenceStore();
  if (!presenceStore) return { ok: false, note: "No local presence store on this surface." };
  const file = await presenceStore.read();
  const member = file.household.find((m) => m.name.toLowerCase() === name.toLowerCase());
  if (!member) return { ok: false, note: "Nobody by that name is on the household list." };
  const fs = await import("node:fs/promises");
  const dir = `${presenceStore.dataDirectory}/household-faces`;
  for (const f of member.frames) {
    await fs.unlink(`${dir}/${f}`).catch(() => undefined);
  }
  await presenceStore.update((f) => ({
    ...f,
    household: f.household.filter((m) => m.name.toLowerCase() !== name.toLowerCase()),
  }));
  return { ok: true, note: `${member.name} is off the household list — the reference frames are deleted from this machine.` };
}
