import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FloatingWindow } from "@/avatar/windows/FloatingWindow";

/**
 * Regression guard for the window-controls defect (2026-11-20): pressing
 * X on the YouTube player made the window resize instead of closing.
 * The title bar's drag handler captured the pointer even when the press
 * started on a button, and a captured pointer retargets the click to
 * the bar — the button never receives it. These tests pin the wiring:
 * a press on a button must NOT start a drag (no pointer capture), and
 * each button must do its own job.
 */
describe("floating window controls", () => {
  const captureSpy = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    captureSpy.mockClear();
    Element.prototype.setPointerCapture = captureSpy;
    Element.prototype.releasePointerCapture = vi.fn();
  });

  // jsdom has no PointerEvent constructor, and a generic event loses the
  // `button` field the drag handler checks — dispatch a MouseEvent typed
  // as pointerdown so the handler sees a real primary-button press.
  function pointerDown(node: Element) {
    const ev = new window.MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(ev, "pointerId", { value: 1 });
    fireEvent(node, ev);
  }

  it("closes when X is pressed — the press does not start a drag", () => {
    const onClose = vi.fn();
    render(
      <FloatingWindow id="win-close" title="Player — YouTube" onClose={onClose}>
        <p>body</p>
      </FloatingWindow>,
    );
    const close = screen.getByRole("button", { name: "Close Player — YouTube" });
    pointerDown(close);
    expect(captureSpy).not.toHaveBeenCalled();
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dragging still starts from the title bar itself", () => {
    render(
      <FloatingWindow id="win-drag" title="Notes" onClose={vi.fn()}>
        <p>body</p>
      </FloatingWindow>,
    );
    pointerDown(screen.getByText("Notes"));
    expect(captureSpy).toHaveBeenCalled();
  });

  it("minimize collapses the body, restore brings it back, maximize toggles size", () => {
    const { container } = render(
      <FloatingWindow id="win-minmax" title="Notes" onClose={vi.fn()}>
        <p>body text</p>
      </FloatingWindow>,
    );
    pointerDown(screen.getByRole("button", { name: "Minimize Notes" }));
    expect(captureSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Minimize Notes" }));
    expect(screen.queryByText("body text")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore Notes" }));
    expect(screen.getByText("body text")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Maximize Notes" }));
    expect(container.querySelector(".floating-window--maximized")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restore Notes size" }));
    expect(container.querySelector(".floating-window--maximized")).toBeNull();
  });

  it("clamps a persisted oversized geometry back inside the viewport on open", () => {
    localStorage.setItem(
      "augi.window.win-huge",
      JSON.stringify({ x: 0, y: 0, w: 5000, h: 5000, minimized: false }),
    );
    const { container } = render(
      <FloatingWindow id="win-huge" title="Notes" onClose={vi.fn()}>
        <p>body text</p>
      </FloatingWindow>,
    );
    const win = container.querySelector<HTMLElement>(".floating-window");
    expect(win?.style.width).toBe(`${window.innerWidth - 32}px`);
    expect(win?.style.height).toBe(`${window.innerHeight - 32}px`);
    expect(win?.style.left).toBe("4px");
    expect(win?.style.top).toBe("4px");
  });

  it("pulls the window back inside when the viewport itself shrinks", () => {
    const { container } = render(
      <FloatingWindow id="win-shrink" title="Notes" onClose={vi.fn()}>
        <p>body text</p>
      </FloatingWindow>,
    );
    const win = container.querySelector<HTMLElement>(".floating-window");
    expect(win?.style.width).toBe("420px");
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    try {
      Object.defineProperty(window, "innerWidth", { value: 360, configurable: true });
      Object.defineProperty(window, "innerHeight", { value: 300, configurable: true });
      fireEvent(window, new window.Event("resize"));
      expect(win?.style.width).toBe("328px");
      expect(win?.style.height).toBe("268px");
      expect(win?.style.left).toBe("28px");
      expect(win?.style.top).toBe("28px");
    } finally {
      Object.defineProperty(window, "innerWidth", { value: originalWidth, configurable: true });
      Object.defineProperty(window, "innerHeight", { value: originalHeight, configurable: true });
    }
  });
});
