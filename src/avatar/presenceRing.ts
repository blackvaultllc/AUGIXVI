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

export type RingPresenceState = "speaking" | "listening" | "thinking" | "idle" | "connecting";

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
}

/**
 * The ring's state, from the signals — the same priority the
 * medallion's own state word has always used (AnubisPresence):
 * connecting until ready, then speaking, listening, working,
 * and at rest, idle.
 */
export function ringPresenceState(signals: RingSignals): RingPresenceState {
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

export type RingSegmentTone = "gold" | "cyan" | "dim";

export interface RingSegment {
  index: number;
  tone: RingSegmentTone;
}

/**
 * Which segments a state lights, and in which tone. The pattern
 * is a gauge, not a meter: it says WHICH state he is in, never
 * how much of anything — there is no quantity here to invent.
 * - speaking: the whole ring lit, gold — he holds the floor.
 * - thinking: every other segment lit, cyan — work in motion.
 * - listening: every third segment lit, cyan — the ear is open.
 * - idle: the four quarter points lit, gold — at rest, present.
 * - connecting: the four quarter points lit, cyan — not ready.
 */
export function ringSegments(state: RingPresenceState): RingSegment[] {
  const segments: RingSegment[] = [];
  for (let index = 0; index < RING_SEGMENT_COUNT; index++) {
    let tone: RingSegmentTone = "dim";
    switch (state) {
      case "speaking":
        tone = "gold";
        break;
      case "thinking":
        tone = index % 2 === 0 ? "cyan" : "dim";
        break;
      case "listening":
        tone = index % 3 === 0 ? "cyan" : "dim";
        break;
      case "idle":
        tone = index % 6 === 0 ? "gold" : "dim";
        break;
      case "connecting":
        tone = index % 6 === 0 ? "cyan" : "dim";
        break;
    }
    segments.push({ index, tone });
  }
  return segments;
}
