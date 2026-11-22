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
 * the command face where he asked for it — top center of the screen,
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
 * PERSPECTIVE (owner order 2026-11-22): Anubis stays at his station —
 * top center — and speaks from his place. Tapping his medallion
 * brings him into perspective (the focus ring); the stage's default
 * perspective is the Black Hatter, and Anubis's station never moves.
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
import type { CSSProperties } from "react";
import { ANUBIS_PORTRAIT_SRC } from "./medallionPortraits";
import { ANUBIS_FEATURES, LivingPortrait } from "./LivingPortrait";

export const ANUBIS_FACE_SRC = ANUBIS_PORTRAIT_SRC;

export function AnubisPresence({
  ready,
  speaking,
  listening,
  acting,
  inPerspective = false,
  onSelect,
  style,
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
  /** Tapping the medallion brings Anubis into perspective. */
  onSelect?: () => void;
  /** The stage-frame offset (Environment Builder) — the translate rides on top of the station's own CSS placement. */
  style?: CSSProperties;
}) {
  const classes = [
    "anubis-presence",
    speaking ? "anubis-presence--speaking" : "",
    listening ? "anubis-presence--listening" : "",
    acting ? "anubis-presence--acting" : "",
    !ready ? "anubis-presence--connecting" : "",
    inPerspective ? "anubis-presence--in-perspective" : "",
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
      style={style}
      role={onSelect ? "button" : "img"}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={`Anubis — ${state}`}
      title={onSelect ? `Anubis — ${state} — tap to bring Anubis into perspective` : `Anubis — ${state}`}
      onClick={onSelect}
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
    >
      <div className="anubis-presence__face">
        {/* LIVING FACE (owner order 2026-11-22): the portrait itself,
            plus blinking eyelids and a mouth that moves while Anubis
            speaks — a face, not a frozen picture (LivingPortrait). */}
        <LivingPortrait
          src={ANUBIS_FACE_SRC}
          features={ANUBIS_FEATURES}
          speaking={speaking}
          imgClassName="anubis-presence__img"
        />
      </div>
      <div className="anubis-presence__plate">
        <span className="anubis-presence__name">Anubis</span>
        <span className="anubis-presence__role">Command</span>
      </div>
    </div>
  );
}
