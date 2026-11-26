/**
 * THE ALERT RING (cybernetic pass, 2026-11-26 — the survey's
 * Star Trek row, built honest): Anubis's presence ring gains a
 * top-priority ALERT state, and this module is its ONLY source
 * of truth. The alert stands when — and only when — a real
 * record says so:
 *
 *   · SOUND WATCH heard a sound it flags as an alert (a library
 *     sound the Captain marked alert, or a human-class label)
 *     and the Captain has not acknowledged it in the Sound
 *     Watch window — the record lives in soundWatchFeed.ts.
 *   · KHADIJA'S CALL is ringing right now in the Daddy Inbox
 *     and nobody has answered — the stage's own inbox poll is
 *     the record; the alert clears the moment the ring stops
 *     (answered, ended, or rung out into the inbox as missed).
 *
 * Nothing else raises it. No CPU, no network, no "attention"
 * score — invented telemetry is refused here by construction:
 * this function reads two named records and nothing else. The
 * heartbeat clock only ever lends the pulse its TEMPO in the
 * component; it is never read as a signal.
 *
 * Pure data — unit-testable per the repo's rules.
 */
import { unacknowledgedSoundAlerts, type SoundFeedEntry } from "./soundWatchFeed";

export interface AlertRingInputs {
  /** The Sound Watch feed (soundWatchFeed.ts) as it stands now. */
  soundFeed: SoundFeedEntry[];
  /** The Daddy Inbox's call is in the "ringing" state right now. */
  daddyCallRinging: boolean;
}

export interface AlertRingReading {
  /** The ring's ALERT state stands. */
  active: boolean;
  /** How many sound alerts wait unacknowledged. */
  soundAlertsWaiting: number;
  /** Khadija's call is ringing unanswered. */
  daddyRinging: boolean;
  /** The standing sources, in plain words — for status lines. */
  sourcesLine: string;
}

export function alertRingReading(inputs: AlertRingInputs): AlertRingReading {
  const waiting = unacknowledgedSoundAlerts(inputs.soundFeed);
  const soundAlertsWaiting = waiting.length;
  const daddyRinging = inputs.daddyCallRinging;
  const active = soundAlertsWaiting > 0 || daddyRinging;
  const parts: string[] = [];
  if (soundAlertsWaiting > 0) {
    parts.push(
      soundAlertsWaiting === 1
        ? "one alert sound heard by Sound Watch, not yet acknowledged"
        : `${soundAlertsWaiting} alert sounds heard by Sound Watch, not yet acknowledged`,
    );
  }
  if (daddyRinging) parts.push("Khadija's call is ringing, unanswered");
  return {
    active,
    soundAlertsWaiting,
    daddyRinging,
    sourcesLine: active ? parts.join(" · ") : "No alert stands.",
  };
}
