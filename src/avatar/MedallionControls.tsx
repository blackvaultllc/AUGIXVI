/**
 * THE MEDALLION'S OWN CONTROLS (owner orders 2026-11-22): moving
 * an avatar must be OBVIOUS — a labeled Move handle that IS the
 * drag, a one-click Center, and the anchor state in plain words.
 *
 * WHERE THEY LIVE (owner eye-check 2026-11-22 ~19:40 EST): not
 * standing under the face. His words: "I don't need those options
 * always there... they can be inside the box menu. I just want
 * face there." This row now renders inside the medallion's box
 * menu (MedallionMenu.tsx) — one tap on the face's menu button
 * brings the whole row up; the stage itself shows the face alone.
 */
import { Crosshair, Move } from "lucide-react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

export function MedallionControls({
  name,
  lifted,
  moveHandleProps,
  eatClick,
  onCenter,
}: {
  /** The medallion's display name, for the buttons' labels. */
  name: string;
  /** True while the medallion is in his hand (a drag is live). */
  lifted: boolean;
  moveHandleProps: {
    "data-medallion-move": string;
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  /** Consumes a drag's trailing click (see useMedallionAnchor). */
  eatClick: (event: ReactMouseEvent<HTMLElement>) => void;
  onCenter: () => void;
}) {
  return (
    <div className="medallion-controls" data-testid="medallion-controls">
      <button
        type="button"
        className="medallion-controls__button medallion-controls__move"
        {...moveHandleProps}
        onClick={(event) => {
          event.stopPropagation();
          eatClick(event);
        }}
        aria-label={`Move ${name} — press and drag to place him`}
        title={`Move ${name} — press and drag`}
      >
        <Move aria-hidden="true" size={13} />
        <span>Move</span>
      </button>
      <button
        type="button"
        className="medallion-controls__button"
        onClick={(event) => {
          event.stopPropagation();
          onCenter();
        }}
        aria-label={`Center ${name} on the stage`}
        title={`Center ${name} on the stage`}
      >
        <Crosshair aria-hidden="true" size={13} />
        <span>Center</span>
      </button>
      <span className="medallion-controls__state" role="status">
        {lifted ? "Free — drag to place" : "Anchored"}
      </span>
    </div>
  );
}
