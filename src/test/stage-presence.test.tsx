import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BLACK_HATTER_FACE_SRC, BlackHatterPresence } from "@/avatar/BlackHatterPresence";
import { ANUBIS_PORTRAIT_SRC, BLACK_HATTER_BINDING } from "@/avatar/medallionPortraits";
import { PRESENCE_ASSETS } from "@/avatar/presenceState";
import {
  DEFAULT_STAGE_PERSPECTIVE,
  perspectiveAfterClose,
} from "@/avatar/stagePerspective";

/**
 * THE BLACK HATTER'S BINDING (owner orders 2026-11-22): these tests
 * pin the binding — his registered portrait, his name, the owner
 * role every station reads him by — and that the face is his
 * alone: never Anubis's portrait, never AUGI's animated clips. His
 * MEDALLION is put away by default under the presence doctrine
 * (Anubis is the resident default now); the binding itself — and
 * his speaker-of-record role — is untouched by that.
 */
describe("the Black Hatter binding", () => {
  it("binds the Captain's registered portrait to his name and the owner role", () => {
    expect(BLACK_HATTER_BINDING.name).toBe("The Black Hatter");
    expect(BLACK_HATTER_BINDING.person).toBe("Domenick Arlon Hall");
    expect(BLACK_HATTER_BINDING.role).toBe("operator/owner");
    expect(BLACK_HATTER_BINDING.portrait).toBe("/owner-presence/captain-infinity.webp");
    expect(BLACK_HATTER_FACE_SRC).toBe(BLACK_HATTER_BINDING.portrait);
  });

  it("is no one else's face — not Anubis's, not AUGI's", () => {
    expect(BLACK_HATTER_BINDING.portrait).not.toBe(ANUBIS_PORTRAIT_SRC);
    for (const asset of Object.values(PRESENCE_ASSETS)) {
      expect(BLACK_HATTER_BINDING.portrait).not.toBe(asset.video);
    }
  });

  it("makes ANUBIS the default perspective — the resident commander — and every close returns to him", () => {
    // Presence doctrine (owner order 2026-11-22), superseding the
    // Black-Hatter-center default: Anubis holds the stage; the
    // Hatter's medallion is away until the Owner seat returns him.
    expect(DEFAULT_STAGE_PERSPECTIVE).toBe("anubis");
    expect(perspectiveAfterClose()).toBe("anubis");
  });
});

describe("BlackHatterPresence", () => {
  it("stands at center with his portrait, name, and owner plate", () => {
    const { container } = render(<BlackHatterPresence inPerspective />);
    const root = container.querySelector(".black-hatter-presence")!;
    expect(root.classList.contains("black-hatter-presence--in-perspective")).toBe(true);
    expect(root.getAttribute("aria-label")).toBe("The Black Hatter — Owner");
    const image = container.querySelector<HTMLImageElement>(".black-hatter-presence__img");
    expect(image).not.toBeNull();
    expect(image!.getAttribute("src")).toBe(BLACK_HATTER_FACE_SRC);
    expect(container.textContent).toContain("The Black Hatter");
    expect(container.textContent).toContain("Owner");
  });

  it("steps back while a station holds the perspective, and tapping him takes it back", () => {
    const onSelect = vi.fn();
    const { container } = render(<BlackHatterPresence inPerspective={false} onSelect={onSelect} />);
    const root = container.querySelector(".black-hatter-presence")!;
    expect(root.classList.contains("black-hatter-presence--stepped-back")).toBe(true);
    expect(root.getAttribute("role")).toBe("button");
    root.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
