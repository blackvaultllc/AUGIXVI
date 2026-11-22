import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnubisPresence } from "@/avatar/AnubisPresence";
import { BlackHatterPresence } from "@/avatar/BlackHatterPresence";
import { MontuPresence } from "@/avatar/MontuPresence";
import { MONTU_FEATURES, speakingMsForText } from "@/avatar/LivingPortrait";

/**
 * LIVING FACES (owner order 2026-11-22, the core defect): the
 * medallions were still portraits — frozen. Both faces now carry
 * blinking eyelids and a mouth that moves while their face speaks:
 * Anubis when Anubis answers, the Black Hatter when he speaks the
 * Captain's typed words. These tests pin the overlays to the
 * portraits and the mouth to the speaking signal.
 */
describe("living medallion faces", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Anubis's face carries two eyelids and a mouth over the portrait", () => {
    const { container } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} />,
    );
    expect(container.querySelector('[data-testid="living-lid-left"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="living-lid-right"]')).not.toBeNull();
    const mouth = container.querySelector<HTMLElement>('[data-testid="living-mouth"]');
    expect(mouth).not.toBeNull();
    // At rest the mouth is shut — the portrait's own mouth shows.
    expect(mouth!.style.opacity).toBe("0");
  });

  it("the eyelids blink on their cadence — the face is never frozen", () => {
    const { container } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} />,
    );
    const lid = () => container.querySelector('[data-testid="living-lid-left"]')!;
    expect(lid().classList.contains("is-closed")).toBe(false);
    // Within twelve seconds of stage time, a blink must have closed
    // the lids at least once (cadence 2.3–5.6s, checked in slices so
    // the 150ms closed window is caught).
    let sawClosed = false;
    for (let i = 0; i < 240 && !sawClosed; i += 1) {
      act(() => {
        vi.advanceTimersByTime(50);
      });
      sawClosed = lid().classList.contains("is-closed");
    }
    expect(sawClosed).toBe(true);
    // And they open again — a blink, not a stuck lid. (Checked in
    // slices: an occasional double blink may close them once more
    // first — what must never happen is a lid that stays shut.)
    let sawOpenAgain = false;
    for (let i = 0; i < 40 && !sawOpenAgain; i += 1) {
      act(() => {
        vi.advanceTimersByTime(50);
      });
      sawOpenAgain = !lid().classList.contains("is-closed");
    }
    expect(sawOpenAgain).toBe(true);
  });

  it("Anubis's mouth moves while he speaks and stills when he stops", () => {
    const { container, rerender } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} />,
    );
    const mouth = () => container.querySelector<HTMLElement>('[data-testid="living-mouth"]')!;
    rerender(<AnubisPresence ready speaking listening={false} acting={false} />);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(mouth().style.opacity).toBe("1");
    expect(mouth().style.transform).not.toBe("scaleY(0)");
    rerender(<AnubisPresence ready speaking={false} listening={false} acting={false} />);
    expect(mouth().style.opacity).toBe("0");
  });

  it("the Black Hatter's mouth moves while he speaks the Captain's typed words", () => {
    const { container } = render(<BlackHatterPresence inPerspective speaking />);
    const mouth = container.querySelector<HTMLElement>('[data-testid="living-mouth"]')!;
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(mouth.style.opacity).toBe("1");
    expect(mouth.style.transform).not.toBe("scaleY(0)");
    const root = container.querySelector(".black-hatter-presence")!;
    expect(root.classList.contains("black-hatter-presence--speaking")).toBe(true);
    expect(root.getAttribute("aria-label")).toContain("speaking");
  });

  it("Montu's face is alive too — eyelids over the falcon's eyes, a mouth at the beak (2026-11-22)", () => {
    const { container } = render(<MontuPresence ready />);
    const lidLeft = container.querySelector<HTMLElement>('[data-testid="living-lid-left"]');
    const lidRight = container.querySelector<HTMLElement>('[data-testid="living-lid-right"]');
    const mouth = container.querySelector<HTMLElement>('[data-testid="living-mouth"]');
    expect(lidLeft).not.toBeNull();
    expect(lidRight).not.toBeNull();
    expect(mouth).not.toBeNull();
    // The overlays sit on HIS measured features — the falcon's
    // eyes at (43.7, 40.5) / (56.3, 40.5), the beak's seam at
    // (50.0, 46.8) — not on another face's map.
    expect(lidLeft!.style.left).toBe(`${MONTU_FEATURES.leftEye.x - MONTU_FEATURES.eyeW / 2}%`);
    expect(lidLeft!.style.top).toBe(`${MONTU_FEATURES.leftEye.y - MONTU_FEATURES.eyeH / 2}%`);
    expect(lidRight!.style.left).toBe(`${MONTU_FEATURES.rightEye.x - MONTU_FEATURES.eyeW / 2}%`);
    expect(mouth!.style.left).toBe(`${MONTU_FEATURES.mouth.x - MONTU_FEATURES.mouthW / 2}%`);
    expect(mouth!.style.top).toBe(`${MONTU_FEATURES.mouth.y - MONTU_FEATURES.mouthH / 2}%`);
    // At rest the beak is shut — the portrait's own beak shows.
    expect(mouth!.style.opacity).toBe("0");
  });

  it("Montu blinks on the same cadence — he was the one frozen face (2026-11-22)", () => {
    const { container } = render(<MontuPresence ready />);
    const lid = () => container.querySelector('[data-testid="living-lid-left"]')!;
    expect(lid().classList.contains("is-closed")).toBe(false);
    let sawClosed = false;
    for (let i = 0; i < 240 && !sawClosed; i += 1) {
      act(() => {
        vi.advanceTimersByTime(50);
      });
      sawClosed = lid().classList.contains("is-closed");
    }
    expect(sawClosed).toBe(true);
  });

  it("Montu's beak moves while he speaks (2026-11-22)", () => {
    const { container } = render(<MontuPresence ready speaking />);
    const mouth = container.querySelector<HTMLElement>('[data-testid="living-mouth"]')!;
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(mouth.style.opacity).toBe("1");
    expect(container.querySelector(".montu-presence")!.classList.contains("montu-presence--speaking")).toBe(
      true,
    );
  });

  it("the Black Hatter is silent at rest — no speaking class, mouth shut", () => {
    const { container } = render(<BlackHatterPresence inPerspective speaking={false} />);
    const mouth = container.querySelector<HTMLElement>('[data-testid="living-mouth"]')!;
    expect(mouth.style.opacity).toBe("0");
    expect(
      container.querySelector(".black-hatter-presence")!.classList.contains(
        "black-hatter-presence--speaking",
      ),
    ).toBe(false);
  });
});

describe("speakingMsForText — the Hatter's line length", () => {
  it("silence for no words, a floor for short lines, a ceiling for long ones", () => {
    expect(speakingMsForText("")).toBe(0);
    expect(speakingMsForText("   ")).toBe(0);
    expect(speakingMsForText("Osiris")).toBe(1300);
    const tenWords = "one two three four five six seven eight nine ten";
    expect(speakingMsForText(tenWords)).toBe(700 + 10 * 340);
    const page = Array.from({ length: 200 }, () => "word").join(" ");
    expect(speakingMsForText(page)).toBe(9000);
  });
});
