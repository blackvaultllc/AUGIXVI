/**
 * TIME SCAN / ROOM SCAN — pure logic, no browser APIs.
 *
 * Owner request 2026-11-03, camera feedback: "it can even do
 * time scanning where I can record for like 10 seconds and I
 * can walk in a circle and they can scan everything I did a
 * scan on in the whole room. To make sure scanners work like
 * Star Trek, you know."
 *
 * Star Trek is inspiration only — no copied code, art, or
 * sound. Honest shape of the feature, because a browser
 * cannot reliably stream continuous video to a vision
 * provider: a time scan captures a series of STILLS, one per
 * second for about 10 seconds, while the owner walks in a
 * circle, then sends those stills together as one analysis.
 * It is user-initiated only (tap TIME SCAN, or say time scan
 * / scan room), never auto-starts, never records in the
 * background, never auto-saves anything, and frames live in
 * memory only until the analysis — the only send is the
 * analysis question itself, exactly like a normal picture
 * analysis. No facial recognition, no person identification.
 * If vision is down, the analysis fails plainly with
 * "Vision isn't reachable", never pretending it scanned.
 */

/** A time scan runs about 10 seconds. */
export const TIME_SCAN_DURATION_MS = 10_000;

/** One still per second during the scan. */
export const TIME_SCAN_FRAME_INTERVAL_MS = 1_000;

/** Expected stills in a full 10-second scan. */
export const TIME_SCAN_EXPECTED_FRAMES = Math.round(
  TIME_SCAN_DURATION_MS / TIME_SCAN_FRAME_INTERVAL_MS,
);

export type TimeScanStatus = "idle" | "recording" | "done";

/** Whole seconds left, counting down from 10. */
export function timeScanSecondsLeft(elapsedMs: number): number {
  return Math.max(0, Math.ceil((TIME_SCAN_DURATION_MS - elapsedMs) / 1000));
}

/** Progress 0–100 for the scan countdown bar. */
export function timeScanProgressPercent(elapsedMs: number): number {
  return Math.max(0, Math.min(100, Math.round((elapsedMs / TIME_SCAN_DURATION_MS) * 100)));
}

export function timeScanIsComplete(elapsedMs: number): boolean {
  return elapsedMs >= TIME_SCAN_DURATION_MS;
}

/**
 * The question sent with a completed time scan: whole-room,
 * investigative, numbered duplicates, click-to-focus boxes —
 * the same analysis shape as a single picture, across all
 * the stills taken while walking in a circle.
 */
export function timeScanQuestion(frameCount: number): string {
  return (
    `This is a TIME SCAN of a whole room: ${frameCount} stills taken over about 10 seconds ` +
    `while walking in a circle. List EVERYTHING you can actually see across all of these ` +
    `stills, one entry per distinct instance, with small observed detail too — never a ` +
    `medical diagnosis, never a cause, never anything beyond what is visible. ` +
    `If you cannot see a detail, say so plainly, do not invent it. ` +
    `If vision cannot answer, say plainly that vision isn't reachable.`
  );
}
