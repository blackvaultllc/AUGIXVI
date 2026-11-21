import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RacingGame } from "@/avatar/learner/racing/RacingGame";
import { LearnerHome } from "@/avatar/learner/LearnerHome";
import { startLearnerSession } from "@/avatar/learner/learnerProfile";

/**
 * PLAY-THROUGH — this suite drives the real component through every
 * state the spec names: setup picks, the 3-2-1-GO countdown, racing
 * questions (correct, wrong, and timed-out), a full pit stop (NOS
 * earned and spent), a partial pit stop (green GO button early), the
 * finish podium, Play Again, and the 1-Minute Sprint.
 */

function readPrompt(container: HTMLElement): { a: number; b: number } | null {
  const el = container.querySelector(".racing-question__prompt");
  if (!el?.textContent) return null;
  const match = el.textContent.match(/(\d+) × (\d+) = \?/);
  if (!match) return null;
  return { a: Number(match[1]), b: Number(match[2]) };
}

function clickAnswer(container: HTMLElement, value: number) {
  const button = [...container.querySelectorAll<HTMLButtonElement>(".racing-answer")].find(
    (b) => b.textContent === String(value),
  );
  if (!button) throw new Error(`no answer button for ${value}`);
  fireEvent.click(button);
}

function clickWrongAnswer(container: HTMLElement) {
  const prompt = readPrompt(container);
  if (!prompt) throw new Error("no question on screen");
  const answer = prompt.a * prompt.b;
  const button = [...container.querySelectorAll<HTMLButtonElement>(".racing-answer")].find(
    (b) => b.textContent !== String(answer),
  );
  if (!button) throw new Error("no wrong answer available");
  fireEvent.click(button);
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function startRace(container: HTMLElement) {
  fireEvent.click(screen.getByRole("button", { name: "Start the Race!" }));
  expect(container.querySelector(".racing-countdown")?.textContent).toBe("3");
  advance(3100); // 3, 2, 1, GO -> racing
  advance(600); // first question arrives
  expect(readPrompt(container)).not.toBeNull();
}

/** Answer questions (correctly) and let time pass until a phase text shows up. */
function raceUntil(container: HTMLElement, phaseText: string, maxSteps = 220) {
  for (let i = 0; i < maxSteps; i++) {
    if (screen.queryByText(phaseText)) return;
    const prompt = readPrompt(container);
    if (prompt) clickAnswer(container, prompt.a * prompt.b);
    advance(1300);
  }
  throw new Error(`never reached "${phaseText}"`);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers();
});

describe("the Academy page points at both games", () => {
  it("Learn cabinet has the Cyber Defense tile to /avatar/world and the TEST racing tile", () => {
    startLearnerSession();
    render(<LearnerHome />);
    const defense = screen.getByRole("link", { name: /Cyber Defense/ });
    expect(defense).toHaveAttribute("href", "/avatar/world");
    const racing = screen.getByRole("link", { name: /Multiplication Racing/ });
    expect(racing).toHaveAttribute("href", "/learner/racing");
    expect(screen.getByText("TEST")).toBeInTheDocument();
  });
});

describe("multiplication racing — full play-through", () => {
  it("setup picks, countdown, laps, pit stops, NOS, podium, play again", () => {
    const { container } = render(<RacingGame />);

    // Setup: car, color, driver picks all register.
    fireEvent.click(screen.getByRole("button", { name: /Tiny Truck/ }));
    expect(screen.getByRole("button", { name: /Tiny Truck/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Color Blue" }));
    expect(screen.getByRole("button", { name: "Color Blue" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: /Ruby/ }));
    expect(screen.getByRole("button", { name: /Ruby/ })).toHaveAttribute("aria-pressed", "true");

    startRace(container);
    expect(screen.getByText(/You are in .* place!/)).toBeInTheDocument();
    expect(screen.getByText("Lap 1 of 3")).toBeInTheDocument();

    // Lap 1 -> pit stop 1.
    raceUntil(container, "Pit Stop!");
    expect(screen.getByText(/Pit Crew Trick:/)).toBeInTheDocument();
    expect(screen.getByText(/No rush here/)).toBeInTheDocument();

    // Solve all three pit problems -> NOS earned, upgrades added.
    for (let i = 0; i < 3; i++) {
      const prompt = readPrompt(container);
      if (!prompt) throw new Error("pit problem missing");
      clickAnswer(container, prompt.a * prompt.b);
    }
    expect(screen.getByText(/You earned NOS/)).toBeInTheDocument();
    expect(screen.getByText(/On your car:/)?.textContent).toContain("Turbo");

    // Green GO button back to the race.
    fireEvent.click(screen.getByRole("button", { name: "GO!" }));
    expect(screen.getByText("Lap 2 of 3")).toBeInTheDocument();

    // NOS button is there in lap 2 and it fires.
    const nos = screen.getByRole("button", { name: /NOS!/ });
    fireEvent.click(nos);
    expect(screen.queryByRole("button", { name: /NOS!/ })).not.toBeInTheDocument();
    expect(screen.getByText(/NOS! ZOOM!/)).toBeInTheDocument();

    // Lap 2 -> pit stop 2. This time leave early after one problem.
    raceUntil(container, "Pit Stop!");
    const prompt = readPrompt(container);
    if (!prompt) throw new Error("pit problem missing");
    clickAnswer(container, prompt.a * prompt.b);
    fireEvent.click(screen.getByRole("button", { name: "GO!" }));
    expect(screen.getByText("Lap 3 of 3")).toBeInTheDocument();
    // Partial pit stop earns no NOS.
    expect(screen.queryByRole("button", { name: /NOS!/ })).not.toBeInTheDocument();

    // Lap 3 -> finish podium with all four places.
    raceUntil(container, "Race Results");
    for (const place of ["1st —", "2nd —", "3rd —", "4th —"]) {
      expect(screen.getByText(new RegExp(place))).toBeInTheDocument();
    }
    expect(screen.getByText(/That's you!/)).toBeInTheDocument();
    expect(screen.getByText(/You answered \d+ questions right/)).toBeInTheDocument();

    // Play Again returns to setup.
    fireEvent.click(screen.getByRole("button", { name: "Play Again" }));
    expect(screen.getByRole("button", { name: "Start the Race!" })).toBeInTheDocument();
  });

  it("a wrong answer never punishes — no boost, the fact is shown, racing goes on", () => {
    const { container } = render(<RacingGame />);
    startRace(container);
    const prompt = readPrompt(container);
    if (!prompt) throw new Error("no question");
    clickWrongAnswer(container);
    expect(
      screen.getByText(new RegExp(`Good try! ${prompt.a} × ${prompt.b} = ${prompt.a * prompt.b}`)),
    ).toBeInTheDocument();
    advance(1600);
    expect(readPrompt(container)).not.toBeNull();
  });

  it("a question left alone times out and the race moves on", () => {
    const { container } = render(<RacingGame />);
    startRace(container);
    advance(10200);
    expect(screen.getByText(/Time's up! Here comes the next one/)).toBeInTheDocument();
    advance(1500);
    expect(readPrompt(container)).not.toBeNull();
  });

  it("a pit problem answered wrong stays put with the trick still showing", () => {
    const { container } = render(<RacingGame />);
    startRace(container);
    raceUntil(container, "Pit Stop!");
    clickWrongAnswer(container);
    expect(screen.getByText(/use the trick and try again/)).toBeInTheDocument();
    expect(readPrompt(container)).not.toBeNull();
  });
});

describe("1-Minute Sprint", () => {
  it("scores correct answers, ends on the timer, and remembers the best", () => {
    const { container } = render(<RacingGame />);
    fireEvent.click(screen.getByRole("button", { name: "1-Minute Sprint" }));
    for (let i = 0; i < 3; i++) {
      const prompt = readPrompt(container);
      if (!prompt) throw new Error("no sprint question");
      clickAnswer(container, prompt.a * prompt.b);
    }
    expect(screen.getByText("Score: 3")).toBeInTheDocument();
    advance(61000);
    expect(screen.getByText("Time! Sprint over")).toBeInTheDocument();
    expect(screen.getByText("You answered 3 right!")).toBeInTheDocument();
    expect(localStorage.getItem("dija.racing.sprintBest")).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Start the Race!" })).toBeInTheDocument();
  });
});
