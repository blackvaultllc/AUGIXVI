/**
 * ANUBIS AT COMMAND (owner order 2026-11-22).
 *
 * NAMING — the owner's system, recorded where the presence is
 * defined: ANUBIS is the command face — the one in command he speaks
 * to day to day. Anubis controls / relays to AUGIE, the robotic
 * construct of all intelligence — OSIRIS, the particle "sand code"
 * figure on the stage (osirisPosition.ts) — whom the operator
 * addresses directly only for definitely important things. This
 * component is presentation only: it renames nothing, it routes
 * nothing; it puts the command face where he asked for it — top
 * center of the screen, "just like how you are," a centered living
 * presence tied to the Command box below.
 *
 * THE FACE: Khadija chose the portrait on 2026-11-22 — antique gold,
 * fur mane, and a broad blue-and-gold ceremonial collar on black.
 * It is NOT the pharaoh emblem: that picture is IEM, a different
 * being, and it is never used or altered here.
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
export const ANUBIS_FACE_SRC = "/anubis-presence/face.webp";

export function AnubisPresence({
  ready,
  speaking,
  listening,
  acting,
}: {
  /** False until the renderer's first frame — the stage is loading. */
  ready: boolean;
  /** Augie is speaking right now (bridge state SPEAKING). */
  speaking: boolean;
  /** The ear is open and Anubis awaits the operator's voice. */
  listening: boolean;
  /** Augie is visibly carrying out work (thinking / presenting). */
  acting: boolean;
}) {
  const classes = [
    "anubis-presence",
    speaking ? "anubis-presence--speaking" : "",
    listening ? "anubis-presence--listening" : "",
    acting ? "anubis-presence--acting" : "",
    !ready ? "anubis-presence--connecting" : "",
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
    <div className={classes} role="img" aria-label={`Anubis — ${state}`} title={`Anubis — ${state}`}>
      <div className="anubis-presence__face">
        <img
          className="anubis-presence__img"
          src={ANUBIS_FACE_SRC}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      </div>
      <div className="anubis-presence__plate">
        <span className="anubis-presence__name">Anubis</span>
        <span className="anubis-presence__role">Command</span>
      </div>
    </div>
  );
}
