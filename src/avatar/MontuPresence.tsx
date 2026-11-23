/**
 * MONTU AT HIS STATION (owner pick 2026-11-22).
 *
 * Montu, the falcon war god, is commander of the army — cyber
 * security defense — and the avatar Domenick SENDS OUT: defense
 * operations, the Bluetooth and Wi-Fi work, the smartest in that
 * department. He operates UNDER Anubis, who remains in overall
 * command; this component is the presence/binding layer only — his
 * seat on the stage, his face, his name — no defense tooling hangs
 * off it in this pass.
 *
 * THE FACE: the falcon portrait the Captain picked on 2026-11-22,
 * bound permanently to Montu's name in medallionPortraits.ts
 * (MONTU_BINDING) and served from the single replaceable asset
 * public/montu-presence/face.webp.
 *
 * THE STATION: Montu is NOT resident (presence doctrine, owner
 * order 2026-11-22) — his medallion stands on the stage only while
 * he is summoned for a conversation, popped in with a report, or
 * bowing out under dismissal. When he is on, he speaks from his
 * place — the right flank of the stage by default, or a clear spot
 * under the no-overlap law — and tapping his medallion brings him
 * into perspective. His medallion is an anchored element under the
 * same anchor law as every stage medallion (useMedallionAnchor):
 * grab it to move it, stretch it from its corner, and where he
 * leaves it is where it stays.
 */
import { useState } from "react";
import { MONTU_BINDING } from "./medallionPortraits";
import { MedallionMenu } from "./MedallionMenu";
import { LivingPortrait, MONTU_FEATURES } from "./LivingPortrait";
import {
  availablePresenceViews,
  effectivePresenceView,
  loadPresenceView,
  savePresenceView,
  type PresenceView,
} from "./presenceView";
import { useMedallionAnchor } from "./useMedallionAnchor";

export const MONTU_FACE_SRC = MONTU_BINDING.portrait;

export function MontuPresence({
  ready,
  speaking = false,
  bowing = false,
  inPerspective = false,
  inCall = false,
  inCouncil = false,
  atAttention = false,
  onSelect,
  onRespectAsk,
}: {
  /** False until the renderer's first frame — the stage is loading. */
  ready: boolean;
  /** Montu is speaking right now — his beak moves with the line. */
  speaking?: boolean;
  /**
   * SHOWING ALLEGIANCE (owner order 2026-11-22): dismissed, he bows
   * — the respect gesture with the blessing — before he leaves the
   * stage back to his work.
   */
  bowing?: boolean;
  /** The stage's focus is on Montu's station right now. */
  inPerspective?: boolean;
  /** A one-god CALL conversation is live with Montu (owner order 2026-11-22). */
  inCall?: boolean;
  /** Montu sits in a GROUP council of gods, at the smaller factor. */
  inCouncil?: boolean;
  /**
   * AT ATTENTION (owner order 2026-11-22): the god he is speaking
   * to falls to attention while addressed — the standing rule for
   * every god on the stage.
   */
  atAttention?: boolean;
  /** Tapping the medallion brings Montu into perspective. */
  onSelect?: () => void;
  /**
   * THE RESPECT ASK (owner order 2026-11-23 ~07:22 EST): fired
   * once per session when his face is handled past the threshold.
   */
  onRespectAsk?: () => void;
}) {
  const anchor = useMedallionAnchor(MONTU_BINDING.id, { onRespectAsk });
  // HEAD OR BODY (owner order 2026-11-22): the switch offers the
  // body perspective only when the binding carries body artwork —
  // Montu's binding has none yet, so he is head-only until it lands.
  const views = availablePresenceViews(MONTU_BINDING);
  const [view, setView] = useState<PresenceView>(() =>
    effectivePresenceView(MONTU_BINDING, loadPresenceView(MONTU_BINDING.id)),
  );
  const showBody = view === "body" && Boolean(MONTU_BINDING.body);
  const toggleView = () => {
    const next: PresenceView = view === "head" ? "body" : "head";
    setView(next);
    savePresenceView(MONTU_BINDING.id, next);
  };
  const classes = [
    "montu-presence",
    "medallion-anchor",
    anchor.lifted ? "medallion-anchor--lifted" : "",
    !ready ? "montu-presence--connecting" : "",
    speaking ? "montu-presence--speaking" : "",
    bowing ? "medallion-anchor--bow" : "",
    inPerspective ? "montu-presence--in-perspective" : "",
    inCall ? "medallion-anchor--in-call" : "",
    inCouncil ? "medallion-anchor--in-council" : "",
    atAttention ? "medallion-anchor--attention" : "",
    onSelect ? "montu-presence--selectable" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const state = ready ? "on watch" : "connecting";
  const label = `Montu — ${state}`;
  return (
    <div
      className={classes}
      role={onSelect ? "button" : "img"}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={label}
      title={
        onSelect
          ? `${label} — tap to bring Montu into perspective; drag to move his medallion`
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
      <div className="montu-presence__face" style={anchor.faceStyle}>
        {showBody ? (
          <img
            className="montu-presence__img"
            src={MONTU_BINDING.body}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        ) : (
          /* LIVING FACE (owner order 2026-11-22): Montu blinks like
             every other face on the stage — eyelids in his own
             portrait's colors over the falcon's eyes, and the beak's
             seam moves while he speaks (LivingPortrait). He was the
             one face left frozen; that defect is closed here. The
             body view carries no feature map and stays a portrait. */
          <LivingPortrait
            src={MONTU_FACE_SRC}
            features={MONTU_FEATURES}
            speaking={speaking}
            imgClassName="montu-presence__img"
          />
        )}
      </div>
      {/* FACE ONLY (owner eye-check 2026-11-22): no name plate, no
          controls row under the face — Move / Center / Anchor live
          inside his box menu (MedallionMenu). */}
      <MedallionMenu
        name={MONTU_BINDING.name}
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
            aria-label={view === "head" ? "Show Montu full body" : "Show Montu head only"}
            title={view === "head" ? "Body perspective" : "Head perspective"}
          >
            {view === "head" ? "Body" : "Head"}
          </button>
        )}
      </MedallionMenu>
    </div>
  );
}
