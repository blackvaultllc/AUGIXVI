import { DoorOpen, Home, MoveLeft, MoveRight } from "lucide-react";
import type { ConversationView, StagePerspective } from "./stagePerspective";

/**
 * THE STAGE TOOLBAR AREA (owner order 2026-11-22 — the toolbar
 * schema he uploaded: the ForeverUI action-bar arrangement, its
 * PATTERNS re-implemented originally, no assets or code copied).
 *
 * The arrangement the schema lays its bars out in, applied to the
 * stage: a framed MAIN BAR anchored bottom-center — one row of
 * square action buttons in labeled groups with separators — read
 * together with the existing right-side selection cluster (AUGI ·
 * ANCHORED / CONTROL / BODY, ConstructControls, untouched in its
 * place) as the bar system's side cluster, the way the schema's
 * bars pair a centered main bar with a bottom-right bar.
 *
 * WHAT THE MAIN BAR HOLDS (real stage actions only — nothing here
 * duplicates a control that lives elsewhere):
 * - SEATS: the perspective seats — Owner (the Black Hatter, the
 *   default), Anubis, Montu. Tapping a seat turns the stage to that
 *   presence, the same turn a medallion tap makes.
 * - CONSTRUCT: the position orders — Bring in (onto the stage),
 *   Step left, Step right (he floats aside, out of the way), Home
 *   (his set-in spot). The typed/spoken forms of the same orders
 *   live in the command layer; the bar is their standing surface.
 *
 * The bar hides with the rest of the stage chrome on a cleared
 * screen, and it never covers the chat window: the window's
 * stacking sits above the bar wherever they meet.
 */
export function StageToolbar({
  perspective,
  conversationView,
  onSeatOwner,
  onSeatGod,
  onBringIn,
  onStepAside,
  onHome,
}: {
  perspective: StagePerspective;
  conversationView: ConversationView;
  /** Return the stage to the Black Hatter (clears any council). */
  onSeatOwner: () => void;
  /** Turn the stage to a god's seat (a second god raises a council). */
  onSeatGod: (god: "anubis" | "montu") => void;
  /** "Bring Augie in" — the construct onto the stage. */
  onBringIn: () => void;
  /** "Step aside" — the construct floats to a side, in profile. */
  onStepAside: (side: "left" | "right") => void;
  /** Send the construct home to his set-in spot. */
  onHome: () => void;
}) {
  return (
    <div className="stage-toolbar" role="toolbar" aria-label="Stage toolbar">
      <div className="stage-toolbar__group" role="group" aria-label="Seats">
        <button
          type="button"
          className="stage-toolbar__button"
          onClick={onSeatOwner}
          aria-pressed={perspective === "black-hatter" && conversationView !== "council"}
          title="The Black Hatter — the default seat. The stage returns to the owner."
        >
          <img
            className="stage-toolbar__thumb"
            src="/owner-presence/captain-infinity.webp"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <span>Owner</span>
        </button>
        <button
          type="button"
          className="stage-toolbar__button"
          onClick={() => onSeatGod("anubis")}
          aria-pressed={perspective === "anubis"}
          title="Anubis — in overall command. Tap for his seat; tap a second god for a council."
        >
          <img
            className="stage-toolbar__thumb"
            src="/anubis-presence/face.webp"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <span>Anubis</span>
        </button>
        <button
          type="button"
          className="stage-toolbar__button"
          onClick={() => onSeatGod("montu")}
          aria-pressed={perspective === "montu"}
          title="Montu — commander of the army. Tap for his seat; tap a second god for a council."
        >
          <img
            className="stage-toolbar__thumb"
            src="/montu-presence/face.webp"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <span>Montu</span>
        </button>
      </div>
      <div className="stage-toolbar__separator" aria-hidden="true" />
      <div className="stage-toolbar__group" role="group" aria-label="Construct position">
        <button
          type="button"
          className="stage-toolbar__button"
          onClick={onBringIn}
          title="Bring Augie in — the construct onto the stage, facing you."
        >
          <DoorOpen aria-hidden="true" />
          <span>Bring in</span>
        </button>
        <button
          type="button"
          className="stage-toolbar__button"
          onClick={() => onStepAside("left")}
          title="Step aside, left — Augie floats to the left side, in profile, out of the way."
        >
          <MoveLeft aria-hidden="true" />
          <span>Left</span>
        </button>
        <button
          type="button"
          className="stage-toolbar__button"
          onClick={() => onStepAside("right")}
          title="Step aside, right — Augie floats to the right side, in profile, out of the way."
        >
          <MoveRight aria-hidden="true" />
          <span>Right</span>
        </button>
        <button
          type="button"
          className="stage-toolbar__button"
          onClick={onHome}
          title="Home — Augie returns to his set-in spot, anchored and free."
        >
          <Home aria-hidden="true" />
          <span>Home</span>
        </button>
      </div>
    </div>
  );
}
