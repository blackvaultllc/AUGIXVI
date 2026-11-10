import { useState, type ReactNode } from "react";
import { ArrowDownToLine, Orbit } from "lucide-react";
import { SpinningEarth } from "../components/SpinningEarth";

/**
 * ONE WORLD, ONE EARTH, ONE FLIGHT (owner order 2026-11-10).
 * Both the landing and the orbital view render the same real textured
 * SpinningEarth scene. Osiris is IN that scene, visibly orbiting the
 * planet — there is no second screen and no CSS circle planet anymore.
 * "Enter Live Mode" is the continuous fly-in: the camera dives from
 * orbit through the atmosphere to the surface and the particle world
 * opens over the arriving shot. The old "One world. Two perspectives."
 * split is gone.
 */
export function SpaceView({
  isEnteringLiveMode,
  isReturningToSpace,
  onEnterLiveMode,
  isLanding = false,
  children,
}: {
  isEnteringLiveMode: boolean;
  isReturningToSpace: boolean;
  onEnterLiveMode: () => void;
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
        <SpinningEarth
          height={height}
          {...(isLanding ? {} : { onEnter: onEnterLiveMode })}
          chromeVisible={!isEnteringLiveMode && !isReturningToSpace}
        />
      </div>

      {isLanding && <div className="avatar-space-view__landing-overlay">{children}</div>}

      {!isLanding && (
        <footer className="avatar-space-view__footer">
          <p>
            <Orbit aria-hidden="true" />
            {isReturningToSpace
              ? "Climbing back to orbit…"
              : isEnteringLiveMode
                ? "Flying down to your world…"
                : "Osiris is in orbit. Enter to fly down home."}
          </p>
          <button
            className="avatar-space-view__enter"
            type="button"
            onClick={onEnterLiveMode}
            disabled={isEnteringLiveMode || isReturningToSpace}
          >
            {isReturningToSpace ? (
              <>
                <Orbit aria-hidden="true" /> Returning to space…
              </>
            ) : isEnteringLiveMode ? (
              <>
                <ArrowDownToLine aria-hidden="true" /> Flying in…
              </>
            ) : (
              <>
                <ArrowDownToLine aria-hidden="true" /> Enter Live Mode
              </>
            )}
          </button>
        </footer>
      )}
    </main>
  );
}
