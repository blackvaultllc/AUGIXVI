import { Anchor, Gamepad2, Hand } from "lucide-react";

/**
 * CONSTRUCT CONTROLS — AUGI's anchor and control state, stated plainly
 * on the stage (owner orders 2026-11-22). A self-contained component:
 * it owns no state and reaches nothing outside its props, so it can
 * be lifted onto another page as-is.
 *
 * THE LAW it renders:
 * - ANCHORED = AUGI is set into the stage and FREE — he roams and
 *   works on his own. UNANCHORED = the Captain has lifted him out to
 *   FIX something — he holds still; the mouse drag positions him.
 * - CONTROL: AUGI FREE, or CAPTAIN DRIVING — click AUGI (or the
 *   control button) to take the keys: WASD moves him, SPACEBAR is
 *   his action. Click again, or press Escape, to hand him back.
 * (Placed environment objects use the opposite anchor meaning —
 * anchored = locked in place. That is the builder's law, not his.)
 */
export function ConstructControls({
  anchored,
  captainDriving,
  onToggleAnchor,
  onToggleControl,
}: {
  anchored: boolean;
  captainDriving: boolean;
  onToggleAnchor: () => void;
  onToggleControl: () => void;
}) {
  return (
    <div className="construct-controls" role="group" aria-label="AUGI construct controls">
      <button
        type="button"
        className={`construct-controls__button${anchored ? " is-anchored" : " is-unanchored"}`}
        onClick={onToggleAnchor}
        aria-pressed={anchored}
        title={
          anchored
            ? "AUGI is anchored — set into the stage and free. Click to lift him out for fixing."
            : "AUGI is unanchored — held for fixing. Click to set him back into the stage, free to work."
        }
      >
        <Anchor aria-hidden="true" />
        <span>
          AUGI · {anchored ? "ANCHORED — FREE TO WORK" : "UNANCHORED — HELD FOR FIXING"}
        </span>
      </button>
      <button
        type="button"
        className={`construct-controls__button${captainDriving ? " is-driving" : ""}`}
        onClick={onToggleControl}
        aria-pressed={captainDriving}
        disabled={!anchored}
        title={
          anchored
            ? captainDriving
              ? "You have the keys — WASD moves AUGI, SPACEBAR acts. Click to hand him back."
              : "Take control of AUGI — WASD moves him, SPACEBAR acts."
            : "Anchor AUGI first — while he is lifted out for fixing, the drag positions him."
        }
      >
        {captainDriving ? <Hand aria-hidden="true" /> : <Gamepad2 aria-hidden="true" />}
        <span>
          {captainDriving ? "CAPTAIN DRIVING — WASD + SPACE" : "CONTROL · AUGI FREE"}
        </span>
      </button>
    </div>
  );
}
