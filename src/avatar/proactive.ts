/**
 * PROACTIVE OSIRIS — he watches and tells ME (owner order 2026-11-10).
 * A buyer just replied, a deal is waiting, Sha hasn't shown yet, a new
 * message came in: he pops up a suggestion and SAYS it — he does NOT
 * auto-open panels and does NOT act without the operator's say. He fixes
 * only when told.
 */

export type ProactiveObservation = {
  id: string;
  atMs: number;
  /** Short spoken line — what Osiris says aloud. */
  message: string;
  /** What he COULD do if told — suggested, never executed on its own. */
  suggestion: string | null;
};

export type ProactiveWatcher = {
  id: string;
  label: string;
  /** Returns an observation or null when there is nothing to report. */
  check: (nowMs: number) => ProactiveObservation | null;
  /** Minimum silence between repeats of the same watcher (ms). */
  quietPeriodMs: number;
};

const SHA_NOT_SHOWN = "Sha hasn't shown yet today.";

export function shaWatcher(
  shownRef: { shown: boolean },
  quietPeriodMs = 45 * 60 * 1000,
): ProactiveWatcher {
  let lastReportedAt = 0;
  return {
    id: "sha-presence",
    label: "Sha check-in",
    quietPeriodMs,
    check: (nowMs) => {
      if (shownRef.shown) return null;
      if (nowMs - lastReportedAt < quietPeriodMs) return null;
      lastReportedAt = nowMs;
      return {
        id: `sha-${nowMs}`,
        atMs: nowMs,
        message: SHA_NOT_SHOWN,
        suggestion: "I can send a check-in message if you say so.",
      };
    },
  };
}

/** Deal/inbox events arrive from the outside; each one is reported once. */
export class EventQueueWatcher implements ProactiveWatcher {
  id = "event-queue";
  label = "events";
  quietPeriodMs = 0;
  private pending: Array<{ text: string; suggestion: string | null }> = [];

  push(text: string, suggestion: string | null = null) {
    this.pending.push({ text, suggestion });
  }

  check(nowMs: number): ProactiveObservation | null {
    const next = this.pending.shift();
    if (!next) return null;
    return {
      id: `event-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
      atMs: nowMs,
      message: next.text,
      suggestion: next.suggestion,
    };
  }
}

export function createProactiveEngine(watchers: ProactiveWatcher[], speak: (line: string) => void) {
  let timer: number | null = null;
  const POLL_MS = 60_000;

  const poll = () => {
    const now = Date.now();
    for (const watcher of watchers) {
      const observation = watcher.check(now);
      if (!observation) continue;
      speak(
        observation.suggestion
          ? `${observation.message} ${observation.suggestion}`
          : observation.message,
      );
      // One report per poll: never a burst.
      break;
    }
  };

  return {
    start() {
      if (timer !== null) return;
      // Report pending events immediately, then keep watching.
      poll();
      timer = window.setInterval(poll, POLL_MS);
    },
    stop() {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
    },
  };
}
