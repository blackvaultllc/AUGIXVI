import { useState, type ReactNode } from "react";
import { Heart } from "lucide-react";
import { isLearnerSessionActive } from "./learnerProfile";

/**
 * LEARNER GATE — the wall on her side of the door. Learner-only routes
 * (her page, her game room) render their content only while HER
 * session is active. An operator session means nothing here: this gate
 * never looks at Supabase, the operator registry, or any operator
 * state — the two modes share nothing but the app shell.
 */
export function LearnerGate({ roomName, children }: { roomName: string; children: ReactNode }) {
  const [active] = useState(() => isLearnerSessionActive());

  if (active) return <>{children}</>;

  return (
    <div className="learner-shell">
      <div className="learner-signin">
        <Heart className="learner-signin__heart" aria-hidden="true" fill="currentColor" />
        <h1>{roomName}</h1>
        <p>This is Khadija&apos;s learning place. Open her heart door first.</p>
        <button
          type="button"
          className="learner-big-button"
          onClick={() => {
            window.location.assign("/learner");
          }}
        >
          Go to Khadija&apos;s door
        </button>
      </div>
    </div>
  );
}
