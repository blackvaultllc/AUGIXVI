/**
 * FULL BODY, FREE WILL (owner order 2026-11-10). Pure decision logic —
 * the renderer reads these targets; this file only decides.
 *
 * - Full body 360°: the renderer renders front AND back with depth
 *   (particle backbone), never a flat cut orange. Represented here by the
 *   VOL_FULL_BODY density multiplier the renderer applies to back-facing
 *   particle columns.
 * - Superman flight: horizontal body, hands forward/up, particle cape
 *   streaming behind — flying is NOT walking in the air.
 * - Free will: Osiris may choose to sit when a chair exists, or decline;
 *   he follows with the camera on, in big regular mode, only when the
 *   operator TELLS him to follow (follow is never always-on).
 * - Hand tracking: point, pick up, hand over a container box, move it
 *   where it suits him.
 */

export type BodyPose = "stand" | "sit" | "superman-flight";

export type FreeWillDecision =
  | { action: "sit-down"; reason: string }
  | { action: "stay-standing"; reason: string }
  | { action: "none"; reason: null };

export type FollowState = "never" | "requested" | "released";

export const FULL_BODY_BACK_DENSITY = 1.0; // equal particles front and back
export const CAPE_PARTICLE_RATIO = 0.08; // of body particles become the cape stream

/** Superman pose: body pitched horizontal, arms extended forward/up. */
export function supermanPose(
  t: number,
  speech: number,
): {
  bodyPitchRadians: number;
  armForward: number;
  capeSway: number;
} {
  return {
    bodyPitchRadians: Math.PI / 2 - 0.18, // near-horizontal, head slightly up
    armForward: 1, // both arms forward/up
    capeSway: 0.5 + 0.5 * Math.sin(t * 6) + speech * 0.2, // cape streams harder when he speaks
  };
}

/**
 * Free will: he WANTS to sit when there is a chair and he has been
 * standing a while — but if he'd rather not (recently flew, or he simply
 * prefers to stand while thinking), he declines and says why.
 */
export function decideFreeWill(input: {
  chairAvailable: boolean;
  standingForMs: number;
  recentlyFlew: boolean;
  prefersStandingWhileThinking: boolean;
}): FreeWillDecision {
  if (!input.chairAvailable) {
    return { action: "none", reason: null };
  }
  if (input.prefersStandingWhileThinking) {
    return {
      action: "stay-standing",
      reason: "I'd rather stand while I think — sitting slows my mind.",
    };
  }
  if (input.recentlyFlew) {
    return {
      action: "sit-down",
      reason: "I just flew in; I'll take the chair for a moment.",
    };
  }
  if (input.standingForMs > 10 * 60 * 1000) {
    return {
      action: "sit-down",
      reason: "I've been on my feet a while — making myself a chair.",
    };
  }
  return { action: "none", reason: null };
}

/**
 * Follow rule: he walks/follows with the camera on even in big regular
 * mode — but ONLY when the operator tells him to. Follow is a state, not
 * a default.
 */
export function resolveFollow(
  command: "follow me" | "stop following" | null,
  current: FollowState,
): FollowState {
  if (command === "follow me") return "requested";
  if (command === "stop following") return "released";
  return current;
}

export function followIsActive(state: FollowState, cameraOn: boolean): boolean {
  return state === "requested" && cameraOn;
}

/** Hand-tracking intents Osiris can execute with his hands. */
export type HandIntent =
  | { kind: "point"; target: string }
  | { kind: "pick-up"; target: string }
  | { kind: "hand-over"; target: string; to: "operator" }
  | { kind: "move"; target: string; where: string };

export function parseHandIntent(text: string): HandIntent | null {
  const point = text.match(/^point (?:at |to )?(.+)$/i);
  if (point) return { kind: "point", target: point[1]!.trim() };
  const pick = text.match(/^pick (?:up )?(?:the )?(.+)$/i);
  if (pick) return { kind: "pick-up", target: pick[1]!.trim() };
  const handOver = text.match(/^hand (?:me |over )?(?:the )?(.+)$/i);
  if (handOver) return { kind: "hand-over", target: handOver[1]!.trim(), to: "operator" };
  const move = text.match(/^move (?:the )?(.+?) to (?:the )?(.+)$/i);
  if (move) return { kind: "move", target: move[1]!.trim(), where: move[2]!.trim() };
  return null;
}
