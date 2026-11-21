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
});
