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
 * THE LOCK-DOWN (owner eye-check 2026-11-23 ~06:51 EST, superseding
 * the anchor paragraph above for this medallion): "I don't want to
 * move it around anymore — even if it's anchored it still lets me
 * click and move it, that's stupid. Anubis needs to stay centered,
 * anchored, nobody can move him around — unless I have an emergency
 * edit I have to do." Anubis's seat is LOCKED: centered, at the big
 * default, no drag, no Move/Center in his everyday menu. Placement
 * lives only behind the EMERGENCY EDIT unlock in his menu, and
 * closing the edit re-seats him centered (useMedallionAnchor's
 * lockedSeat). What he gets instead of movement is the PERSPECTIVE
 * BY BUTTON (same order): Left / Front / Right stage-view buttons
 * in his menu — the view moves around him; he never does.
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
 *
 * THE SCEPTER — REMOVED (owner order 2026-11-24 ~09:57 EST,
 * superseding the 2026-11-23 scepter order): the was-scepter
 * overlay that rose at his side for a god report is gone with
 * the pop-up it rode with — "his scepter is getting in the way
 * of the actual Anubis. Stop having that pop up." The asset
 * stays in the registry (medallionPortraits) unrendered; the
 * portrait itself was never altered to hold it.
 */
import { useState } from "react";
import { ANUBIS_BINDING, ANUBIS_PORTRAIT_SRC } from "./medallionPortraits";
import { ANUBIS_FEATURES, LivingPortrait } from "./LivingPortrait";
import { ANUBIS_MOTION_PROFILE } from "./godMotion";
import { MedallionMenu } from "./MedallionMenu";
import {
  availablePresenceViews,
  effectivePresenceView,
  loadPresenceView,
  savePresenceView,
  type PresenceView,
} from "./presenceView";
import type { StageView } from "./stageView";
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
  onReturn,
  stageView,
  onStageViewChange,
  onRespectAsk,
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
  /**
   * RETURN TO HIS PLACE (gods-on-the-sides round, owner order
   * 2026-11-24): while Anubis holds the FRONT, his menu carries
   * the way back — he returns to his side slot and the stage to
   * its wallpaper. Supplied by the stage only in the front
   * state; a face tap on the front medallion does the same.
   */
  onReturn?: () => void;
  /**
   * THE STAGE VIEW (owner eye-check 2026-11-23): the perspective
   * the stage is viewed from — switched by the buttons in his
   * menu, never by moving him. Supplied by AvatarStage; without
   * it the menu simply carries no perspective row.
   */
  stageView?: StageView;
  /** Switch the stage view (Left / Front / Right perspective). */
  onStageViewChange?: (view: StageView) => void;
  /**
   * THE RESPECT ASK (owner order 2026-11-23 ~07:22 EST): fired
   * once per session when his face is handled past the threshold
   * — the stage has him speak the polite line.
   */
  onRespectAsk?: () => void;
}) {
  // THE LOCKED SEAT (the lock-down): Anubis's anchor runs locked —
  // centered and big, immovable outside an emergency edit.
  const anchor = useMedallionAnchor("anubis", { lockedSeat: true, onRespectAsk });
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
    anchor.emergencyEdit ? "medallion-anchor--emergency-edit" : "",
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
          ? anchor.emergencyEdit
            ? `Anubis — ${state} — emergency edit open: drag to move his medallion`
            : `Anubis — ${state} — tap to bring Anubis into perspective; he stays centered — his placement is locked`
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
             portrait; the head is the living face. HIS OWN MOTION
             (2026-11-24): the shared rig bent to the commander —
             the stage's slowest, weightiest blink (rebuilt in
             phases, lower lid rising, lids fitted to the jackal
             eye's slant), a deliberate gaze, a measured speech. */
          <LivingPortrait
            src={ANUBIS_FACE_SRC}
            features={ANUBIS_FEATURES}
            speaking={speaking}
            imgClassName="anubis-presence__img"
            motion={ANUBIS_MOTION_PROFILE}
          />
        )}
      </div>
      {/* FACE ONLY (owner eye-check 2026-11-22): no name plate, no
          controls row under the face — the controls live inside
          his box menu (MedallionMenu), opened from the small
          button at the face's corner. THE LOCK-DOWN (2026-11-23):
          his menu carries no Move/Center/size while he is locked —
          only the seat's state, the emergency-edit unlock, the
          perspective buttons, and the head/body switch. */}
      <MedallionMenu
        name={ANUBIS_BINDING.name}
        lifted={anchor.lifted}
        moveHandleProps={anchor.moveHandleProps}
        eatClick={anchor.eatClick}
        onCenter={anchor.center}
        size={anchor.geometry.size}
        onSizeChange={anchor.setSize}
        placementLocked={!anchor.emergencyEdit}
        emergencyEdit={anchor.emergencyEdit}
        onEnterEmergencyEdit={anchor.enterEmergencyEdit}
        onExitEmergencyEdit={anchor.exitEmergencyEdit}
      >
        {/* RETURN TO HIS PLACE (gods-on-the-sides round,
            2026-11-24): the front is a summons, not a seat —
            this sends him back to his side slot and the stage
            back to its wallpaper. */}
        {onReturn && (
          <button
            type="button"
            className="medallion-menu__lock-button"
            onClick={(event) => {
              event.stopPropagation();
              onReturn();
            }}
            aria-label="Return Anubis to his place"
            title="Return to his place — back to his side slot; the stage rests on the wallpaper"
          >
            <span>Return to his place</span>
          </button>
        )}
        {/* PERSPECTIVE BY BUTTON (owner eye-check 2026-11-23):
            "have a button I can do left perspective, right
            perspective" — the stage's view steps left or right
            around him, and Front brings it back to center. He
            never moves; the view does. */}
        {stageView && onStageViewChange && (
          <div
            className="medallion-menu__perspective"
            role="group"
            aria-label="Stage perspective"
          >
            <span className="medallion-menu__perspective-label">Perspective</span>
            <div className="medallion-menu__perspective-buttons">
              {(
                [
                  ["left", "Left"],
                  ["front", "Front"],
                  ["right", "Right"],
                ] as const
              ).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  className="medallion-menu__perspective-button"
                  aria-pressed={stageView === view}
                  aria-label={`${label} perspective`}
                  title={`${label} perspective — the view moves, Anubis stays centered`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onStageViewChange(view);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
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
