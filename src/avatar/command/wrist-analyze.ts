/**
 * WRIST ANALYZE — "Agamos, analyze" (owner order 2026-11-04).
 * A real-time, on-command analyzer for the phone on the owner's wrist:
 * the camera turns on, watches, captures and analyzes from the first
 * movement to the last, until an explicit stop command, so he has the
 * whole sequence as proof and evidence for his own safety situations.
 *
 * Pure logic only — no three.js, no DOM, no network — so it stays
 * unit-testable. The panel owns the camera stream, the motion sampling
 * and the frame capture; this file decides state, motion, decode and
 * the RF honesty report.
 *
 * HONEST LIMITS, stated on the face of the mode, never hidden:
 * - A single phone camera is NOT true 360 degrees all at once. It sees
 *   what it is pointed at; 360 coverage only happens as the owner
 *   rotates his wrist / phone around. The timeline records what the
 *   camera actually saw, in order, never a view it did not have.
 * - NO facial recognition, NO person identification, ever. Analysis
 *   describes objects, movements and actions only. Detection is not
 *   identification, and this mode never names a person from a face.
 * - Evidence stays local to his device. Frames are kept in memory
 *   during a session, never auto-saved to the photo archive, never
 *   auto-uploaded or auto-shared. On the trigger, analysis runs
 *   AUTOMATICALLY with no button press: the first frame is sent
 *   through the existing vision path once the camera is ready, then
 *   on movement, throttled to at most once every 30 seconds (see
 *   WRIST_AUTO_ANALYZE_MIN_INTERVAL_MS) — the 2-second motion
 *   sampling watches continuously, the vision provider is never
 *   spammed with every sampled frame. ANALYZE THIS FRAME stays as
 *   an extra manual button only.
 * - STOP PRESERVES THE CAPTURE (owner correction 2026-11-04):
 *   stopping ends live watching/capture ONLY. It never clears,
 *   removes or modifies the last captured picture, its HUD grids,
 *   the motion timeline or the evidence summary — they stay on
 *   screen exactly as captured until the owner himself dismisses
 *   that screen (CLOSE button / "dismiss analyze"). Only a new
 *   analyze session or an explicit "rescan" replaces the capture.
 * - RF: a web page cannot scan the local airwaves, and a phone alone
 *   cannot scan arbitrary radio frequencies like an SDR. Open
 *   frequencies here means unencrypted public broadcasts only — never
 *   interception of private communications, never decryption of
 *   encrypted traffic. Lawful defense on his own property only.
 * - This mode is an explicit owner override of the general deck rule
 *   "live frames never recorded / auto-saved", FOR THIS ON-COMMAND
 *   MODE ONLY. Outside this mode, watching never auto-analyzes and
 *   live frames are never recorded or auto-saved, exactly as before.
 */

export interface WristMotionEvent {
  atMs: number;
  label: string;
}

export interface WristDecode {
  atMs: number;
  input: string;
  kind: string;
  output: string;
}

export interface WristRfLog {
  atMs: number;
  frequency: string;
  note: string;
}

export interface WristAnalyzeState {
  active: boolean;
  startedAtMs: number | null;
  stoppedAtMs: number | null;
  frameCount: number;
  motionEvents: WristMotionEvent[];
  decodes: WristDecode[];
  rfLogs: WristRfLog[];
}

export function emptyWristAnalyzeState(): WristAnalyzeState {
  return {
    active: false,
    startedAtMs: null,
    stoppedAtMs: null,
    frameCount: 0,
    motionEvents: [],
    decodes: [],
    rfLogs: [],
  };
}

/** Start a session. Starting while already active changes nothing. */
export function startWristAnalyze(state: WristAnalyzeState, nowMs: number): WristAnalyzeState {
  if (state.active) return state;
  return {
    active: true,
    startedAtMs: nowMs,
    stoppedAtMs: null,
    frameCount: 0,
    motionEvents: [],
    decodes: [],
    rfLogs: [],
  };
}

/** Stop a session. Stopping while idle changes nothing. */
export function stopWristAnalyze(state: WristAnalyzeState, nowMs: number): WristAnalyzeState {
  if (!state.active) return state;
  return { ...state, active: false, stoppedAtMs: nowMs };
}

export function addWristFrame(state: WristAnalyzeState): WristAnalyzeState {
  if (!state.active) return state;
  return { ...state, frameCount: state.frameCount + 1 };
}

export function addWristMotion(
  state: WristAnalyzeState,
  atMs: number,
  label: string,
): WristAnalyzeState {
  if (!state.active) return state;
  return {
    ...state,
    motionEvents: [...state.motionEvents, { atMs, label }],
  };
}

/**
 * Motion score between two small luminance frames (values 0-255, same
 * length): the mean absolute difference. A flat, unchanged view scores
 * near 0; a hand moving across the frame scores high. The panel samples
 * the camera down to a small grid and calls this, so no full frame is
 * ever stored for motion detection.
 */
export function motionScore(prev: number[], curr: number[]): number {
  if (prev.length === 0 || prev.length !== curr.length) return 0;
  let sum = 0;
  for (let i = 0; i < prev.length; i++) {
    sum += Math.abs((curr[i] ?? 0) - (prev[i] ?? 0));
  }
  return sum / prev.length;
}

/** Default motion threshold on the 0-255 mean-difference scale. */
export const WRIST_MOTION_THRESHOLD = 18;

/**
 * Minimum gap between AUTOMATIC vision sends. Motion is sampled
 * every 2 seconds, but the vision provider is not: an automatic
 * frame is sent at most once per 30 seconds (plus the very first
 * frame once the camera is ready), so a long session never spams
 * the provider with every sampled frame.
 */
export const WRIST_AUTO_ANALYZE_MIN_INTERVAL_MS = 30000;

/** True when an automatic vision send is due (first send, or throttled). */
export function shouldAutoAnalyze(lastAutoMs: number | null, nowMs: number): boolean {
  if (lastAutoMs === null) return true;
  return nowMs - lastAutoMs >= WRIST_AUTO_ANALYZE_MIN_INTERVAL_MS;
}

export function isWristMotion(score: number): boolean {
  return score >= WRIST_MOTION_THRESHOLD;
}

function isPrintableAscii(text: string): boolean {
  if (text.length === 0) return false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 || code > 126) return false;
  }
  return true;
}

function decodeHex(input: string): string | null {
  const cleaned = input.replace(/\s+/g, "");
  if (cleaned.length < 8 || cleaned.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) return null;
  let out = "";
  for (let i = 0; i < cleaned.length; i += 2) {
    out += String.fromCharCode(parseInt(cleaned.slice(i, i + 2), 16));
  }
  return isPrintableAscii(out) ? out : null;
}

function decodeBase64(input: string): string | null {
  const cleaned = input.replace(/\s+/g, "");
  if (cleaned.length < 8 || cleaned.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) return null;
  try {
    const binary = atob(cleaned);
    let out = "";
    for (let i = 0; i < binary.length; i++) {
      out += binary.charCodeAt(i) < 128 ? binary[i]! : "";
    }
    // atob output must round-trip to printable text, or it is not a decode.
    if (out.length !== binary.length) return null;
    return isPrintableAscii(out) ? out : null;
  } catch {
    return null;
  }
}

const MORSE_TABLE: Record<string, string> = {
  ".-": "A",
  "-...": "B",
  "-.-.": "C",
  "-..": "D",
  ".": "E",
  "..-.": "F",
  "--.": "G",
  "....": "H",
  "..": "I",
  ".---": "J",
  "-.-": "K",
  ".-..": "L",
  "--": "M",
  "-.": "N",
  "---": "O",
  ".--.": "P",
  "--.-": "Q",
  ".-.": "R",
  "...": "S",
  "-": "T",
  "..-": "U",
  "...-": "V",
  ".--": "W",
  "-..-": "X",
  "-.--": "Y",
  "--..": "Z",
  "-----": "0",
  ".----": "1",
  "..---": "2",
  "...--": "3",
  "....-": "4",
  ".....": "5",
  "-....": "6",
  "--...": "7",
  "---..": "8",
  "----.": "9",
};

function decodeMorse(input: string): string | null {
  const trimmed = input.trim();
  if (!/^[.\- /]+$/.test(trimmed)) return null;
  const words = trimmed.split(/\s{2,}|\s*\/\s*/);
  let out = "";
  for (const word of words) {
    for (const code of word.trim().split(/\s+/)) {
      const letter = MORSE_TABLE[code];
      if (!letter) return null;
      out += letter;
    }
    out += " ";
  }
  const result = out.trim();
  return result.length > 0 ? result : null;
}

/**
 * Decode what is being analyzed, where the deck can do so lawfully:
 * on-screen text, signs, labels or codes in view, in hex, base64 or
 * Morse. Returns null when the input is not a decodable code — the
 * caller says plainly that it could not be decoded, and never invents
 * a decode. Plain words are not forced through a decoder: a decode is
 * returned only when the decoded text is printable.
 */
export function tryWristDecode(input: string): { kind: string; output: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const hex = decodeHex(trimmed);
  if (hex) return { kind: "hex", output: hex };
  const b64 = decodeBase64(trimmed);
  if (b64) return { kind: "base64", output: b64 };
  const morse = decodeMorse(trimmed);
  if (morse) return { kind: "morse", output: morse };
  return null;
}

/**
 * What the phone can and cannot do about radio, stated plainly. A web
 * page cannot scan the local airwaves; a phone alone cannot scan
 * arbitrary radio frequencies like an SDR. What exists here is: a
 * user-approved Bluetooth device picker (not a passive scan), the
 * connection type only (not a scan), and the owner's own observed
 * open-frequency log — plus the deck's existing RF WATCH reference
 * and FREQUENCY calculator. Arbitrary open-frequency scanning needs
 * external SDR hardware connected, which a browser page alone does
 * not have.
 */
export function rfCapabilityReport(hasBluetoothApi: boolean, hasNetworkInfo: boolean): string[] {
  return [
    "RF check — what this phone can and cannot do:",
    "- It CANNOT scan arbitrary radio frequencies. A web page cannot scan the local airwaves, and a phone alone is not an SDR.",
    "- Arbitrary open-frequency scanning needs external SDR hardware connected. Without it, no live scan is claimed here.",
    hasBluetoothApi
      ? "- Bluetooth: a user-approved device picker only — it shows devices you choose, it is not a passive scan of nearby radios."
      : "- Bluetooth: no Bluetooth API in this browser, so no Bluetooth picker is available here.",
    hasNetworkInfo
      ? "- Network: the connection type only (for example wifi or cellular) — not a scan of nearby networks or signals."
      : "- Network: no connection-type API in this browser.",
    "- OPEN frequencies only: unencrypted public broadcasts. Never interception of private communications, never decryption of encrypted traffic.",
    "- An open frequency you observe yourself can be logged below — it is labelled USER-OBSERVED, never auto-detected.",
    "- For reference and audit records, open RF WATCH; for band math, open FREQUENCY.",
  ];
}

/* ------------------------------------------------------------------ */
/* RF AUTO SCAN — SURVIVAL METHOD (owner order 2026-11-04: "I have   */
/* a auto button so it can just check through channels channels      */
/* until it finds one. I like to keep things for survival methods    */
/* as well."). "Lateral" in that order is read as local/open         */
/* frequencies, in the context of this RF box; if the owner meant a   */
/* different band, the panel must say which bands it can and cannot  */
/* check, never invent one.                                          */
/*                                                                     */
/* HONESTY CONTRACT, enforced by the shape of this state machine:     */
/* the deck has NO SDR integration and a web page cannot scan the    */
/* local airwaves, so there is no live radio channel to walk. AUTO   */
/* SCAN therefore walks ONLY what is genuinely checkable: first,    */
/* the owner's own saved USER-OBSERVED open channels, in order —     */
/* if one exists, the scan stops there and reports it as a SAVED     */
/* channel, never as a live detection. Then it reports the phone-    */
/* checkable items (Bluetooth picker availability, network type),    */
/* which are NOT radio channels and are labelled as such. If no     */
/* saved channel exists, the scan ends with a plain no-live-scan    */
/* message: connect external SDR hardware to scan live channels.    */
/* No frequency is ever invented, and no channel is ever claimed    */
/* checked when it was not. A future SDR integration would plug in  */
/* here by supplying a real, hardware-backed channel list — until    */
/* then, `sdrConnected` is always false in the deck, and the panel  */
/* says so.                                                          */
/* ------------------------------------------------------------------ */

export type WristRfAutoScanStatus =
  "idle" | "scanning" | "found" | "done-no-live-channel" | "cancelled";

export interface WristRfAutoScanState {
  status: WristRfAutoScanStatus;
  /** Human-readable progress lines, in the order they were checked. */
  checked: string[];
  /** The saved channel the scan stopped at, if any — never a live detection. */
  found: WristRfLog | null;
  /** Index into the saved-channel list of the next channel to check. */
  nextIndex: number;
}

export function emptyWristRfAutoScan(): WristRfAutoScanState {
  return { status: "idle", checked: [], found: null, nextIndex: 0 };
}

/** Start a scan. Starting while one is running changes nothing. */
export function startWristRfAutoScan(
  state: WristRfAutoScanState,
  savedChannels: WristRfLog[],
): WristRfAutoScanState {
  if (state.status === "scanning") return state;
  if (savedChannels.length === 0) {
    return {
      status: "done-no-live-channel",
      checked: [
        "No saved open channels to check.",
        "Phone-checkable items are not radio channels: Bluetooth picker (user-approved only) and network connection type only.",
        "No live open channel found. A phone alone cannot scan radio channels — connect external SDR hardware to scan live channels. No frequency was invented.",
      ],
      found: null,
      nextIndex: 0,
    };
  }
  return { status: "scanning", checked: [], found: null, nextIndex: 0 };
}

/**
 * Advance the scan by one saved channel. The first saved channel
 * stops the scan: it is reported as a SAVED channel the owner
 * already observed, never as a live detection, and no further
 * channel is claimed checked.
 */
export function advanceWristRfAutoScan(
  state: WristRfAutoScanState,
  savedChannels: WristRfLog[],
): WristRfAutoScanState {
  if (state.status !== "scanning") return state;
  const next = savedChannels[state.nextIndex];
  if (!next) {
    return {
      ...state,
      status: "done-no-live-channel",
      checked: [
        ...state.checked,
        "No live open channel found. A phone alone cannot scan radio channels — connect external SDR hardware to scan live channels. No frequency was invented.",
      ],
    };
  }
  return {
    status: "found",
    checked: [
      ...state.checked,
      `Checked saved open channel: ${next.frequency} — found. This is a channel you already observed (USER-OBSERVED), not a live scan detection.`,
    ],
    found: next,
    nextIndex: state.nextIndex + 1,
  };
}

/** Cancel a running scan. Cancelling any other state changes nothing. */
export function stopWristRfAutoScan(state: WristRfAutoScanState): WristRfAutoScanState {
  if (state.status !== "scanning") return state;
  return { ...state, status: "cancelled" };
}

/** Plain-text evidence summary for a finished session. Local only. */
export function wristEvidenceSummary(state: WristAnalyzeState): string {
  const start = state.startedAtMs;
  const end = state.stoppedAtMs ?? Date.now();
  const seconds = start === null ? 0 : Math.max(0, Math.round((end - start) / 1000));
  const firstMotion = state.motionEvents[0];
  const lastMotion = state.motionEvents[state.motionEvents.length - 1];
  const lines = [
    "WRIST ANALYZE — EVIDENCE SUMMARY (local only, not a legal certification).",
    `Session: ${seconds}s, ${state.frameCount} frames sampled, ${state.motionEvents.length} movement events.`,
    firstMotion
      ? `First movement: ${new Date(firstMotion.atMs).toLocaleTimeString()} — ${firstMotion.label}.`
      : "First movement: none recorded.",
    lastMotion
      ? `Last movement: ${new Date(lastMotion.atMs).toLocaleTimeString()} — ${lastMotion.label}.`
      : "Last movement: none recorded.",
    state.decodes.length
      ? `Decoded: ${state.decodes.map((d) => `${d.kind}: ${d.output}`).join("; ")}.`
      : "Decoded: nothing decoded in this session.",
    state.rfLogs.length
      ? `Open frequencies logged (user-observed): ${state.rfLogs.map((r) => `${r.frequency}${r.note ? ` (${r.note})` : ""}`).join("; ")}.`
      : "Open frequencies logged: none.",
    "Frames were kept in memory during the session only — never auto-saved, never auto-uploaded, never auto-shared. No person was identified: analysis describes objects, movements and actions only.",
  ];
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* ANALYSIS QUEUE — FINISH THEN STOP (owner order 2026-11-04).        */
/*                                                                     */
/* A new movement while an analysis is still being spoken/written    */
/* must NOT interrupt it and must NOT start mid-sentence. The       */
/* current analysis finishes, then PAUSES so the owner can read     */
/* the rest; only when he says "continue analysis" (or taps         */
/* CONTINUE) does the next queued analysis begin. Speech is never   */
/* cut by the next analysis automatically, because the next one     */
/* never starts on its own — the owner starts it.                    */
/* ------------------------------------------------------------------ */

export interface WristAnalysisQueue {
  /** Id of the analysis currently running, or null. */
  activeId: string | null;
  /** Queued ids, in arrival order. */
  pendingIds: string[];
  /** True after an analysis finishes while more are queued. */
  pausedForReading: boolean;
  /** True when the queue refused a new item because it was full. */
  droppedLatest: boolean;
}

export const WRIST_ANALYSIS_QUEUE_MAX = 10;

export function emptyWristAnalysisQueue(): WristAnalysisQueue {
  return { activeId: null, pendingIds: [], pausedForReading: false, droppedLatest: false };
}

/**
 * Offer a new analysis id. If nothing is running and nothing is
 * paused, it starts immediately (returns "start"); otherwise it is
 * queued (returns "queued"); when the queue is full it is refused
 * (returns "dropped") and the caller must say so plainly — never
 * silently drop a queued picture.
 */
export function offerWristAnalysis(
  queue: WristAnalysisQueue,
  id: string,
): { queue: WristAnalysisQueue; action: "start" | "queued" | "dropped" } {
  if (queue.activeId === null && !queue.pausedForReading) {
    return { queue: { ...queue, activeId: id, droppedLatest: false }, action: "start" };
  }
  if (queue.pendingIds.length >= WRIST_ANALYSIS_QUEUE_MAX) {
    return { queue: { ...queue, droppedLatest: true }, action: "dropped" };
  }
  return {
    queue: { ...queue, pendingIds: [...queue.pendingIds, id], droppedLatest: false },
    action: "queued",
  };
}

/** The running analysis finished. If more are queued, pause for reading. */
export function finishWristAnalysis(queue: WristAnalysisQueue): WristAnalysisQueue {
  if (queue.activeId === null) return queue;
  return {
    ...queue,
    activeId: null,
    pausedForReading: queue.pendingIds.length > 0,
  };
}

/** Owner said continue: start the next queued analysis, or null. */
export function continueWristAnalysis(queue: WristAnalysisQueue): {
  queue: WristAnalysisQueue;
  nextId: string | null;
} {
  const [nextId, ...rest] = queue.pendingIds;
  if (nextId === undefined) {
    return { queue: { ...queue, pausedForReading: false }, nextId: null };
  }
  return {
    queue: {
      ...queue,
      activeId: nextId,
      pendingIds: rest,
      pausedForReading: false,
      droppedLatest: false,
    },
    nextId,
  };
}

/** Plain queue status line for the panel / pamphlet. */
export function wristQueueStatus(queue: WristAnalysisQueue): string {
  if (queue.activeId !== null) {
    return queue.pendingIds.length > 0
      ? `Analysis running — ${queue.pendingIds.length} queued behind it. When this one finishes, it pauses so you can read it, then you say continue analysis for the next.`
      : "Analysis running — nothing queued behind it.";
  }
  if (queue.pausedForReading) {
    return `Analysis finished — PAUSED so you can read it. ${queue.pendingIds.length} queued. Say continue analysis, or tap CONTINUE, for the next.`;
  }
  return "No analysis running, nothing queued.";
}

/* ------------------------------------------------------------------ */
/* PICTURE ARCHIVE / CABINET (owner order 2026-11-04).                */
/*                                                                     */
/* Every analyzed picture is saved in its own archive/cabinet,       */
/* organized by the day it was taken, renameable by the owner,      */
/* recallable by date ("what pictures did I take yesterday") and    */
/* by topic ("pictures about balloons" searches the analysis       */
/* text, the name and the motion notes). A saved picture can be     */
/* pulled back up on screen and reanalyzed on demand, deeper.       */
/* Archive is local to his device only — never auto-uploaded,      */
/* never auto-shared, never member private spaces, never the       */
/* Report Log, budget, blink enrollment, keys or secrets. It is    */
/* NOT the deck photo archive: this archive is the save the owner  */
/* explicitly ordered for analyzed pictures, and nothing else is   */
/* auto-saved into the photo archive.                              */
/* ------------------------------------------------------------------ */

export interface WristArchivePicture {
  id: string;
  takenAtMs: number;
  /** Local calendar day, YYYY-MM-DD. */
  dayKey: string;
  name: string;
  /** Downscaled saved copy (max ~640px), not the full live frame. */
  dataUrl: string;
  analysisText: string;
  motionSummary: string;
}

export const WRIST_ARCHIVE_STORAGE_KEY = "wrist-analyze-archive-v1";
export const WRIST_ARCHIVE_MAX_PICTURES = 50;

/** Local calendar day for a timestamp, YYYY-MM-DD. */
export function wristDayKey(takenAtMs: number): string {
  const d = new Date(takenAtMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function wristDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Resolve a relative day phrase to a day key, for typed recall:
 * "yesterday", "a week ago", "today", or an explicit YYYY-MM-DD.
 * Returns null for anything else — the caller says so plainly.
 */
export function wristArchiveDayForPhrase(
  phrase: string,
  nowMs: number,
): { dayKey: string; label: string } | null {
  const p = phrase.trim().toLowerCase();
  const dayMs = 24 * 60 * 60 * 1000;
  if (p === "today") {
    return { dayKey: wristDayKey(nowMs), label: "today" };
  }
  if (p === "yesterday") {
    return { dayKey: wristDayKey(nowMs - dayMs), label: "yesterday" };
  }
  if (p === "a week ago") {
    return { dayKey: wristDayKey(nowMs - 7 * dayMs), label: "a week ago" };
  }
  const explicit = /^\d{4}-\d{2}-\d{2}$/.exec(p);
  if (explicit) return { dayKey: p, label: p };
  return null;
}

/** Add a picture. When the archive is full, nothing is auto-deleted. */
export function addWristArchivePicture(
  list: WristArchivePicture[],
  picture: WristArchivePicture,
): { list: WristArchivePicture[]; full: boolean } {
  if (list.length >= WRIST_ARCHIVE_MAX_PICTURES) {
    return { list, full: true };
  }
  return { list: [...list, picture], full: false };
}

export function renameWristArchivePicture(
  list: WristArchivePicture[],
  id: string,
  newName: string,
): WristArchivePicture[] {
  const name = newName.trim();
  if (!name) return list;
  return list.map((p) => (p.id === id ? { ...p, name } : p));
}

export function deleteWristArchivePicture(
  list: WristArchivePicture[],
  id: string,
): WristArchivePicture[] {
  return list.filter((p) => p.id !== id);
}

/** Find by exact id, or by a unique name fragment (case-insensitive). */
export function findWristArchivePicture(
  list: WristArchivePicture[],
  query: string,
): WristArchivePicture | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const byId = list.find((p) => p.id.toLowerCase() === q);
  if (byId) return byId;
  const matches = list.filter((p) => p.name.toLowerCase().includes(q));
  return matches.length === 1 ? matches[0]! : null;
}

export function wristPicturesForDay(
  list: WristArchivePicture[],
  dayKey: string,
): WristArchivePicture[] {
  return list.filter((p) => p.dayKey === dayKey).sort((a, b) => a.takenAtMs - b.takenAtMs);
}

/** Topic recall: name, analysis text and motion notes, case-insensitive. */
export function searchWristArchive(
  list: WristArchivePicture[],
  topic: string,
): WristArchivePicture[] {
  const q = topic.trim().toLowerCase();
  if (!q) return [];
  return list
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.analysisText.toLowerCase().includes(q) ||
        p.motionSummary.toLowerCase().includes(q),
    )
    .sort((a, b) => b.takenAtMs - a.takenAtMs);
}

/** Load the archive from this device only. Corrupt storage reads as empty. */
export function loadWristArchive(): WristArchivePicture[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(WRIST_ARCHIVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is WristArchivePicture =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { id?: unknown }).id === "string" &&
        typeof (p as { dataUrl?: unknown }).dataUrl === "string" &&
        typeof (p as { takenAtMs?: unknown }).takenAtMs === "number",
    );
  } catch {
    return [];
  }
}

/**
 * Save the archive to this device only. Returns ok=false when the
 * browser refuses (quota) — the caller must say so plainly and keep
 * the picture for the session only, never silently drop it and
 * never claim it saved.
 */
export function saveWristArchive(list: WristArchivePicture[]): { ok: boolean } {
  try {
    if (typeof localStorage === "undefined") return { ok: false };
    localStorage.setItem(WRIST_ARCHIVE_STORAGE_KEY, JSON.stringify(list));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
