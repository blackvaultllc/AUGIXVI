import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HexoCubeView, buildHexoCubeDocument, buildHexoDocument } from "@/avatar/HexoWindow";

/**
 * HEXO — the cube alone (owner order 2026-11-27, phone fix
 * pass 6): opening HEXO no longer opens the whole HEXO website
 * in a window. The pins that matter: the cube-only document is
 * the REAL artifact (its title, its four layers, its hunt)
 * with the page stripped away by the cube-only sheet; the
 * artifact still has NO public path (srcDoc, never a URL) and
 * its three.js rides inlined so the cube turns on the Parrot
 * with no internet; the view stands the cube over HIS Matrix
 * Wall and carries one clear way back to the stage.
 */
describe("HEXO cube view", () => {
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

  it("builds the cube-only document: same artifact, page stripped to the cube", () => {
    const doc = buildHexoCubeDocument();
    // The artifact itself rides whole underneath the sheet.
    expect(doc).toContain("HEXO — AUGI Core");
    expect(doc).toContain("01 · BINARY");
    expect(doc).not.toContain("cdnjs.cloudflare.com/ajax/libs/three.js");
    expect(doc).toContain("Three.js Authors");
    // The cube-only sheet: everything but the core stage is
    // hidden, the ground goes transparent, his rain replaces
    // the artifact's own.
    expect(doc).toContain("HEXO — CUBE ONLY");
    expect(doc).toContain(".wrap>*:not(.stage){display:none !important}");
    expect(doc).toContain("background:transparent !important");
    expect(doc).toContain("#rain,.chaos-badge{display:none !important}");
    expect(doc).toContain(".hud,.layerbar{display:none !important}");
  });

  it("stands the cube over the Matrix Wall in a srcDoc frame — no public path", () => {
    const { container } = render(<HexoCubeView onClose={vi.fn()} />);
    // His gold binary rain is the ground the cube stands on.
    expect(container.querySelector(".matrix-wall")).not.toBeNull();
    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute("src")).toBeNull();
    expect(frame?.getAttribute("srcdoc")).toContain("HEXO — AUGI Core");
    expect(frame?.getAttribute("srcdoc")).toContain("HEXO — CUBE ONLY");
    expect(frame?.getAttribute("title")).toBe("HEXO — AUGI Core");
    // No window chrome — the cube alone.
    expect(container.querySelector(".floating-window")).toBeNull();
  });

  it("goes back to the stage through the Back button", () => {
    const onClose = vi.fn();
    render(<HexoCubeView onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Back to the stage — close HEXO" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
