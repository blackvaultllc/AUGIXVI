/**
 * THE SPEECH-BUBBLE SWITCH (owner desk photos 2026-11-23 ~07:11
 * EST): when the AI talks, the reply ALSO raises the cream anime
 * bubble beside the speaking god's head (the Bellwood standard —
 * GodReportPopUp, driven by AvatarStage's response model). His
 * words: "when the AI talks in the middle it's not only supposed
 * to talk but it's supposed to pop up the chat box like an anime…
 * If I want to turn that box off I can, and just have it talk and
 * look at the chat to see what it's saying."
 *
 * So the bubble is a switch, persisted, default ON: OFF means
 * voice + the chat thread only, no bubble. The switch lives in
 * Anubis's medallion menu beside the perspective buttons (the
 * stage's one obvious spot for how replies present). God REPORTS
 * (proactive notifications through notify()) are not replies and
 * are not governed by this switch.
 */

export const SPEECH_BUBBLE_KEY = "augi.avatar.speech-bubble.v1";

/** The saved switch, defaulting ON (the bubble is the standard). */
export function loadSpeechBubble(): boolean {
  try {
    return localStorage.getItem(SPEECH_BUBBLE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveSpeechBubble(on: boolean) {
  try {
    localStorage.setItem(SPEECH_BUBBLE_KEY, on ? "on" : "off");
  } catch {
    // Storage unavailable — the switch still holds for the session.
  }
}
