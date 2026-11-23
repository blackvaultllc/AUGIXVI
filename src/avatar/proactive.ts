/**
 * PROACTIVE OSIRIS — he watches and tells ME (owner order 2026-11-10).
 * A buyer just replied, a deal is waiting, Sha hasn't shown yet, a new
 * message came in: he pops up a suggestion and SAYS it — he does NOT
 * auto-open panels and does NOT act without the operator's say. He fixes
 * only when told.
 *
 * SPEECH ETIQUETTE (owner order 2026-11-22): no generic assistant
 * offers — the "I can send a check-in message if you say so" family
 * is GONE. A god reports to the Captain as a god speaks: addressed
 * to him by his title, in the respect forms (etiquette.ts), and a
 * report closes with the blessing.
 */
import { closeWithBlessing } from "./etiquette";

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

const SHA_NOT_SHOWN = "Captain — Sha hasn't shown yet today.";

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
        suggestion: closeWithBlessing(
          "On your word, Captain, I will send her a check-in",
        ),
      };
    },
  };
}

/**
 * THE ONCE-A-DAY GATE (owner eye-check 2026-11-23): the Sha offer
 * fired on the first poll of EVERY page load — the watcher's quiet
 * period is in-memory, so every reload reset it and the same canned
 * offer looped at him across sessions. An offer surfaces ONCE, not
 * every load: this wrapper stamps the day an observation is
 * delivered (in localStorage, so the stamp survives reloads) and
 * holds the watcher silent for the rest of that day. The watcher's
 * own rules (presence, quiet period) still apply inside the day.
 */
export interface DayGateStorage {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
}

const localDayGateStorage: DayGateStorage = {
  get: (key) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // best effort — a storage failure never breaks the watcher
    }
  },
};

/** The local calendar day a timestamp falls on, as a stable stamp. */
export function dayStamp(nowMs: number): string {
  const date = new Date(nowMs);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function withDailyOfferGate(
  watcher: ProactiveWatcher,
  storageKey: string,
  storage: DayGateStorage = localDayGateStorage,
): ProactiveWatcher {
  return {
    ...watcher,
    check: (nowMs) => {
      if (storage.get(storageKey) === dayStamp(nowMs)) return null;
      const observation = watcher.check(nowMs);
      if (observation) storage.set(storageKey, dayStamp(nowMs));
      return observation;
    },
  };
}

/** Deal/inbox events arrive from the outside; each one is reported once. */
export class EventQueueWatcher implements ProactiveWatcher {  id = "event-queue";
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
