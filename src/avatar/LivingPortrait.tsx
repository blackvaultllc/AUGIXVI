import { useEffect, useState } from "react";
import { lidGradientFromSamples, lidSamplePoints, type Rgb } from "./lidColor";

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
 * on the shipped files, 2026-11-22; RE-MEASURED the same day after
 * the Captain's verdict "blackhatter eyes look weird when blinking"
 * — the first map sat high and wide on his eyes, so the lids swept
 * over his brow ridge instead of his eyes):
 *
 * CAPTAIN (captain-infinity.webp, bounding boxes in percent): his
 * eyes span x 39.3–46.7 / 53.7–60.8, y 37.6–40.8 — centers
 * (43.0, 39.2) and (57.3, 39.2), openings ≈7.4×3.2. His mouth spans
 * x 43.8–56.2, y 51.2–56.6 — center (50.0, 53.9). The lid colors
 * are sampled from the portrait's own skin around the eyes (brow
 * #473830, lid line #322a2a, cheek #2e1b14, lit side #6e5b55) — the
 * first map's lighter reddish lid read as a foreign patch sliding
 * over his face.
 *
 * ANUBIS (face.webp): his eyes span x 39.0–45.5 / 54.3–61.0,
 * y 37.3–42.0 — centers (42.3, 39.6) and (57.7, 39.8), openings
 * ≈6.6×4.5. His mouth spans x 46.3–53.8, y 56.5–59.8 — center
 * (50.1, 58.2). His centers were true; his lids were HALF AGAIN
 * wider than his eyes (9.5 against a 6.6 opening), painting gold
 * over the engraved cheek lines beside them — narrowed to the eye.
 * Lid gold is sampled from the fur around the eyes (#a0752f /
 * #a87a3d), not the muzzle's bright highlight.
 *
 * MONTU (face.webp): the falcon's eyes at (43.7, 40.5) /
 * (56.3, 40.5), his mouth at the beak's seam (50.0, 46.8).
 *
 * The lid COLOR is not part of the map's authority: on top of the
 * hand-sampled tones recorded in each map, the lid is re-sampled
 * from each portrait itself at runtime (lidColor.ts), at points
 * derived FROM this map — so a face blinks in its own colors and a
 * corrected map corrects the colors with it. The gradients
 * recorded here are the pre-sample first paint and the fallback.
 */
export const ANUBIS_FEATURES: FaceFeatures = {
  leftEye: { x: 42.3, y: 39.6 },
  rightEye: { x: 57.7, y: 39.8 },
  eyeW: 7.4,
  eyeH: 4.8,
  mouth: { x: 50.1, y: 58.2 },
  mouthW: 7.5,
  mouthH: 3.0,
  lidBackground:
    "radial-gradient(ellipse at 50% 35%, #c49a48 0%, #a0752f 70%, #7c5a24 100%)",
  mouthBackground: "radial-gradient(ellipse at 50% 50%, #3a2a08 0%, #241a04 100%)",
};

export const BLACK_HATTER_FEATURES: FaceFeatures = {
  leftEye: { x: 43.0, y: 39.2 },
  rightEye: { x: 57.3, y: 39.2 },
  eyeW: 8.2,
  eyeH: 3.8,
  mouth: { x: 50.0, y: 53.9 },
  mouthW: 12.0,
  mouthH: 3.4,
  lidBackground:
    "radial-gradient(ellipse at 50% 35%, #54423a 0%, #3a2a21 60%, #271b13 100%)",
  mouthBackground: "radial-gradient(ellipse at 50% 50%, #33150c 0%, #1c0b06 100%)",
};

/**
 * Montu's map, measured on his shipped portrait the same way
 * (visual grounding on public/montu-presence/face.webp,
 * 2026-11-22): the falcon's amber eyes sit at (43.7, 40.5) /
 * (56.3, 40.5); his mouth is the beak's seam, centered (50.0,
 * 46.8) between the beak's base and its tip (49.8). His authored
 * lid gradient is the fallback — the dark blue-black feather
 * around his eyes; the sampled gradient (below) is what he
 * actually blinks with once his own portrait has been read.
 */
export const MONTU_FEATURES: FaceFeatures = {
  leftEye: { x: 43.7, y: 40.5 },
  rightEye: { x: 56.3, y: 40.5 },
  eyeW: 7.4,
  eyeH: 3.9,
  mouth: { x: 50.0, y: 46.8 },
  mouthW: 5.2,
  mouthH: 2.0,
  lidBackground:
    "radial-gradient(ellipse at 50% 35%, #2c3850 0%, #161d2e 70%, #0a0e18 100%)",
  mouthBackground: "radial-gradient(ellipse at 50% 50%, #14100a 0%, #070503 100%)",
};

/**
 * THE LID WEARS THE FACE'S OWN COLORS (owner order 2026-11-22):
 * once the portrait loads, sample the pixels of its own lid
 * territory (lidColor.ts — the strip above each eye and the eye's
 * corners, placed from this face's feature map) and build the
 * lid's gradient from them. Each face blinks in its own colors
 * because each gradient is read off its own artwork. Any failure —
 * an unreadable image, a blocked canvas — leaves the authored
 * gradient standing; the blink never waits on the sampling.
 */
function useSampledLidBackground(src: string, features: FaceFeatures): string | null {
  const [sampled, setSampled] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const image = new Image();
    image.onload = () => {
      if (!alive) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context || canvas.width === 0 || canvas.height === 0) return;
        context.drawImage(image, 0, 0);
        const samples: Rgb[] = [];
        for (const point of lidSamplePoints(features)) {
          const px = Math.min(
            canvas.width - 1,
            Math.max(0, Math.round((point.x / 100) * canvas.width)),
          );
          const py = Math.min(
            canvas.height - 1,
            Math.max(0, Math.round((point.y / 100) * canvas.height)),
          );
          const data = context.getImageData(px, py, 1, 1).data;
          samples.push({ r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0 });
        }
        const gradient = lidGradientFromSamples(samples);
        if (alive && gradient) setSampled(gradient);
      } catch {
        // The authored gradient stands — sampling is an enhancement,
        // never a dependency of the blink.
      }
    };
    image.src = src;
    return () => {
      alive = false;
    };
  }, [src, features]);
  return sampled;
}

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
  const sampledLid = useSampledLidBackground(src, features);
  const lidStyle = (eye: { x: number; y: number }) => ({
    left: `${eye.x - features.eyeW / 2}%`,
    top: `${eye.y - features.eyeH / 2}%`,
    width: `${features.eyeW}%`,
    height: `${features.eyeH}%`,
    background: sampledLid ?? features.lidBackground,
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
