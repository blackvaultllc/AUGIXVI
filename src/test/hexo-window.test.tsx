import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HexoWindow, buildHexoDocument } from "@/avatar/HexoWindow";

/**
 * HEXO window (owner order 2026-11-25): the Captain's cube is back
 * in his area. The pins that matter: the window carries the REAL
 * artifact (its title, its four layers, its hunt), the artifact has
 * NO public path (it renders from a srcDoc, never a URL), and its
 * three.js rides inlined in the document so the cube turns on the
 * Parrot with no internet.
 */
describe("HEXO window", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it("builds the artifact document with three.js inlined and no CDN left", () => {
    const doc = buildHexoDocument();
    expect(doc).toContain("HEXO — AUGI Core");
    expect(doc).toContain("01 · BINARY");
    expect(doc).toContain("HXO · HEXO");
    expect(doc).toContain("KNOWLEDGE + TABLE");
    // The CDN script tag is gone — the same build rides inline.
    expect(doc).not.toContain("cdnjs.cloudflare.com/ajax/libs/three.js");
    expect(doc).toContain("Three.js Authors");
  });

  it("renders the artifact in a srcDoc iframe — no public path", () => {
    const { container } = render(<HexoWindow onClose={vi.fn()} />);
    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute("src")).toBeNull();
    expect(frame?.getAttribute("srcdoc")).toContain("HEXO — AUGI Core");
    expect(frame?.getAttribute("title")).toBe("HEXO — AUGI Core");
    expect(screen.getByText(/Operator only — no public path/)).toBeInTheDocument();
  });

  it("closes through the window's X button and minimizes to the title bar", () => {
    const onClose = vi.fn();
    const { container } = render(<HexoWindow onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Minimize HEXO — the Core" }));
    expect(container.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restore HEXO — the Core" }));
    expect(container.querySelector("iframe")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close HEXO — the Core" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
