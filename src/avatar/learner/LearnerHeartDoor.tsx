import { Heart } from "lucide-react";

/**
 * THE HEART DOOR (operator order 2026-11-21): a heart button on the
 * app footer is Khadija's entrance. The heart is her symbol. It lives
 * on the operator sign-in landing — reachable with no sign-in at all —
 * and it leads only to /learner, her education side. It is a plain
 * button with a full-page navigation on purpose: crossing between her
 * mode and the operator's always goes through a fresh page load, so no
 * in-memory operator state rides along with her, and her door grants
 * nothing on the operator side.
 */
export function LearnerHeartDoor() {
  return (
    <footer className="learner-heart-door">
      <button
        type="button"
        className="learner-heart-door__button"
        aria-label="Khadija's door — open the learning side"
        title="Khadija's door"
        onClick={() => {
          window.location.assign("/learner");
        }}
      >
        <Heart aria-hidden="true" fill="currentColor" />
      </button>
      <span className="learner-heart-door__label">Khadija</span>
    </footer>
  );
}
