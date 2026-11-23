/**
 * THE BLACK HATTER (owner orders 2026-11-22).
 *
 * The Black Hatter is DOMENICK HIMSELF: the face he speaks with in
 * the system, and the face every station recognizes as the boss,
 * the owner (BLACK_HATTER_BINDING — medallionPortraits.ts; the
 * binding is permanent, picture↔name).
 *
 * PUT AWAY BY DEFAULT (presence doctrine, owner order 2026-11-22):
 * his medallion does NOT stand on the stage when the stage opens —
 * Anubis, the resident commander, holds it. The Owner seat brings
 * the Hatter back, at his saved placement and size (nothing of his
 * is deleted or reset by being away), standing in the middle of
 * the screen as before. His speaker-of-record role for the
 * Captain's typed lines in the Command box is unchanged.
 *
 * LIVING FACE (owner order 2026-11-22, superseding the still-
 * portrait treatment): the Black Hatter TALKS — his eyes blink on
 * a natural cadence and his mouth moves while he is speaking. Per
 * the Captain's protocol, this medallion speaks the Captain's
 * TYPED words (AvatarStage drives `speaking` for the length of the
 * line); when the Captain uses the mic, that is the Captain
 * himself and this face stays silent. The medallion also carries
 * the perspective: full and bright while the stage's focus is his,
 * stepped back — a shade smaller, a shade dimmer — while a station
 * he opened holds the focus. Tapping the medallion returns the
 * perspective to him.
 *
 * THE ANCHOR (owner order 2026-11-22): his medallion is an anchored
 * element on the shared medallion system (useMedallionAnchor) —
 * BIG in the middle of the screen by default, and his to grab,
 * move, and stretch; where he leaves it persists.
 */
import { useState } from "react";
import { BLACK_HATTER_BINDING } from "./medallionPortraits";
import { BLACK_HATTER_FEATURES, LivingPortrait } from "./LivingPortrait";
import { MedallionMenu } from "./MedallionMenu";
import {
  availablePresenceViews,
  effectivePresenceView,
  loadPresenceView,
  savePresenceView,
  type PresenceView,
} from "./presenceView";
import { useMedallionAnchor } from "./useMedallionAnchor";

export const BLACK_HATTER_FACE_SRC = BLACK_HATTER_BINDING.portrait;

export function BlackHatterPresence({
  inPerspective,
  speaking = false,
  inCall = false,
  onSelect,
}: {
  /** True while the stage's focus is the owner's (the default). */
  inPerspective: boolean;
  /** The Hatter is speaking the Captain's typed words right now. */
  speaking?: boolean;
  /**
   * A one-god CALL conversation is live (owner order 2026-11-22):
   * the Black Hatter stands in the call beside the god — he never
   * shrinks for a council; the gods come to him.
   */
  inCall?: boolean;
  /** Tapping the medallion returns the perspective to the owner. */
  onSelect?: () => void;
}) {
  const anchor = useMedallionAnchor(BLACK_HATTER_BINDING.id);
  // HEAD OR BODY (owner order 2026-11-22): the switch offers the
  // body perspective only when the binding carries body artwork —
  // his binding has none yet, so he is head-only until it lands.
  const views = availablePresenceViews(BLACK_HATTER_BINDING);
  const [view, setView] = useState<PresenceView>(() =>
    effectivePresenceView(BLACK_HATTER_BINDING, loadPresenceView(BLACK_HATTER_BINDING.id)),
  );
  const showBody = view === "body" && Boolean(BLACK_HATTER_BINDING.body);
  const toggleView = () => {
    const next: PresenceView = view === "head" ? "body" : "head";
    setView(next);
    savePresenceView(BLACK_HATTER_BINDING.id, next);
  };
  const classes = [
    "black-hatter-presence",
    "medallion-anchor",
    anchor.lifted ? "medallion-anchor--lifted" : "",
    inPerspective ? "black-hatter-presence--in-perspective" : "black-hatter-presence--stepped-back",
    speaking ? "black-hatter-presence--speaking" : "",
    inCall ? "medallion-anchor--in-call" : "",
    onSelect ? "black-hatter-presence--selectable" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const label = `${BLACK_HATTER_BINDING.name} — ${BLACK_HATTER_BINDING.roleLabel}${speaking ? " — speaking" : ""}`;
  return (
    <div
      className={classes}
      role={onSelect ? "button" : "img"}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={label}
      title={
        onSelect
          ? `${label} — tap to return the stage to the Black Hatter; drag to move his medallion`
          : label
      }
      onClick={anchor.wrapSelect(onSelect)}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      {...anchor.rootProps}
    >
      <div className="black-hatter-presence__face" style={anchor.faceStyle}>
        {showBody ? (
          <img
            className="black-hatter-presence__img"
            src={BLACK_HATTER_BINDING.body}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        ) : (
          <LivingPortrait
            src={BLACK_HATTER_FACE_SRC}
            features={BLACK_HATTER_FEATURES}
            speaking={speaking}
            imgClassName="black-hatter-presence__img"
          />
        )}
      </div>
      {/* FACE ONLY (owner eye-check 2026-11-22): no name plate, no
          controls row under the face — Move / Center / Anchor live
          inside his box menu (MedallionMenu). */}
      <MedallionMenu
        name={BLACK_HATTER_BINDING.name}
        lifted={anchor.lifted}
        moveHandleProps={anchor.moveHandleProps}
        eatClick={anchor.eatClick}
        onCenter={anchor.center}
        size={anchor.geometry.size}
        onSizeChange={anchor.setSize}
      >
        {views.length > 1 && (
          <button
            type="button"
            className="medallion-anchor__view-toggle"
            onClick={(event) => {
              event.stopPropagation();
              toggleView();
            }}
            aria-pressed={view === "body"}
            aria-label={
              view === "head" ? "Show the Black Hatter full body" : "Show the Black Hatter head only"
            }
            title={view === "head" ? "Body perspective" : "Head perspective"}
          >
            {view === "head" ? "Body" : "Head"}
          </button>
        )}
      </MedallionMenu>
    </div>
  );
}
