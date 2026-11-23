import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ANUBIS_FACE_SRC, AnubisPresence } from "@/avatar/AnubisPresence";
import { ANUBIS_SCEPTER_SRC } from "@/avatar/medallionPortraits";

/**
 * Anubis at Command: the medallion must keep reading the one
 * replaceable portrait asset, and its state classes must follow the
 * live signals the stage passes in — never decorative state.
 */
describe("AnubisPresence", () => {
  it("uses Khadija's chosen portrait from the single replaceable asset path", () => {
    expect(ANUBIS_FACE_SRC).toBe("/anubis-presence/face.webp");

    const { container } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} />,
    );
    const image = container.querySelector<HTMLImageElement>(".anubis-presence__img");
    expect(image).not.toBeNull();
    expect(image!.getAttribute("src")).toBe(ANUBIS_FACE_SRC);
    // The FACE is the raster portrait — never an SVG substitute.
    // (The move controls under the plate carry their own icons.)
    expect(container.querySelector(".anubis-presence__face svg")).toBeNull();
  });

  it("marks speaking, listening, working, and connecting from its signals", () => {
    const { container, rerender } = render(
      <AnubisPresence ready={false} speaking={false} listening={false} acting={false} />,
    );
    const root = () => container.querySelector(".anubis-presence")!;
    expect(root().classList.contains("anubis-presence--connecting")).toBe(true);
    expect(root().getAttribute("aria-label")).toBe("Anubis — connecting");

    rerender(<AnubisPresence ready speaking listening={false} acting={false} />);
    expect(root().classList.contains("anubis-presence--speaking")).toBe(true);
    expect(root().getAttribute("aria-label")).toBe("Anubis — speaking");

    rerender(<AnubisPresence ready speaking={false} listening acting={false} />);
    expect(root().classList.contains("anubis-presence--listening")).toBe(true);
    expect(root().getAttribute("aria-label")).toBe("Anubis — listening");

    rerender(<AnubisPresence ready speaking={false} listening={false} acting />);
    expect(root().classList.contains("anubis-presence--acting")).toBe(true);
    expect(root().getAttribute("aria-label")).toBe("Anubis — working");
  });
});

/**
 * THE SCEPTER (owner order 2026-11-23): raised only for
 * significant deliveries — the stage drives the prop from his
 * report pop-up — and put away at every ordinary moment,
 * ordinary talk included. The scepter is its own asset beside
 * the portrait, never part of it.
 */
describe("AnubisPresence — the scepter", () => {
  it("the scepter asset stands by, put away, at rest", () => {
    const { container } = render(
      <AnubisPresence ready speaking={false} listening={false} acting={false} />,
    );
    const scepter = container.querySelector<HTMLImageElement>('[data-testid="anubis-scepter"]');
    expect(scepter).not.toBeNull();
    expect(scepter!.getAttribute("src")).toBe(ANUBIS_SCEPTER_SRC);
    expect(scepter!.classList.contains("is-drawn")).toBe(false);
    const root = container.querySelector(".anubis-presence")!;
    expect(root.classList.contains("anubis-presence--scepter")).toBe(false);
    expect(root.getAttribute("aria-label")).not.toContain("scepter");
  });

  it("ordinary talk does NOT draw it — speaking alone keeps it put away", () => {
    const { container } = render(<AnubisPresence ready speaking listening={false} acting={false} />);
    const scepter = container.querySelector('[data-testid="anubis-scepter"]')!;
    expect(scepter.classList.contains("is-drawn")).toBe(false);
  });

  it("a significant delivery draws it — raised at his side, named in his state", () => {
    const { container } = render(
      <AnubisPresence ready speaking listening={false} acting={false} scepter />,
    );
    const scepter = container.querySelector('[data-testid="anubis-scepter"]')!;
    expect(scepter.classList.contains("is-drawn")).toBe(true);
    const root = container.querySelector(".anubis-presence")!;
    expect(root.classList.contains("anubis-presence--scepter")).toBe(true);
    expect(root.getAttribute("aria-label")).toContain("scepter raised");
  });
});
