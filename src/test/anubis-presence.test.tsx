import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ANUBIS_FACE_SRC, AnubisPresence } from "@/avatar/AnubisPresence";

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
