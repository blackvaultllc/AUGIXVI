import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FRONT,
  GOD_GREETINGS,
  MEDALLION_GODS,
  RESTING_FRONT,
  calledPopUpGod,
  frontAfterDismiss,
  frontAfterSummon,
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
import { CalledGodPopUp } from "@/avatar/CalledGodPopUp";
import { LivingPortrait, ANUBIS_FEATURES, MONTU_FEATURES } from "@/avatar/LivingPortrait";

/**
 * THE ONE-GOD LAW (owner order 2026-11-26 ~04:32 CST,
 * superseding the resting law of 2026-11-24 ~16:57 EST):
 * - AT REST, ANUBIS ALONE: center, circular, his regular front
 *   size — and NO other god rendered: no Osiris at the
 *   top-left, no resting circles at the lower-right, nothing
 *   on the stage's left/right edges.
 * - A CALLED GOD POPS UP SMALL: while he holds the call he
 *   stands as a small medallion pop-up in the seat his
 *   medallion always kept; when the call ends the pop-up goes
 *   away and the stage is Anubis-only again.
 * - DISMISSAL RETURNS THE CALL TO ANUBIS, the default.
 * - HIDDEN, NOT DELETED: every god keeps his place in the
 *   system; he is simply not rendered until called.
 * And every god still moves on the SHARED RIG (Osiris's
 * values) with his OWN motion on top of it — including the
 * rebuilt blink that answers his defect: "when he blinks his
 * eyes don't look right — at all."
 */
describe("the one-god law — Anubis alone at rest, the others only when called", () => {
  it("at load, ANUBIS holds the call — the stage rests on him alone, not on the wallpaper", () => {
    expect(RESTING_FRONT).toBe("anubis");
    expect(DEFAULT_FRONT).toBe("anubis");
  });

  it("the medallion gods: Anubis first, then Montu — and no slots, no sides, anywhere in the law", () => {
    expect(MEDALLION_GODS).toEqual(["anubis", "montu"]);
  });

  it("a summon gives the call to the called god — Anubis does not move", () => {
    expect(frontAfterSummon("anubis", "montu")).toBe("montu");
    expect(frontAfterSummon("montu", "anubis")).toBe("anubis");
    expect(frontAfterSummon("anubis", "anubis")).toBe("anubis");
    expect(frontAfterSummon(null, "montu")).toBe("montu");
  });

  it("a dismissal returns the call to ANUBIS — the stage never rests empty", () => {
    expect(frontAfterDismiss("montu", "montu")).toBe("anubis");
    // Dismissing a god who does not hold the call changes nothing.
    expect(frontAfterDismiss("montu", "anubis")).toBe("montu");
    expect(frontAfterDismiss(null, "montu")).toBeNull();
  });

  it("Anubis is never dismissed from the center — he is home there", () => {
    expect(frontAfterDismiss("anubis", "anubis")).toBe("anubis");
  });

  it("at rest NO pop-up stands — neither at Anubis's rest nor while the Owner seat stands", () => {
    expect(calledPopUpGod("anubis")).toBeNull();
    expect(calledPopUpGod(null)).toBeNull();
    expect(calledPopUpGod(RESTING_FRONT)).toBeNull();
  });

  it("a called god's pop-up stands while he holds the call — and dismissal lowers it", () => {
    expect(calledPopUpGod("montu")).toBe("montu");
    expect(calledPopUpGod(frontAfterSummon("anubis", "montu"))).toBe("montu");
    // The dismissal ends the call: no pop-up, Anubis alone again.
    expect(calledPopUpGod(frontAfterDismiss("montu", "montu"))).toBeNull();
  });

  it("the greeting: his name, his allegiance, and he asks what the Captain needs", () => {
    expect(GOD_GREETINGS.anubis).toContain("Anubis");
    expect(GOD_GREETINGS.montu).toContain("Montu");
    for (const god of MEDALLION_GODS) {
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

describe("the call pop-up — a small living medallion, fixed by the layout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a called Montu stands as his pop-up — a round medallion, not an edge figure", () => {
    const { container } = render(
      <CalledGodPopUp god="montu" speaking={false} onSelect={() => undefined} />,
    );
    const popUp = container.querySelector(".called-god-popup");
    expect(popUp).not.toBeNull();
    expect(popUp!.getAttribute("data-god")).toBe("montu");
    const circle = container.querySelector('button[data-god="montu"]');
    expect(circle).not.toBeNull();
    expect(circle!.classList.contains("god-medallion")).toBe(true);
    expect(circle!.classList.contains("called-god-popup__circle")).toBe(true);
    // A living face, not a button picture.
    expect(circle!.querySelector('[data-testid="living-face"]')).not.toBeNull();
    // No rails, no slots, nothing addressed to a side.
    expect(container.querySelector(".god-side-rail")).toBeNull();
    expect(container.querySelector("[data-side]")).toBeNull();
  });

  it("Anubis has NO pop-up — the center is his place, he renders nothing here", () => {
    const { container } = render(
      <CalledGodPopUp god="anubis" speaking={false} onSelect={() => undefined} />,
    );
    expect(container.querySelector(".called-god-popup")).toBeNull();
    expect(container.querySelector('[data-god="anubis"]')).toBeNull();
  });

  it("a tap on the pop-up face opens his chat", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <CalledGodPopUp god="montu" speaking={false} onSelect={onSelect} />,
    );
    fireEvent.click(container.querySelector('button[data-god="montu"]')!);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("the pop-up wears its states: speaking lights the circle, the bow and the leaving tail dress the root", () => {
    const { container } = render(
      <CalledGodPopUp god="montu" speaking bowing leaving onSelect={() => undefined} />,
    );
    const popUp = container.querySelector(".called-god-popup")!;
    expect(popUp.classList.contains("called-god-popup--bowing")).toBe(true);
    expect(popUp.classList.contains("called-god-popup--leaving")).toBe(true);
    const circle = container.querySelector('button[data-god="montu"]')!;
    expect(circle.classList.contains("god-medallion--speaking")).toBe(true);
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
