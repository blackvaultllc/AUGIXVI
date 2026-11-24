import { useState, type ReactNode } from "react";
import { Orbit } from "lucide-react";
import { SpinningEarth } from "../components/SpinningEarth";
import { LivingPortrait, MONTU_FEATURES } from "./LivingPortrait";
import { MONTU_PORTRAIT_SRC } from "./medallionPortraits";

/**
 * ONE WORLD, ONE EARTH, ONE FLIGHT (owner order 2026-11-10).
 * The orbital view renders the real textured SpinningEarth scene.
 * Osiris is IN that scene, visibly orbiting the planet — there is no
 * second screen and no CSS circle planet anymore. The fly-in to the
 * live world is automatic after sign-in (owner order 2026-11-11): no
 * Enter button — the orbital view exists only briefly during the
 * automatic flight and when returning to orbit on request.
 *
 * THE LOGIN GUARDIAN IS MONTU (owner order 2026-11-24 ~10:00 EST,
 * superseding the Earth on the front intro): the landing / sign-in
 * surface no longer spins the Earth. MONTU, the war god, stands
 * guard there in a big circular medallion presented exactly like
 * Anubis's — gold ring, living face — and nobody reaches Anubis
 * without signing in; on sign-in the stage switches to Anubis as
 * always. The Earth view INSIDE the app (the orbital view above)
 * is untouched by this order.
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
      {isLanding ? (
        /* MONTU GUARDS THE GATE: his living portrait in the big gold
           medallion, on the left like Anubis stands on the Earth
           scene — placement in styles.css
           (.avatar-space-view__montu-guard), which also steps him
           clear of the sign-in card at phone sizes. */
        <div className="avatar-space-view__montu-guard" data-testid="montu-guard">
          <span className="avatar-space-view__montu-ring">
            <LivingPortrait
              src={MONTU_PORTRAIT_SRC}
              features={MONTU_FEATURES}
              speaking={false}
              imgClassName="avatar-space-view__montu-face"
            />
          </span>
          <p className="avatar-space-view__montu-name">MONTU · GUARDIAN OF THE GATE</p>
        </div>
      ) : (
        /* The real textured Earth is the stage for the orbital states. */
        <div className="avatar-space-view__real-earth" aria-hidden="true">
          <SpinningEarth height={height} chromeVisible={!isEnteringLiveMode && !isReturningToSpace} />
        </div>
      )}

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
