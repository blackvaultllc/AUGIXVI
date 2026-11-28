import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HexoCubeView, buildHexoCubeDocument, buildHexoDocument } from "@/avatar/HexoWindow";

/**
 * HEXO — stripped to the cube (owner order 2026-11-28, on top
 * of pass 6's cube-alone view, owner order 2026-11-27): the
 * artifact document itself now holds ONLY the cube, spinning
 * in space, and one plain answer box. The pins that matter:
 * the cube is really in the document (its renderers, its
 * 11×11×11 grid) with three.js inlined and no CDN left; none
 * of the removed page rides along — no layer bar, no page
 * nav, no HUD, no table, no word vault, no hints, no labels;
 * the cube is LOCKED (no drag, no tap-collect, no layer
 * wiring — nothing in the document answers a visitor's hand);
 * exactly one input stands on the page, the answer box, with
 * no placeholder hint; and the in-app view still stands the
 * document over HIS Matrix Wall with one way back.
 */
describe("HEXO cube view", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it("builds the stripped document: the cube, three.js inlined, no CDN left", () => {
    const doc = buildHexoDocument();
    // The cube itself: its holders, its grid, its idle spin.
    expect(doc).toContain('id="glholder"');
    expect(doc).toContain('id="cube2d"');
    expect(doc).toContain("GRID=11");
    expect(doc).toContain("cubeGroup.rotation.y+=0.038");
    // The CDN script tag is gone — the same build rides inline.
    expect(doc).not.toContain("cdnjs.cloudflare.com/ajax/libs/three.js");
    expect(doc).toContain("Three.js Authors");
  });

  it("the document holds nothing but the cube and one plain answer box", () => {
    const doc = buildHexoDocument();
    // The one box a visitor may type an answer into — unlabeled,
    // no placeholder, no hint of any kind.
    expect(doc).toContain('id="answer"');
    expect(doc.match(/type="text"/g)).toHaveLength(1);
    expect(doc.match(/<input/g)).toHaveLength(1);
    expect(doc).not.toContain("placeholder");
    expect(doc).not.toContain("<button");
    // None of the removed page: no title, no layer bar, no page
    // nav, no HUD, no controls, no table, no word vault.
    expect(doc).not.toContain("HEXO — AUGI Core");
    expect(doc).not.toContain("01 · BINARY");
    expect(doc).not.toContain("HXO · HEXO");
    expect(doc).not.toContain("KNOWLEDGE + TABLE");
    expect(doc).not.toContain("layerbar");
    expect(doc).not.toContain("data-layer");
    expect(doc).not.toContain("pagenav");
    expect(doc).not.toContain("CRACK THE CODE");
    expect(doc).not.toContain("hudLayer");
    expect(doc).not.toContain("ptable");
    expect(doc).not.toContain("PERIODIC TABLE");
    expect(doc).not.toContain("wordVault");
    expect(doc).not.toContain("HANGMAN");
    expect(doc).not.toContain("Stop the cube");
  });

  it("the cube is locked: nothing in the document answers a visitor's hand", () => {
    const doc = buildHexoDocument();
    // No drag, no tap-to-collect raycast, no glyph collection,
    // no layer switching, no twist/reset buttons wired. (The
    // raycast pin names the construction — the three.js library
    // itself carries the class name; the document never uses it.)
    expect(doc).not.toContain("new THREE.Raycaster");
    expect(doc).not.toContain("pointerdown");
    expect(doc).not.toContain("pointermove");
    expect(doc).not.toContain("__collectGlyph");
    expect(doc).not.toContain("__setLayer");
    expect(doc).not.toContain("twistBtn");
    expect(doc).not.toContain("resetBtn");
  });

  it("builds the cube-only document: same stripped document, transparent ground laid over it", () => {
    const doc = buildHexoCubeDocument();
    // The stripped document rides whole underneath the sheet.
    expect(doc).toContain('id="glholder"');
    expect(doc).toContain('id="answer"');
    expect(doc).not.toContain("cdnjs.cloudflare.com/ajax/libs/three.js");
    expect(doc).toContain("Three.js Authors");
    // The cube-only sheet: the ground goes transparent so his
    // rain surrounds the cube in-app.
    expect(doc).toContain("HEXO — CUBE ONLY");
    expect(doc).toContain("background:transparent !important");
  });

  it("stands the cube over the Matrix Wall in a srcDoc frame — no public path", () => {
    const { container } = render(<HexoCubeView onClose={vi.fn()} />);
    // His gold binary rain is the ground the cube stands on.
    expect(container.querySelector(".matrix-wall")).not.toBeNull();
    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute("src")).toBeNull();
    expect(frame?.getAttribute("srcdoc")).toContain("HEXO — CUBE ONLY");
    expect(frame?.getAttribute("srcdoc")).toContain('id="answer"');
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
