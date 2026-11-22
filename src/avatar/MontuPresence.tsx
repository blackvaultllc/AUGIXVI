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
 * THE STATION: like Anubis's medallion, Montu speaks from his
 * place — the right flank of the stage by default — and tapping his
 * medallion brings him into perspective. His medallion is an
 * anchored element under the same anchor law as every stage
 * medallion (useMedallionAnchor): grab it to move it, stretch it
 * from its corner, and where he leaves it is where it stays.
 */
import { useState } from "react";
import { MONTU_BINDING } from "./medallionPortraits";
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
  inPerspective = false,
  inCall = false,
  inCouncil = false,
  atAttention = false,
  onSelect,
}: {
  /** False until the renderer's first frame — the stage is loading. */
  ready: boolean;
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
}) {
  const anchor = useMedallionAnchor(MONTU_BINDING.id);
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
        <img
          className="montu-presence__img"
          src={showBody ? MONTU_BINDING.body : MONTU_FACE_SRC}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      </div>
      <div className="montu-presence__plate">
        <span className="montu-presence__name">{MONTU_BINDING.name}</span>
        <span className="montu-presence__role">{MONTU_BINDING.roleLabel}</span>
      </div>
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
      <div
        className="medallion-anchor__stretch"
        role="separator"
        aria-label="Stretch the Montu medallion"
        title="Drag to stretch the medallion"
        {...anchor.stretchProps}
      />
    </div>
  );
}
