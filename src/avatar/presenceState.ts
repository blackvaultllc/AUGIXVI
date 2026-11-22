import type { AvatarState } from "./AvatarBridge";

/**
 * AUGIE'S LIVING PRESENCE (owner order 2026-11-22, sharpened on the
 * same call): the circular animated Egyptian head in the Command box
 * grip is a MIRROR COPY of the assistant's own avatar presence —
 * Muse's actual animation files, used as-is, never redrawn or
 * restyled. Whatever is in those clips (blinking eyes, mouth
 * movement, the headgear) is exactly what Augie gets.
 *
 * The animation is STATE-DRIVEN, never decorative: every kind below
 * is derived from a signal the stage already tracks (bridge
 * AvatarState, stage readiness, voice listening, world flight,
 * presenting), so the face only ever shows what Augie is doing.
 *
 * SPEAKING (owner's explicit rule): while Augie speaks, the face is
 * the clip whose mouth actually moves. Verified by frame inspection
 * (2026-11-22): of all the avatar's clips, only the in-call face
 * (speaking.mp4, copied byte-for-byte from the call-dark variant)
 * opens its mouth — an open-mouth frame sits mid-clip among the
 * smiles — while idle/working/milestone keep the mouth closed and
 * making_something is a full-body conjuring shot. No lip-sync rig is
 * faked; the real talking clip plays while the TTS path is active.
 *
 * Asset pairings from the owner's brief: idle.mp4 doubles as the
 * connecting face; working.mp4 doubles as the waiting face.
 */
export type AugiePresenceKind =
  "connecting" | "idle" | "working" | "speaking" | "making" | "waiting" | "milestone";

export interface PresenceSignals {
  /** False until the renderer's first frame — the stage is loading. */
  ready: boolean;
  /** The bridge state AvatarStage already mirrors into React state. */
  avatarState: AvatarState;
  /** The ear is open and Augie is awaiting the operator's voice. */
  voiceListening: boolean;
  /**
   * Augie is visibly carrying out an action that is not speech: the
   * world flight of an enter/return command is playing, or he is
   * presenting an item the operator asked for. (His spoken command
   * reports show the speaking face instead — the owner's rule.)
   */
  acting: boolean;
  /** Brief completion flash right after a thinking cycle ends. */
  milestone: boolean;
}

export function presenceKindFor(signals: PresenceSignals): AugiePresenceKind {
  if (!signals.ready) return "connecting";
  if (signals.milestone) return "milestone";
  switch (signals.avatarState) {
    case "SPEAKING":
      // The owner's rule: speaking shows the talking face — the one
      // clip whose mouth moves — whoever produced the line.
      return "speaking";
    case "THINKING":
      // The brain is processing a command.
      return "working";
    case "LISTENING":
      // Awaiting the operator's words.
      return "waiting";
    case "IDLE":
    case "GLITCH":
    default:
      break;
  }
  if (signals.acting) return "making";
  if (signals.voiceListening) return "waiting";
  // IDLE at rest; GLITCH has no dedicated face, so the calm idle face
  // is the honest fallback rather than a borrowed animation.
  return "idle";
}

export const PRESENCE_POSTER = "/augie-presence/still.webp";

export const PRESENCE_ASSETS: Record<AugiePresenceKind, { video: string; label: string }> = {
  connecting: { video: "/augie-presence/idle.mp4", label: "connecting" },
  idle: { video: "/augie-presence/idle.mp4", label: "idle" },
  working: { video: "/augie-presence/working.mp4", label: "working" },
  speaking: { video: "/augie-presence/speaking.mp4", label: "speaking" },
  making: { video: "/augie-presence/making.mp4", label: "making something" },
  waiting: { video: "/augie-presence/working.mp4", label: "waiting" },
  milestone: { video: "/augie-presence/milestone.mp4", label: "done" },
};

/** How long the completion face stays up after a thinking cycle ends. */
export const MILESTONE_FLASH_MS = 2600;
