/**
 * GOD MOTION — THE SHARED RIG, EACH GOD'S OWN MOVEMENT (owner
 * orders 2026-11-24 ~11:27–11:31 EST, the gods-on-the-sides round).
 *
 * His ruling, in two parts that only sound opposed:
 * - "I don't want that animation built into everybody like you
 *   said" — no god moves as a copy-paste of another; each god's
 *   movement, idle and talking, is HIS OWN.
 * - "If it takes the same animation value as you have Osiris ...
 *   then do that" — Osiris's animation values ARE the approved
 *   foundation: the rig every god's motion is built on.
 *
 * So: ONE RIG (PRESENCE_RIG below — the blink cadence, lid phases,
 * gaze steps, and speech rhythm that LivingPortrait has run since
 * the living-faces order of 2026-11-22, tuned against the mirror
 * presence's own clips, Osiris's face), and ONE PROFILE PER GOD
 * that bends the rig into his character: how heavy his lids are,
 * how his eyes travel when he looks around, how fast his words
 * come. The rig is shared; the personality is not.
 *
 * ANUBIS'S BLINK, REBUILT (the defect he named in the same call:
 * "when he blinks his eyes don't look right — at all"): the old
 * blink was one flat gold ellipse snapping down over the eye in
 * 80ms and back in 150ms — a coin over the eye, not a lid. The
 * rebuilt blink runs in PHASES on this rig: the upper lid sweeps
 * down (fitted to the jackal eye's almond slant, per-face in
 * LivingPortrait's feature map), HOLDS shut for a breath, and
 * opens slower than it closed — and the lower lid rises to meet
 * it, the way a real eye closes. Anubis's phases are the
 * weightiest on the stage: a slow, regal blink. Montu's are the
 * sharpest: a falcon's quick lid. Same rig, opposite tempers.
 *
 * Plain data + timing math, no rendering — unit-testable per the
 * repo's avatar rules. LivingPortrait.tsx is the renderer.
 */

/** A gaze target in unit space: (0,0) is straight ahead; ±1 is the
 *  profile's full travel on that axis. Scaled by travelPct when
 *  rendered, so a profile can never push an eye off its socket. */
export interface GazePoint {
  x: number;
  y: number;
}

export interface GodMotionProfile {
  /** The god this character belongs to ("default" = the rig itself). */
  id: string;
  /* --- the blink (phases on the shared rig) --- */
  /** Multiplier on the rig's between-blinks interval. */
  blinkIntervalScale: number;
  /** Upper lid sweep-down time, ms. */
  lidCloseMs: number;
  /** Fully-shut hold, ms — the breath at the bottom of the blink. */
  lidHoldMs: number;
  /** Upper lid rise time, ms — a real blink opens slower than it closes. */
  lidOpenMs: number;
  /** How far the lower lid rises to meet the upper, as a fraction
   *  of the eye's height (0 = the old top-lid-only blink). */
  lowerLidRise: number;
  /* --- the gaze (idle life — the side gods look around) --- */
  /** How long a look holds before the eyes travel again, ms range. */
  gazeHoldMinMs: number;
  gazeHoldRangeMs: number;
  /** How long the eyes take to travel to the next look, ms. */
  gazeTransitionMs: number;
  /** Full-travel distance, percent of the face's width. */
  gazeTravelPct: number;
  /** The waypoints his eyes cycle through, in unit space. The
   *  pattern is his signature: where he looks, in what order. */
  gazePattern: readonly GazePoint[];
  /* --- the speech rhythm (his talking motion) --- */
  /** Ms per syllable tick of the mouth rhythm. */
  talkTickMs: number;
  /** Syllables per phrase burst: [min, range]. */
  talkBurstMin: number;
  talkBurstRange: number;
  /** Near-shut ticks between phrases: [min, range]. */
  talkPauseMin: number;
  talkPauseRange: number;
  /** Chance a tick inside a burst is a word-gap closure. */
  talkWordGapChance: number;
  /** Multiplier on his feature map's jaw travel while he speaks. */
  jawScale: number;
}

/**
 * THE SHARED RIG — Osiris's values, the approved foundation. These
 * are the numbers LivingPortrait ran on before profiles existed
 * (blink every 2.3–5.6s, an occasional double blink, the speech
 * rhythm in ~105ms syllable ticks) — the cadence set against the
 * mirror presence's clips when the faces first came alive.
 */
export const PRESENCE_RIG = {
  blinkMinMs: 2300,
  blinkRangeMs: 3300,
  doubleBlinkChance: 0.14,
  lidCloseMs: 80,
  lidHoldMs: 150,
  lidOpenMs: 150,
  talkTickMs: 105,
} as const;

/**
 * THE DEFAULT PROFILE — the rig unbent. The Black Hatter (the
 * Captain's own face) and any face without a god profile run on
 * this: his blink was measured and eye-checked as his own, and it
 * does not change in this round.
 */
export const DEFAULT_MOTION_PROFILE: GodMotionProfile = {
  id: "default",
  blinkIntervalScale: 1,
  lidCloseMs: PRESENCE_RIG.lidCloseMs,
  lidHoldMs: PRESENCE_RIG.lidHoldMs,
  lidOpenMs: PRESENCE_RIG.lidOpenMs,
  lowerLidRise: 0,
  gazeHoldMinMs: 2000,
  gazeHoldRangeMs: 2400,
  gazeTransitionMs: 520,
  gazeTravelPct: 0,
  gazePattern: [{ x: 0, y: 0 }],
  talkTickMs: PRESENCE_RIG.talkTickMs,
  talkBurstMin: 3,
  talkBurstRange: 5,
  talkPauseMin: 2,
  talkPauseRange: 4,
  talkWordGapChance: 0.12,
  jawScale: 1,
};

/**
 * ANUBIS — the commander. Everything about his motion is WEIGHT:
 * the slowest blink on the stage (long interval, a lid that comes
 * down like a gate and rises slower still, the lower lid rising
 * to meet it), a gaze that moves rarely and deliberately — long
 * holds, slow travel, looking DOWN the room and back to center
 * like a judge surveying it — and a measured speech: longer
 * phrases, unhurried ticks, the biggest jaw travel of any god
 * (his muzzle works when he speaks).
 */
export const ANUBIS_MOTION_PROFILE: GodMotionProfile = {
  id: "anubis",
  blinkIntervalScale: 1.35,
  lidCloseMs: 120,
  lidHoldMs: 60,
  lidOpenMs: 300,
  lowerLidRise: 0.24,
  gazeHoldMinMs: 3400,
  gazeHoldRangeMs: 3400,
  gazeTransitionMs: 780,
  gazeTravelPct: 0.95,
  gazePattern: [
    { x: 0, y: 0 },
    { x: -0.8, y: 0.15 },
    { x: 0, y: 0 },
    { x: 0.8, y: 0.15 },
    { x: 0, y: 0 },
    { x: 0, y: 0.55 },
    { x: 0, y: 0 },
  ],
  talkTickMs: 128,
  talkBurstMin: 4,
  talkBurstRange: 5,
  talkPauseMin: 3,
  talkPauseRange: 4,
  talkWordGapChance: 0.1,
  jawScale: 1,
};

/**
 * MONTU — the falcon. Everything about his motion is SPEED: the
 * sharpest blink on the stage (a quick lid, barely a hold, open
 * again), a gaze that DARTS — short holds, fast travel, the
 * widest range, checking the corners of the room like a bird of
 * prey on watch — and clipped speech: short bursts, quick ticks,
 * and a beak that hinges rather than drops (his jaw scale is
 * small; his feature map's travel is a third of Anubis's to
 * begin with).
 */
export const MONTU_MOTION_PROFILE: GodMotionProfile = {
  id: "montu",
  blinkIntervalScale: 0.7,
  lidCloseMs: 60,
  lidHoldMs: 30,
  lidOpenMs: 140,
  lowerLidRise: 0.3,
  gazeHoldMinMs: 900,
  gazeHoldRangeMs: 1400,
  gazeTransitionMs: 240,
  gazeTravelPct: 1.3,
  gazePattern: [
    { x: 0, y: 0 },
    { x: 1, y: -0.2 },
    { x: 0.3, y: 0.1 },
    { x: -1, y: -0.2 },
    { x: 0, y: 0 },
    { x: -0.5, y: -0.45 },
    { x: 0.6, y: 0.2 },
    { x: 0, y: 0 },
  ],
  talkTickMs: 88,
  talkBurstMin: 2,
  talkBurstRange: 4,
  talkPauseMin: 2,
  talkPauseRange: 3,
  talkWordGapChance: 0.16,
  jawScale: 0.8,
};

/** The motion profile a god's face runs on. */
export const GOD_MOTION_PROFILES: Readonly<Record<string, GodMotionProfile>> = {
  anubis: ANUBIS_MOTION_PROFILE,
  montu: MONTU_MOTION_PROFILE,
};

export function motionProfileFor(god: string): GodMotionProfile {
  return GOD_MOTION_PROFILES[god] ?? DEFAULT_MOTION_PROFILE;
}

/** The between-blinks interval for a profile, rig-scaled: a
 *  random draw in [min, min+range] × the profile's scale. */
export function blinkIntervalMs(profile: GodMotionProfile, random: number): number {
  const draw = Math.min(1, Math.max(0, random));
  return (PRESENCE_RIG.blinkMinMs + draw * PRESENCE_RIG.blinkRangeMs) * profile.blinkIntervalScale;
}

/** One full blink's travel time under a profile: down, hold, up. */
export function blinkCycleMs(profile: GodMotionProfile): number {
  return profile.lidCloseMs + profile.lidHoldMs + profile.lidOpenMs;
}

/** The gaze target at a step of the god's pattern, in percent of
 *  face width — the pattern point scaled by his travel. */
export function gazeOffsetForStep(profile: GodMotionProfile, step: number): { x: number; y: number } {
  const pattern = profile.gazePattern;
  if (pattern.length === 0) return { x: 0, y: 0 };
  const point = pattern[Math.abs(step) % pattern.length]!;
  return { x: point.x * profile.gazeTravelPct, y: point.y * profile.gazeTravelPct };
}

/** How long a look holds at a step: a random draw in the
 *  profile's hold range. */
export function gazeHoldMs(profile: GodMotionProfile, random: number): number {
  const draw = Math.min(1, Math.max(0, random));
  return profile.gazeHoldMinMs + draw * profile.gazeHoldRangeMs;
}
