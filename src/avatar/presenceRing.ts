/**
 * THE PRESENCE RING — the circuit ring's readings (owner order
 * 2026-11-26, the circuit-ring theme): a segmented ring gauge
 * stands around the front god's medallion, and its lit segments
 * are READ FROM THE GOD'S REAL STATE — the same signals the
 * stage already holds (speaking / listening / thinking / idle,
 * and still-connecting before the first frame). The truth law
 * governs absolutely: the ring invents nothing — no numbers, no
 * telemetry, no decoration dressed as data. A segment is lit
 * only because the god is in the state that lights it; every
 * segment the state does not light stays a dim part of the ring.
 *
 * Plain data, no rendering — unit-testable per the repo's rules.
 */
import type { AvatarState } from "./AvatarBridge";

export type RingPresenceState =
  | "alert"
  | "speaking"
  | "listening"
  | "thinking"
  | "idle"
  | "connecting";

/** The live signals the stage holds for a presence, named plainly. */
export interface RingSignals {
  /** False until the renderer's first frame — the stage is loading. */
  ready: boolean;
  /** The god is speaking right now. */
  speaking: boolean;
  /** The ear is open and the god awaits the operator's voice. */
  listening: boolean;
  /** The god is visibly carrying out work (thinking / presenting). */
  acting: boolean;
  /**
   * A REAL alert stands unacknowledged (the cybernetic pass,
   * 2026-11-26): an alert-flagged sound Sound Watch heard and the
   * Captain has not yet acknowledged, or Khadija's call still
   * ringing unanswered in the Daddy Inbox. Computed by the stage
   * from those records (alertRing.ts) — never from anything else.
   * Absent = no alert. The alert outranks every other state: it
   * is the one reading that must not wait its turn.
   */
  alert?: boolean | undefined;
}

/**
 * The ring's state, from the signals — the same priority the
 * medallion's own state word has always used (AnubisPresence):
 * an unacknowledged alert first, then connecting until ready,
 * speaking, listening, working, and at rest, idle.
 */
export function ringPresenceState(signals: RingSignals): RingPresenceState {
  if (signals.alert) return "alert";
  if (!signals.ready) return "connecting";
  if (signals.speaking) return "speaking";
  if (signals.listening) return "listening";
  if (signals.acting) return "thinking";
  return "idle";
}

/** The same derivation read straight off the bridge's state word. */
export function ringPresenceStateForBridge(state: AvatarState, ready: boolean): RingPresenceState {
  return ringPresenceState({
    ready,
    speaking: state === "SPEAKING",
    listening: state === "LISTENING",
    acting: state === "THINKING" || state === "GLITCH",
  });
}

export const RING_SEGMENT_COUNT = 24;

export type RingSegmentTone = "gold" | "amber" | "goldred" | "alert" | "dim";

export interface RingSegment {
  index: number;
  tone: RingSegmentTone;
}

/**
 * Which segments a state lights, and in which tone. The pattern
 * is a gauge, not a meter: it says WHICH state he is in, never
 * how much of anything — there is no quantity here to invent.
 * - alert: the whole ring lit in the alert tone — a real alert
 *   stands unacknowledged; the component pulses it on the
 *   stage's own heartbeat clock (tempo only, never a reading).
 * - speaking: the whole ring lit, gold-red — he holds the floor.
 * - thinking: every other segment lit, gold-red — work in motion.
 * - listening: every third segment lit, gold-red — the ear open.
 * - idle: the four quarter points lit, gold — at rest, present.
 * - connecting: the four quarter points lit, amber — not ready.
 *
 * THE GOLD ORDERS (owner orders 2026-11-26, from his phone):
 * the cybernetic blue the theme shipped with is OUT ("the blue
 * little lines, the blue around — I don't like that") — no
 * state of the ring reads blue, ever. AT REST the ring is gold.
 * ACTIVE — he is talking, working, or listening — the ring
 * turns GOLD-RED: gold moving toward red, the heat of an
 * engaged construct, distinct from rest gold and from the
 * ALERT state, which stays pure red (and pulses) as the
 * emergency signal alone.
 */
export function ringSegments(state: RingPresenceState): RingSegment[] {
  const segments: RingSegment[] = [];
  for (let index = 0; index < RING_SEGMENT_COUNT; index++) {
    let tone: RingSegmentTone = "dim";
    switch (state) {
      case "alert":
        tone = "alert";
        break;
      case "speaking":
        tone = "goldred";
        break;
      case "thinking":
        tone = index % 2 === 0 ? "goldred" : "dim";
        break;
      case "listening":
        tone = index % 3 === 0 ? "goldred" : "dim";
        break;
      case "idle":
        tone = index % 6 === 0 ? "gold" : "dim";
        break;
      case "connecting":
        tone = index % 6 === 0 ? "amber" : "dim";
        break;
    }
    segments.push({ index, tone });
  }
  return segments;
}
