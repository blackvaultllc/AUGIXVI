/**
 * CAMERA VIEW ANALYSIS — one lens's current frame, read by the
 * analyzer (owner order 2026-11-23, the camera run-3 follow-up).
 *
 * Run 3 proved a pulled camera frame CAN be read by driving the
 * local vision model (llava:7b) directly — and proved just as
 * clearly that the reading can be PARTLY INVENTED (objects named
 * that are not in the frame). So this flow exists under a honesty
 * rule: the panel shows the reading only under the draft label
 * below, next to the very frame that was read, and a failure is
 * plain words — never a dressed-up or invented reading.
 *
 * The flow itself: pull the CURRENT snapshot through the existing
 * operator-gated snapshot route, then send that frame through the
 * app's existing picture-analysis path (analyzeImageBase64 — same
 * model pick, same prompt, same parser as Picture Analysis).
 * Plain TS so the whole flow is unit-testable without a stage.
 */
import { analyzeImageBase64, type VisionReading } from "../PictureAnalysis";
import { runSecondLook, type SecondLookOutcome } from "../secondLook";

/** The label every camera reading renders under. Exact copy is
 *  pinned by test — the words are the honesty contract. */
export const CAMERA_ANALYSIS_DRAFT_LABEL =
  "Analyzer's reading — a draft: it can invent details; trust the picture, not the words.";

/** The operator-gated snapshot route for one lens — the same URL
 *  the panel's Snapshot button uses. */
export function cameraSnapshotUrl(token: string, cameraId: string, lensId: string): string {
  return `/api/cameras/snapshot?t=${encodeURIComponent(token)}&id=${encodeURIComponent(cameraId)}&lens=${encodeURIComponent(lensId)}`;
}

export type CameraAnalysisOutcome =
  | { ok: true; frame: Blob; reading: VisionReading; secondLook: SecondLookOutcome }
  | { ok: false; note: string };

/** The per-lens analysis state the panel renders. The done state
 *  carries the Second Look's verdicts WITH the reading (the
 *  cybernetic pass, 2026-11-26) — saved on the record, so the
 *  stamps shown are the stamps earned, never re-derived. */
export type LensAnalysisState =
  | { kind: "idle" }
  | { kind: "working"; elapsed: number; partial: string }
  | { kind: "done"; reading: VisionReading; at: number; secondLook: SecondLookOutcome }
  | { kind: "failed"; note: string };

/** Frame bytes → base64. Chunked: a full-size frame is a few
 *  hundred KB and a single spread would blow the argument limit.
 *  (Bytes come off the Response, not the Blob — some environments'
 *  Blob has no arrayBuffer().) */
export function frameBytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Analyze one lens's current view. Never throws: every failure
 * lands as `{ ok: false, note }` in plain words, and no outcome
 * other than `ok: true` carries a reading.
 */
export async function analyzeCameraView(args: {
  snapshotUrl: string;
  brain: string;
  fetchFn?: typeof fetch;
  onText?: (textSoFar: string) => void;
}): Promise<CameraAnalysisOutcome> {
  const fetchFn = args.fetchFn ?? fetch;
  let frame: Blob;
  let frameBytes: ArrayBuffer;
  try {
    const res = await fetchFn(args.snapshotUrl);
    if (!res.ok) throw new Error(`snapshot route answered ${res.status}`);
    frameBytes = await res.arrayBuffer();
    frame = new Blob([frameBytes], {
      type: res.headers.get("Content-Type") ?? "image/jpeg",
    });
  } catch {
    return {
      ok: false,
      note: "No frame came back from that lens — the path is silent or refused, so there is nothing to analyze.",
    };
  }
  try {
    const base64 = frameBytesToBase64(frameBytes);
    const reading = await analyzeImageBase64({
      brain: args.brain,
      base64,
      ...(args.onText ? { onText: args.onText } : {}),
      fetchFn,
    });
    // THE SECOND LOOK (cybernetic pass, 2026-11-26): every
    // finding is checked again, one at a time, before the
    // reading is shown — the camera analyzer's inventions are
    // exactly what this pass exists to catch. runSecondLook
    // never throws; an unreachable model lands as "unavailable"
    // and the panel labels the reading FIRST PASS ONLY.
    const secondLook = await runSecondLook({
      brain: args.brain,
      base64,
      findings: reading.findings,
      fetchFn,
    });
    return { ok: true, frame, reading, secondLook };
  } catch (err) {
    return {
      ok: false,
      note: `The analyzer could not read this view: ${
        err instanceof Error ? err.message : "the request failed"
      }. No reading was made up — the picture itself is the truth.`,
    };
  }
}
