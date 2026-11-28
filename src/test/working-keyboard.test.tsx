import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnubisPresence } from "@/avatar/AnubisPresence";
import { WorkingKeyboard } from "@/avatar/WorkingKeyboard";
import {
  WORKING_KEY_COUNT,
  WORKING_KEY_ROWS,
  WORKING_STREAM_MAX,
  appendWorkingBit,
  nextLitKeyIndex,
  workingBit,
  workingByte,
  workingKeyDelay,
} from "@/avatar/workingKeyboard";

/**
 * THE WORKING KEYBOARD (owner order 2026-11-28 ~07:21 CST,
 * "engage"): the sandbox typing effect he approved moves to
 * Anubis on the main construct — a keyboard rises at the base
 * of his medallion while he WORKS, keys lighting, binary
 * streaming above it. The pins below: the effect follows the
 * REAL working signal (his `acting` read) and nothing else,
 * and the sandbox's paw/minion figures are NOT in — excluded
 * by his order until he perfects them in the sandbox.
 */
describe("workingKeyboard — the plain rhythm", () => {
  it("types only bits, a byte at a time", () => {
    expect(workingBit(() => 0.9)).toBe("1");
    expect(workingBit(() => 0.1)).toBe("0");
    const byte = workingByte(Math.random);
    expect(byte).toHaveLength(8);
    expect(byte).toMatch(/^[01]{8}$/);
  });

  it("grows the stream by one bit and caps it at the max", () => {
    expect(appendWorkingBit("01", () => 0.9)).toBe("011");
    const full = "0".repeat(WORKING_STREAM_MAX);
    const capped = appendWorkingBit(full, () => 0.9);
    expect(capped).toHaveLength(WORKING_STREAM_MAX);
    expect(capped.endsWith("1")).toBe(true);
  });

  it("strikes a real key, never the same key twice in a row", () => {
    for (let i = 0; i < 40; i += 1) {
      const next = nextLitKeyIndex(Math.random, 5, WORKING_KEY_COUNT);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(WORKING_KEY_COUNT);
      expect(next).not.toBe(5);
    }
    expect(nextLitKeyIndex(Math.random, 0, 1)).toBe(0);
  });

  it("keeps an uneven human cadence", () => {
    for (let i = 0; i < 40; i += 1) {
      const delay = workingKeyDelay(Math.random);
      expect(delay).toBeGreaterThanOrEqual(70);
      expect(delay).toBeLessThan(170);
    }
  });

  it("lays out the board the component renders", () => {
    const flat = WORKING_KEY_ROWS.flatMap((row) => [...row]);
    expect(flat).toHaveLength(WORKING_KEY_COUNT - 1); // + the space bar
    expect(flat).toContain("Q");
    expect(flat).toContain("M");
  });
});

describe("WorkingKeyboard — the effect itself", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the keyboard and the binary stream while active", () => {
    const { container } = render(<WorkingKeyboard active />);
    const root = container.querySelector("[data-working-keyboard]");
    expect(root).not.toBeNull();
    const keys = container.querySelectorAll(".working-keyboard__key");
    expect(keys).toHaveLength(WORKING_KEY_COUNT);
    const stream = container.querySelector(".working-keyboard__stream");
    expect(stream).not.toBeNull();
    expect(stream!.textContent ?? "").toMatch(/^[01]+$/);
    // Exactly one key lit at a time — a hand striking.
    expect(container.querySelectorAll(".working-keyboard__key--lit")).toHaveLength(1);
  });

  it("renders nothing while inactive, and settles away when the work ends", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<WorkingKeyboard active={false} />);
    expect(container.querySelector("[data-working-keyboard]")).toBeNull();

    rerender(<WorkingKeyboard active />);
    expect(container.querySelector("[data-working-keyboard]")).not.toBeNull();

    rerender(<WorkingKeyboard active={false} />);
    // The settle stands for its moment, dressed as leaving…
    const leaving = container.querySelector("[data-working-keyboard]");
    expect(leaving).not.toBeNull();
    expect(leaving!.classList.contains("working-keyboard--leaving")).toBe(true);
    // …then it is gone, cleanly.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(container.querySelector("[data-working-keyboard]")).toBeNull();
  });

  it("carries NO paw or minion figure — excluded by his order", () => {
    const { container } = render(<WorkingKeyboard active />);
    expect(container.querySelector('[class*="paw"]')).toBeNull();
    expect(container.querySelector('[class*="minion"]')).toBeNull();
    expect(container.querySelector('[data-paw], [data-minion]')).toBeNull();
    expect((container.textContent ?? "").toLowerCase()).not.toContain("minion");
    expect((container.textContent ?? "").toLowerCase()).not.toContain("paw");
  });
});

describe("AnubisPresence — the keyboard rides the real working signal", () => {
  it("stands at his medallion while he works (acting), and nowhere else", () => {
    const { container, rerender } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} />,
    );
    expect(container.querySelector("[data-working-keyboard]")).toBeNull();

    rerender(<AnubisPresence ready speaking={false} listening acting={false} />);
    expect(container.querySelector("[data-working-keyboard]")).toBeNull();

    rerender(<AnubisPresence ready speaking listening={false} acting={false} />);
    expect(container.querySelector("[data-working-keyboard]")).toBeNull();

    rerender(<AnubisPresence ready speaking={false} listening={false} acting />);
    const keyboard = container.querySelector("[data-working-keyboard]");
    expect(keyboard).not.toBeNull();
    // Seated at the medallion: the keyboard stands inside his halo.
    expect(keyboard!.closest(".anubis-presence__halo")).not.toBeNull();
    // And the whole presence still carries no paw or minion.
    expect(container.querySelector('[class*="paw"], [class*="minion"]')).toBeNull();
  });
});
