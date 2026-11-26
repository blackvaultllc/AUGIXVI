/**
 * THE CALL POP-UP (owner order 2026-11-26 ~04:32 CST — the law
 * lives in godStage.ts; REFINED by the God Presence doctrine,
 * voice call 2026-11-26 ~13:50 CST — godPresence.ts).
 *
 * At rest the stage is ANUBIS ALONE. A god who is CALLED — by
 * the Captain's address, by a summon, by Anubis's relay through
 * the Captain — stands on the stage in the ONE CIRCLE FORMAT
 * every god shares (the .god-medallion dress — square box, 50%
 * radius, clipped, the face centered with its aspect kept),
 * fixed by the layout in the stage's lower-right field, above
 * the chat dock's clearance. He is alive in his circle — his
 * own portrait under the LivingPortrait treatment with HIS OWN
 * motion (godMotion.ts): he blinks, his eyes look around the
 * room, and his mouth moves when he is the one speaking.
 *
 * THE TWO SCALES (the refinement): a god who holds the
 * Captain's call stands at PRESENCE scale — full value, the
 * same living treatment as Anubis: a bigger circle with his
 * presence ring standing around him — because when the Captain
 * speaks to a god, that god comes onto the screen at Anubis's
 * value, in his own way. A god called BY another god — a
 * HELPER — stands at the smaller HELPER scale (the Osiris
 * medallion scale) on the stage's lower-left field, converses,
 * and when he is done he BOWS (the allegiance gesture, the
 * same 1.6 seconds the dismissal has always held) and is gone
 * back to his work.
 *
 * The pop-up is a face, not a panel: a tap on it opens the
 * chat window, which stands addressed to him (every god his
 * own chat — the clean-screen law, kept). When the call ends
 * the pop-up goes away: on the dismissal words he BOWS first,
 * and on the Captain's return to Anubis the stage's leaving
 * tail fades him out. Under reduced motion both are instant.
 *
 * ANUBIS HAS NO POP-UP: the center is his place. Osiris's own
 * pop-up is his own component (OsirisMedallion.tsx) — it
 * carries his menu and his message screen, and it follows the
 * addressee state; this component carries the stage gods who
 * hold the call state (godStage.ts) — Montu today — and any
 * god standing as a helper. Osiris as a helper wears his still
 * face in the circle: his living clip treatment lives in his
 * own medallion, and no measured face rig exists for the
 * still, so the still stands plain rather than wearing
 * another face's measurements.
 *
 * The circle is FIXED BY THE LAYOUT: no dragging, no anchor —
 * a god is never grabbed by his face (the Respect Doctrine).
 */
import { MONTU_BINDING } from "./medallionPortraits";
import { LivingPortrait, MONTU_FEATURES, type FaceFeatures } from "./LivingPortrait";
import { PresenceRing } from "./PresenceRing";
import { motionProfileFor } from "./godMotion";
import type { PresenceGodId } from "./godPresence";

const POPUP_FACES: Readonly<
  Partial<
    Record<
      PresenceGodId,
      {
        name: string;
        role: string;
        portrait: string;
        /** Absent = the portrait stands plain (no measured face rig). */
        features?: FaceFeatures;
      }
    >
  >
> = {
  montu: {
    name: MONTU_BINDING.name,
    role: MONTU_BINDING.role,
    portrait: MONTU_BINDING.portrait,
    features: MONTU_FEATURES,
  },
  osiris: {
    name: "Osiris",
    role: "the core — memory, knowledge, the record",
    portrait: "/augie-presence/still.webp",
  },
};

export function CalledGodPopUp({
  god,
  speaking,
  bowing,
  leaving,
  scale = "presence",
  seat,
  onSelect,
}: {
  /** The called god. Anubis never pops up — he renders null. */
  god: PresenceGodId;
  /** The god speaking right now — his circle face talks. */
  speaking: boolean;
  /** Dismissed: he shows his allegiance — the bow — on his way out. */
  bowing?: boolean;
  /** The call has ended: the pop-up is in its leaving tail. */
  leaving?: boolean;
  /**
   * PRESENCE: he holds the Captain's call — full value, ring
   * standing, at the lower-right call seat. HELPER: a god
   * called by a god — the smaller medallion scale, lower-left.
   */
  scale?: "presence" | "helper";
  /**
   * COUNCIL seat (God Presence doctrine point 7): in council a
   * god stands by his council seat, not his call seat — Osiris
   * takes the lower-left at presence scale. Absent = his call
   * seat, as ever.
   */
  seat?: "council";
  /** His face tapped: open the chat window, addressed to him. */
  onSelect: () => void;
}) {
  const face = POPUP_FACES[god];
  if (!face) return null;
  const classes = [
    "called-god-popup",
    `called-god-popup--${scale}`,
    seat === "council" ? "called-god-popup--council-seat" : "",
    bowing ? "called-god-popup--bowing" : "",
    leaving ? "called-god-popup--leaving" : "",
  ]
    .filter(Boolean)
    .join(" ");
  // THE CALL CARD (cybernetic pass, 2026-11-26 — the survey's
  // Digivice row): beside the called god's circle, a small card
  // carrying only what is real — his name and his one-line role,
  // both from his medallion binding (medallionPortraits.ts), and
  // his state word from this pop-up's own standing states (the
  // same states his face renders: speaking, bowing, leaving, on
  // the call). No stats, no levels, no invented numbers — a
  // Digivice card with the honesty law standing where the fake
  // numbers would go.
  const stateWord = speaking
    ? "Speaking"
    : bowing
      ? "Taking his leave"
      : leaving
        ? "Leaving"
        : seat === "council"
          ? "In council"
          : scale === "helper"
            ? "Standing with the call"
            : "On the call";
  return (
    <div className={classes} data-god={god}>
      <div className="called-god-popup__card" aria-label={`${face.name} — ${face.role}`}>
        <p className="called-god-popup__name">{face.name}</p>
        <p className="called-god-popup__role">{face.role}</p>
        <p className="called-god-popup__state">{stateWord}</p>
      </div>
      <span className="called-god-popup__ring-wrap">
        {scale === "presence" && (
          <PresenceRing
            ready
            speaking={speaking}
            listening={false}
            acting={false}
            alert={false}
          />
        )}
        <button
          type="button"
          className={`god-medallion called-god-popup__circle${speaking ? " god-medallion--speaking" : ""}`}
          data-god={god}
          aria-label={`Talk to ${face.name} — open his chat`}
          title={`${face.name} — called. Tap to open his chat`}
          onClick={onSelect}
        >
          <span className="god-medallion__face">
            {face.features ? (
              <LivingPortrait
                src={face.portrait}
                features={face.features}
                speaking={speaking}
                imgClassName="god-medallion__img"
                motion={motionProfileFor(god)}
              />
            ) : (
              <img
                src={face.portrait}
                alt=""
                className="god-medallion__img"
                draggable={false}
              />
            )}
          </span>
        </button>
      </span>
    </div>
  );
}
