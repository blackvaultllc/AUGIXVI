import { useEffect, useState, type CSSProperties } from "react";
import {
  averageRgb,
  lidGradientFromSamples,
  lidSamplePoints,
  rgbCss,
  shadeRgb,
  type Rgb,
} from "./lidColor";
import {
  DEFAULT_MOTION_PROFILE,
  PRESENCE_RIG,
  blinkIntervalMs,
  gazeHoldMs,
  gazeOffsetForStep,
  type GodMotionProfile,
} from "./godMotion";

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
 *
 * LIVING PARITY (owner orders 2026-11-23 — "just like you… all
 * those functionalities, all of them"; the investor standard the
 * same morning: when the AI speaks it must LOOK like it's
 * talking): the generated-clip route was tried first, twice, on
 * Anubis's real portrait — an idle clip and a talking clip per
 * attempt, the second attempt under a cinemagraph prompt ordering
 * everything but the eyelids/mouth frozen. It cannot hold his
 * face: measured against the shipped portrait, the talking
 * frames' eye region collapsed (the model's eyes change color
 * and shape, the gold nose goes black, ornaments the portrait
 * does not carry appear on the ring). A regenerated face is a
 * DIFFERENT face, and his law is that the medallion is Khadija's
 * chosen portrait, unchanged — so no generated clip ships for
 * any god. What ships instead is this treatment, strengthened:
 *
 *   THE JAW — a second copy of the SAME portrait, feather-masked
 *   to the jaw zone under the mouth, that drops and hinges on
 *   the speech rhythm while the face speaks. Every pixel of it
 *   is his own artwork, so the face cannot drift, shimmer, or
 *   become someone else; the chin visibly works like a jaw
 *   instead of a dark ellipse pasted over a still muzzle.
 *   THE MOUTH — the interior is painted from the portrait's own
 *   mouth-shadow pixels, sampled at runtime like the lids are,
 *   deepened — his own shadow, opened.
 *   THE RHYTHM — the mouth no longer jitters at random: it runs
 *   in phrases (bursts of syllables, brief word-gap closures,
 *   a pause between phrases), the shape of actual speech.
 *
 * Osiris needs none of this: his panel presence already runs
 * real animated clips whose mouth moves (presenceState.ts).
 *
 * THE GODS-ON-THE-SIDES ROUND (owner orders 2026-11-24): three
 * deepenings, all on the shared rig in godMotion.ts — Osiris's
 * animation values as the approved foundation, each god's
 * motion his own on top of it. (1) THE BLINK RUNS IN PHASES:
 * sweep down, hold, rise slower — with a LOWER LID rising to
 * meet the upper, and per-face lid fitting (tilt + radius in
 * the feature map). This is the rebuild of Anubis's blink,
 * which he judged wrong "at all": the old blink was one flat
 * ellipse at one speed both ways. (2) THE GAZE: at rest a
 * god's eyes travel his own pattern — the eye's own pixels
 * sliding inside a fixed feathered window over the eye.
 * (3) THE SPEECH TEMPO is per-god: Anubis measured, Montu
 * clipped. The Captain's own face (the Black Hatter) runs the
 * default profile — the rig exactly as he was eye-checked
 * with, no gaze, no lower lid.
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
  /**
   * THE JAW ZONE (living parity, 2026-11-23): the feathered
   * ellipse of the portrait's own pixels — centered at
   * (mouth.x, jawY), jawW × jawH percent of the face — that
   * drops by up to jawDrop percent of the face height while
   * the face speaks. Sized per face: a muzzle and a chin get
   * a real zone; a beak gets a whisper of one.
   */
  jawW: number;
  jawH: number;
  jawY: number;
  jawDrop: number;
  /**
   * LID FITTING (owner defect 2026-11-24 — "when he blinks his
   * eyes don't look right"): a generic round lid reads as a coin
   * slapped over the eye. A face whose eyes have a slant carries
   * it here — degrees each lid rotates (mirrored by the map: the
   * left lid takes `left`, the right takes `right`) — and a face
   * whose eye shape is not a plain ellipse carries its
   * border-radius here. Faces without a fitting keep the round
   * lid they were eye-checked with.
   */
  lidTilt?: { left: number; right: number };
  lidRadius?: string;
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
 * JAW ZONES (2026-11-23, from the same maps): Anubis's jaw zone
 * covers the lower muzzle and chin (center y 60.6, 17×10) and
 * fades into the dark neck fur below; the Captain's covers his
 * chin and jaw (center y 57.0, 21×11); Montu's is the lower beak
 * only (center y 48.8, 9×5) with a third of the travel — a beak
 * hinges, it does not drop like a jaw.
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
  jawW: 17,
  jawH: 10,
  jawY: 60.6,
  jawDrop: 0.85,
  /* LID FITTING (2026-11-24): the jackal's eyes are almonds,
     angled — inner corners a shade lower than the outer — and
     flatter across the top than a plain ellipse. His lids carry
     that slant and that flatter crown, so a blink sweeps along
     HIS eye instead of dropping a round coin over it. */
  lidTilt: { left: 3, right: -3 },
  lidRadius: "50% 50% 50% 50% / 68% 68% 32% 32%",
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
  jawW: 21,
  jawH: 11,
  jawY: 57.0,
  jawDrop: 0.75,
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
  jawW: 9,
  jawH: 5,
  jawY: 48.8,
  jawDrop: 0.35,
};

/**
 * Sample a face's own pixels at percent-space points — the one
 * canvas routine behind both the lid tones and the mouth's
 * interior (below). Any failure — an unreadable image, a blocked
 * canvas — resolves to null and the authored gradient stands;
 * the face never waits on the sampling.
 */
function usePortraitSamples(
  src: string,
  points: readonly { x: number; y: number }[],
): Rgb[] | null {
  const [samples, setSamples] = useState<Rgb[] | null>(null);
  const key = points.map((point) => `${point.x},${point.y}`).join(";");
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
        const read: Rgb[] = [];
        for (const point of points) {
          const px = Math.min(
            canvas.width - 1,
            Math.max(0, Math.round((point.x / 100) * canvas.width)),
          );
          const py = Math.min(
            canvas.height - 1,
            Math.max(0, Math.round((point.y / 100) * canvas.height)),
          );
          const data = context.getImageData(px, py, 1, 1).data;
          read.push({ r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0 });
        }
        if (alive && read.length > 0) setSamples(read);
      } catch {
        // The authored gradients stand — sampling is an
        // enhancement, never a dependency of the face.
      }
    };
    image.src = src;
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, key]);
  return samples;
}

/** Percent-space points inside the mouth's own shadow. */
function mouthSamplePoints(features: FaceFeatures): { x: number; y: number }[] {
  const y = features.mouth.y + features.mouthH * 0.3;
  return [
    { x: features.mouth.x - features.mouthW * 0.3, y },
    { x: features.mouth.x, y },
    { x: features.mouth.x + features.mouthW * 0.3, y },
  ];
}

/**
 * The mouth's interior from its own sampled shadow, deepened —
 * the portrait's mouth-shadow tones taken down toward the dark
 * of an open mouth, in the authored gradients' shape.
 */
function mouthGradientFromSamples(samples: readonly Rgb[]): string | null {
  if (samples.length === 0) return null;
  const base = averageRgb(samples);
  const deep = shadeRgb(base, 0.45);
  const core = shadeRgb(base, 0.2);
  return `radial-gradient(ellipse at 50% 50%, ${rgbCss(core)} 0%, ${rgbCss(deep)} 100%)`;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * THE BLINK, IN PHASES (rebuilt 2026-11-24 on the shared rig —
 * godMotion.ts): a blink is not a lid snapping shut and back.
 * The upper lid sweeps DOWN (the profile's lidCloseMs), HOLDS
 * shut for a breath (lidHoldMs), and RISES slower than it fell
 * (lidOpenMs) — and while it travels, the lower lid rises to
 * meet it (the profile's lowerLidRise), the way a real eye
 * closes. The old blink was one flat ellipse at one speed both
 * ways, and on Anubis's jackal eyes it read wrong — "when he
 * blinks his eyes don't look right — at all." The phases are
 * the rig; how heavy they run is the god's own profile:
 * Anubis's gate-slow blink and Montu's falcon-quick one are the
 * same machinery at opposite tempers. The returned phase drives
 * both lids' targets and their per-phase transition durations,
 * so what the tests (and his eye) see is the lid's true travel.
 */
export type BlinkPhase = "open" | "closing" | "closed" | "opening";

function useBlinkPhase(profile: GodMotionProfile): BlinkPhase {
  const [phase, setPhase] = useState<BlinkPhase>("open");
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let alive = true;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };
    const blinkOnce = (again: () => void) => {
      setPhase("closing");
      later(() => {
        if (!alive) return;
        setPhase("closed");
        later(() => {
          if (!alive) return;
          setPhase("opening");
          later(() => {
            if (!alive) return;
            setPhase("open");
            again();
          }, profile.lidOpenMs);
        }, profile.lidHoldMs);
      }, profile.lidCloseMs);
    };
    const schedule = () => {
      later(() => {
        if (!alive) return;
        blinkOnce(() => {
          if (!alive) return;
          // An occasional double blink, like a real face.
          if (Math.random() < PRESENCE_RIG.doubleBlinkChance) {
            later(() => alive && blinkOnce(schedule), 230);
          } else schedule();
        });
      }, blinkIntervalMs(profile, Math.random()));
    };
    schedule();
    return () => {
      alive = false;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [profile]);
  return phase;
}

/**
 * THE GAZE (owner order 2026-11-24 — idle life: "there might be
 * looking around how Osiris is looking"): a resting face's eyes
 * TRAVEL — hold a look, move to the next, hold again — through
 * the waypoints of his own pattern (godMotion.ts). The offset is
 * in percent of the face's width, rendered by sliding the eye's
 * own pixels inside a fixed feathered window over the eye (the
 * gaze layer in the component below): the eye moves in its
 * socket; the face never moves — the circle does not move, per
 * his standing law. Still under reduced motion, and still for a
 * face whose profile carries no travel (the Captain's own face
 * keeps the stillness he was eye-checked with).
 */
function useGaze(profile: GodMotionProfile): { x: number; y: number } {
  const [step, setStep] = useState(0);
  const travels = profile.gazeTravelPct > 0 && profile.gazePattern.length > 1;
  useEffect(() => {
    if (!travels || prefersReducedMotion()) return;
    let alive = true;
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(() => {
        if (!alive) return;
        setStep((current) => current + 1);
        next();
      }, gazeHoldMs(profile, Math.random()));
    };
    next();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [profile, travels]);
  if (!travels) return { x: 0, y: 0 };
  return gazeOffsetForStep(profile, step);
}

/**
 * Mouth openness 0..1 — while speaking, a PHRASE rhythm (living
 * parity, 2026-11-23): bursts of syllable shapes with brief
 * word-gap closures inside the burst and a near-shut pause
 * between phrases — the envelope of actual speech, not a random
 * jitter. Shut at rest; a steady half-open under reduced motion.
 * The rhythm's TEMPO is the god's own (godMotion.ts): Anubis's
 * phrases run long and unhurried, Montu's clipped and quick —
 * the same speech machinery, each god's own talking motion.
 */
function useMouthOpen(speaking: boolean, profile: GodMotionProfile): number {
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
    setOpen(0.55);
    const rollBurst = () =>
      profile.talkBurstMin + Math.floor(Math.random() * (profile.talkBurstRange + 1));
    const rollPause = () =>
      profile.talkPauseMin + Math.floor(Math.random() * (profile.talkPauseRange + 1));
    let burst = rollBurst();
    let pause = 0;
    const id = window.setInterval(() => {
      if (pause > 0) {
        pause -= 1;
        setOpen(0.04);
        return;
      }
      if (burst <= 0) {
        pause = rollPause();
        burst = rollBurst();
        setOpen(0.04);
        return;
      }
      burst -= 1;
      // A word-gap closure inside the phrase, else a syllable.
      setOpen(Math.random() < profile.talkWordGapChance ? 0.05 : 0.25 + Math.random() * 0.75);
    }, profile.talkTickMs);
    return () => window.clearInterval(id);
  }, [speaking, profile]);
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

/**
 * THE CIRCLE DOES NOT MOVE (owner eye-check 2026-11-23): an
 * earlier idle-life order put a slow sway, a breathing scale, and
 * a look-around turn on the face's wrapper — he rejected it from
 * his screen: "Why is the whole circle moving? It shouldn't be
 * rocking." The wrapper is a STATIC positioning layer now. Motion
 * lives INSIDE the portrait only: the lids (blink), the jaw (a
 * masked copy of the portrait itself, dropped on the speech
 * rhythm), and the mouth — each painted in its own layer over
 * the still portrait, on the measured feature map, so a blink
 * can never drift off the eyes it covers and the jaw can never
 * carry the face somewhere it is not.
 */
export function LivingPortrait({
  src,
  features,
  speaking,
  imgClassName,
  motion = DEFAULT_MOTION_PROFILE,
}: {
  src: string;
  features: FaceFeatures;
  speaking: boolean;
  imgClassName: string;
  /**
   * THE GOD'S OWN MOTION (2026-11-24 — godMotion.ts): the shared
   * rig bent into his character — his blink's weight, his gaze's
   * pattern, his speech's tempo. Faces without a god profile
   * (the Black Hatter) run the default: the rig as it was
   * eye-checked, no gaze travel, no lower lid.
   */
  motion?: GodMotionProfile;
}) {
  const phase = useBlinkPhase(motion);
  const gaze = useGaze(motion);
  const open = useMouthOpen(speaking, motion);
  const lidSamples = usePortraitSamples(src, lidSamplePoints(features));
  const sampledLid = lidSamples ? lidGradientFromSamples(lidSamples) : null;
  const mouthSamples = usePortraitSamples(src, mouthSamplePoints(features));
  const sampledMouth = mouthSamples ? mouthGradientFromSamples(mouthSamples) : null;
  // The lids' travel: shut through the closing and closed phases,
  // open through the opening and open phases — with each phase's
  // own duration on the transition, so the sweep down and the
  // rise back run at the profile's two different speeds.
  const lidsShut = phase === "closing" || phase === "closed";
  const lidMs = phase === "closing" ? motion.lidCloseMs : motion.lidOpenMs;
  const lidTiming = phase === "closing" ? "ease-in" : "ease-out";
  const lidStyle = (eye: { x: number; y: number }, tilt: number | undefined) =>
    ({
      left: `${eye.x - features.eyeW / 2}%`,
      top: `${eye.y - features.eyeH / 2}%`,
      width: `${features.eyeW}%`,
      height: `${features.eyeH}%`,
      background: sampledLid ?? features.lidBackground,
      borderRadius: features.lidRadius,
      transform: `rotate(${tilt ?? 0}deg) scaleY(${lidsShut ? 1 : 0})`,
      transitionDuration: `${lidMs}ms`,
      transitionTimingFunction: lidTiming,
    }) as CSSProperties;
  const lowerLidStyle = (eye: { x: number; y: number }, tilt: number | undefined) =>
    ({
      left: `${eye.x - features.eyeW / 2}%`,
      top: `${eye.y - features.eyeH / 2}%`,
      width: `${features.eyeW}%`,
      height: `${features.eyeH}%`,
      background: sampledLid ?? features.lidBackground,
      borderRadius: features.lidRadius,
      transform: `rotate(${tilt ?? 0}deg) scaleY(${lidsShut ? motion.lowerLidRise : 0})`,
      transitionDuration: `${lidMs}ms`,
      transitionTimingFunction: lidTiming,
    }) as CSSProperties;
  // THE GAZE WINDOW: a fixed feathered window over each eye; the
  // portrait copy inside it slides by the gaze offset, so the eye
  // moves in its socket while the window — and the face — stay.
  const gazeWindowStyle = (eye: { x: number; y: number }) =>
    ({
      "--gaze-mask": `radial-gradient(ellipse ${features.eyeW * 1.6}% ${features.eyeH * 2.1}% at ${eye.x}% ${eye.y}%, rgb(0 0 0 / 100%) 52%, rgb(0 0 0 / 0%) 78%)`,
    }) as CSSProperties;
  const gazeSlideStyle = {
    transform: `translate(${gaze.x.toFixed(3)}%, ${gaze.y.toFixed(3)}%)`,
    transitionDuration: `${motion.gazeTransitionMs}ms`,
  } as CSSProperties;
  const jawMask = `radial-gradient(ellipse ${features.jawW}% ${features.jawH}% at ${features.mouth.x}% ${features.jawY}%, rgb(0 0 0 / 100%) 52%, rgb(0 0 0 / 0%) 76%)`;
  const jawDrop = features.jawDrop * motion.jawScale;
  return (
    <span className="living-face" data-testid="living-face">
      <img
        className={`${imgClassName} living-face__portrait`}
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      {/* THE JAW (living parity, 2026-11-23): the portrait's OWN
          pixels in the jaw zone, feather-masked, hinged down on
          the speech rhythm while the face speaks — at rest the
          copy sits exactly on the portrait and is invisible. */}
      <img
        aria-hidden="true"
        data-testid="living-jaw"
        className="living-face__jaw"
        src={src}
        alt=""
        draggable={false}
        style={
          {
            "--jaw-mask": jawMask,
            transform: `translateY(${(open * jawDrop).toFixed(3)}%) scaleY(${(
              1 +
              open * 0.015
            ).toFixed(4)})`,
            transformOrigin: `${features.mouth.x}% ${features.mouth.y}%`,
          } as CSSProperties
        }
      />
      {/* THE GAZE (2026-11-24): his own eye pixels sliding inside
          a fixed window over each eye — he looks around at rest.
          Only for a face whose profile carries travel. */}
      {motion.gazeTravelPct > 0 && (
        <>
          <span
            aria-hidden="true"
            data-testid="living-gaze-left"
            className="living-face__gaze"
            style={gazeWindowStyle(features.leftEye)}
          >
            <img
              className="living-face__gaze-img"
              src={src}
              alt=""
              draggable={false}
              style={gazeSlideStyle}
            />
          </span>
          <span
            aria-hidden="true"
            data-testid="living-gaze-right"
            className="living-face__gaze"
            style={gazeWindowStyle(features.rightEye)}
          >
            <img
              className="living-face__gaze-img"
              src={src}
              alt=""
              draggable={false}
              style={gazeSlideStyle}
            />
          </span>
        </>
      )}
      <span
        aria-hidden="true"
        data-testid="living-lid-left"
        className={`living-face__lid${lidsShut ? " is-closed" : ""}`}
        style={lidStyle(features.leftEye, features.lidTilt?.left)}
      />
      <span
        aria-hidden="true"
        data-testid="living-lid-right"
        className={`living-face__lid${lidsShut ? " is-closed" : ""}`}
        style={lidStyle(features.rightEye, features.lidTilt?.right)}
      />
      {/* THE LOWER LID (2026-11-24): rises to meet the upper lid
          as the blink closes — the half of the blink the old flat
          lid never had. Only for a face whose profile carries a
          rise; the Captain's own face keeps his measured blink. */}
      {motion.lowerLidRise > 0 && (
        <>
          <span
            aria-hidden="true"
            data-testid="living-lid-bottom-left"
            className={`living-face__lid living-face__lid--lower${lidsShut ? " is-closed" : ""}`}
            style={lowerLidStyle(features.leftEye, features.lidTilt?.left)}
          />
          <span
            aria-hidden="true"
            data-testid="living-lid-bottom-right"
            className={`living-face__lid living-face__lid--lower${lidsShut ? " is-closed" : ""}`}
            style={lowerLidStyle(features.rightEye, features.lidTilt?.right)}
          />
        </>
      )}
      <span
        aria-hidden="true"
        data-testid="living-mouth"
        className="living-face__mouth"
        style={{
          left: `${features.mouth.x - features.mouthW / 2}%`,
          top: `${features.mouth.y - features.mouthH / 2}%`,
          width: `${features.mouthW}%`,
          height: `${features.mouthH}%`,
          background: sampledMouth ?? features.mouthBackground,
          transform: `scaleY(${open.toFixed(3)})`,
          opacity: open <= 0.01 ? 0 : 1,
        }}
      />
    </span>
  );
}
