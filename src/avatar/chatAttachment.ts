/**
 * THE CHAT BOX'S ATTACHMENT HAND-OFF (owner order, voice call
 * 2026-11-26 ~13:48 CST): he uploads pictures and files FROM
 * THE CHAT BOX when he needs to. A picture picked there goes
 * to Picture Analysis; the analyzer lives in its own window,
 * so the chat box stashes the picked file here and the stage
 * opens the window — the analyzer takes the stash the moment
 * it mounts (or, if it is already open, the moment the stash
 * lands, by the event below). One file at a time: a new pick
 * replaces an untaken one, because the pick IS his intent.
 *
 * Plain module state + one DOM event — no rendering.
 */

/** Fired on window when a picture is stashed for the analyzer. */
export const CHAT_ATTACHMENT_EVENT = "augie:chat-attachment";

let stashed: File | null = null;

/** The chat box's pick, held for the analyzer. */
export function stashChatAttachment(file: File): void {
  stashed = file;
  try {
    globalThis.dispatchEvent?.(new Event(CHAT_ATTACHMENT_EVENT));
  } catch {
    // No event surface (tests, SSR) — the stash itself still holds.
  }
}

/** The analyzer takes the stashed picture — once. */
export function takeChatAttachment(): File | null {
  const file = stashed;
  stashed = null;
  return file;
}
