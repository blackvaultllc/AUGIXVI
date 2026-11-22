import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArCubeWindow } from "@/avatar/ArCubeWindow";

/**
 * AR Cube window (2026-11-21): the cube as a small floating box on the
 * avatar screen — Domenick's standing UI rule (tools in contained,
 * resizable/minimizable boxes, never full-screen takeovers). The box
 * hosts the same /ar-cube page as the full room at /avatar/cube, in an
 * iframe on the app's own origin with camera permission, and keeps a
 * link out to the full room.
 */
describe("AR Cube window", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it("renders the AR Cube page in an iframe with camera permission", () => {
    const { container } = render(<ArCubeWindow onClose={vi.fn()} />);
    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute("src")).toBe("/ar-cube/index.html");
    expect(frame?.getAttribute("title")).toBe("Augie AR Cube");
    expect(frame?.getAttribute("allow")).toContain("camera");
    expect(screen.getByRole("link", { name: "Open the full AR Cube room" })).toHaveAttribute(
      "href",
      "/avatar/cube",
    );
  });

  it("closes through the window's X button and minimizes to the title bar", () => {
    const onClose = vi.fn();
    const { container } = render(<ArCubeWindow onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Minimize AR Cube" }));
    expect(container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restore AR Cube" }));
    expect(container.querySelector("iframe")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close AR Cube" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens at the contained default size, inside the viewport with margins", () => {
    const { container } = render(<ArCubeWindow onClose={vi.fn()} />);
    const win = container.querySelector<HTMLElement>(".floating-window");
    expect(win).not.toBeNull();
    expect(win?.style.width).toBe("520px");
    expect(win?.style.height).toBe("600px");
    expect(win?.style.left).toBe("120px");
    expect(win?.style.top).toBe("90px");
  });

  it("never reopens at a persisted oversized geometry — it is clamped back inside the viewport", () => {
    // Regression for Domenick's 2026-11-21 screenshot: a saved
    // near-full-screen geometry reopened covering the whole stage and
    // burying the command box. The saved values must be clamped to
    // the viewport minus margins before they are applied.
    localStorage.setItem(
      "augi.window.ar-cube",
      JSON.stringify({ x: 5000, y: 4000, w: 4000, h: 3000, minimized: false }),
    );
    const { container } = render(<ArCubeWindow onClose={vi.fn()} />);
    const win = container.querySelector<HTMLElement>(".floating-window");
    const maxW = window.innerWidth - 32;
    const maxH = window.innerHeight - 32;
    expect(win?.style.width).toBe(`${maxW}px`);
    expect(win?.style.height).toBe(`${maxH}px`);
    expect(Number.parseInt(win?.style.left ?? "0", 10)).toBeLessThanOrEqual(
      window.innerWidth - maxW - 4,
    );
    expect(Number.parseInt(win?.style.top ?? "0", 10)).toBeLessThanOrEqual(
      window.innerHeight - maxH - 4,
    );
  });
});
