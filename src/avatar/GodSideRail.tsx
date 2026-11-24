/**
 * THE SIDE SLOTS (owner order 2026-11-24 ~11:27–11:31 EST —
 * the gods-on-the-sides round; the law lives in godStage.ts).
 *
 * Every god rests SMALL at the side of the stage, in the small
 * medallion format of Osiris's corner console — Anubis down the
 * left, Montu down the right — while the stage rests on its
 * wallpaper. The slot is a living face, not a button picture:
 * his own portrait under the LivingPortrait treatment with HIS
 * OWN motion (godMotion.ts) — he blinks, his eyes look around
 * the room, and his mouth moves when he is the one speaking.
 * A click on the slot summons him to the front (the stage's
 * selectGod: center, big, his greeting, his chat). The god at
 * front is not in his slot — he is at the front.
 *
 * The slots are FIXED BY THE LAYOUT: no dragging, no anchor —
 * a god is never grabbed by his face (the Respect Doctrine).
 * The Osiris console at the top-left keeps its own anchor law,
 * untouched; the rails begin below its corner and end above
 * the bottom bar, on the phone as on the desktop.
 */
import { ANUBIS_BINDING, MONTU_BINDING } from "./medallionPortraits";
import { ANUBIS_FEATURES, LivingPortrait, MONTU_FEATURES, type FaceFeatures } from "./LivingPortrait";
import { motionProfileFor } from "./godMotion";
import { slotGodsOnSide, type FrontGod, type GodSlotSide } from "./godStage";
import type { GodPerspective } from "./stagePerspective";

const SLOT_FACES: Readonly<
  Record<GodPerspective, { name: string; portrait: string; features: FaceFeatures }>
> = {
  anubis: { name: ANUBIS_BINDING.name, portrait: ANUBIS_BINDING.portrait, features: ANUBIS_FEATURES },
  montu: { name: MONTU_BINDING.name, portrait: MONTU_BINDING.portrait, features: MONTU_FEATURES },
};

export function GodSideRail({
  side,
  front,
  speakingGod,
  onSummon,
}: {
  side: GodSlotSide;
  /** The god at front — his slot stands empty. */
  front: FrontGod;
  /** The god speaking right now, if any — his slot face talks. */
  speakingGod: GodPerspective | null;
  /** A slot clicked: summon that god to the front. */
  onSummon: (god: GodPerspective) => void;
}) {
  const gods = slotGodsOnSide(front, side);
  if (gods.length === 0) return null;
  return (
    <div className={`god-side-rail god-side-rail--${side}`} data-side={side} aria-label="The gods at rest">
      {gods.map((god) => {
        const face = SLOT_FACES[god];
        const speaking = speakingGod === god;
        return (
          <button
            key={god}
            type="button"
            className={`god-slot${speaking ? " god-slot--speaking" : ""}`}
            data-god={god}
            aria-label={`Bring ${face.name} to the front`}
            title={`${face.name} — tap to bring him to the front`}
            onClick={() => onSummon(god)}
          >
            <span className="god-slot__face">
              <LivingPortrait
                src={face.portrait}
                features={face.features}
                speaking={speaking}
                imgClassName="god-slot__img"
                motion={motionProfileFor(god)}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
