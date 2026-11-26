/**
 * STOP MODE RUNTIME — node-only, server-side. The living half
 * of the personal-safety pass (owner order 2026-11-26).
 *
 * When a stop begins — the Captain declares it, an officer's
 * own words give it away, or he starts it from the panel —
 * this runtime:
 *
 *   · RECORDS the interaction at once: the hearing camera's
 *     stream, copied by ffmpeg into the evidence folder on the
 *     core (~/.local/share/augie/evidence/, 0600). The record
 *     is evidence: start time, source camera, the file itself.
 *   · CHECKS every line heard on that camera against the law
 *     base and writes the verdicts into the stop record —
 *     matches, contradicts, or the honest "not in the base".
 *   · QUEUES GUIDANCE built only from base entries (their
 *     exact-word scripts, entry-id cited) for the panel to put
 *     in his ear through the voice path.
 *   · ENDS the stop on his word, on ten minutes of silence, or
 *     the instant the ALL-STOP is raised — the ALL-STOP governs
 *     recording here exactly as it governs every send.
 *
 * Hard bounds, in code: stop mode can only start on a camera
 * whose HEARING IS ARMED (listening on is his act — this module
 * never turns a microphone on), it refuses to start under the
 * ALL-STOP, and it records nothing outside an active stop.
 * Runtime handles (the ffmpeg child, the sweeper) live in this
 * module's memory; the durable record lives in the evidence
 * store.
 */
import { getCameraStore, type StoredCamera } from "./cameraStore.server";
import { getEvidenceStore } from "./evidenceStore.server";
import { getLawBaseStore } from "./lawBaseStore.server";
import { allStopInForce } from "./cameraPresenceRuntime.server";
import {
  checkOfficerClaim,
  detectStopTrigger,
  guidanceForClaim,
  isStopRelease,
  looksLikeLegalClaim,
  STOP_SILENCE_WINDOW_MS,
} from "./lawBase";
import type { EvidenceRecording, StopSession, StopTriggerKind } from "./evidence";
import type { CameraLens } from "./cameras/cameraRegistry";

/* ------------------------------------------------------------------ */
/* Live handles                                                        */
/* ------------------------------------------------------------------ */

interface LiveStop {
  sessionId: string;
  cameraId: string;
  kill: (() => void) | null;
  file: string;
}

let live: LiveStop | null = null;
let sweeper: ReturnType<typeof setInterval> | null = null;

export function stopModeLive(): boolean {
  return live !== null;
}

function lensFor(camera: StoredCamera): CameraLens | null {
  return camera.lenses.find((l) => l.kind === "ptz") ?? camera.lenses[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

export interface StartStopResult {
  ok: boolean;
  note: string;
  session: StopSession | null;
}

export async function startStopMode(input: {
  camera: StoredCamera;
  trigger: StopTriggerKind;
  triggerText: string;
}): Promise<StartStopResult> {
  const evidenceStore = await getEvidenceStore();
  if (!evidenceStore) return { ok: false, note: "No local evidence store on this surface.", session: null };
  if (await allStopInForce()) {
    return {
      ok: false,
      note: "Refused — the ALL-STOP is in force. Stop mode records nothing while it stands.",
      session: null,
    };
  }
  const current = await evidenceStore.read();
  if (current.active) {
    return {
      ok: true,
      note: `Stop mode is already on — recording through ${current.active.cameraName} since ${new Date(current.active.startedAt).toLocaleTimeString()}.`,
      session: current.active,
    };
  }
  const lens = lensFor(input.camera);
  if (!lens) {
    return { ok: false, note: `${input.camera.name} has no lens registered to record through.`, session: null };
  }

  const now = Date.now();
  const session: StopSession = {
    id: `stop-${now}-${input.camera.id}`,
    startedAt: now,
    endedAt: null,
    trigger: input.trigger,
    triggerText: input.triggerText.slice(0, 500),
    cameraId: input.camera.id,
    cameraName: input.camera.name,
    recording: null,
    claims: [],
    guidance: [],
    endKind: "still-open",
    lastHeardAt: now,
  };

  // The recording: the camera's own stream, copied whole —
  // its audio is the conversation, its video the scene.
  const fs = await import("node:fs/promises");
  await fs.mkdir(evidenceStore.directory, { recursive: true, mode: 0o700 });
  const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");
  const slug =
    input.camera.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || input.camera.id;
  const file = `stop-${slug}-${stamp}.mkv`;
  let kill: (() => void) | null = null;
  try {
    const { spawn } = await import("node:child_process");
    const { rtspUrlFor } = await import("./cameras/cameraBridge.server");
    const child = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-rtsp_transport",
      "tcp",
      "-i",
      rtspUrlFor(input.camera, lens),
      "-map",
      "0",
      "-c",
      "copy",
      "-y",
      `${evidenceStore.directory}/${file}`,
    ]);
    kill = () => {
      try {
        child.kill("SIGINT");
      } catch {
        // already gone
      }
    };
    child.on("exit", () => {
      // The stream ended on its own (camera reboot, network).
      // The record stands; the stop stays open until an end
      // condition closes it, and says its recording stopped.
      if (live && live.sessionId === session.id) live.kill = null;
    });
  } catch {
    return {
      ok: false,
      note: "ffmpeg is not available on this machine — stop mode cannot record, so it does not pretend to start.",
      session: null,
    };
  }

  const recording: EvidenceRecording = {
    id: `ev-${now}-${input.camera.id}`,
    file,
    cameraId: input.camera.id,
    cameraName: input.camera.name,
    startedAt: now,
    stoppedAt: null,
    bytes: null,
  };
  const withRecording: StopSession = { ...session, recording };
  await evidenceStore.update((f) => ({ ...f, active: withRecording }));
  live = { sessionId: session.id, cameraId: input.camera.id, kill, file };
  ensureSweeper();
  return {
    ok: true,
    note: `Stop mode is ON — recording through ${input.camera.name}. The recording is evidence and stays on this machine.`,
    session: withRecording,
  };
}

/* ------------------------------------------------------------------ */
/* End                                                                 */
/* ------------------------------------------------------------------ */

export type StopEndKindInput = "his-word" | "silence" | "all-stop" | "panel";

export async function endStopMode(endKind: StopEndKindInput): Promise<{ ok: boolean; note: string }> {
  const evidenceStore = await getEvidenceStore();
  if (!evidenceStore) return { ok: false, note: "No local evidence store on this surface." };
  const current = await evidenceStore.read();
  const active = current.active;
  if (!active) {
    live = null;
    return { ok: true, note: "No stop is in progress." };
  }
  const ending = live;
  live = null;
  ending?.kill?.();
  // Give ffmpeg a beat to close the file before measuring it.
  await new Promise((r) => setTimeout(r, 400));
  let bytes: number | null = null;
  if (active.recording) {
    try {
      const fs = await import("node:fs/promises");
      const stat = await fs.stat(`${evidenceStore.directory}/${active.recording.file}`);
      bytes = stat.size;
    } catch {
      bytes = null;
    }
  }
  const now = Date.now();
  const finished: StopSession = {
    ...active,
    endedAt: now,
    endKind,
    recording: active.recording
      ? { ...active.recording, stoppedAt: now, bytes }
      : null,
  };
  await evidenceStore.update((f) => ({
    active: null,
    stops: [finished, ...f.stops],
  }));
  const why =
    endKind === "his-word"
      ? "ended on your word"
      : endKind === "all-stop"
        ? "ended by the ALL-STOP"
        : endKind === "silence"
          ? "ended after ten minutes of silence"
          : "ended from the panel";
  return {
    ok: true,
    note: `Stop mode is off — the stop ${why}. Its recording and claim record are in the evidence store.`,
  };
}

/* ------------------------------------------------------------------ */
/* The sweeper — silence and the ALL-STOP end a stop on their own      */
/* ------------------------------------------------------------------ */

function ensureSweeper(): void {
  if (sweeper) return;
  sweeper = setInterval(() => {
    void (async () => {
      const evidenceStore = await getEvidenceStore();
      if (!evidenceStore) return;
      const file = await evidenceStore.read();
      if (!file.active) {
        if (sweeper) {
          clearInterval(sweeper);
          sweeper = null;
        }
        live = null;
        return;
      }
      if (await allStopInForce()) {
        await endStopMode("all-stop");
        return;
      }
      if (Date.now() - file.active.lastHeardAt > STOP_SILENCE_WINDOW_MS) {
        await endStopMode("silence");
      }
    })();
  }, 30_000);
}

/** Rebuild the live handle after a server restart: an active
 *  stop on the record is closed honestly as ended by the
 *  restart's silence — its recording file stands as it fell. */
export async function reconcileStopMode(): Promise<void> {
  const evidenceStore = await getEvidenceStore();
  if (!evidenceStore) return;
  const file = await evidenceStore.read();
  if (file.active && !live) {
    // The process restarted mid-stop: the ffmpeg child is gone
    // with the old process. Close the record as a silence end —
    // no line has been heard by THIS process, and the record
    // must not claim a recording is still running.
    const active = file.active;
    let bytes: number | null = null;
    if (active.recording) {
      try {
        const fs = await import("node:fs/promises");
        bytes = (await fs.stat(`${evidenceStore.directory}/${active.recording.file}`)).size;
      } catch {
        bytes = null;
      }
    }
    await evidenceStore.update((f) => ({
      active: null,
      stops: [
        {
          ...active,
          endedAt: Date.now(),
          endKind: "silence" as const,
          recording: active.recording
            ? { ...active.recording, stoppedAt: Date.now(), bytes }
            : null,
        },
        ...f.stops,
      ],
    }));
  }
  if (file.active) ensureSweeper();
}

/* ------------------------------------------------------------------ */
/* Heard lines — the presence runtime feeds every line through here    */
/* ------------------------------------------------------------------ */

/**
 * One heard line, from the camera hearing pipeline. Three jobs:
 *   1. If a stop is live on THIS camera: keep its clock alive,
 *      check the line against the law base, log the verdict,
 *      and queue any guidance the matched entry carries (once
 *      per entry per stop — his ear is not a loop).
 *   2. If his release words are heard from the Captain: end it.
 *   3. If no stop is live: a declaration from him, or an
 *      officer's own stop vocabulary, starts one — but only on
 *      a camera whose hearing is armed (the caller is that
 *      pipeline, so the line itself proves it) and never under
 *      the ALL-STOP.
 */
export async function noteHeardLine(input: {
  camera: StoredCamera;
  text: string;
  speaker: "captain" | "another" | null;
}): Promise<void> {
  const evidenceStore = await getEvidenceStore();
  if (!evidenceStore) return;
  const file = await evidenceStore.read();
  const active = file.active;

  if (active) {
    if (active.cameraId !== input.camera.id) return;
    // His release words end it — his voice only, so an officer
    // cannot talk the recording off.
    if (input.speaker === "captain" && isStopRelease(input.text)) {
      await endStopMode("his-word");
      return;
    }
    // The Captain's own lines are not officer claims — they
    // keep the stop's clock alive and nothing more. Every other
    // line is checked: a verdict from the base when the base
    // has one, and a "not in the base" record when the line is
    // claim-shaped but the base is silent.
    if (input.speaker === "captain") {
      await evidenceStore.update((f) =>
        f.active ? { ...f, active: { ...f.active, lastHeardAt: Date.now() } } : f,
      );
      return;
    }
    const lawStore = await getLawBaseStore();
    const base = lawStore ? await lawStore.read() : null;
    const result = base ? checkOfficerClaim(input.text, base.entries) : null;
    await evidenceStore.update((f) => {
      if (!f.active) return f;
      const next: StopSession = { ...f.active, lastHeardAt: Date.now() };
      if (result && result.entry) {
        next.claims = [
          ...next.claims,
          {
            at: Date.now(),
            claim: input.text.slice(0, 500),
            verdict: result.verdict,
            entryId: result.entry.id,
            note: result.note,
            source: input.camera.name,
          },
        ];
        const fresh = guidanceForClaim(result).filter(
          (line) => !next.guidance.some((g) => g.entryId === line.entryId && g.text === line.text),
        );
        if (fresh.length > 0) next.guidance = [...next.guidance, ...fresh];
      } else if (result && (result.related || looksLikeLegalClaim(input.text))) {
        next.claims = [
          ...next.claims,
          {
            at: Date.now(),
            claim: input.text.slice(0, 500),
            verdict: result.verdict,
            entryId: null,
            note: result.note,
            source: input.camera.name,
          },
        ];
      }
      return { ...f, active: next };
    });
    return;
  }

  // No stop live — does this line start one?
  const trigger = detectStopTrigger(input.text);
  if (!trigger) return;
  if (trigger === "declaration" && input.speaker === "another") return; // not his declaration
  await startStopMode({
    camera: input.camera,
    trigger,
    triggerText: input.text,
  });
}
