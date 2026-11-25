import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CUBE_FACES, LearnerCube, frontFaceIndex } from "@/avatar/learner/LearnerCube";

/**
 * Her cube (owner order 2026-11-25): a cube of her own to turn and
 * decipher. The pins: the front-face math matches the CSS the
 * browser applies (so the face she sees is the face the game
 * means), the turn buttons bring the named face to her, the Find
 * game celebrates a find, and there is no timer anywhere — the
 * turning IS the logic.
 */
function frontName(rx: number, ry: number): string | undefined {
  return CUBE_FACES[frontFaceIndex(rx, ry)]?.name;
}

describe("her cube — front-face math", () => {
  it("starts with the Star looking at her", () => {
    expect(frontName(0, 0)).toBe("Star");
  });

  it("turn right brings the Flower (the right face) to the front", () => {
    expect(frontName(0, -90)).toBe("Flower");
  });

  it("turn left brings the Rainbow (the left face) to the front", () => {
    expect(frontName(0, 90)).toBe("Rainbow");
  });

  it("tip up brings the Gem (the top face) to the front", () => {
    expect(frontName(-90, 0)).toBe("Gem");
  });

  it("tip down brings the Heart (the bottom face) to the front", () => {
    expect(frontName(90, 0)).toBe("Heart");
  });

  it("two rights bring the Bird around from the back", () => {
    expect(frontName(0, -180)).toBe("Bird");
  });

  it("a full spin lands back on the Star", () => {
    expect(frontName(360, -360)).toBe("Star");
  });
});

describe("her cube — the cabinet", () => {
  it("shows all six picture faces and names the one she taps", () => {
    render(<LearnerCube />);
    for (const face of CUBE_FACES) {
      expect(screen.getByRole("button", { name: `${face.name} face` })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Star face" }));
    expect(screen.getByText("That's the Star face!")).toBeInTheDocument();
  });

  it("turn buttons turn the cube — after Turn right, the Flower is hers to tap", () => {
    render(<LearnerCube />);
    fireEvent.click(screen.getByRole("button", { name: /Turn right/ }));
    fireEvent.click(screen.getByRole("button", { name: "Flower face" }));
    expect(screen.getByText("That's the Flower face!")).toBeInTheDocument();
  });

  it("the Find game celebrates when she turns the named face to the front and taps it", () => {
    render(<LearnerCube />);
    fireEvent.click(screen.getByRole("button", { name: /Find a face/ }));
    const line = screen.getByText(/Can you find the/);
    const target = CUBE_FACES.find((f) => line.textContent?.includes(`find the ${f.name}?`));
    expect(target).toBeDefined();
    // Turn the named face to the front from rest, the way she would:
    // each face is a known set of button taps away.
    const turnsFromRest: Record<string, RegExp[]> = {
      Flower: [/Turn right/],
      Rainbow: [/Turn left/],
      Bird: [/Turn right/, /Turn right/],
      Gem: [/Tip up/],
      Heart: [/Tip down/],
    };
    for (const name of turnsFromRest[target!.name] ?? []) {
      fireEvent.click(screen.getByRole("button", { name }));
    }
    fireEvent.click(screen.getByRole("button", { name: `${target!.name} face` }));
    expect(screen.getByText(new RegExp(`You found the ${target!.name}!`))).toBeInTheDocument();
    expect(screen.getByText(/Stars you found: 1/)).toBeInTheDocument();
  });

  it("has no timer and no losing — nothing counts down, nothing takes stars away", () => {
    const { container } = render(<LearnerCube />);
    expect(container.textContent?.toLowerCase()).not.toContain("timer");
    expect(container.textContent?.toLowerCase()).not.toContain("time left");
    expect(container.textContent?.toLowerCase()).not.toContain("game over");
  });
});
