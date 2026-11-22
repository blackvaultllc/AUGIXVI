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
 * THE FACE: Anubis drawn as clean vector art in the house treatment —
 * gold on deep blue, calm and watchful, front-facing. It is NOT the
 * pharaoh emblem: that picture is IEM, a different being, and it is
 * never used or altered here. The life in the face is state-driven,
 * never decorative, on the same signals the stage already tracks:
 * the eyes blink on a slow cycle, the jaw moves only while Augie is
 * actually SPEAKING, the ears and ring attend while the ear is open
 * (listening), and the ring breathes while he is working (acting).
 *
 * THE MEDALLION (owner refinement 2026-11-22): the presence reads
 * like the assistant's own avatar presence — a circular face
 * medallion with a BLACK background inside the circle, the face in
 * gold and deep blue on the black. The black lives inside Anubis's
 * medallion only; the Room around it stays light.
 */
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
        <svg viewBox="0 0 120 120" className="anubis-presence__svg" aria-hidden="true">
          <defs>
            <radialGradient id="anubis-bg" cx="50%" cy="38%" r="75%">
              <stop offset="0%" stopColor="#16233f" />
              <stop offset="52%" stopColor="#05080f" />
              <stop offset="100%" stopColor="#000000" />
            </radialGradient>
            <linearGradient id="anubis-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f3d27a" />
              <stop offset="55%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#9a7414" />
            </linearGradient>
            <clipPath id="anubis-clip">
              <circle cx="60" cy="60" r="57" />
            </clipPath>
          </defs>
          <circle cx="60" cy="60" r="57" fill="url(#anubis-bg)" />
          <g clipPath="url(#anubis-clip)">
            {/* Halo ring — the quiet gold circle behind the guardian. */}
            <circle cx="60" cy="52" r="41" fill="none" stroke="#d4af37" strokeOpacity="0.32" strokeWidth="1.4" />
            {/* Wesekh collar — banded gold, lapis and teal, house colors. */}
            <path d="M22,126 A38,38 0 0 1 98,126 Z" fill="url(#anubis-gold)" />
            <path d="M29,126 A31,31 0 0 1 91,126 Z" fill="#2456c8" />
            <path d="M36,126 A24,24 0 0 1 84,126 Z" fill="#1f7a6d" />
            <path d="M43,126 A17,17 0 0 1 77,126 Z" fill="url(#anubis-gold)" />
            {/* Neck */}
            <rect x="52.5" y="62" width="15" height="28" fill="#101a2c" />
            {/* Ears — tall, upright, the guardian's silhouette. */}
            <g className="anubis-ear anubis-ear--left">
              <path d="M45.5,41 L49,7 L58.5,34 Z" fill="#131e33" stroke="#d4af37" strokeWidth="1.1" />
              <path d="M48.3,36.5 L50.3,15.5 L55.2,31.5 Z" fill="#8a6a1f" />
            </g>
            <g className="anubis-ear anubis-ear--right">
              <path d="M74.5,41 L71,7 L61.5,34 Z" fill="#131e33" stroke="#d4af37" strokeWidth="1.1" />
              <path d="M71.7,36.5 L69.7,15.5 L64.8,31.5 Z" fill="#8a6a1f" />
            </g>
            {/* Skull */}
            <ellipse cx="60" cy="42" rx="16.5" ry="14.5" fill="#16233c" stroke="#d4af37" strokeWidth="0.9" />
            {/* Forehead band */}
            <path d="M44.5,36.5 Q60,28.5 75.5,36.5 L75.5,31.5 Q60,23.5 44.5,31.5 Z" fill="url(#anubis-gold)" />
            {/* Muzzle — the long jackal snout, front-on. */}
            <path d="M51,49 L69,49 L67,71 Q60,76.5 53,71 Z" fill="#1b2a47" stroke="#d4af37" strokeWidth="0.7" />
            <line x1="60" y1="50" x2="60" y2="66" stroke="#d4af37" strokeOpacity="0.3" strokeWidth="0.8" />
            {/* Nose */}
            <path d="M53.5,69.5 Q60,65.8 66.5,69.5 L65.5,75.5 Q60,78.5 54.5,75.5 Z" fill="#070c16" />
            <circle cx="57" cy="72.5" r="1" fill="#d4af37" fillOpacity="0.75" />
            <circle cx="63" cy="72.5" r="1" fill="#d4af37" fillOpacity="0.75" />
            {/* Jaw — moves only while he speaks. */}
            <g className="anubis-jaw">
              <path d="M54.5,80.5 Q60,83.5 65.5,80.5" fill="none" stroke="#d4af37" strokeWidth="1.1" strokeLinecap="round" />
            </g>
            {/* Eyes — gold almonds, dark pupils, lids that blink. */}
            <g>
              <path d="M43.5,45 Q50,39.3 56.5,45 Q50,48.6 43.5,45 Z" fill="url(#anubis-gold)" stroke="#0a0f1c" strokeWidth="0.5" />
              <ellipse cx="50" cy="44.1" rx="1.7" ry="2.3" fill="#0a0f1c" />
              <g className="anubis-lid">
                <path d="M43,45.4 Q50,38.8 57,45.4 Q50,49.2 43,45.4 Z" fill="#16233c" />
              </g>
            </g>
            <g>
              <path d="M63.5,45 Q70,39.3 76.5,45 Q70,48.6 63.5,45 Z" fill="url(#anubis-gold)" stroke="#0a0f1c" strokeWidth="0.5" />
              <ellipse cx="70" cy="44.1" rx="1.7" ry="2.3" fill="#0a0f1c" />
              <g className="anubis-lid">
                <path d="M63,45.4 Q70,38.8 77,45.4 Q70,49.2 63,45.4 Z" fill="#16233c" />
              </g>
            </g>
          </g>
          <circle cx="60" cy="60" r="57.8" fill="none" stroke="url(#anubis-gold)" strokeWidth="2.4" />
        </svg>
      </div>
      <div className="anubis-presence__plate">
        <span className="anubis-presence__name">Anubis</span>
        <span className="anubis-presence__role">Command</span>
      </div>
    </div>
  );
}
