/**
 * WORLD OF LOGIC — ported from the VoiceWave Command Deck
 * (blackvaultllc/voicewave-command-deck @ 7653d36, src/lib/crew-levels.ts).
 * The level curve the Captain's battle record climbs — the functions
 * battles.ts imports, verbatim. The curve is deliberately slow: the XP
 * to climb from level L to L+1 is 20*L.
 */
export const MAX_EMPLOYEE_LEVEL = 100;

/** XP to climb from level L to L+1. Slow on purpose: 1→2 needs
 * 20, 99→100 needs 1,980. */
export function xpForNextLevel(level: number): number {
  return 20 * Math.max(1, level);
}

/** Total XP to reach a level from LV 1. LV 100 needs 99,000. */
export function xpToReachLevel(level: number): number {
  const l = Math.max(1, Math.min(MAX_EMPLOYEE_LEVEL, level));
  return 10 * l * (l - 1);
}

/** The level an XP total buys — capped at 100, never below 1. */
export function levelForXp(xp: number): number {
  const total = Math.max(0, Math.floor(xp));
  let level = 1;
  while (level < MAX_EMPLOYEE_LEVEL && total >= xpToReachLevel(level + 1)) {
    level += 1;
  }
  return level;
}
