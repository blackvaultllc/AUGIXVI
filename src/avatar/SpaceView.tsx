import { useState, type ReactNode } from "react";
import { Orbit } from "lucide-react";
import { SpinningEarth } from "../components/SpinningEarth";

/**
 * ONE WORLD, ONE EARTH, ONE FLIGHT (owner order 2026-11-10).
 * Both the landing and the orbital view render the same real textured
 * SpinningEarth scene. Osiris is IN that scene, visibly orbiting the
 * planet — there is no second screen and no CSS circle planet anymore.
 * The fly-in to the live world is automatic after sign-in (owner order
 * 2026-11-11): no Enter button — the orbital view exists only briefly
 * during the automatic flight and when returning to orbit on request.
 */
export function SpaceView({
  isEnteringLiveMode,
  isReturningToSpace,
  isLanding = false,
  children,
}: {
  isEnteringLiveMode: boolean;
  isReturningToSpace: boolean;
  isLanding?: boolean;
  children?: ReactNode;
}) {
  const [height] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));

  return (
    <main
      className={`avatar-space-view${isEnteringLiveMode ? " avatar-space-view--entering" : ""}${isReturningToSpace ? " avatar-space-view--returning" : ""}${isLanding ? " avatar-space-view--landing" : ""}`}
      aria-label={isLanding ? "Operator sign-in landing view" : "Earth orbital view"}
    >
      {/* The real textured Earth is the stage for every state of the gate. */}
      <div className="avatar-space-view__real-earth" aria-hidden="true">
        <SpinningEarth height={height} chromeVisible={!isEnteringLiveMode && !isReturningToSpace} />
      </div>

      {isLanding && <div className="avatar-space-view__landing-overlay">{children}</div>}

      {!isLanding && !isEnteringLiveMode && !isReturningToSpace && (
        <footer className="avatar-space-view__footer">
          <p>
            <Orbit aria-hidden="true" /> Osiris is in orbit. Say &ldquo;go home&rdquo; to fly down.
          </p>
        </footer>
      )}
      {!isLanding && (isEnteringLiveMode || isReturningToSpace) && (
        <footer className="avatar-space-view__footer">
          <p>
            <Orbit aria-hidden="true" />
            {isReturningToSpace ? "Climbing back to orbit…" : "Flying down to your world…"}
          </p>
        </footer>
      )}
    </main>
  );
}
