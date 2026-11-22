/**
 * THE CAPTURE SYSTEM (Part 15, owner order 2026-11-21) — one click in
 * the test environment bundles what he sees PLUS the state behind it
 * (the command he ran, Augie's answer, the settings in force, recent
 * errors/replies) into one downloadable file he can hand to Muse,
 * instead of screenshotting the screen over and over. The bundle
 * labels HONESTLY what is inside it and what is not.
 */

export interface CaptureInput {
  at: number;
  url: string;
  userAgent: string;
  lastCommand: string;
  lastAnswer: string;
  responseSource: string;
  settings: unknown;
  replyHistory: readonly unknown[];
  openWindows: readonly string[];
  notes?: string;
}

export interface CaptureBundle {
  kind: "augie-capture";
  version: 1;
  capturedAt: string;
  /** Exactly what this bundle carries — no more, no less. */
  includes: string[];
  /** What a capture can NOT see, stated up front. */
  excludes: string[];
  page: { url: string; userAgent: string };
  exchange: { lastCommand: string; lastAnswer: string; responseSource: string };
  settings: unknown;
  replyHistory: readonly unknown[];
  openWindows: readonly string[];
  notes: string;
}

export function buildCaptureBundle(input: CaptureInput): CaptureBundle {
  return {
    kind: "augie-capture",
    version: 1,
    capturedAt: new Date(input.at).toISOString(),
    includes: [
      "the last command the operator ran and Augie's answer to it",
      "the full reply history held by this browser (up to its cap)",
      "the avatar settings in force at capture time",
      "which tool windows were open",
      "the page URL and browser user agent",
    ],
    excludes: [
      "a screenshot or any camera frame — captures never record images",
      "server-side logs (the gate log and event log live in the Logs window)",
      "anything from Khadija's learner side — her world is behind her own wall",
      "keys, tokens, or credentials of any kind",
    ],
    page: { url: input.url, userAgent: input.userAgent },
    exchange: {
      lastCommand: input.lastCommand,
      lastAnswer: input.lastAnswer,
      responseSource: input.responseSource,
    },
    settings: input.settings,
    replyHistory: input.replyHistory,
    openWindows: input.openWindows,
    notes: input.notes ?? "",
  };
}

export function captureFileName(at: number): string {
  return `augie-capture-${new Date(at).toISOString().replace(/[:.]/g, "-")}.json`;
}

/** Browser-side: bundle + download in one click. */
export function downloadCapture(input: CaptureInput): string {
  const bundle = buildCaptureBundle(input);
  const name = captureFileName(input.at);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return name;
}
