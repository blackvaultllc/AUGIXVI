/**
 * A GOD POPS UP TO REPORT (owner order 2026-11-22).
 *
 * When a god has something to report, he does not stay parked on
 * screen and he does not speak from a card in a stack: he POPS UP —
 * his face appears at a clear edge of the stage with the anime
 * chat bubble beside his head, the Bellwood standard (cream
 * bubble, tail pointing at the speaker, one short line, typed
 * slow at 25 ms a character) — he speaks his line, and he goes.
 *
 * The placement is godPopUp.ts's: the whole block — face plus
 * bubble — is set where it overlaps no other avatar, and it never
 * takes head-center; the center belongs to whoever the Captain
 * seats there. One pop-up at a time: a newer report replaces the
 * one speaking, exactly like a person stepping up to report.
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

  return (
    <div
      className="god-popup"
      style={{ left: placement.x, top: placement.y }}
      role="status"
      aria-label={`${binding.name} reports`}
    >
      {placement.bubbleSide === "left" ? (
        <>
          <div className="god-popup__bubble god-popup__bubble--tail-right">
            <p>
              {request.text.slice(0, typed)}
              {typing && <span className="god-popup__caret">▌</span>}
            </p>
          </div>
          <div className="god-popup__who">
            {face}
            <span className="god-popup__name">{binding.name}</span>
          </div>
        </>
      ) : (
        <>
          <div className="god-popup__who">
            {face}
            <span className="god-popup__name">{binding.name}</span>
          </div>
          <div className="god-popup__bubble god-popup__bubble--tail-left">
            <p>
              {request.text.slice(0, typed)}
              {typing && <span className="god-popup__caret">▌</span>}
            </p>
          </div>
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
