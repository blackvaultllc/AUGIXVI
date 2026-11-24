/**
 * WEPWAWET REMOTE CONTROL — the layout of the clickable remote on
 * the dog's Devices card (Captain's order 2026-11-24 ~11:21 EST):
 * a remote he can click inside Augie so the dog moves with no
 * talking to anybody. Modeled on the vendor app's Control screen:
 * a direction pad on the left, the trick/action buttons arranged
 * around it like a remote, Stop in the middle of the pad.
 *
 * This module is ONLY the layout — which command sits where. Every
 * click on the remote runs the exact same road as the card's Send
 * buttons (Permission Law → Parrot bridge → Practice/LIVE by the
 * card's switch); the remote adds no send path of its own.
 *
 * Every id here must exist on the dog profile — a test pins that,
 * so a renamed command fails loudly instead of leaving a dead
 * button on the remote.
 */

/** The direction pad: arrows around a Stop center. */
export const WEPWAWET_REMOTE_PAD = {
  up: "forward",
  left: "turn-left",
  center: "stop",
  right: "turn-right",
  down: "back",
} as const;

/**
 * The action buttons around the pad — tricks, light, and the sound
 * triggers, in the vendor remote's spirit. The sound triggers
 * (dance, song, learn, ai-content) still obey his Use / Never use
 * picks on the card: a Never use pick disables that remote button
 * exactly as it disables its Send button.
 */
export const WEPWAWET_REMOTE_ACTIONS: string[] = [
  "greet",
  "sit",
  "lie-down",
  "dance",
  "kung-fu",
  "swim",
  "bless",
  "coquetry",
  "handstand",
  "push-ups",
  "patrol",
  "pee",
  "light",
  "song",
  "learn",
  "ai-content",
];

/** The feeding row: the eight pictured items, one button each. */
export const WEPWAWET_REMOTE_FEED: string[] = [
  "feed-1",
  "feed-2",
  "feed-3",
  "feed-4",
  "feed-5",
  "feed-6",
  "feed-7",
  "feed-8",
];

/** Every command id the remote carries — pad, actions, feed. */
export const WEPWAWET_REMOTE_IDS: string[] = [
  ...Object.values(WEPWAWET_REMOTE_PAD),
  ...WEPWAWET_REMOTE_ACTIONS,
  ...WEPWAWET_REMOTE_FEED,
];
