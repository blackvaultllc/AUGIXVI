import { useEffect, useState } from "react";

/**
 * LIVING PORTRAITS (owner order 2026-11-22, the core-defect fix):
 * the medallion portraits must be ALIVE — eyes that blink on a
 * natural cadence, a mouth that moves while the face is speaking,
 * never a frozen picture. His comparison was the assistant's own
 * animated presence in his Muse chat: it blinks and moves; the
 * stage's medallions did not. This component closes that gap.
 *
 * HOW: the registered portrait stays the portrait (one replaceable
 * file per face, never altered). Over it sit two eyelids and a
 * mouth, placed from measured feature coordinates on the actual
 * artwork (percent space — both portraits are square and shown
 * with object-fit: cover, so the map transfers 1:1). The lids
 * sweep down from the top of each eye for a blink; the mouth is a
 * dark ellipse over the portrait's own mouth that opens and closes
 * on a speech rhythm while `speaking` is true.
 *
 * THE LEVEL REACHED, stated plainly: mouth movement tied to the
 * speaking STATE (Anubis answering; the Black Hatter carrying the
 * Captain's typed words) — real blinking, real mouth motion, not
 * phoneme-level lip-sync to the audio waveform.
 *
 * Speaking protocol (his standing order): Anubis's medallion
 * speaks when Anubis answers. The Black Hatter speaks the
 * Captain's TYPED words. When the Captain uses the mic, that is
 * the Captain himself — the Hatter's mouth stays still.
 */

export type FaceFeatures = {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  /** Lid size, percent of the medallion — a shade larger than the eye. */
  eyeW: number;
  eyeH: number;
  mouth: { x: number; y: number };
  mouthW: number;
  mouthH: number;
  lidBackground: string;
  mouthBackground: string;
};

/**
 * Feature maps measured on the registered artwork (visual grounding
 * on the shipped files, 2026-11-22): Anubis's eyes sit at
 * (42.2, 39.4) / (57.9, 39.4), his mouth under the muzzle at
 * (50.1, 58.0); the Black Hatter's eyes at (42.2, 38.8) /
 * (57.6, 38.8), his mouth at (49.8, 53.9).
 */
export const ANUBIS_FEATURES: FaceFeatures = {
  leftEye: { x: 42.2, y: 39.4 },
  rightEye: { x: 57.9, y: 39.4 },
  eyeW: 9.5,
  eyeH: 4.6,
  mouth: { x: 50.1, y: 58.0 },
  mouthW: 8.5,
  mouthH: 2.8,
  lidBackground:
    "radial-gradient(ellipse at 50% 35%, #dcb34a 0%, #a37e22 70%, #7c5c14 100%)",
  mouthBackground: "radial-gradient(ellipse at 50% 50%, #3a2a08 0%, #241a04 100%)",
};

export const BLACK_HATTER_FEATURES: FaceFeatures = {
  leftEye: { x: 42.2, y: 38.8 },
  rightEye: { x: 57.6, y: 38.8 },
  eyeW: 8.6,
  eyeH: 4.0,
  mouth: { x: 49.8, y: 53.9 },
  mouthW: 11.5,
  mouthH: 3.4,
  lidBackground:
    "radial-gradient(ellipse at 50% 35%, #6b4a30 0%, #402818 70%, #2a180c 100%)",
  mouthBackground: "radial-gradient(ellipse at 50% 50%, #33150c 0%, #1c0b06 100%)",
};

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Blinking on a natural, slightly irregular cadence. */
function useBlink(): boolean {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let alive = true;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };
    const blinkOnce = (again: () => void) => {
      setClosed(true);
      later(() => {
        if (!alive) return;
        setClosed(false);
        again();
      }, 150);
    };
    const schedule = () => {
      later(() => {
        if (!alive) return;
        blinkOnce(() => {
          if (!alive) return;
          // An occasional double blink, like a real face.
          if (Math.random() < 0.14) later(() => alive && blinkOnce(schedule), 230);
          else schedule();
        });
      }, 2300 + Math.random() * 3300);
    };
    schedule();
    return () => {
      alive = false;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);
  return closed;
}

/** Mouth openness 0..1 — a speech rhythm while speaking, shut at rest. */
function useMouthOpen(speaking: boolean): number {
  const [open, setOpen] = useState(0);
  useEffect(() => {
    if (!speaking) {
      setOpen(0);
      return;
    }
    if (prefersReducedMotion()) {
      setOpen(0.55);
      return;
    }
    setOpen(0.5);
    const id = window.setInterval(() => {
      // Syllable-like: mostly open shapes, brief closures between words.
      setOpen(Math.random() < 0.16 ? 0.04 : 0.2 + Math.random() * 0.8);
    }, 118);
    return () => window.clearInterval(id);
  }, [speaking]);
  return open;
}

/**
 * How long a face keeps speaking a line of text: a reading-aloud
 * pace (~175 wpm) with a floor so short lines still register and a
 * ceiling so a pasted page doesn't pin the mouth open.
 */
export function speakingMsForText(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.min(9000, Math.max(1300, 700 + words * 340));
}

export function LivingPortrait({
  src,
  features,
  speaking,
  imgClassName,
}: {
  src: string;
  features: FaceFeatures;
  speaking: boolean;
  imgClassName: string;
}) {
  const closed = useBlink();
  const open = useMouthOpen(speaking);
  const lidStyle = (eye: { x: number; y: number }) => ({
    left: `${eye.x - features.eyeW / 2}%`,
    top: `${eye.y - features.eyeH / 2}%`,
    width: `${features.eyeW}%`,
    height: `${features.eyeH}%`,
    background: features.lidBackground,
  });
  return (
    <>
      <img className={imgClassName} src={src} alt="" aria-hidden="true" draggable={false} />
      <span
        aria-hidden="true"
        data-testid="living-lid-left"
        className={`living-face__lid${closed ? " is-closed" : ""}`}
        style={lidStyle(features.leftEye)}
      />
      <span
        aria-hidden="true"
        data-testid="living-lid-right"
        className={`living-face__lid${closed ? " is-closed" : ""}`}
        style={lidStyle(features.rightEye)}
      />
      <span
        aria-hidden="true"
        data-testid="living-mouth"
        className="living-face__mouth"
        style={{
          left: `${features.mouth.x - features.mouthW / 2}%`,
          top: `${features.mouth.y - features.mouthH / 2}%`,
          width: `${features.mouthW}%`,
          height: `${features.mouthH}%`,
          background: features.mouthBackground,
          transform: `scaleY(${open.toFixed(3)})`,
          opacity: open <= 0.01 ? 0 : 1,
        }}
      />
    </>
  );
}
