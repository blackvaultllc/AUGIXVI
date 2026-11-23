/**
 * HEARING STATE — the plain-words truth behind the stage's voice
 * indicator (owner order 2026-11-22: "an indicator graph that shows
 * when voice is being heard or not — so I know Anubis and the other
 * constructs are hearing me").
 *
 * Pure derivation from the local ear's own snapshot (localEar.ts):
 * HEARING only while the ear is actually listening. Every other
 * state reads NOT HEARING with the reason in plain words — the mic
 * off, the mic starting, a failure carried verbatim from the ear.
 * Nothing here can paint a false green: a state this module does
 * not recognize also reads NOT HEARING.
 */
import type { EarState, HearingSnapshot } from "./localEar";

export interface HearingStatus {
  hearing: boolean;
  /** Why not, in plain words. Null while hearing. */
  reason: string | null;
}

export function deriveHearingStatus(snapshot: HearingSnapshot): HearingStatus {
  if (!snapshot.supported) {
    return {
      hearing: false,
      reason: "This browser cannot record audio, so no microphone can be heard here.",
    };
  }
  switch (snapshot.state) {
    case "listening":
      return { hearing: true, reason: null };
    case "starting":
      return { hearing: false, reason: "The microphone is starting…" };
    case "transcribing":
      // The phrase was captured and the mic has closed; the local
      // speech service is writing it down. Not a failure — say so.
      return { hearing: false, reason: "Heard you — writing down what you said." };
    case "error":
      return {
        hearing: false,
        reason: snapshot.lastError ?? "The microphone stopped with an error.",
      };
    case "idle":
      return { hearing: false, reason: "The microphone is off." };
    default:
      return { hearing: false, reason: "The microphone state is unknown." };
  }
}

/**
 * ONE TRUTH ON SCREEN (owner eye-check 2026-11-23): his HUD read
 * "STATUS: LISTENING" in the same moment the indicator read "NOT
 * HEARING — THE MICROPHONE IS OFF" and the sensor column read MIC
 * OFF. The bridge's LISTENING is its resting state — it was set at
 * mount and after every reply, with no regard for the ear. The
 * STATUS readout now answers to the ear's real condition: the ear
 * is push-to-talk, so unless it is actually capturing (starting,
 * listening, or writing down a captured phrase), a resting bridge
 * reads MIC OFF — plainly — and every readout on the screen
 * agrees. Every other bridge state passes through untouched.
 */
export function stageStatusLabel(bridgeState: string, earState: EarState | null): string {
  if (bridgeState !== "LISTENING") return bridgeState;
  const capturing =
    earState === "starting" || earState === "listening" || earState === "transcribing";
  return capturing ? bridgeState : "MIC OFF";
}

/** Samples kept in the indicator's scrolling history. */
export const LEVEL_HISTORY_MAX = 56;
/**
 * Append one measured level to the graph history, capped at the
 * window size. Pure: the graph shows only samples that were really
 * measured — the component appends the latest measured level per
 * frame and zeroes when the mic closes (the ear emits a true 0).
 */
export function pushLevel(
  history: readonly number[],
  level: number,
  max: number = LEVEL_HISTORY_MAX,
): number[] {
  const next = [...history, Math.min(1, Math.max(0, level))];
  return next.length > max ? next.slice(next.length - max) : next;
}
