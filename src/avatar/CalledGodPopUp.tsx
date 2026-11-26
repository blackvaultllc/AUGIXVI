/**
 * THE CALL POP-UP (owner order 2026-11-26 ~04:32 CST — the law
 * lives in godStage.ts).
 *
 * At rest the stage is ANUBIS ALONE. A god who is CALLED — by
 * the Captain's address, by a summon, by Anubis's relay through
 * the Captain — stands on the stage as a SMALL medallion
 * pop-up for exactly as long as he holds the call: a true
 * round circle in the ONE CIRCLE FORMAT every god shares
 * (the .god-medallion dress — square box, 50% radius, clipped,
 * the face centered with its aspect kept), fixed by the layout
 * in the stage's lower-right field, above the chat dock's
 * clearance, where Montu's resting circle stood under the old
 * law. He is alive in his circle — his own portrait under the
 * LivingPortrait treatment with HIS OWN motion (godMotion.ts):
 * he blinks, his eyes look around the room, and his mouth
 * moves when he is the one speaking.
 *
 * The pop-up is a face, not a panel: a tap on it opens the
 * chat window, which stands addressed to him (every god his
 * own chat — the clean-screen law, kept). When the call ends
 * the pop-up goes away: on the dismissal words he BOWS first
 * (the allegiance gesture, the same 1.6 seconds the dismissal
 * has always held), and on the Captain's return to Anubis the
 * stage's leaving tail fades him out. Under reduced motion
 * both are instant.
 *
 * ANUBIS HAS NO POP-UP: the center is his place. Osiris's
 * pop-up is his own component (OsirisMedallion.tsx) — it
 * carries his menu and his message screen, and it follows the
 * addressee state; this component carries the stage gods who
 * hold the call state (godStage.ts) — Montu today.
 *
 * The circle is FIXED BY THE LAYOUT: no dragging, no anchor —
 * a god is never grabbed by his face (the Respect Doctrine).
 */
import { MONTU_BINDING } from "./medallionPortraits";
import { LivingPortrait, MONTU_FEATURES, type FaceFeatures } from "./LivingPortrait";
import { motionProfileFor } from "./godMotion";
import type { GodPerspective } from "./stagePerspective";

const POPUP_FACES: Readonly<
  Partial<Record<GodPerspective, { name: string; portrait: string; features: FaceFeatures }>>
> = {
  montu: { name: MONTU_BINDING.name, portrait: MONTU_BINDING.portrait, features: MONTU_FEATURES },
};

export function CalledGodPopUp({
  god,
  speaking,
  bowing,
  leaving,
  onSelect,
}: {
  /** The called god. Anubis never pops up — he renders null. */
  god: GodPerspective;
  /** The god speaking right now — his circle face talks. */
  speaking: boolean;
  /** Dismissed: he shows his allegiance — the bow — on his way out. */
  bowing?: boolean;
  /** The call has ended: the pop-up is in its leaving tail. */
  leaving?: boolean;
  /** His face tapped: open the chat window, addressed to him. */
  onSelect: () => void;
}) {
  const face = POPUP_FACES[god];
  if (!face) return null;
  const classes = [
    "called-god-popup",
    bowing ? "called-god-popup--bowing" : "",
    leaving ? "called-god-popup--leaving" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} data-god={god}>
      <button
        type="button"
        className={`god-medallion called-god-popup__circle${speaking ? " god-medallion--speaking" : ""}`}
        data-god={god}
        aria-label={`Talk to ${face.name} — open his chat`}
        title={`${face.name} — called. Tap to open his chat`}
        onClick={onSelect}
      >
        <span className="god-medallion__face">
          <LivingPortrait
            src={face.portrait}
            features={face.features}
            speaking={speaking}
            imgClassName="god-medallion__img"
            motion={motionProfileFor(god)}
          />
        </span>
      </button>
    </div>
  );
}
