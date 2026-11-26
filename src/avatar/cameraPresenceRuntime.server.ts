/**
 * CAMERA PRESENCE RUNTIME — node-only, server-side. The living
 * half of the Camera Presence pass (owner orders 2026-11-26):
 *
 *   · HEARING — ffmpeg pulls each armed camera's audio on the
 *     core, in short WAV chunks; a chunk with real sound in it
 *     goes to the SAME local speech service the Parrot mic uses
 *     (faster-whisper on this machine). Silence is never sent —
 *     a speech model invents words out of quiet, and this house
 *     does not ship inventions. What a camera hears is recorded
 *     as words + which camera heard them: that attribution is
 *     known truth, because the audio came down that camera's
 *     own stream.
 *   · COMMANDS — a heard line that matches the camera command
 *     set executes HERE, through the one gated executor: the
 *     Permission Law (ownership + control grant on the card)
 *     and the ALL-STOP both stand in front of every send, the
 *     same as the device bridge. Speech that is not a camera
 *     command is left unrouted in the record; the stage polls
 *     it and feeds it to Anubis exactly like the local ear does.
 *   · PATROL — a timed left-right sweep pattern, re-read from
 *     the store every tick: a stop from any surface, a direct
 *     PTZ command, or the ALL-STOP ends it at once.
 *   · FOLLOW — measured motion between real frames drives the
 *     PTZ to keep the moving subject centered. The analyzer is
 *     asked, on its own strict yes/no, whether a person is in
 *     the frame; only its yes earns the word "person", and the
 *     follow's basis says which one it is standing on.
 *   · RECORDING — ffmpeg stream copy to a local file under the
 *     core's data folder. Nothing leaves the machine.
 *
 * Runtime handles (ffmpeg children, loop timers) live in this
 * module's memory; durable state lives in the presence store.
 * A loop that finds its state switched off — from any surface —
 * stops itself and cleans up. Nothing here runs on the Worker:
 * no node, no presence.
 */
import { getCameraStore, type StoredCamera } from "./cameraStore.server";
import { getCameraPresenceStore } from "./cameraPresenceStore.server";
import { cameraCanControl, type CameraLens } from "./cameras/cameraRegistry";
import {
  describeIntent,
  followMaySteer,
  followVelocity,
  hearsAnubisName,
  motionCentroidIn,
  parseCameraCommand,
  parseStrictYesNo,
  patrolVelocityAt,
  presenceFor,
  streamFollowsPtzFromCoverage,
  streamProbeNote,
  PERSON_CHECK_PROMPT,
  SAME_PERSON_PROMPT,
  type CameraCommandIntent,
  type CameraPresenceFile,
  type HearingEvent,
  type RecordingInfo,
} from "./cameras/cameraPresence";

/* ------------------------------------------------------------------ */
/* Gates                                                               */
/* ------------------------------------------------------------------ */

/** The ALL-STOP, read from the device core — the same flag the
 *  device bridge checks on every request it serves. */
export async function allStopInForce(): Promise<boolean> {
  try {
    const { readDeviceCore } = await import("./devices/deviceStore.server");
    const read = await readDeviceCore(process.env);
    return read.available && read.state.allStop.active;
  } catch {
    return false;
  }
}

const ALL_STOP_NOTE =
  "Refused — the ALL-STOP is in force. The Captain releases it from his Devices window.";

async function loadCamera(cameraId: string): Promise<StoredCamera | null> {
  const store = await getCameraStore();
  if (!store) return null;
  return store.get(cameraId);
}

async function loadPresence(): Promise<{ file: CameraPresenceFile } | null> {
  const store = await getCameraPresenceStore();
  if (!store) return null;
  return { file: await store.read() };
}

/* ------------------------------------------------------------------ */
/* PTZ driving — one road, used by the executor, patrol, and follow    */
/* ------------------------------------------------------------------ */

interface PtzDoor {
  ptzUrl: string;
  profileToken: string;
}

async function resolvePtzDoor(camera: StoredCamera): Promise<PtzDoor | null> {
  const { onvifDeviceInfo, onvifProfiles } = await import("./cameras/onvifClient.server");
  const info = await onvifDeviceInfo(camera.host, camera.onvifPort, camera.username, camera.password ?? "");
  if (info.state !== "ok" || !info.value.ptzUrl || !info.value.mediaUrl) return null;
  const profiles = await onvifProfiles(info.value.mediaUrl, camera.username, camera.password ?? "");
  if (profiles.state !== "ok" || !profiles.value.length) return null;
  const profile = profiles.value.length > 1 ? profiles.value[1] : profiles.value[0];
  if (!profile) return null;
  return { ptzUrl: info.value.ptzUrl, profileToken: profile.token };
}

async function drivePtz(
  camera: StoredCamera,
  pan: number,
  tilt: number,
  stop: boolean,
): Promise<boolean> {
  const door = await resolvePtzDoor(camera);
  if (!door) return false;
  const { onvifPtzMove, onvifPtzStop } = await import("./cameras/onvifClient.server");
  const result = stop
    ? await onvifPtzStop(door.ptzUrl, camera.username, camera.password ?? "", door.profileToken)
    : await onvifPtzMove(door.ptzUrl, camera.username, camera.password ?? "", door.profileToken, {
        pan,
        tilt,
        zoom: 0,
      });
  return result.state === "ok";
}

/** A short, bounded nudge: move, then stop after the beat. */
async function nudgePtz(camera: StoredCamera, pan: number, tilt: number, ms = 650): Promise<boolean> {
  const moving = await drivePtz(camera, pan, tilt, false);
  if (!moving) return false;
  await new Promise((r) => setTimeout(r, ms));
  await drivePtz(camera, 0, 0, true);
  return true;
}

/**
 * The same nudge, exported for Sector Watch's judgment aim —
 * the caller gates it (control granted + ALL-STOP) exactly as
 * the follow loop gates its own steering.
 */
export async function nudgeCameraLens(
  camera: StoredCamera,
  pan: number,
  tilt: number,
  ms = 650,
): Promise<boolean> {
  return nudgePtz(camera, pan, tilt, ms);
}

function ptzLens(camera: StoredCamera): CameraLens | null {
  return camera.lenses.find((l) => l.kind === "ptz") ?? camera.lenses[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* The executor — every camera send this pass makes goes through here  */
/* ------------------------------------------------------------------ */

export interface ExecResult {
  ok: boolean;
  note: string;
}

export async function executeCameraIntent(
  intent: CameraCommandIntent,
  cameraNameFallback: string,
): Promise<ExecResult> {
  const camera = await loadCamera(intent.cameraId);
  if (!camera) return { ok: false, note: "That camera is not in the registry." };
  const name = camera.name || cameraNameFallback;

  // Recording is a core-side pull (the stream comes TO the core;
  // nothing is sent to the camera) — its gate is ownership, the
  // same gate as looking. Everything else is a SEND and stands
  // behind both Permission-Law flags and the ALL-STOP.
  if (intent.type === "record-start" || intent.type === "record-stop") {
    if (camera.ownerConfirmed !== true) {
      return { ok: false, note: "Recording refused — ownership is not confirmed on this camera's card." };
    }
    return intent.type === "record-start" ? startRecording(camera) : stopRecording(camera);
  }

  if (!cameraCanControl(camera)) {
    return {
      ok: false,
      note: "Refused — control is not granted for this camera. The Permission Law holds it to observation only.",
    };
  }
  if (await allStopInForce()) return { ok: false, note: ALL_STOP_NOTE };

  const presenceStore = await getCameraPresenceStore();
  if (!presenceStore) return { ok: false, note: "No local presence store on this surface." };

  switch (intent.type) {
    case "ptz": {
      await stopPatrol(intent.cameraId, "a direct move replaced it");
      const ok = await nudgePtz(camera, intent.pan * 0.7, intent.tilt * 0.7);
      return { ok, note: ok ? describeIntent(intent, name) : "The camera did not accept the move." };
    }
    case "stop-motion": {
      await stopPatrol(intent.cameraId, "stopped by command");
      await stopFollow(intent.cameraId, "stopped by command");
      const ok = await drivePtz(camera, 0, 0, true);
      return { ok: true, note: ok ? describeIntent(intent, name) : "Motion state cleared; the stop itself got no answer." };
    }
    case "patrol-start": {
      await presenceStore.update((file) => {
        const state = presenceFor(file, intent.cameraId);
        state.patrol = { ...state.patrol, active: true, startedAt: Date.now() };
        return { ...file, cameras: { ...file.cameras, [intent.cameraId]: state } };
      });
      ensurePatrolLoop(intent.cameraId);
      return { ok: true, note: describeIntent(intent, name) };
    }
    case "patrol-stop": {
      await stopPatrol(intent.cameraId, "stopped by command");
      return { ok: true, note: describeIntent(intent, name) };
    }
    case "follow-start": {
      await stopPatrol(intent.cameraId, "follow replaced it");
      await presenceStore.update((file) => {
        const state = presenceFor(file, intent.cameraId);
        state.follow = { ...state.follow, active: true, startedAt: Date.now(), basis: null };
        return { ...file, cameras: { ...file.cameras, [intent.cameraId]: state } };
      });
      ensureFollowLoop(intent.cameraId);
      return { ok: true, note: describeIntent(intent, name) };
    }
    case "follow-stop": {
      await stopFollow(intent.cameraId, "stopped by command");
      return { ok: true, note: describeIntent(intent, name) };
    }
    case "spotlight": {
      return setSpotlight(camera, intent.on);
    }
    case "turn-to-speaker": {
      const loaded = await loadPresence();
      const centroid = loaded ? presenceFor(loaded.file, intent.cameraId).follow.lastCentroid : null;
      if (!centroid) {
        return { ok: false, note: `Heard his name through ${name}, but that camera has no last-seen position to turn to.` };
      }
      const velocity = followVelocity(centroid);
      if (!velocity) return { ok: true, note: `${name} is already facing where he was last seen.` };
      const ok = await nudgePtz(camera, velocity.pan, velocity.tilt);
      return { ok, note: ok ? describeIntent(intent, name) : "The camera did not accept the turn." };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Spotlight + unit tracking — only through doors the probe found      */
/* ------------------------------------------------------------------ */

export async function setSpotlight(camera: StoredCamera, on: boolean): Promise<ExecResult> {
  const presenceStore = await getCameraPresenceStore();
  if (!presenceStore) return { ok: false, note: "No local presence store on this surface." };
  const file = await presenceStore.read();
  const state = presenceFor(file, camera.id);
  const door = state.spotlight.door;
  if (!door) {
    return {
      ok: false,
      note: state.spotlight.probedAt
        ? `No switch to flip — ${state.spotlight.note}`
        : "The spotlight has not been probed on this camera yet. Run the presence probe first — Augie only flips switches the unit actually exposes.",
    };
  }
  const onvif = await import("./cameras/onvifClient.server");
  if (door.startsWith("aux:")) {
    const base = door.slice(4);
    const doorHandle = await resolvePtzDoor(camera);
    if (!doorHandle) return { ok: false, note: "The camera's PTZ door did not answer." };
    const result = await onvif.onvifPtzAuxiliary(
      doorHandle.ptzUrl,
      camera.username,
      camera.password ?? "",
      doorHandle.profileToken,
      `${base}|${on ? "On" : "Off"}`,
    );
    if (result.state !== "ok") return { ok: false, note: "The camera did not accept the spotlight command." };
  } else {
    // An imaging field is the door: rewrite that one field's value
    // in the unit's own settings block and hand the block back.
    const services = await onvif.onvifServices(camera.host, camera.onvifPort, camera.username, camera.password ?? "");
    if (services.state !== "ok") return { ok: false, note: "The camera's ONVIF door did not answer." };
    const imaging = services.value.find((s) => s.namespace.includes("/imaging/"));
    const media = services.value.find((s) => s.namespace.includes("/media/"));
    if (!imaging || !media) return { ok: false, note: "This camera offers no imaging service to write through." };
    const sources = await onvif.onvifVideoSources(media.xaddr, camera.username, camera.password ?? "");
    if (sources.state !== "ok" || !sources.value[0]) return { ok: false, note: "The camera named no video source." };
    const current = await onvif.onvifImagingSettings(imaging.xaddr, camera.username, camera.password ?? "", sources.value[0]);
    if (current.state !== "ok") return { ok: false, note: "The camera's imaging settings did not answer." };
    const blockMatch = /<(?:[a-zA-Z0-9]+:)?ImagingSettings[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?ImagingSettings>/.exec(current.value);
    if (!blockMatch?.[1]) return { ok: false, note: "The imaging settings came back in a shape Augie cannot safely rewrite." };
    const fieldRe = new RegExp(
      `(<(?:[a-zA-Z0-9]+:)?${door}[^>]*>)([^<]*)(</(?:[a-zA-Z0-9]+:)?${door}>)`,
    );
    if (!fieldRe.test(blockMatch[1])) return { ok: false, note: "The spotlight field the probe found is no longer in the settings." };
    const rewritten = blockMatch[1].replace(fieldRe, `$1${on ? "ON" : "OFF"}$3`);
    const written = await onvif.onvifSetImagingSettings(
      imaging.xaddr,
      camera.username,
      camera.password ?? "",
      sources.value[0],
      rewritten,
    );
    if (written.state !== "ok") {
      return { ok: false, note: "The camera refused the imaging write — the spotlight state is unchanged and unclaimed." };
    }
  }
  await presenceStore.update((f) => {
    const s = presenceFor(f, camera.id);
    s.spotlight = { ...s.spotlight, on };
    return { ...f, cameras: { ...f.cameras, [camera.id]: s } };
  });
  return { ok: true, note: `Spotlight ${on ? "on" : "off"} — set through the ${door.startsWith("aux:") ? "auxiliary" : "imaging"} door the probe found.` };
}

export async function setUnitTracking(camera: StoredCamera, on: boolean): Promise<ExecResult> {
  const presenceStore = await getCameraPresenceStore();
  if (!presenceStore) return { ok: false, note: "No local presence store on this surface." };
  const file = await presenceStore.read();
  const state = presenceFor(file, camera.id);
  const door = state.tracking.door;
  if (!door) {
    return {
      ok: false,
      note: state.tracking.probedAt
        ? `No switch to flip — ${state.tracking.note}`
        : "Unit tracking has not been probed on this camera yet. Run the presence probe first.",
    };
  }
  const [, configToken, itemName] = door.split(":");
  if (!configToken || !itemName) return { ok: false, note: "The stored tracking door is malformed — probe again." };
  const onvif = await import("./cameras/onvifClient.server");
  const services = await onvif.onvifServices(camera.host, camera.onvifPort, camera.username, camera.password ?? "");
  if (services.state !== "ok") return { ok: false, note: "The camera's ONVIF door did not answer." };
  const analytics = services.value.find((s) => s.namespace.includes("/analytics/"));
  if (!analytics) return { ok: false, note: "This camera no longer offers an analytics service." };
  const current = await onvif.onvifAnalyticsConfiguration(analytics.xaddr, camera.username, camera.password ?? "", configToken);
  if (current.state !== "ok") return { ok: false, note: "The analytics configuration did not answer." };
  const { flipAnalyticsEnable } = await import("./cameras/cameraPresence");
  const blockMatch = /<((?:[a-zA-Z0-9]+:)?Configuration)\b[^>]*>[\s\S]*?<\/\1>/.exec(current.value);
  if (!blockMatch) return { ok: false, note: "The configuration came back in a shape Augie cannot safely rewrite." };
  const flipped = flipAnalyticsEnable(blockMatch[0], itemName, on);
  if (!flipped) return { ok: false, note: "The tracking enable item the probe found is no longer in the configuration." };
  const written = await onvif.onvifSetAnalyticsConfiguration(analytics.xaddr, camera.username, camera.password ?? "", flipped);
  if (written.state !== "ok") return { ok: false, note: "The camera refused the tracking write — its state is unchanged and unclaimed." };
  await presenceStore.update((f) => {
    const s = presenceFor(f, camera.id);
    s.tracking = { ...s.tracking, on };
    return { ...f, cameras: { ...f.cameras, [camera.id]: s } };
  });
  return { ok: true, note: `The unit's own auto-tracking is ${on ? "on" : "off"} — set through its analytics door.` };
}

/* ------------------------------------------------------------------ */
/* Patrol loop                                                         */
/* ------------------------------------------------------------------ */

const patrolLoops = new Map<string, { timer: NodeJS.Timeout; lastSent: number | null }>();

export function ensurePatrolLoop(cameraId: string): void {
  if (patrolLoops.has(cameraId)) return;
  const loop = { timer: null as unknown as NodeJS.Timeout, lastSent: null as number | null };
  const tick = async () => {
    try {
      const presenceStore = await getCameraPresenceStore();
      const cameraStore = await getCameraStore();
      if (!presenceStore || !cameraStore) return endLoop();
      const file = await presenceStore.read();
      const state = presenceFor(file, cameraId);
      if (!state.patrol.active || state.patrol.startedAt === null) return endLoop();
      const camera = await cameraStore.get(cameraId);
      if (!camera || !cameraCanControl(camera)) return endLoop();
      if (await allStopInForce()) {
        // The ALL-STOP ends patrol outright — it does not pause it.
        await stopPatrol(cameraId, "the ALL-STOP ended it");
        return;
      }
      const wanted = patrolVelocityAt(Date.now() - state.patrol.startedAt, state.patrol.sweepMs);
      if (wanted !== loop.lastSent) {
        if (wanted === 0) {
          await drivePtz(camera, 0, 0, true);
        } else {
          await drivePtz(camera, wanted, 0, false);
        }
        loop.lastSent = wanted;
      }
    } catch {
      // a failed tick never kills the loop silently into a stuck
      // camera: the next tick re-reads the state and re-decides.
    }
  };
  const endLoop = () => {
    clearInterval(loop.timer);
    patrolLoops.delete(cameraId);
  };
  loop.timer = setInterval(() => void tick(), 1000);
  patrolLoops.set(cameraId, loop);
  void tick();
}

export async function stopPatrol(cameraId: string, _reason: string): Promise<void> {
  const loop = patrolLoops.get(cameraId);
  if (loop) {
    clearInterval(loop.timer);
    patrolLoops.delete(cameraId);
  }
  const presenceStore = await getCameraPresenceStore();
  let wasActive = loop !== undefined;
  if (presenceStore) {
    const before = await presenceStore.read();
    wasActive = wasActive || presenceFor(before, cameraId).patrol.active;
    await presenceStore.update((file) => {
      const state = presenceFor(file, cameraId);
      if (!state.patrol.active) return file;
      state.patrol = { ...state.patrol, active: false, startedAt: null };
      return { ...file, cameras: { ...file.cameras, [cameraId]: state } };
    });
  }
  if (wasActive) {
    const camera = await loadCamera(cameraId);
    if (camera) await drivePtz(camera, 0, 0, true);
  }
}

/* ------------------------------------------------------------------ */
/* Follow loop                                                         */
/* ------------------------------------------------------------------ */

const followLoops = new Map<string, { timer: NodeJS.Timeout; busy: boolean }>();

function brainBaseUrl(): string {
  const raw = process.env["AUGIE_BRAIN_URL"]?.trim() || process.env["OLLAMA_URL"]?.trim() || "http://localhost:11434";
  return raw.replace(/\/+$/, "").replace(/\/api\/chat$/, "").replace(/\/api\/generate$/, "");
}

/**
 * The one analyzer road for strict yes/no vision questions —
 * shared with Sector Watch (sectorWatchRuntime.server.ts) so
 * every watcher in the house asks the same brain the same way:
 * the local vision model, a reply that must begin with yes or
 * no, and null for anything else (no verdict, never a guess).
 */
export async function askVisionYesNo(imagesBase64: string[], prompt: string): Promise<boolean | null> {
  try {
    const base = brainBaseUrl();
    const tagsRes = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(8000) });
    if (!tagsRes.ok) return null;
    const tags = (await tagsRes.json()) as { models?: { name?: string }[] };
    const installed = (tags.models ?? []).map((m) => m.name).filter((n): n is string => Boolean(n));
    const model =
      installed.find((n) => n === "llava:7b") ??
      installed.find((n) => /(llava|vision|moondream|bakllava|minicpm-v|gemma3|qwen[0-9.]*vl)/i.test(n));
    if (!model) return null;
    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ model, prompt, images: imagesBase64, stream: false, options: { num_predict: 24 } }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    return parseStrictYesNo(data.response ?? "");
  } catch {
    return null;
  }
}

/**
 * The analyzer's free-text answer — the same local vision
 * model, asked for words instead of a verdict (a plate reading,
 * a one-line description). Null when the model does not answer:
 * callers label whatever it returns a DRAFT READING and keep
 * the still as the evidence; the words are an index, never the
 * record of truth.
 */
export async function askVisionText(
  imagesBase64: string[],
  prompt: string,
): Promise<string | null> {
  try {
    const base = brainBaseUrl();
    const tagsRes = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(8000) });
    if (!tagsRes.ok) return null;
    const tags = (await tagsRes.json()) as { models?: { name?: string }[] };
    const installed = (tags.models ?? []).map((m) => m.name).filter((n): n is string => Boolean(n));
    const model =
      installed.find((n) => n === "llava:7b") ??
      installed.find((n) => /(llava|vision|moondream|bakllava|minicpm-v|gemma3|qwen[0-9.]*vl)/i.test(n));
    if (!model) return null;
    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ model, prompt, images: imagesBase64, stream: false, options: { num_predict: 80 } }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    const text = (data.response ?? "").trim();
    return text ? text : null;
  } catch {
    return null;
  }
}

export function ensureFollowLoop(cameraId: string): void {
  if (followLoops.has(cameraId)) return;
  const loop = { timer: null as unknown as NodeJS.Timeout, busy: false };
  let prevGray: Uint8Array | null = null;
  let lastPersonCheck = 0;
  const endLoop = () => {
    clearInterval(loop.timer);
    followLoops.delete(cameraId);
  };
  const tick = async () => {
    if (loop.busy) return;
    loop.busy = true;
    try {
      const presenceStore = await getCameraPresenceStore();
      const cameraStore = await getCameraStore();
      if (!presenceStore || !cameraStore) return endLoop();
      const file = await presenceStore.read();
      const state = presenceFor(file, cameraId);
      if (!state.follow.active) return endLoop();
      const camera = await cameraStore.get(cameraId);
      if (!camera || !cameraCanControl(camera)) return endLoop();
      if (await allStopInForce()) {
        await stopFollow(cameraId, "the ALL-STOP ended it");
        return;
      }
      const lens = ptzLens(camera);
      if (!lens) return endLoop();
      const { grabGrayFrame, grabSnapshot } = await import("./cameras/cameraBridge.server");
      const gray = await grabGrayFrame(camera, lens, 96, 54, 10_000);
      if (!gray) return;
      if (prevGray) {
        const centroid = motionCentroidIn(prevGray, gray, 96, 54);
        if (centroid) {
          await presenceStore.update((f) => {
            const s = presenceFor(f, cameraId);
            s.follow = {
              ...s.follow,
              lastCentroid: { x: centroid.x, y: centroid.y },
              basis: s.follow.basis === "person" && Date.now() - (s.follow.lastPersonAt ?? 0) < 30_000 ? "person" : "movement",
            };
            return { ...f, cameras: { ...f.cameras, [cameraId]: s } };
          });
          const velocity = followVelocity(centroid);
          // Steering by picture is only honest where the pulled
          // stream follows the moving lens (the stream probe's
          // measured word). Where it measured false, the follow
          // still watches and reports from the fixed view — it
          // just does not nudge a lens its picture cannot see.
          if (velocity && followMaySteer(state.streamFollowsPtz)) {
            await nudgePtz(camera, velocity.pan, velocity.tilt, 550);
          }
        }
      }
      prevGray = gray;
      // The person question, asked of the analyzer on its strict
      // yes/no — at most every 20 s, and only its YES earns the word.
      if (Date.now() - lastPersonCheck > 20_000) {
        lastPersonCheck = Date.now();
        const frame = await grabSnapshot(camera, lens, 10_000);
        if (frame) {
          const verdict = await askVisionYesNo([frame.toString("base64")], PERSON_CHECK_PROMPT);
          if (verdict === true) {
            await presenceStore.update((f) => {
              const s = presenceFor(f, cameraId);
              s.follow = { ...s.follow, basis: "person", lastPersonAt: Date.now() };
              return { ...f, cameras: { ...f.cameras, [cameraId]: s } };
            });
          }
        }
      }
    } catch {
      // a failed tick re-decides next time; nothing is claimed
    } finally {
      loop.busy = false;
    }
  };
  loop.timer = setInterval(() => void tick(), 2600);
  followLoops.set(cameraId, loop);
  void tick();
}

export async function stopFollow(cameraId: string, _reason: string): Promise<void> {
  const loop = followLoops.get(cameraId);
  if (loop) {
    clearInterval(loop.timer);
    followLoops.delete(cameraId);
  }
  const presenceStore = await getCameraPresenceStore();
  if (presenceStore) {
    await presenceStore.update((file) => {
      const state = presenceFor(file, cameraId);
      if (!state.follow.active) return file;
      state.follow = { ...state.follow, active: false, startedAt: null };
      return { ...file, cameras: { ...file.cameras, [cameraId]: state } };
    });
  }
}

/* ------------------------------------------------------------------ */
/* Recording                                                           */
/* ------------------------------------------------------------------ */

const recordings = new Map<string, { kill: () => void; info: RecordingInfo }>();

export function recordingLive(cameraId: string): boolean {
  return recordings.has(cameraId);
}

async function startRecording(camera: StoredCamera): Promise<ExecResult> {
  if (recordings.has(camera.id)) return { ok: true, note: `${camera.name} is already recording.` };
  const presenceStore = await getCameraPresenceStore();
  if (!presenceStore) return { ok: false, note: "No local presence store on this surface." };
  const lens = ptzLens(camera);
  if (!lens) return { ok: false, note: "This camera has no lens registered to record." };
  const { spawn } = await import("node:child_process");
  const fs = await import("node:fs/promises");
  const dir = `${presenceStore.dataDirectory}/camera-recordings`;
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = camera.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || camera.id;
  const file = `${slug}-${stamp}.mkv`;
  const { rtspUrlFor } = await import("./cameras/cameraBridge.server");
  let child: ReturnType<typeof spawn>;
  try {
    child = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-rtsp_transport",
      "tcp",
      "-i",
      rtspUrlFor(camera, lens),
      "-map",
      "0",
      "-c",
      "copy",
      "-y",
      `${dir}/${file}`,
    ]);
  } catch {
    return { ok: false, note: "ffmpeg is not available on this machine — recording cannot start." };
  }
  const info: RecordingInfo = {
    id: `rec-${Date.now()}-${camera.id}`,
    cameraId: camera.id,
    cameraName: camera.name,
    file,
    startedAt: Date.now(),
    stoppedAt: null,
    bytes: null,
  };
  recordings.set(camera.id, {
    kill: () => {
      try {
        child.kill("SIGINT");
      } catch {
        // already gone
      }
    },
    info,
  });
  child.on("exit", () => {
    void finalizeRecording(camera.id);
  });
  await presenceStore.update((f) => ({ ...f, recordings: [info, ...f.recordings] }));
  return { ok: true, note: `Recording ${camera.name} — saving on this machine as ${file}.` };
}

async function finalizeRecording(cameraId: string): Promise<void> {
  const live = recordings.get(cameraId);
  if (!live) return;
  recordings.delete(cameraId);
  const presenceStore = await getCameraPresenceStore();
  if (!presenceStore) return;
  let bytes: number | null = null;
  try {
    const fs = await import("node:fs/promises");
    const stat = await fs.stat(`${presenceStore.dataDirectory}/camera-recordings/${live.info.file}`);
    bytes = stat.size;
  } catch {
    bytes = null;
  }
  await presenceStore.update((f) => ({
    ...f,
    recordings: f.recordings.map((r) =>
      r.id === live.info.id ? { ...r, stoppedAt: Date.now(), bytes } : r,
    ),
  }));
}

async function stopRecording(camera: StoredCamera): Promise<ExecResult> {
  const live = recordings.get(camera.id);
  if (!live) return { ok: true, note: `${camera.name} is not recording.` };
  live.kill();
  await finalizeRecording(camera.id);
  return { ok: true, note: `Recording stopped — ${live.info.file} is saved on this machine.` };
}

/* ------------------------------------------------------------------ */
/* Hearing — the camera audio pipeline                                 */
/* ------------------------------------------------------------------ */

interface Listener {
  stop: () => void;
  dir: string;
}

const listeners = new Map<string, Listener>();
const listenerBackoff = new Map<string, number>();

export function hearingLive(cameraId: string): boolean {
  return listeners.has(cameraId);
}

function wavRms(bytes: Buffer): number {
  // 16-bit PCM WAV: find the data chunk, measure RMS. A chunk
  // under the floor is silence — and silence is never transcribed.
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (id === "data") {
      const start = offset + 8;
      const end = Math.min(bytes.length, start + size);
      let sum = 0;
      let count = 0;
      for (let i = start; i + 1 < end; i += 2) {
        const v = bytes.readInt16LE(i) / 32768;
        sum += v * v;
        count++;
      }
      return count > 0 ? Math.sqrt(sum / count) : 0;
    }
    offset += 8 + size;
  }
  return 0;
}

/**
 * The camera's current audio level — a 3-second pull measured
 * with the listener's own RMS. Sector Watch's cross-examination
 * consults it as a stress INDICATOR (a measurable input, labeled
 * as one). Null when no level could be measured — the caller
 * records UNAVAILABLE and claims nothing.
 */
export async function measureCameraAudioLevel(
  camera: StoredCamera,
): Promise<{ rms: number } | null> {
  const lens = ptzLens(camera);
  if (!lens) return null;
  const { spawn } = await import("node:child_process");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const { rtspUrlFor } = await import("./cameras/cameraBridge.server");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `augie-cam-level-${camera.id}-`));
  const file = path.join(dir, "level.wav");
  try {
    const code = await new Promise<number | null>((resolve) => {
      let child: ReturnType<typeof spawn>;
      try {
        child = spawn("ffmpeg", [
          "-hide_banner",
          "-loglevel",
          "error",
          "-rtsp_transport",
          "tcp",
          "-i",
          rtspUrlFor(camera, lens),
          "-t",
          "3",
          "-vn",
          "-ac",
          "1",
          "-ar",
          "16000",
          "-y",
          file,
        ]);
      } catch {
        resolve(null);
        return;
      }
      const killer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // already gone
        }
        resolve(null);
      }, 12_000);
      child.on("error", () => {
        clearTimeout(killer);
        resolve(null);
      });
      child.on("close", (c) => {
        clearTimeout(killer);
        resolve(typeof c === "number" ? c : null);
      });
    });
    if (code !== 0) return null;
    const bytes = await fs.readFile(file);
    if (bytes.length === 0) return null;
    return { rms: wavRms(bytes) };
  } catch {
    return null;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function ensureListener(camera: StoredCamera): Promise<void> {
  if (listeners.has(camera.id)) return;
  const lens = ptzLens(camera);
  if (!lens) return;
  const { spawn } = await import("node:child_process");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `augie-cam-audio-${camera.id}-`));
  const { rtspUrlFor } = await import("./cameras/cameraBridge.server");
  let child: ReturnType<typeof spawn>;
  try {
    child = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-rtsp_transport",
      "tcp",
      "-i",
      rtspUrlFor(camera, lens),
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-f",
      "segment",
      "-segment_time",
      "6",
      "-reset_timestamps",
      "1",
      path.join(dir, "chunk-%05d.wav"),
    ]);
  } catch {
    return;
  }
  const seen = new Set<string>();
  let stopped = false;
  const poll = setInterval(() => {
    void (async () => {
      if (stopped) return;
      let names: string[] = [];
      try {
        names = (await fs.readdir(dir)).filter((n) => n.endsWith(".wav")).sort();
      } catch {
        return;
      }
      // The newest file is still being written; work the rest.
      for (const name of names.slice(0, -1)) {
        if (seen.has(name)) continue;
        seen.add(name);
        const filePath = path.join(dir, name);
        try {
          const bytes = await fs.readFile(filePath);
          await handleAudioChunk(camera, bytes);
        } catch {
          // chunk vanished mid-cleanup — nothing was heard
        } finally {
          await fs.unlink(filePath).catch(() => undefined);
        }
      }
    })();
  }, 3000);
  const stop = () => {
    stopped = true;
    clearInterval(poll);
    try {
      child.kill("SIGKILL");
    } catch {
      // already gone
    }
    listeners.delete(camera.id);
    void fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  };
  child.on("exit", () => {
    if (!stopped) {
      // The stream dropped (camera reboot, network). The armed
      // state stands in the store; the window shows the listener
      // as down, and re-arming is one tap — no silent restart loop.
      stop();
    }
  });
  listeners.set(camera.id, { stop, dir });
}

export function stopListener(cameraId: string): void {
  listeners.get(cameraId)?.stop();
}

async function handleAudioChunk(camera: StoredCamera, bytes: Buffer): Promise<void> {
  if (wavRms(bytes) < 0.012) return; // silence — never transcribed
  if (Date.now() < (listenerBackoff.get(camera.id) ?? 0)) return;
  const { sttServiceUrl } = await import("./transcribe.server");
  let text = "";
  try {
    const res = await fetch(sttServiceUrl(), {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`stt ${res.status}`);
    const data = (await res.json()) as { text?: string };
    text = (data.text ?? "").trim();
  } catch {
    listenerBackoff.set(camera.id, Date.now() + 30_000);
    return;
  }
  if (!text) return;
  await handleHeard(camera, text);
}

async function handleHeard(camera: StoredCamera, text: string): Promise<void> {
  const presenceStore = await getCameraPresenceStore();
  const cameraStore = await getCameraStore();
  if (!presenceStore || !cameraStore) return;
  const file = await presenceStore.read();
  const state = presenceFor(file, camera.id);
  const allCameras = await cameraStore.list();
  const nameRefs = allCameras.map((c) => ({ id: c.id, name: c.name }));

  let kind: HearingEvent["kind"] = "speech";
  let acted: string | null = null;

  const intent = state.commands ? parseCameraCommand(text, nameRefs, camera.id) : null;
  if (intent) {
    kind = "command";
    const result = await executeCameraIntent(intent, camera.name);
    acted = result.ok ? result.note : `Refused: ${result.note}`;
  } else if (hearsAnubisName(text)) {
    kind = "name";
    if (state.commands && cameraCanControl(camera) && !(await allStopInForce())) {
      const turn = await executeCameraIntent({ type: "turn-to-speaker", cameraId: camera.id }, camera.name);
      acted = turn.note;
    } else {
      acted = state.follow.lastCentroid
        ? "Heard his name — noted. (Turning is held: commands are off for this camera, control is not granted, or the ALL-STOP stands.)"
        : "Heard his name — noted. This camera has no last-seen position to turn to.";
    }
  } else {
    acted = state.commands
      ? "Speech for Anubis — waiting in the record for the stage to feed it to him."
      : "Heard and logged. Commands are off for this camera, so nothing was acted on or forwarded.";
  }

  const event: HearingEvent = {
    id: `hear-${Date.now()}-${camera.id}`,
    at: Date.now(),
    cameraId: camera.id,
    cameraName: camera.name,
    text,
    kind,
    acted,
    routed: false,
  };
  await presenceStore.update((f) => ({ ...f, hearing: [event, ...f.hearing] }));
}

/* ------------------------------------------------------------------ */
/* The presence probe — what doors does THIS unit actually expose      */
/* ------------------------------------------------------------------ */

export interface PresenceProbeResult {
  ok: boolean;
  spotlightNote: string;
  trackingNote: string;
}

/**
 * Ask the unit, through its own ONVIF answers, whether a real
 * spotlight door and a real auto-tracking door exist. The
 * verdicts land in the store; the switches in the window exist
 * only where a door was found. A unit that does not answer gets
 * an honest "did not answer", never a guessed capability.
 */
export async function probePresence(camera: StoredCamera): Promise<PresenceProbeResult> {
  const presenceStore = await getCameraPresenceStore();
  if (!presenceStore) return { ok: false, spotlightNote: "No local presence store.", trackingNote: "No local presence store." };
  const onvif = await import("./cameras/onvifClient.server");
  const pure = await import("./cameras/cameraPresence");
  const services = await onvif.onvifServices(camera.host, camera.onvifPort, camera.username, camera.password ?? "");
  if (services.state !== "ok") {
    const note =
      services.state === "auth-refused"
        ? "The camera refused the login — the probe could not read its doors."
        : "The camera's ONVIF door did not answer — nothing about its doors is claimed.";
    await presenceStore.update((f) => {
      const s = presenceFor(f, camera.id);
      s.spotlight = { door: null, on: null, probedAt: Date.now(), note };
      s.tracking = { door: null, on: null, probedAt: Date.now(), note };
      return { ...f, cameras: { ...f.cameras, [camera.id]: s } };
    });
    return { ok: false, spotlightNote: note, trackingNote: note };
  }
  const byNs = (frag: string) => services.value.find((s) => s.namespace.includes(frag))?.xaddr ?? null;
  const mediaUrl = byNs("/media/");
  const ptzUrl = byNs("/ptz/");
  const imagingUrl = byNs("/imaging/");
  const analyticsUrl = byNs("/analytics/");

  // Spotlight: an advertised PTZ auxiliary lamp command is the
  // most direct door; an imaging field named for the white light
  // is the other. IR fields are reported, never wired.
  let spotlight = { door: null as string | null, note: "No imaging service and no PTZ service answered — no spotlight door can be read." };
  if (imagingUrl && mediaUrl) {
    const sources = await onvif.onvifVideoSources(mediaUrl, camera.username, camera.password ?? "");
    if (sources.state === "ok" && sources.value[0]) {
      const settings = await onvif.onvifImagingSettings(imagingUrl, camera.username, camera.password ?? "", sources.value[0]);
      if (settings.state === "ok") {
        spotlight = pure.spotlightDoorFromImaging(pure.imagingFieldNames(settings.value));
      }
    }
  }
  if (ptzUrl) {
    const caps = await onvif.onvifPtzCapabilities(ptzUrl, camera.username, camera.password ?? "");
    if (caps.state === "ok") {
      const aux = pure.spotlightDoorFromAux(pure.auxiliaryCommands(caps.value));
      if (aux) spotlight = aux;
    }
  }

  // Unit auto-tracking: an analytics configuration that speaks
  // of tracking and carries an enable item Augie can flip.
  let tracking = { door: null as string | null, note: "No analytics service answered — no tracking door can be read.", on: null as boolean | null };
  if (analyticsUrl && mediaUrl) {
    const profiles = await onvif.onvifProfilesXml(mediaUrl, camera.username, camera.password ?? "");
    const token = profiles.state === "ok" ? pure.analyticsConfigTokenFromProfiles(profiles.value) : null;
    if (token) {
      const config = await onvif.onvifAnalyticsConfiguration(analyticsUrl, camera.username, camera.password ?? "", token);
      if (config.state === "ok") {
        const verdict = pure.trackingDoorFromAnalytics(config.value);
        let on: boolean | null = null;
        if (verdict.door) {
          const itemName = verdict.door.split(":")[2];
          if (itemName) on = pure.analyticsItemValue(config.value, itemName);
        }
        tracking = { door: verdict.door, note: verdict.note, on };
      } else {
        tracking = { door: null, note: "The unit names an analytics configuration but it did not answer — no tracking door is claimed.", on: null };
      }
    } else {
      tracking = { door: null, note: "No ONVIF auto-tracking door: the unit's profiles carry no video-analytics configuration. Following runs on the core instead (see Follow).", on: null };
    }
  }

  await presenceStore.update((f) => {
    const s = presenceFor(f, camera.id);
    s.spotlight = {
      door: spotlight.door,
      on: spotlight.door ? s.spotlight.on : null,
      probedAt: Date.now(),
      note: spotlight.note,
    };
    s.tracking = {
      door: tracking.door,
      on: tracking.door ? tracking.on : null,
      probedAt: Date.now(),
      note: tracking.note,
    };
    return { ...f, cameras: { ...f.cameras, [camera.id]: s } };
  });
  return { ok: true, spotlightNote: spotlight.note, trackingNote: tracking.note };
}

/**
 * THE STREAM PROBE — measure, per camera, whether the stream
 * the core pulls swings when the moving lens is panned. The
 * brief's first word ("frames never follow PTZ") was disproven
 * live on the Bedroom unit (2026-11-26 ~09:09 CST: an ONVIF pan
 * swung the pulled frame, door view → wall view, then back),
 * while the Command unit's pulled stream never changed across
 * three moves — so this is a MEASURED property, never a
 * hard-coded one. The probe takes a frame, commands a solid
 * pan, takes another frame, and records how much of the picture
 * changed (the evidence travels with the verdict). The head is
 * then panned back toward where it started. It MOVES the camera,
 * so it stands behind the same gates as every send: control
 * granted + the ALL-STOP.
 */
export async function probeStreamFollow(camera: StoredCamera): Promise<ExecResult> {
  if (!cameraCanControl(camera)) {
    return { ok: false, note: "The stream probe moves the camera, and control is not granted on this camera." };
  }
  if (await allStopInForce()) {
    return { ok: false, note: "The ALL-STOP is in force — the stream probe is held like every other action." };
  }
  const presenceStore = await getCameraPresenceStore();
  if (!presenceStore) return { ok: false, note: "No local presence store — the stream probe cannot record its measurement." };
  const lens = ptzLens(camera);
  if (!lens) return { ok: false, note: "This camera has no movable lens — there is no stream-follow question to measure." };
  const { grabGrayFrame } = await import("./cameras/cameraBridge.server");
  const before = await grabGrayFrame(camera, lens, 96, 54, 10_000);
  if (!before) return { ok: false, note: "No frame came back before the test pan — nothing is claimed about this stream." };
  const moved = await nudgePtz(camera, 0.8, 0, 1_200);
  if (!moved) return { ok: false, note: "The test pan did not run — the camera did not take the move." };
  await new Promise((r) => setTimeout(r, 500));
  const after = await grabGrayFrame(camera, lens, 96, 54, 10_000);
  // Return the head toward where the probe found it.
  await nudgePtz(camera, -0.8, 0, 1_200);
  const centroid = after ? motionCentroidIn(before, after, 96, 54, 28, 0) : null;
  const coverage = after ? (centroid ? centroid.coverage : 0) : null;
  const follows = streamFollowsPtzFromCoverage(coverage);
  const note = streamProbeNote(coverage);
  await presenceStore.update((f) => {
    const s = presenceFor(f, camera.id);
    s.streamFollowsPtz = follows;
    s.streamProbedAt = Date.now();
    s.streamNote = note;
    return { ...f, cameras: { ...f.cameras, [camera.id]: s } };
  });
  return { ok: follows !== null, note };
}

/** Re-arm whatever the store says should be running (after a
 *  server restart the loops and listeners are gone; the armed
 *  states in the store are the truth to rebuild from). */
export async function reconcilePresence(): Promise<void> {
  const presenceStore = await getCameraPresenceStore();
  const cameraStore = await getCameraStore();
  if (!presenceStore || !cameraStore) return;
  const file = await presenceStore.read();
  for (const camera of await cameraStore.list()) {
    const state = presenceFor(file, camera.id);
    if (state.hearing) await ensureListener(camera);
    if (state.patrol.active) ensurePatrolLoop(camera.id);
    if (state.follow.active) ensureFollowLoop(camera.id);
  }
}

/* ------------------------------------------------------------------ */
/* Creator enrollment + recognition check                              */
/* ------------------------------------------------------------------ */

export async function enrollCreator(camera: StoredCamera): Promise<ExecResult & { frames?: number }> {
  const presenceStore = await getCameraPresenceStore();
  if (!presenceStore) return { ok: false, note: "No local presence store on this surface." };
  const lens = ptzLens(camera);
  if (!lens) return { ok: false, note: "This camera has no lens registered." };
  const { grabSnapshot } = await import("./cameras/cameraBridge.server");
  const fs = await import("node:fs/promises");
  const dir = `${presenceStore.dataDirectory}/creator-faces`;
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  // Clear any previous enrollment frames — one enrollment, his latest.
  const previous = (await presenceStore.read()).enrollment;
  if (previous) {
    for (const f of previous.frames) {
      await fs.unlink(`${dir}/${f}`).catch(() => undefined);
    }
  }
  const frames: string[] = [];
  for (let i = 0; i < 3; i++) {
    const frame = await grabSnapshot(camera, lens, 10_000);
    if (frame) {
      const name = `creator-${camera.id}-${Date.now()}-${i}.jpg`;
      await fs.writeFile(`${dir}/${name}`, frame, { mode: 0o600 });
      frames.push(name);
    }
    if (i < 2) await new Promise((r) => setTimeout(r, 800));
  }
  if (frames.length === 0) {
    return { ok: false, note: "No frame came back from that camera — nothing was enrolled. Stand where it can see you and try again." };
  }
  await presenceStore.update((f) => ({
    ...f,
    enrollment: { cameraId: camera.id, cameraName: camera.name, frames, at: Date.now() },
  }));
  return {
    ok: true,
    frames: frames.length,
    note: `Enrolled — ${frames.length} reference frame${frames.length === 1 ? "" : "s"} from ${camera.name}, stored only on this machine.`,
  };
}

export type CreatorCheckResult =
  | { state: "match" | "no-match"; note: string }
  | { state: "no-verdict" | "unavailable" | "not-enrolled"; note: string };

export async function checkCreator(camera: StoredCamera): Promise<CreatorCheckResult> {
  const presenceStore = await getCameraPresenceStore();
  if (!presenceStore) return { state: "unavailable", note: "No local presence store on this surface." };
  const file = await presenceStore.read();
  const enrollment = file.enrollment;
  if (!enrollment || enrollment.frames.length === 0) {
    return { state: "not-enrolled", note: "No creator enrollment yet — enroll his face from a camera first." };
  }
  const lens = ptzLens(camera);
  if (!lens) return { state: "unavailable", note: "This camera has no lens registered." };
  const { grabSnapshot } = await import("./cameras/cameraBridge.server");
  const fs = await import("node:fs/promises");
  const current = await grabSnapshot(camera, lens, 10_000);
  if (!current) return { state: "unavailable", note: "No frame came back from that camera — no check was made." };
  let reference: Buffer;
  try {
    reference = await fs.readFile(`${presenceStore.dataDirectory}/creator-faces/${enrollment.frames[0]}`);
  } catch {
    return { state: "unavailable", note: "The enrollment frames are missing from the core — enroll again." };
  }
  const verdict = await askVisionYesNo(
    [reference.toString("base64"), current.toString("base64")],
    SAME_PERSON_PROMPT,
  );
  if (verdict === null) {
    return {
      state: "no-verdict",
      note: "The analyzer gave no clean yes or no — no match is claimed. Its word here is a draft either way, never proof of identity.",
    };
  }
  return verdict
    ? {
        state: "match",
        note: "The analyzer's draft reading says this is the Captain. That is a hint from a model that can be wrong — reported as a match, never as certainty.",
      }
    : {
        state: "no-match",
        note: "The analyzer's draft reading says this is not the enrolled face. It can be wrong — reported as a reading, never as certainty.",
      };
}
