import type { AvatarState } from "./AvatarBridge";

/**
 * AUGIE'S LIVING PRESENCE (owner order 2026-11-22): the circular
 * animated Egyptian head in the Command box grip — the same gold-and-
 * blue pharaoh face the owner approved for the assistant on
 * 2026-11-19, living in Augie's own command base. The animation is
 * STATE-DRIVEN, never decorative: every kind below is derived from a
 * signal the stage already tracks (bridge AvatarState, stage
 * readiness, voice listening, and who produced the current line), so
 * the face only ever shows what Augie is actually doing.
 *
 * Asset set (public/augie-presence/): idle.mp4 doubles as the
 * connecting face; working.mp4 doubles as the waiting face — both
 * pairings are the owner's brief, not an invention.
 */
export type AugiePresenceKind =
  "connecting" | "idle" | "working" | "making" | "waiting" | "milestone";

export interface PresenceSignals {
  /** False until the renderer's first frame — the stage is loading. */
  ready: boolean;
  /** The bridge state AvatarStage already mirrors into React state. */
  avatarState: AvatarState;
  /** The ear is open and Augie is awaiting the operator's voice. */
  voiceListening: boolean;
  /**
   * The current spoken line is Augie carrying out a local command
   * himself (AvatarStage's responseSource === "local command": he
   * opened a tool, ran an action, moved the world) rather than the
   * brain delivering an answer.
   */
  actingLocally: boolean;
  /** Brief completion flash right after a thinking cycle ends. */
  milestone: boolean;
}

export function presenceKindFor(signals: PresenceSignals): AugiePresenceKind {
  if (!signals.ready) return "connecting";
  if (signals.milestone) return "milestone";
  switch (signals.avatarState) {
    case "THINKING":
      // The brain is processing a command.
      return "working";
    case "SPEAKING":
      // Delivering a local command's action = making something happen;
      // delivering the brain's answer = still working.
      return signals.actingLocally ? "making" : "working";
    case "LISTENING":
      // Awaiting the operator's words.
      return "waiting";
    case "IDLE":
      return signals.voiceListening ? "waiting" : "idle";
    case "GLITCH":
    default:
      // No dedicated glitch face exists; the calm idle face is the
      // honest fallback rather than a borrowed animation.
      return "idle";
  }
}

export const PRESENCE_POSTER = "/augie-presence/still.webp";

export const PRESENCE_ASSETS: Record<AugiePresenceKind, { video: string; label: string }> = {
  connecting: { video: "/augie-presence/idle.mp4", label: "connecting" },
  idle: { video: "/augie-presence/idle.mp4", label: "idle" },
  working: { video: "/augie-presence/working.mp4", label: "working" },
  making: { video: "/augie-presence/making.mp4", label: "making something" },
  waiting: { video: "/augie-presence/working.mp4", label: "waiting" },
  milestone: { video: "/augie-presence/milestone.mp4", label: "done" },
};

/** How long the completion face stays up after a thinking cycle ends. */
export const MILESTONE_FLASH_MS = 2600;
