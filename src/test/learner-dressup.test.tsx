import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LearnerDressUp } from "@/avatar/learner/LearnerDressUp";

/**
 * Dress-Up Corner (owner order 2026-11-25): animated girls she can
 * dress — nice dresses, magic, LOTS of pink. The pins: pink leads
 * (her default dress is hot pink), the wardrobe really changes the
 * girl on the page, the girls are original picture-code (an SVG she
 * owns — no ripped game art), and Magic turns the sparkles on.
 */
describe("Dress-Up Corner", () => {
  it("opens on Ruby in a hot pink party dress — pink first, as ordered", () => {
    render(<LearnerDressUp />);
    expect(
      screen.getByText("Ruby is wearing a hot pink party dress!"),
    ).toBeInTheDocument();
    const girl = screen.getByRole("img", { name: /Ruby wearing a Hot pink Party Dress/ });
    expect(girl.tagName.toLowerCase()).toBe("svg");
  });

  it("paints the dress the color she picks", () => {
    render(<LearnerDressUp />);
    fireEvent.click(screen.getByRole("button", { name: "Sky blue" }));
    expect(
      screen.getByText("Ruby is wearing a sky blue party dress!"),
    ).toBeInTheDocument();
  });

  it("changes the dress and the girl", () => {
    render(<LearnerDressUp />);
    fireEvent.click(screen.getByRole("button", { name: "Princess Gown" }));
    fireEvent.click(screen.getByRole("button", { name: "Pearl" }));
    expect(
      screen.getByText("Pearl is wearing a hot pink princess gown!"),
    ).toBeInTheDocument();
  });

  it("the fairy dress grows wings", () => {
    const { container } = render(<LearnerDressUp />);
    expect(container.querySelectorAll("ellipse").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Fairy Dress" }));
    // Wings are the two big tilted ellipses behind her.
    const wings = container.querySelectorAll('ellipse[transform^="rotate"]');
    expect(wings.length).toBe(2);
  });

  it("Magic turns the sparkles on and says so", () => {
    const { container } = render(<LearnerDressUp />);
    expect(container.querySelector(".learner-dressup__sparkles")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Magic!/ }));
    expect(container.querySelector(".learner-dressup__sparkles")).not.toBeNull();
    expect(screen.getByText(/And the magic is ON!/)).toBeInTheDocument();
  });

  it("a crown goes on her head when she picks it", () => {
    render(<LearnerDressUp />);
    fireEvent.click(screen.getByRole("button", { name: /Crown/ }));
    expect(
      screen.getByRole("img", { name: /Ruby wearing a Hot pink Party Dress/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Crown/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
