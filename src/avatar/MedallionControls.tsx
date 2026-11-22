/**
 * THE MEDALLION'S OWN CONTROLS (owner order 2026-11-22): moving an
 * avatar must be OBVIOUS. His words: "I don't know how to move the
 * other avatars to put them in place — I'm trying to get things
 * centered." The drag existed, but nothing on the face said so — a
 * hidden gesture is a defect.
 *
 * So every medallion carries this row under its name plate, in
 * plain words, always visible (never hover-only, never behind a
 * menu):
 * - MOVE — a handle that IS the drag: press it and drag, the face
 *   follows the hand; release sets it down and the spot persists.
 * - CENTER — one click puts the face dead-center of the stage at
 *   the size it wears (another face never lands on the Captain's).
 * - The state chip — "Anchored" while the medallion sits set in
 *   place, "Free — drag to place" while it is in his hand — the
 *   anchor state shown on the avatar itself.
 *
 * The controls are self-evident, so no how-to text rides on the
 * face (Part 33: explanation lives behind the Help button).
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
