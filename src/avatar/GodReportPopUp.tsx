/**
 * A GOD POPS UP TO REPORT (owner order 2026-11-22; PRESENTATION
 * RESTATED EXACTLY by the Captain 2026-11-23 ~14:47 CST): "when
 * they come in to make a report, they come in with the same
 * circular circumference and then right next to them there's the
 * chat box like the comic books."
 *
 * So a report is ONE UNIT, two parts: the reporting god's
 * CIRCULAR MEDALLION — the same round medallion form as Anubis's
 * on the stage, gold-ringed, his living portrait inside — and
 * immediately beside the circle, the COMIC-STYLE CHAT BOX in the
 * full-comic dress the Captain chose (cream box, bold ink frame,
 * hard offset shadow, the god's name on a tag inside the box, the
 * report typed at the Bellwood pace of 25 ms a character, tail
 * pointing at the circle). He speaks his line, and he goes.
 *
 * NEVER a notification card, never a corner lane (his verdict the
 * same day: a report card in the bottom-right corner "looks
 * stupid" — that lane is deleted). The circle itself carries
 * nothing drawn on it (the clean-circle law): the name lives on
 * the box's tag, not on the medallion.
 *
 * The placement is godPopUp.ts's: the whole block — medallion
 * plus box — is set where it overlaps no other avatar, and it
 * never takes head-center; the center belongs to whoever the
 * Captain seats there. One pop-up at a time: a newer report
 * replaces the one speaking, exactly like a person stepping up
 * to report.
 */
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ANUBIS_BINDING, MONTU_BINDING } from "./medallionPortraits";
import { ANUBIS_FEATURES, LivingPortrait } from "./LivingPortrait";
import {
  POPUP_HOLD_MS,
  POPUP_TYPE_MS_PER_CHAR,
  placePopUp,
  type PopUpGodId,
  type StageRect,
} from "./godPopUp";

export type GodPopUpRequest = {
  id: number;
  god: PopUpGodId;
  text: string;
};

const BINDINGS = { anubis: ANUBIS_BINDING, montu: MONTU_BINDING } as const;

export function GodReportPopUp({
  request,
  stageSize,
  occupiedRects,
  onDone,
}: {
  request: GodPopUpRequest;
  stageSize: { w: number; h: number };
  /** The ground the stage's avatars stand on — the pop-up avoids all of it. */
  occupiedRects: readonly StageRect[];
  onDone: (id: number) => void;
}) {
  const binding = BINDINGS[request.god];
  const [typed, setTyped] = useState(0);
  const typing = typed < request.text.length;
  const placement = useMemo(
    () => placePopUp(stageSize, occupiedRects),
    // Placement is taken once, when the god steps up — he does not
    // slide around while he is speaking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [request.id],
  );

  useEffect(() => {
    setTyped(0);
    if (request.text.length === 0) {
      const hold = window.setTimeout(() => onDone(request.id), POPUP_HOLD_MS);
      return () => window.clearTimeout(hold);
    }
    const typeTimer = window.setInterval(() => {
      setTyped((count) => {
        if (count >= request.text.length) {
          window.clearInterval(typeTimer);
          return count;
        }
        return count + 1;
      });
    }, POPUP_TYPE_MS_PER_CHAR);
    const totalMs = request.text.length * POPUP_TYPE_MS_PER_CHAR + POPUP_HOLD_MS;
    const hold = window.setTimeout(() => onDone(request.id), totalMs);
    return () => {
      window.clearInterval(typeTimer);
      window.clearTimeout(hold);
    };
  }, [request.id, request.text, onDone]);

  // THE MEDALLION: the god's circular medallion — the same round
  // circumference as the stage medallions, gold-ringed, the living
  // portrait inside, nothing drawn on the circle.
  const face = (
    <div className="god-popup__face">
      {request.god === "anubis" ? (
        <LivingPortrait
          src={binding.portrait}
          features={ANUBIS_FEATURES}
          speaking={typing}
          imgClassName="god-popup__img"
        />
      ) : (
        <img
          className={`god-popup__img${typing ? " god-popup__img--speaking" : ""}`}
          src={binding.portrait}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      )}
    </div>
  );

  // THE COMIC BOX: immediately beside the circle — cream box, ink
  // frame, the god's name on a tag inside the box (the comic-book
  // standard the Captain picked), the report typed inside.
  const box = (side: "left" | "right") => (
    <div className={`god-popup__bubble god-popup__bubble--tail-${side}`}>
      <span className="god-popup__tag">{binding.name}</span>
      <p>
        {request.text.slice(0, typed)}
        {typing && <span className="god-popup__caret">▌</span>}
      </p>
    </div>
  );

  return (
    <div
      className="god-popup"
      // The block renders at the placement's own width — the
      // painted block is the placed block, never wider (the
      // clipped-portrait defect, owner screenshot 2026-11-23).
      style={{ left: placement.x, top: placement.y, width: placement.w }}
      role="status"
      aria-label={`${binding.name} reports`}
    >
      {placement.bubbleSide === "left" ? (
        <>
          {box("right")}
          <div className="god-popup__who">{face}</div>
        </>
      ) : (
        <>
          <div className="god-popup__who">{face}</div>
          {box("left")}
        </>
      )}
      <button
        type="button"
        className="god-popup__dismiss"
        onClick={() => onDone(request.id)}
        aria-label={`Dismiss ${binding.name}'s report`}
        title="Dismiss"
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}
