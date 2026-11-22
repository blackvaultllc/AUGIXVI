/**
 * CAPTURE (Part 15, operator order 2026-11-21) — one click bundles
 * the state of the moment into a single downloadable JSON the
 * operator can hand over for diagnosis: what was asked, what Augie
 * answered, the settings in force, the watcher/scan state, and the
 * Test Area ledger. Every section is labeled with what it is and
 * where it came from — a capture never dresses a guess up as a fact.
 *
 * Pure builder: the window gathers the live pieces and passes them
 * in; this module shapes the bundle.
 */
import type { TestLedger } from "./testArea";

export type CaptureInput = {
  now: number;
  userAgent: string;
  /** The operator's current settings (already sanitized values). */
  settings: unknown;
  /** Latest watcher/scan state as the client last read it, or null. */
  scanState: unknown;
  /** Recent conversation, oldest → newest, as recorded locally. */
  recentReplies: unknown;
  ledger: TestLedger;
  /** Any error the operator is looking at right now, or null. */
  visibleError: string | null;
};

export function buildCaptureBundle(input: CaptureInput) {
  return {
    kind: "augie-capture",
    version: 1,
    capturedAt: new Date(input.now).toISOString(),
    capturedFrom: input.userAgent,
    sections: {
      settings: {
        label: "The operator's stage settings as currently in force (local copy).",
        value: input.settings,
      },
      scanState: {
        label: "Wi-Fi watcher scan-state as last read from /api/devices/scan-state.",
        value: input.scanState,
      },
      recentReplies: {
        label: "Recent replies recorded in this browser's local reply history.",
        value: input.recentReplies,
      },
      testLedger: {
        label: "Test Area ledger — real probe results with their run times; STALE means old.",
        value: input.ledger,
      },
      visibleError: {
        label: "An error visible on screen at capture time, if the operator reported one.",
        value: input.visibleError,
      },
    },
  };
}

export function captureFilename(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `augie-capture-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
}
