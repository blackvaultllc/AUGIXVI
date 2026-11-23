/**
 * ANUBIS AT COMMAND (owner order 2026-11-22).
 *
 * NAMING — the owner's system, recorded where the presence is
 * defined: Captain Infinity is at the top. ANUBIS is the commander
 * and command face — the one he speaks to day to day. Anubis controls
 * AUGIE / OSIRIS, the construct core and particle "sand code" figure
 * on the stage (osirisPosition.ts), whom the operator addresses
 * directly only for definitely important things. This component is
 * presentation only: it renames nothing, it routes nothing; it puts
 * the command face where he asked for it — center of the screen,
 * "just like how you are," a centered living presence tied to the
 * Command box below.
 *
 * THE FACE: Khadija chose the portrait on 2026-11-22 — antique gold,
 * fur mane, and a broad blue-and-gold ceremonial collar on black.
 * It is NOT the pharaoh emblem: that picture is IEM, a different
 * being, and it is never used or altered here.
 *
 * THE GOLD VERSION (owner order 2026-11-22, restated from his desk):
 * the face IS the gold Anubis — gold head, gold face and accents
 * dominant, matching his black-and-gold desk statue (black carried
 * by the medallion's ground and the collar's deep blue, never a dark
 * face). The medallion is sized to read gold across the room.
 *
 * PERSPECTIVE (owner orders 2026-11-22): Anubis is the RESIDENT
 * commander — the stage's default presence and its default
 * perspective, standing at center. He speaks from his place;
 * tapping his medallion brings him into perspective (the focus
 * ring), and every station's close returns the focus to him.
 *
 * THE ANCHOR (owner order 2026-11-22): his medallion is an anchored
 * element on the shared medallion system (useMedallionAnchor). Its
 * factory home is center stage — and like every medallion he can
 * be grabbed, moved, and stretched, and where the Captain leaves
 * him persists. The station's home does not move; the medallion is
 * his to place.
 *
 * REPLACEABLE ASSET: the medallion reads exactly one file,
 * public/anubis-presence/face.webp. Replacing that file changes the
 * face with no code change. Because the chosen portrait is a finished
 * raster, its living treatment is at medallion level: the whole
 * medallion breathes, its ring attends while the ear is open, it
 * glows while Augie works, and the portrait gives a restrained
 * speaking pulse only while Augie is actually SPEAKING.
 *
 * THE MEDALLION (owner refinement 2026-11-22): the presence reads
 * like the assistant's own avatar presence — a circular face
 * medallion with a BLACK background inside the circle. The black
 * lives inside Anubis's medallion only; the Room around it stays
 * light.
 */
import { useState } from "react";
import { ANUBIS_BINDING, ANUBIS_PORTRAIT_SRC } from "./medallionPortraits";
import { ANUBIS_FEATURES, LivingPortrait } from "./LivingPortrait";
import { MedallionMenu } from "./MedallionMenu";
import {
  availablePresenceViews,
  effectivePresenceView,
  loadPresenceView,
  savePresenceView,
  type PresenceView,
} from "./presenceView";
import { useMedallionAnchor } from "./useMedallionAnchor";

export const ANUBIS_FACE_SRC = ANUBIS_PORTRAIT_SRC;

export function AnubisPresence({
  ready,
  speaking,
  listening,
  acting,
  inPerspective = false,
  inCall = false,
  inCouncil = false,
  atAttention = false,
  onSelect,
}: {
  /** False until the renderer's first frame — the stage is loading. */
  ready: boolean;
  /** Augie is speaking right now (bridge state SPEAKING). */
  speaking: boolean;
  /** The ear is open and Anubis awaits the operator's voice. */
  listening: boolean;
  /** Augie is visibly carrying out work (thinking / presenting). */
  acting: boolean;
  /** The stage's focus is on Anubis's station right now. */
  inPerspective?: boolean;
  /** A one-god CALL conversation is live with Anubis (owner order 2026-11-22). */
  inCall?: boolean;
  /** Anubis sits in a GROUP council of gods, at the smaller factor. */
  inCouncil?: boolean;
  /**
   * AT ATTENTION (owner order 2026-11-22): the god he is speaking
   * to falls to attention while addressed — the standing rule for
   * every god on the stage.
   */
  atAttention?: boolean;
  /** Tapping the medallion brings Anubis into perspective. */
  onSelect?: () => void;
}) {
  const anchor = useMedallionAnchor("anubis");
  // HEAD OR BODY (owner order 2026-11-22): the switch offers the
  // body perspective only when the binding carries body artwork —
  // Anubis's binding has none yet, so he is head-only until it lands.
  const views = availablePresenceViews(ANUBIS_BINDING);
  const [view, setView] = useState<PresenceView>(() =>
    effectivePresenceView(ANUBIS_BINDING, loadPresenceView(ANUBIS_BINDING.id)),
  );
  const showBody = view === "body" && Boolean(ANUBIS_BINDING.body);
  const toggleView = () => {
    const next: PresenceView = view === "head" ? "body" : "head";
    setView(next);
    savePresenceView(ANUBIS_BINDING.id, next);
  };
  const classes = [
    "anubis-presence",
    "medallion-anchor",
    anchor.lifted ? "medallion-anchor--lifted" : "",
    speaking ? "anubis-presence--speaking" : "",
    listening ? "anubis-presence--listening" : "",
    acting ? "anubis-presence--acting" : "",
    !ready ? "anubis-presence--connecting" : "",
    inPerspective ? "anubis-presence--in-perspective" : "",
    inCall ? "medallion-anchor--in-call" : "",
    inCouncil ? "medallion-anchor--in-council" : "",
    atAttention ? "medallion-anchor--attention" : "",
    onSelect ? "anubis-presence--selectable" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const state = speaking
    ? "speaking"
    : listening
      ? "listening"
      : acting
        ? "working"
        : ready
          ? "at command"
          : "connecting";
  return (
    <div
      className={classes}
      role={onSelect ? "button" : "img"}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={`Anubis — ${state}`}
      title={
        onSelect
          ? `Anubis — ${state} — tap to bring Anubis into perspective; drag to move his medallion`
          : `Anubis — ${state}`
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
      <div className="anubis-presence__face" style={anchor.faceStyle}>
        {showBody ? (
          <img
            className="anubis-presence__img"
            src={ANUBIS_BINDING.body}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        ) : (
          /* LIVING FACE (owner order 2026-11-22): the portrait itself,
             plus blinking eyelids and a mouth that moves while Anubis
             speaks — a face, not a frozen picture (LivingPortrait).
             The body view carries no feature map, so it stays a plain
             portrait; the head is the living face. */
          <LivingPortrait
            src={ANUBIS_FACE_SRC}
            features={ANUBIS_FEATURES}
            speaking={speaking}
            imgClassName="anubis-presence__img"
          />
        )}
      </div>
      {/* FACE ONLY (owner eye-check 2026-11-22): no name plate, no
          controls row under the face — the Move / Center / Anchor
          controls live inside his box menu (MedallionMenu), opened
          from the small button at the face's corner. */}
      <MedallionMenu
        name={ANUBIS_BINDING.name}
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
            aria-label={view === "head" ? "Show Anubis full body" : "Show Anubis head only"}
            title={view === "head" ? "Body perspective" : "Head perspective"}
          >
            {view === "head" ? "Body" : "Head"}
          </button>
        )}
      </MedallionMenu>
    </div>
  );
}
