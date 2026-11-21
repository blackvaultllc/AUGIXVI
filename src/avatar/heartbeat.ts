/**
 * AUGIE'S HEARTBEAT — the recurring pulse of the rebuilt body on
 * stage (operator order 2026-11-21 follow-up: "when Augie's like
 * heartbeat heartbeat to actually scan Wi-Fi around").
 *
 * The heartbeat chosen is the body's own breath cycle: the body
 * shader in AvatarRenderer breathes at sin(uTime · 1.2), so one full
 * cycle — one heartbeat — is 2π/1.2 ≈ 5.24 seconds of stage time.
 * The renderer emits a beat each time a cycle completes (it pauses
 * when the tab is hidden, exactly like the body does), and consumers
 * pace themselves in beats instead of inventing their own timers —
 * the Wi-Fi presence watch rides this (devices/presence.ts).
 *
 * The runner-up was the idle-life interval (75 s): the codebase's own
 * test calls it "a slow heartbeat", but it is an activity scheduler
 * that sleeps mid-conversation — it is not the body's pulse.
 *
 * Pure math only — no DOM, no three.js — so the beat is unit-testable
 * (src/test/device-heartbeat.test.ts), per the house rule that avatar
 * rules live in plain TS modules.
 */

/** Angular speed of the body shader's breath, radians per second. */
export const BREATH_ANGULAR_SPEED = 1.2;

/** Milliseconds of stage time per heartbeat (one full breath cycle). */
export const HEARTBEAT_PERIOD_MS = ((2 * Math.PI) / BREATH_ANGULAR_SPEED) * 1000;

/**
 * Which breath cycle a stage-clock reading falls in. The renderer
 * compares successive values; when the cycle increments, a heartbeat
 * has fired. Frame-rate independent — it reads the stage clock, not
 * the frame count.
 */
export function breathCycleAt(stageSeconds: number): number {
  if (!(stageSeconds > 0)) return 0;
  return Math.floor((stageSeconds * BREATH_ANGULAR_SPEED) / (2 * Math.PI));
}
