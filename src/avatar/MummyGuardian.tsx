import { useState } from "react";
import { MUMMY_GUARDIAN_BINDING } from "./medallionPortraits";

/**
 * THE MUMMY GUARDIAN DETERRENT (owner order 2026-11-22): the slot
 * on the operator gate's DENIAL surface. When an unauthorized
 * attempt hits the gate — a failed sign-in, an account the registry
 * denies, a refused verification code — the denial carries a
 * guardian: the scare face for intruders, serious, never playful,
 * standing on the maze principle: they get lost, they don't get in.
 *
 * THE SET: three guardian portraits, bound in medallionPortraits.ts
 * (MUMMY_GUARDIAN_BINDING.guardians) and copied byte-for-byte into
 * the app. They ROTATE: each denial that raises the deterrent
 * advances the rotation, so the next intruder meets the next
 * guardian. A face that fails to load falls back to the guarded
 * frame — never a broken image, never a substitute face.
 */
let rotationCursor = 0;

export function MummyGuardianDeterrent() {
  const set = MUMMY_GUARDIAN_BINDING.guardians;
  const [face] = useState(() => {
    const picked = set[rotationCursor % set.length] ?? set[0];
    rotationCursor += 1;
    return picked;
  });
  const [artReady, setArtReady] = useState(true);
  return (
    <figure className="mummy-guardian" aria-label="Access denied. This gate is guarded.">
      {artReady && face ? (
        <img
          className="mummy-guardian__face"
          src={face}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => setArtReady(false)}
        />
      ) : (
        <div className="mummy-guardian__frame" aria-hidden="true">
          <span className="mummy-guardian__mark">{MUMMY_GUARDIAN_BINDING.name}</span>
        </div>
      )}
      <figcaption className="mummy-guardian__word">
        This gate is guarded. Turn back — the maze keeps what it catches.
      </figcaption>
    </figure>
  );
}
