/**
 * THE WORKING KEYBOARD (owner order 2026-11-28 ~07:21 CST —
 * see workingKeyboard.ts for the order and its bounds): while
 * Anubis works, a gold-rimmed keyboard rises at the base of
 * his medallion, keys lighting in a typing rhythm, and a
 * stream of binary types out above it. When the work ends it
 * settles away. KEYBOARD AND BINARY ONLY — the sandbox paws
 * are excluded by his order until he perfects them there.
 *
 * The trigger is not invented here: AnubisPresence passes its
 * `acting` signal — the stage's real working read (bridge
 * THINKING or presenting). This component renders only while
 * that signal stands (plus one short settle as it falls).
 *
 * REDUCED MOTION: the keyboard stands still — a standing
 * stream, no key ever flashing — the same restraint the rest
 * of his face keeps (pass 8's law).
 */
import { useEffect, useRef, useState } from "react";
import {
  WORKING_KEY_ROWS,
  WORKING_KEYBOARD_EXIT_MS,
  appendWorkingBit,
  nextLitKeyIndex,
  workingByte,
  workingKeyDelay,
} from "./workingKeyboard";

const FLAT_KEYS: readonly string[] = WORKING_KEY_ROWS.flatMap((row) => [...row]);
/** The space bar's index — the last key on the board. */
const SPACE_INDEX = FLAT_KEYS.length;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function WorkingKeyboard({ active }: { active: boolean }) {
  const [shown, setShown] = useState(active);
  const [leaving, setLeaving] = useState(false);
  const [stream, setStream] = useState<string>(() => workingByte(Math.random));
  const [lit, setLit] = useState<number>(() => nextLitKeyIndex(Math.random, -1, SPACE_INDEX + 1));
  const reducedRef = useRef<boolean | null>(null);
  if (reducedRef.current === null) reducedRef.current = prefersReducedMotion();
  const reduced = reducedRef.current;

  // Rise the moment the work starts; when it ends, stand one
  // short settle (the --leaving dress) and then be gone.
  useEffect(() => {
    if (active) {
      setShown(true);
      setLeaving(false);
      return;
    }
    if (!shown) return;
    setLeaving(true);
    const timer = setTimeout(() => {
      setShown(false);
      setLeaving(false);
    }, WORKING_KEYBOARD_EXIT_MS);
    return () => clearTimeout(timer);
  }, [active, shown]);

  // The typing itself: one strike at a time on an uneven
  // rhythm — a bit joins the stream, a new key lights.
  useEffect(() => {
    if (!active || !shown || reduced) return;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const strike = () => {
      if (cancelled) return;
      setStream((value) => appendWorkingBit(value, Math.random));
      setLit((value) => nextLitKeyIndex(Math.random, value, SPACE_INDEX + 1));
      timer = setTimeout(strike, workingKeyDelay(Math.random));
    };
    timer = setTimeout(strike, workingKeyDelay(Math.random));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, shown, reduced]);

  if (!shown) return null;

  let keyIndex = -1;
  return (
    <div
      className={`working-keyboard${leaving ? " working-keyboard--leaving" : ""}`}
      role="img"
      aria-label="Anubis is working — typing at his keyboard, binary streaming above it"
      data-working-keyboard=""
    >
      <div className="working-keyboard__stream" aria-hidden="true">
        {stream}
        <span className="working-keyboard__caret" />
      </div>
      <div className="working-keyboard__board" aria-hidden="true">
        {WORKING_KEY_ROWS.map((row, rowAt) => (
          <div className="working-keyboard__row" key={rowAt}>
            {row.map((label) => {
              keyIndex += 1;
              const at = keyIndex;
              return (
                <span
                  key={label}
                  className={`working-keyboard__key${at === lit ? " working-keyboard__key--lit" : ""}`}
                  data-key-index={at}
                >
                  {label}
                </span>
              );
            })}
          </div>
        ))}
        <div className="working-keyboard__row">
          <span
            className={`working-keyboard__key working-keyboard__key--space${SPACE_INDEX === lit ? " working-keyboard__key--lit" : ""}`}
            data-key-index={SPACE_INDEX}
          />
        </div>
      </div>
    </div>
  );
}
