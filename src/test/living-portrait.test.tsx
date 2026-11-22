import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnubisPresence } from "@/avatar/AnubisPresence";
import { BlackHatterPresence } from "@/avatar/BlackHatterPresence";
import { speakingMsForText } from "@/avatar/LivingPortrait";

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
    // And they open again — a blink, not a stuck lid.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(lid().classList.contains("is-closed")).toBe(false);
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
