import { describe, expect, it } from "vitest";
import {
  IDLE_INTERVAL_MS,
  idleChalkboardThought,
  idleReportLine,
  pickIdleActivity,
  type IdleActivity,
} from "@/avatar/idleLife";

describe("Osiris's idle life — Ankh means life, not standing at attention", () => {
  it("always picks an activity that moves him — never static attention", () => {
    const statics: IdleActivity[] = [];
    for (let i = 0; i < 200; i += 1) {
      const action = pickIdleActivity(() => i / 200);
      expect(ACTIONS_VALID).toContain(action.activity);
      expect(action.line.length).toBeGreaterThan(5);
      if (action.activity === "breathe") statics.push(action.activity);
    }
    // Breathing is allowed but rare and never the only thing he does.
    expect(statics.length).toBeLessThan(200);
  });

  it("varies the activity — he does not repeat the previous action", () => {
    const first = pickIdleActivity(() => 0.99); // walks with high roll
    const second = pickIdleActivity(() => 0.99, first.activity);
    expect(second.activity).not.toBe(first.activity);
  });

  it("opens windows himself when his idle life calls for study or thinking", () => {
    let foundWindow = false;
    for (let i = 0; i < 400; i += 1) {
      const action = pickIdleActivity(() => (i * 7919) / 40000);
      if (action.window) {
        foundWindow = true;
        expect(["chalkboard", "notepad", "player"]).toContain(action.window);
      }
      if (action.activity === "write-chalkboard") {
        expect(action.chalkboardText).toBeTruthy();
      }
    }
    expect(foundWindow).toBe(true);
  });

  it("writes varied chalkboard thoughts, never invented facts", () => {
    const thoughts = new Set<string>();
    for (let i = 0; i < 50; i += 1) thoughts.add(idleChalkboardThought(() => i / 50));
    expect(thoughts.size).toBeGreaterThan(1);
  });

  it("reports only suggestions and stays silent when nothing is known", () => {
    expect(idleReportLine("check-business", false)).toBeNull();
    expect(idleReportLine("check-business", true)).toMatch(/Report:/i);
    expect(idleReportLine("check-sub-ais", true)).toMatch(/Report:/i);
    expect(idleReportLine("walk", true)).toBeNull();
  });

  it("idles on a slow heartbeat, not a rapid loop", () => {
    expect(IDLE_INTERVAL_MS).toBeGreaterThanOrEqual(30_000);
  });
});

const ACTIONS_VALID: IdleActivity[] = [
  "breathe",
  "shift-weight",
  "look-around",
  "walk",
  "fly",
  "study-egyptology",
  "study-history",
  "study-cybersecurity",
  "check-earth",
  "check-wolves",
  "check-cube",
  "check-knowledge",
  "write-chalkboard",
  "open-notepad",
  "open-player",
  "check-business",
  "check-sub-ais",
];
