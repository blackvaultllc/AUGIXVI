/**
 * ROOM ROUTING — deterministic and TERMINAL (operator incident
 * 2026-11-21). Domenick typed/spoke "open the cube" and the phrase fell
 * through every matcher into the LLM chat, which answered with a chatbot
 * refusal ("I'm a simulated world governor, I don't have the ability to
 * physically open or interact with the cube…"). The slash catalog even
 * advertised "open the cube" as the example for the older Metatron
 * "My Cube" panel while he meant the AR Cube room — a name collision,
 * plus no handler for the phrase at all.
 *
 * This module is the single decider for room phrases, typed or spoken.
 * A non-null result is handled by AvatarStage and RETURNS — the text is
 * never forwarded to the chat path. Matching is full-string on the
 * normalized phrase, so room phrases can never swallow a longer
 * sentence ("open the cube and fly" is not a room command).
 *
 * "The cube" means the AR Cube room (the physical cube he holds). The
 * Metatron "My Cube" panel keeps its own distinct triggers: "open my
 * cube", "metatron's cube", and its original exact phrase "pull up the
 * cube" (see cubeReference.isCubePanelCommand).
 */
import { isCubePanelCommand } from "../cubeReference";

export type RoomTarget = "ar-cube" | "picture-analysis" | "game" | "reply-history" | "my-cube";

/** Lowercase, single-spaced, no leading slash, no trailing punctuation. */
function normalizeRoomPhrase(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?…]+$/, "")
    .trim();
}

const MY_CUBE_PATTERNS: readonly RegExp[] = [
  /^(?:open\s+)?(?:the\s+)?metatron(?:'?s)?\s+cube$/,
  /^(?:open\s+)?my\s+cube$/,
];

const AR_CUBE_PATTERNS: readonly RegExp[] = [
  /^cube$/,
  /^ar\s+cube$/,
  /^(?:open|show|pull\s+up)\s+(?:me\s+)?(?:the\s+)?ar\s+cube$/,
  /^(?:open|show)\s+(?:me\s+)?(?:the\s+)?cube$/,
];

const PICTURE_ANALYSIS_PATTERNS: readonly RegExp[] = [
  /^(?:picture\s+analysis|analytic\s+window)$/,
  /^(?:open|show)\s+(?:me\s+)?(?:the\s+)?(?:picture\s+analysis|analytic\s+window)$/,
];

const GAME_PATTERNS: readonly RegExp[] = [
  /^(?:game|legend\s+of\s+logic)$/,
  /^(?:open|play|show)\s+(?:me\s+)?(?:the\s+)?(?:game|legend\s+of\s+logic)$/,
];

const REPLY_HISTORY_PATTERNS: readonly RegExp[] = [
  /^reply\s+history$/,
  /^(?:open|show)\s+(?:me\s+)?(?:the\s+)?(?:reply\s+history|history)$/,
];

/**
 * Resolve a typed or spoken phrase to the room it opens, or null when it
 * is not a room phrase (the caller then continues its normal handling).
 */
export function parseRoomCommand(text: string): RoomTarget | null {
  const phrase = normalizeRoomPhrase(text);
  if (!phrase) return null;
  // My Cube first: its triggers are the most specific, and "pull up the
  // cube" has always belonged to the Metatron panel.
  if (isCubePanelCommand(phrase) || MY_CUBE_PATTERNS.some((p) => p.test(phrase))) {
    return "my-cube";
  }
  if (AR_CUBE_PATTERNS.some((p) => p.test(phrase))) return "ar-cube";
  if (PICTURE_ANALYSIS_PATTERNS.some((p) => p.test(phrase))) return "picture-analysis";
  if (GAME_PATTERNS.some((p) => p.test(phrase))) return "game";
  if (REPLY_HISTORY_PATTERNS.some((p) => p.test(phrase))) return "reply-history";
  return null;
}
