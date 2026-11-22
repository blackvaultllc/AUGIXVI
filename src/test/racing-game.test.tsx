import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RacingGame } from "@/avatar/learner/racing/RacingGame";
import { LearnerHome } from "@/avatar/learner/LearnerHome";
import { startLearnerSession } from "@/avatar/learner/learnerProfile";

/**
 * PLAY-THROUGH — this suite drives the real component through every
 * state the spec names: setup picks, the 3-2-1-GO countdown, racing
 * questions (correct = the car speeds up, wrong = the car slows
 * down, and NO question timer — a question waits to be answered),
 * a full pit stop (NOS earned and spent), a partial pit stop
 * (green GO button early), the finish podium, and Play Again.
 * There is NO timed mode: the 1-Minute Sprint was removed by
 * Domenick's order (2026-11-21) and a guard test below proves
 * the start screen offers no sprint and no clock.
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

describe("the Academy page points at the racing game", () => {
  it("Learn cabinet has the TEST racing tile to /learner/racing", () => {
    startLearnerSession();
    render(<LearnerHome />);
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

  it("THE SPEED LOOP: right answer speeds her car up, wrong answer slows it down", () => {
    const { container } = render(<RacingGame />);
    startRace(container);
    const speed = () => screen.getByTestId("player-speed").textContent;
    // Rolling at base speed before any answer.
    expect(speed()).toBe("Your speed: 7");

    // RIGHT answer — the car SPEEDS UP (7.2 + 4.4 boost = 11.6 -> 12).
    const first = readPrompt(container);
    if (!first) throw new Error("no question");
    clickAnswer(container, first.a * first.b);
    expect(speed()).toBe("Your speed: 12");

    // WRONG answer — the car SLOWS DOWN (boost gone, 7.2 - 3.4 slow
    // = 3.8 -> 4), the right fact is shown kindly, racing goes on.
    advance(1300);
    const second = readPrompt(container);
    if (!second) throw new Error("no second question");
    clickWrongAnswer(container);
    expect(speed()).toBe("Your speed: 4");
    expect(
      screen.getByText(
        new RegExp(`Good try! ${second.a} × ${second.b} = ${second.a * second.b}`),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/slows down a little/)).toBeInTheDocument();

    // The next RIGHT answer speeds her right back up.
    advance(1300);
    const third = readPrompt(container);
    if (!third) throw new Error("no third question");
    clickAnswer(container, third.a * third.b);
    expect(speed()).toBe("Your speed: 12");
  });

  it("a question has NO timer — left alone, it waits to be answered", () => {
    const { container } = render(<RacingGame />);
    startRace(container);
    const prompt = readPrompt(container);
    if (!prompt) throw new Error("no question");
    // 12 seconds — past the old 10-second limit — and she is still
    // on lap 1 (base speed covers ~91 of 100 units), so the very
    // same question must still be on screen, untimed and unhurried.
    advance(12000);
    expect(screen.queryByText(/Time's up/)).not.toBeInTheDocument();
    expect(readPrompt(container)).toEqual(prompt);
    expect(container.querySelector(".racing-timer")).toBeNull();
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

describe("no timed mode — the 1-Minute Sprint is removed", () => {
  it("the start screen offers no sprint, no clock, and no best-score chase", () => {
    render(<RacingGame />);
    expect(screen.queryByRole("button", { name: /sprint/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/sprint/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 minute/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start the Race!" })).toBeInTheDocument();
    expect(localStorage.getItem("dija.racing.sprintBest")).toBeNull();
  });
});

describe("Part 16 — the circuit and its sounds", () => {
  it("renders a circuit (one shared loop), not straight lanes", () => {
    const { container } = render(<RacingGame />);
    startRace(container);
    expect(container.querySelector(".racing-circuit")).not.toBeNull();
    expect(container.querySelector(".racing-circuit__svg path")).not.toBeNull();
    expect(container.querySelectorAll(".racing-lane")).toHaveLength(0);
    expect(container.querySelectorAll(".racing-car--circuit")).toHaveLength(4);
  });

  it("the mute sticks: off stays off across a remount", () => {
    const first = render(<RacingGame />);
    startRace(first.container);
    const mute = screen.getByRole("button", { name: /Sound: On/ });
    fireEvent.click(mute);
    expect(localStorage.getItem("augi.racing.muted.v1")).toBe("1");
    first.unmount();
    const second = render(<RacingGame />);
    startRace(second.container);
    expect(screen.getByRole("button", { name: /Sound: Off/ })).toBeInTheDocument();
  });
});
