import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GOD_GREETINGS,
  GOD_SLOTS,
  RESTING_FRONT,
  SLOT_GODS,
  frontAfterDismiss,
  frontAfterSummon,
  slotFor,
  slotGodsOnSide,
} from "@/avatar/godStage";
import {
  ANUBIS_MOTION_PROFILE,
  DEFAULT_MOTION_PROFILE,
  MONTU_MOTION_PROFILE,
  PRESENCE_RIG,
  blinkCycleMs,
  blinkIntervalMs,
  gazeOffsetForStep,
  motionProfileFor,
} from "@/avatar/godMotion";
import { GodSideRail } from "@/avatar/GodSideRail";
import { LivingPortrait, ANUBIS_FEATURES, MONTU_FEATURES } from "@/avatar/LivingPortrait";

/**
 * GODS ON THE SIDES (owner order 2026-11-24 ~11:27–11:31 EST):
 * the stage rests on its wallpaper; every god — Anubis included
 * — rests small in a side slot; a click brings him front with
 * his allegiance greeting; and every god moves on the SHARED
 * RIG (Osiris's values) with his OWN motion on top of it. These
 * tests pin the law, the lineup, the greeting, and the
 * distinctness of the motions — including the rebuilt blink
 * that answers his defect: "when he blinks his eyes don't look
 * right — at all."
 */
describe("the resting law — the stage rests on its wallpaper", () => {
  it("at load, nobody holds the front", () => {
    expect(RESTING_FRONT).toBeNull();
  });

  it("the lineup: Anubis down the left, Montu down the right", () => {
    expect(SLOT_GODS).toEqual(["anubis", "montu"]);
    expect(slotFor("anubis")).toEqual({ god: "anubis", side: "left", order: 0 });
    expect(slotFor("montu")).toEqual({ god: "montu", side: "right", order: 0 });
    expect(GOD_SLOTS).toHaveLength(2);
  });

  it("a summon puts the called god at front — and sends the holder back to his slot", () => {
    expect(frontAfterSummon(null, "montu")).toBe("montu");
    expect(frontAfterSummon("montu", "anubis")).toBe("anubis");
    expect(frontAfterSummon("anubis", "anubis")).toBe("anubis");
  });

  it("a dismissal returns only the dismissed god; the stage rests when he was the front", () => {
    expect(frontAfterDismiss("montu", "montu")).toBeNull();
    expect(frontAfterDismiss("montu", "anubis")).toBe("montu");
    expect(frontAfterDismiss(null, "montu")).toBeNull();
  });

  it("a god at front has left his slot; the other god's slot stands", () => {
    expect(slotGodsOnSide(null, "left")).toEqual(["anubis"]);
    expect(slotGodsOnSide(null, "right")).toEqual(["montu"]);
    expect(slotGodsOnSide("anubis", "left")).toEqual([]);
    expect(slotGodsOnSide("anubis", "right")).toEqual(["montu"]);
    expect(slotGodsOnSide("montu", "right")).toEqual([]);
  });

  it("the greeting: his name, his allegiance, and he asks what the Captain needs", () => {
    expect(GOD_GREETINGS.anubis).toContain("Anubis");
    expect(GOD_GREETINGS.montu).toContain("Montu");
    for (const god of SLOT_GODS) {
      expect(GOD_GREETINGS[god]).toContain("Captain");
      expect(GOD_GREETINGS[god]).toContain("What do you need?");
    }
  });
});

describe("the shared rig, each god's own motion (owner amendment 2026-11-24)", () => {
  it("the default profile IS the rig — the values the faces were eye-checked with", () => {
    expect(DEFAULT_MOTION_PROFILE.lidCloseMs).toBe(PRESENCE_RIG.lidCloseMs);
    expect(DEFAULT_MOTION_PROFILE.lidHoldMs).toBe(PRESENCE_RIG.lidHoldMs);
    expect(DEFAULT_MOTION_PROFILE.talkTickMs).toBe(PRESENCE_RIG.talkTickMs);
    expect(DEFAULT_MOTION_PROFILE.blinkIntervalScale).toBe(1);
    // The Captain's own face keeps his stillness: no gaze, no lower lid.
    expect(DEFAULT_MOTION_PROFILE.gazeTravelPct).toBe(0);
    expect(DEFAULT_MOTION_PROFILE.lowerLidRise).toBe(0);
  });

  it("Anubis's blink is the weightiest; Montu's the sharpest — same rig, opposite tempers", () => {
    expect(ANUBIS_MOTION_PROFILE.lidCloseMs).toBeGreaterThan(MONTU_MOTION_PROFILE.lidCloseMs);
    expect(ANUBIS_MOTION_PROFILE.lidOpenMs).toBeGreaterThan(MONTU_MOTION_PROFILE.lidOpenMs);
    expect(blinkIntervalMs(ANUBIS_MOTION_PROFILE, 0)).toBeGreaterThan(
      blinkIntervalMs(MONTU_MOTION_PROFILE, 0),
    );
    expect(blinkCycleMs(ANUBIS_MOTION_PROFILE)).toBeGreaterThan(blinkCycleMs(MONTU_MOTION_PROFILE));
    // Both gods close with a lower lid rising to meet the upper —
    // the half of the blink the old flat lid never had.
    expect(ANUBIS_MOTION_PROFILE.lowerLidRise).toBeGreaterThan(0);
    expect(MONTU_MOTION_PROFILE.lowerLidRise).toBeGreaterThan(0);
  });

  it("the gazes are distinct: Anubis deliberate, Montu darting", () => {
    expect(ANUBIS_MOTION_PROFILE.gazeHoldMinMs).toBeGreaterThan(MONTU_MOTION_PROFILE.gazeHoldMinMs);
    expect(ANUBIS_MOTION_PROFILE.gazeTransitionMs).toBeGreaterThan(
      MONTU_MOTION_PROFILE.gazeTransitionMs,
    );
    expect(MONTU_MOTION_PROFILE.gazeTravelPct).toBeGreaterThan(ANUBIS_MOTION_PROFILE.gazeTravelPct);
    expect(ANUBIS_MOTION_PROFILE.gazePattern).not.toEqual(MONTU_MOTION_PROFILE.gazePattern);
  });

  it("the speech tempos are distinct: Anubis measured, Montu clipped", () => {
    expect(ANUBIS_MOTION_PROFILE.talkTickMs).toBeGreaterThan(MONTU_MOTION_PROFILE.talkTickMs);
    expect(ANUBIS_MOTION_PROFILE.talkBurstMin).toBeGreaterThan(MONTU_MOTION_PROFILE.talkBurstMin);
    expect(MONTU_MOTION_PROFILE.jawScale).toBeLessThan(ANUBIS_MOTION_PROFILE.jawScale);
  });

  it("gaze steps cycle the god's own pattern, scaled by his travel", () => {
    const first = gazeOffsetForStep(MONTU_MOTION_PROFILE, 1);
    expect(first.x).toBeCloseTo(1 * MONTU_MOTION_PROFILE.gazeTravelPct);
    expect(first.y).toBeCloseTo(-0.2 * MONTU_MOTION_PROFILE.gazeTravelPct);
    const wrapped = gazeOffsetForStep(
      MONTU_MOTION_PROFILE,
      1 + MONTU_MOTION_PROFILE.gazePattern.length,
    );
    expect(wrapped).toEqual(first);
    expect(motionProfileFor("anubis")).toBe(ANUBIS_MOTION_PROFILE);
    expect(motionProfileFor("montu")).toBe(MONTU_MOTION_PROFILE);
  });
});

describe("the side rail — small living medallions, fixed by the layout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("at rest both gods stand in their slots, one rail a side", () => {
    const left = render(
      <GodSideRail side="left" front={null} speakingGod={null} onSummon={() => undefined} />,
    );
    const anubis = left.container.querySelector('[data-god="anubis"]');
    expect(anubis).not.toBeNull();
    // A living face, not a button picture.
    expect(anubis!.querySelector('[data-testid="living-face"]')).not.toBeNull();
    left.unmount();
    const right = render(
      <GodSideRail side="right" front={null} speakingGod={null} onSummon={() => undefined} />,
    );
    expect(right.container.querySelector('[data-god="montu"]')).not.toBeNull();
  });

  it("the god at front has left his slot — his rail stands empty", () => {
    const { container } = render(
      <GodSideRail side="left" front="anubis" speakingGod={null} onSummon={() => undefined} />,
    );
    expect(container.querySelector('[data-god="anubis"]')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("a click on a slot summons that god", () => {
    const onSummon = vi.fn();
    const { container } = render(
      <GodSideRail side="right" front={null} speakingGod={null} onSummon={onSummon} />,
    );
    fireEvent.click(container.querySelector('[data-god="montu"]')!);
    expect(onSummon).toHaveBeenCalledWith("montu");
  });
});

describe("the rebuilt blink and the gaze, rendered", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("Anubis carries a lower lid and a gaze layer; the default face carries neither", () => {
    const god = render(
      <LivingPortrait
        src="/anubis-presence/face.webp"
        features={ANUBIS_FEATURES}
        speaking={false}
        imgClassName="x"
        motion={ANUBIS_MOTION_PROFILE}
      />,
    );
    expect(god.container.querySelector('[data-testid="living-lid-bottom-left"]')).not.toBeNull();
    expect(god.container.querySelector('[data-testid="living-lid-bottom-right"]')).not.toBeNull();
    expect(god.container.querySelector('[data-testid="living-gaze-left"]')).not.toBeNull();
    god.unmount();
    const plain = render(
      <LivingPortrait
        src="/anubis-presence/face.webp"
        features={ANUBIS_FEATURES}
        speaking={false}
        imgClassName="x"
      />,
    );
    expect(plain.container.querySelector('[data-testid="living-lid-bottom-left"]')).toBeNull();
    expect(plain.container.querySelector('[data-testid="living-gaze-left"]')).toBeNull();
  });

  it("Anubis's lids are FITTED to the jackal eye — the slant is in the lid's transform", () => {
    const { container } = render(
      <LivingPortrait
        src="/anubis-presence/face.webp"
        features={ANUBIS_FEATURES}
        speaking={false}
        imgClassName="x"
        motion={ANUBIS_MOTION_PROFILE}
      />,
    );
    const left = container.querySelector<HTMLElement>('[data-testid="living-lid-left"]')!;
    const right = container.querySelector<HTMLElement>('[data-testid="living-lid-right"]')!;
    expect(left.style.transform).toContain(`rotate(${ANUBIS_FEATURES.lidTilt!.left}deg)`);
    expect(right.style.transform).toContain(`rotate(${ANUBIS_FEATURES.lidTilt!.right}deg)`);
    expect(left.style.borderRadius).toBe(ANUBIS_FEATURES.lidRadius);
  });

  it("Anubis's blink closes in phases and opens again — never a stuck lid", () => {
    const { container } = render(
      <LivingPortrait
        src="/anubis-presence/face.webp"
        features={ANUBIS_FEATURES}
        speaking={false}
        imgClassName="x"
        motion={ANUBIS_MOTION_PROFILE}
      />,
    );
    const lid = () => container.querySelector('[data-testid="living-lid-left"]')!;
    let sawClosed = false;
    for (let i = 0; i < 200 && !sawClosed; i += 1) {
      act(() => {
        vi.advanceTimersByTime(50);
      });
      sawClosed = lid().classList.contains("is-closed");
    }
    expect(sawClosed).toBe(true);
    let sawOpen = false;
    for (let i = 0; i < 40 && !sawOpen; i += 1) {
      act(() => {
        vi.advanceTimersByTime(50);
      });
      sawOpen = !lid().classList.contains("is-closed");
    }
    expect(sawOpen).toBe(true);
  });

  it("Montu's eyes travel his pattern — the gaze slide moves inside its window", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const { container } = render(
      <LivingPortrait
        src="/blackhatter/montu-portrait.png"
        features={MONTU_FEATURES}
        speaking={false}
        imgClassName="x"
        motion={MONTU_MOTION_PROFILE}
      />,
    );
    const slide = () =>
      container.querySelector<HTMLElement>('[data-testid="living-gaze-left"] .living-face__gaze-img')!;
    expect(slide().style.transform).toContain("translate(0.000%, 0.000%)");
    // His longest hold at this draw is ~2.3s; past it, his eyes
    // have darted to the pattern's second waypoint — up and to
    // his right, a falcon checking the corner.
    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(slide().style.transform).toContain("translate(1.300%, -0.260%)");
  });
});
