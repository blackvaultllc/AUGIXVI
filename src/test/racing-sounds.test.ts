import { describe, expect, it } from "vitest";
import { racingMuted, setRacingMuted, SOUND_NOTES } from "@/avatar/learner/racing/sounds";

/** PART 16 (sounds) — the note plans are kind (rising for right,
 * falling for wrong, a fanfare for the finish), and the mute switch
 * sticks. Kids' rules: soft and short — every note under 0.2s. */
describe("racing sounds", () => {
  it("right rises, wrong falls, finish climbs", () => {
    const up = SOUND_NOTES["speed-up"].map((n) => n.freq);
    const down = SOUND_NOTES["slow-down"].map((n) => n.freq);
    const fin = SOUND_NOTES["finish"].map((n) => n.freq);
    expect(up[up.length - 1]!).toBeGreaterThan(up[0]!);
    expect(down[down.length - 1]!).toBeLessThan(down[0]!);
    expect(fin[fin.length - 1]!).toBeGreaterThan(fin[0]!);
    for (const notes of Object.values(SOUND_NOTES)) {
      for (const n of notes) expect(n.dur).toBeLessThanOrEqual(0.2);
    }
  });

  it("the mute switch persists", () => {
    setRacingMuted(true);
    expect(racingMuted()).toBe(true);
    setRacingMuted(false);
    expect(racingMuted()).toBe(false);
  });
});
