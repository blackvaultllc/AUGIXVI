/**
 * THE SPEECH BUBBLE (owner order, voice call 2026-11-26
 * ~13:48 CST): when a god speaks, he speaks aloud AND this
 * bubble stands beside his head showing the words he is
 * saying — "kind of like if I was playing one of those comic
 * book games and I'm typing to talk to the character."
 *
 * The bubble hangs on the god's OWN standing presence — the
 * center medallion for Anubis, the call pop-up for Montu,
 * Osiris's medallion at the top-left. It raises NO new face:
 * the thing removed on 2026-11-24 was a second face popping
 * up beside a bubble for reports, and it stays removed. This
 * is words only, beside a head that is already on the stage,
 * for exactly as long as the voice is sounding (the state
 * rule lives in godPresence.ts — speechBubbleFor).
 *
 * Comic dress, the house comic style (manual: chat-style):
 * cream ground, ink-black frame, hard offset shadow, a tail
 * pointing at the speaker's head. Position is CSS law per
 * god (god-presence.css); this component is words and dress.
 */
import { ADDRESSEE_NAMES } from "./addressee";
import type { PresenceGodId } from "./godPresence";

export function SpeechBubble({ god, text }: { god: PresenceGodId; text: string }) {
  const name = ADDRESSEE_NAMES[god];
  return (
    <div
      className={`speech-bubble speech-bubble--${god}`}
      role="status"
      aria-label={`${name} is saying: ${text}`}
      data-god={god}
    >
      <p className="speech-bubble__text">{text}</p>
      <span className="speech-bubble__tail" aria-hidden="true" />
    </div>
  );
}
