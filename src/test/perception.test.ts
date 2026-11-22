import { describe, expect, it } from "vitest";
import {
  estimatePitch,
  expressionCues,
  perceptionSentence,
  voiceCues,
  type LandmarkPoint,
} from "@/avatar/perception";

/**
 * PART 25 — perception cues. Synthetic landmark geometry in,
 * cue sentences out. The rules under test: cues are phrased as
 * cues, silence when the signals say nothing, and no cue set ever
 * claims an identity or a mental state.
 */

function blankFace(): LandmarkPoint[] {
  return Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }));
}

function set(face: LandmarkPoint[], i: number, x: number, y: number) {
  face[i] = { x, y };
}

/** A face with a wide mouth and clearly open eyes. */
function smilingFace(): LandmarkPoint[] {
  const f = blankFace();
  set(f, 234, 0.2, 0.5);
  set(f, 454, 0.8, 0.5); // face width 0.6
  set(f, 10, 0.5, 0.1);
  set(f, 152, 0.5, 0.9); // face height 0.8
  set(f, 61, 0.32, 0.72);
  set(f, 291, 0.68, 0.72); // mouth width 0.36 → ratio 0.6 (wide)
  set(f, 13, 0.5, 0.715);
  set(f, 14, 0.5, 0.725); // mouth nearly closed
  // right eye: width 0.08, verticals 0.025 → EAR ≈ 0.31 (open)
  set(f, 33, 0.3, 0.4); set(f, 133, 0.38, 0.4);
  set(f, 159, 0.34, 0.385); set(f, 145, 0.34, 0.41);
  set(f, 158, 0.35, 0.386); set(f, 153, 0.35, 0.409);
  // left eye mirrored
  set(f, 362, 0.62, 0.4); set(f, 263, 0.7, 0.4);
  set(f, 386, 0.66, 0.385); set(f, 374, 0.66, 0.41);
  set(f, 385, 0.65, 0.386); set(f, 380, 0.65, 0.409);
  // brows neutral: apart and mid-height
  set(f, 55, 0.42, 0.33); set(f, 285, 0.58, 0.33);
  return f;
}

describe("expression cues", () => {
  it("reads a wide mouth and open eyes as cues — phrased as cues", () => {
    const cues = expressionCues(smilingFace());
    expect(cues).toContain("mouth wide — smile-like");
    expect(cues).toContain("eyes open");
    expect(perceptionSentence(cues, [])).toMatch(/^Cues suggest: /);
  });

  it("says nothing for a degenerate landmark set", () => {
    expect(expressionCues(blankFace())).toEqual([]);
    expect(expressionCues([])).toEqual([]);
    expect(perceptionSentence([], [])).toBeNull();
  });
});

describe("voice cues", () => {
  it("estimates the pitch of a clean 150 Hz tone and calls it mid-range", () => {
    const sr = 16_000;
    const buf = new Float32Array(sr / 2);
    for (let i = 0; i < buf.length; i++) buf[i] = 0.5 * Math.sin((2 * Math.PI * 150 * i) / sr);
    const v = voiceCues(buf, sr);
    expect(v.pitchHz).not.toBeNull();
    expect(Math.abs((v.pitchHz ?? 0) - 150)).toBeLessThanOrEqual(6);
    expect(v.cues.some((c) => c.includes("mid-range"))).toBe(true);
    expect(estimatePitch(buf, sr)).toBe(v.pitchHz);
  });

  it("a silent buffer yields no cues — never an invented voice", () => {
    const v = voiceCues(new Float32Array(4096), 16_000);
    expect(v.pitchHz).toBeNull();
    expect(v.cues).toEqual([]);
  });
});
