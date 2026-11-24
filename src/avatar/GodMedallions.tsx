/**
 * THE RESTING CIRCLES (owner order 2026-11-24 ~16:57 EST — the
 * law lives in godStage.ts).
 *
 * Every god who is not at the front rests as a SMALL CIRCULAR
 * medallion on the stage — round like Osiris's picture, just
 * smaller than Anubis at the center: a round frame, the god's
 * face centered inside the circle, his aspect kept — never
 * stretched, squeezed, or cropped into a tall strip, and never
 * standing on the stage's edges (the side strips of the
 * gods-on-the-sides build are gone entirely). The circles sit
 * in a row in the stage's lower-right field.
 *
 * A circle is a living face, not a button picture: his own
 * portrait under the LivingPortrait treatment with HIS OWN
 * motion (godMotion.ts) — he blinks, his eyes look around the
 * room, and his mouth moves when he is the one speaking. A
 * click summons him to the front (the stage's selectGod:
 * center, big, his greeting, his chat). The god at front is
 * not in the row — he is at the front.
 *
 * The circles are FIXED BY THE LAYOUT: no dragging, no
 * anchor — a god is never grabbed by his face (the Respect
 * Doctrine).
 */
import { ANUBIS_BINDING, MONTU_BINDING } from "./medallionPortraits";
import { ANUBIS_FEATURES, LivingPortrait, MONTU_FEATURES, type FaceFeatures } from "./LivingPortrait";
import { motionProfileFor } from "./godMotion";
import { restingMedallionGods, type FrontGod } from "./godStage";
import type { GodPerspective } from "./stagePerspective";

const CIRCLE_FACES: Readonly<
  Record<GodPerspective, { name: string; portrait: string; features: FaceFeatures }>
> = {
  anubis: { name: ANUBIS_BINDING.name, portrait: ANUBIS_BINDING.portrait, features: ANUBIS_FEATURES },
  montu: { name: MONTU_BINDING.name, portrait: MONTU_BINDING.portrait, features: MONTU_FEATURES },
};

export function GodMedallions({
  front,
  speakingGod,
  onSummon,
}: {
  /** The god at front — he has no resting circle. */
  front: FrontGod;
  /** The god speaking right now, if any — his circle face talks. */
  speakingGod: GodPerspective | null;
  /** A circle clicked: summon that god to the front. */
  onSummon: (god: GodPerspective) => void;
}) {
  const gods = restingMedallionGods(front);
  if (gods.length === 0) return null;
  return (
    <div className="god-medallions" aria-label="The gods at rest">
      {gods.map((god) => {
        const face = CIRCLE_FACES[god];
        const speaking = speakingGod === god;
        return (
          <button
            key={god}
            type="button"
            className={`god-medallion${speaking ? " god-medallion--speaking" : ""}`}
            data-god={god}
            aria-label={`Bring ${face.name} to the front`}
            title={`${face.name} — tap to bring him to the front`}
            onClick={() => onSummon(god)}
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
        );
      })}
    </div>
  );
}
