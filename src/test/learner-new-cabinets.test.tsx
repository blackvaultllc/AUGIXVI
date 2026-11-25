import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LearnerHome } from "@/avatar/learner/LearnerHome";
import { startLearnerSession, endLearnerSession } from "@/avatar/learner/learnerProfile";

/**
 * Her space grew (owner order 2026-11-25, with 007 beside him):
 * three new cabinets in HER OWN space inside his Anubis — Dress-Up,
 * My Cube, and Play Games — beside the eight she already had. Her
 * Squishy Maker stays exactly where it was.
 */
describe("her new cabinets — Dress-Up, My Cube, Play Games", () => {
  beforeEach(() => {
    localStorage.clear();
    endLearnerSession();
    startLearnerSession();
  });

  it("shows all eleven cabinets on her grand page", () => {
    render(<LearnerHome />);
    for (const label of [
      "Learn",
      "Squishy Maker",
      "Augie the Flower",
      "Daddy",
      "My Diary",
      "Squishy Projects",
      "Homework & Tests",
      "My Art",
      "Dress-Up",
      "My Cube",
      "Play Games",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("the Dress-Up cabinet opens her dress-up corner, pink ready", () => {
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "Dress-Up" }));
    expect(screen.getByRole("heading", { name: "Dress-Up Corner" })).toBeInTheDocument();
    expect(screen.getByText(/pink is ready for you/)).toBeInTheDocument();
  });

  it("the My Cube cabinet opens her cube with its turn buttons", () => {
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "My Cube" }));
    expect(screen.getByRole("heading", { name: "My Cube" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Turn right/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Find a face/ })).toBeInTheDocument();
  });

  it("the Play Games cabinet opens the emulators, Super Nintendo by name", () => {
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "Play Games" }));
    expect(screen.getByRole("heading", { name: "Play Games" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Super Nintendo" })).toBeInTheDocument();
  });

  it("her Squishy Maker is still right where it was", () => {
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "Squishy Maker" }));
    expect(screen.getByRole("link", { name: /Play Squishy Maker/i })).toHaveAttribute(
      "href",
      "/learner/squishy",
    );
  });
});
