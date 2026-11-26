/**
 * THE CAPTAIN'S LEARNING — window tests (owner orders
 * 2026-11-26): the shelves render their three subjects with
 * the Art of War chaptered; the Quotes & Prayer card shows
 * the empty-prayer state honestly and reads aloud through
 * the stage voice; a training run renders NO subject labels,
 * scores, and records to the core.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LearningWindow } from "@/avatar/learning/LearningWindow";
import { TrainingWindow } from "@/avatar/learning/TrainingWindow";
import { SightLogWindow } from "@/avatar/learning/SightLogWindow";
import { SUBJECT_LABELS } from "@/avatar/learning/questionBank";
import { progressFromHistory } from "@/avatar/learning/training";
import { hallStatsFromHistory } from "@/avatar/learning/hall";
import { chicagoDateISO } from "@/avatar/learning/time";
import * as learningServer from "@/avatar/learning/learning.server";
import { getOperatorAccessToken } from "@/avatar/trustedDevice";

vi.mock("@/avatar/learning/learning.server", () => ({
  getPrayer: vi.fn(),
  savePrayer: vi.fn(),
  getTrainingProgress: vi.fn(),
  recordTrainingRun: vi.fn(),
  getAssessments: vi.fn(),
  recordAssessment: vi.fn(),
  getSightLog: vi.fn(),
  addSightEntry: vi.fn(),
  setSightOutcome: vi.fn(),
}));

vi.mock("@/avatar/trustedDevice", () => ({
  getOperatorAccessToken: vi.fn(),
}));

const getPrayer = vi.mocked(learningServer.getPrayer);
const getTrainingProgress = vi.mocked(learningServer.getTrainingProgress);
const recordTrainingRun = vi.mocked(learningServer.recordTrainingRun);
const recordAssessment = vi.mocked(learningServer.recordAssessment);
const getSightLog = vi.mocked(learningServer.getSightLog);
const token = vi.mocked(getOperatorAccessToken);

beforeEach(() => {
  vi.clearAllMocks();
  token.mockResolvedValue("test-token");
  getPrayer.mockResolvedValue({
    authorized: true,
    storageAvailable: true,
    text: "",
    updatedAt: null,
    bankProblems: [],
  });
  getTrainingProgress.mockResolvedValue({
    authorized: true,
    storageAvailable: true,
    progress: progressFromHistory([]),
    hall: hallStatsFromHistory([], chicagoDateISO(Date.now())),
    assessments: [],
  });
  recordTrainingRun.mockResolvedValue({ authorized: true, ok: true, note: "Recorded.", recorded: 5 });
  recordAssessment.mockResolvedValue({ authorized: true, ok: true, note: "Recorded." });
  getSightLog.mockResolvedValue({ authorized: true, storageAvailable: true, entries: [] });
});

describe("My Learning window", () => {
  it("renders the three shelves, with the Art of War chaptered in full", { timeout: 30_000 }, async () => {
    render(<LearningWindow onClose={vi.fn()} onSpeak={vi.fn()} />);
    // Psychology is the opening shelf.
    expect(await screen.findByText(/Two systems of thinking/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Dark Psychology" }));
    expect(await screen.findByText(/Gaslighting/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "The Art of War" }));
    expect(await screen.findByText(/All warfare is based on deception/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /XIII\. The Use of Spies/ })).toBeInTheDocument();
    expect(screen.getByText(/Lionel Giles/)).toBeInTheDocument();
  });

  it("shows the empty-prayer state plainly and reads the quotes aloud on demand", async () => {
    const onSpeak = vi.fn();
    render(<LearningWindow onClose={vi.fn()} onSpeak={onSpeak} />);
    fireEvent.click(screen.getByRole("tab", { name: "Quotes & Prayer" }));
    expect(await screen.findByText(/No prayer is saved yet/)).toBeInTheDocument();
    expect(screen.getByText(/Prayer Time will surface four times a day/)).toBeInTheDocument();
    const readButtons = screen.getAllByRole("button", { name: "Read it aloud" });
    expect(readButtons.length).toBe(2); // quote of the day + quote of the night
    fireEvent.click(readButtons[0]!);
    expect(onSpeak).toHaveBeenCalledWith(expect.stringContaining("Your quote of the day"));
    // The prayer read button stays disabled while the prayer is empty —
    // nothing is ever "read" from an empty record.
    expect(screen.getByRole("button", { name: "Read my prayer" })).toBeDisabled();
  });

  it("reads the stored prayer verbatim once he has saved one", async () => {
    getPrayer.mockResolvedValue({
      authorized: true,
      storageAvailable: true,
      text: "His own prayer text, word for word.",
      updatedAt: 1_700_000_000_000,
      bankProblems: [],
    });
    const onSpeak = vi.fn();
    render(<LearningWindow onClose={vi.fn()} onSpeak={onSpeak} />);
    fireEvent.click(screen.getByRole("tab", { name: "Quotes & Prayer" }));
    const readPrayer = await screen.findByRole("button", { name: "Read my prayer" });
    await waitFor(() => expect(readPrayer).not.toBeDisabled());
    fireEvent.click(readPrayer);
    expect(onSpeak).toHaveBeenCalledWith("His own prayer text, word for word.");
  });
});

describe("Daily Training window", () => {
  it("runs untitled: no subject label appears anywhere during a run, and the run records to the core", { timeout: 30_000 }, async () => {
    render(<TrainingWindow onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "5 questions" }));
    const start = screen.getByRole("button", { name: "Start today's training" });
    await waitFor(() => expect(start).not.toBeDisabled());
    fireEvent.click(start);

    for (let step = 0; step < 5; step++) {
      expect(await screen.findByText(new RegExp(`Question ${step + 1} of 5`))).toBeInTheDocument();
      // UNTITLED: not one subject label is rendered during the run.
      for (const label of Object.values(SUBJECT_LABELS)) {
        expect(screen.queryByText(label, { exact: true })).not.toBeInTheDocument();
      }
      const choices = document.querySelectorAll(".window-learning__choice");
      expect(choices.length).toBe(4);
      fireEvent.click(choices[0]!);
      // After answering, the fact and its source are stated plainly.
      expect(await screen.findByText(/Source:/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: step === 4 ? "Finish" : "Next question" }));
    }

    expect(await screen.findByText(/Run complete/)).toBeInTheDocument();
    expect(recordTrainingRun).toHaveBeenCalledTimes(1);
    const call = recordTrainingRun.mock.calls[0]![0] as {
      data: { answers: { questionId: string; correct: boolean; mode?: string; responseMs?: number }[] };
    };
    expect(call.data.answers.length).toBe(5);
    for (const answer of call.data.answers) {
      expect(typeof answer.questionId).toBe("string");
      expect(typeof answer.correct).toBe("boolean");
      expect(answer.mode).toBe("choice");
      expect(typeof answer.responseMs).toBe("number");
      // The client never names a subject — the core re-derives it.
      expect(Object.keys(answer).sort()).toEqual(["correct", "mode", "questionId", "responseMs"]);
    }
  });

  it("the progress view reflects the recorded history it is handed", async () => {
    const history = [
      ...Array.from({ length: 12 }, (_, i) => ({
        date: "2026-01-15",
        at: 1_000 + i,
        questionId: `a-${i}`,
        subject: "anatomy" as const,
        correct: i >= 2,
      })),
    ];
    getTrainingProgress.mockResolvedValue({
      authorized: true,
      storageAvailable: true,
      progress: progressFromHistory(history),
      hall: hallStatsFromHistory(history, "2026-01-15"),
      assessments: [],
    });
    render(<TrainingWindow onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "See my progress" }));
    expect(await screen.findByText("Anatomy")).toBeInTheDocument();
    expect(screen.getByText(/Overall: 10 of 12 correct/)).toBeInTheDocument();
    expect(screen.getByText(/2026-01-15: 10 of 12/)).toBeInTheDocument();
  });
});

describe("The Training Hall — levels, typed answers, assessment", () => {
  it("the Hall header always shows his level, XP, and the road to the next level", async () => {
    const today = chicagoDateISO(Date.now());
    const history = Array.from({ length: 5 }, (_, i) => ({
      date: today,
      at: 1_000 + i,
      questionId: "psy-pavlov",
      subject: "psychology" as const,
      correct: true,
      runId: "run-1",
    }));
    getTrainingProgress.mockResolvedValue({
      authorized: true,
      storageAvailable: true,
      progress: progressFromHistory(history),
      hall: hallStatsFromHistory(history, today),
      assessments: [],
    });
    render(<TrainingWindow onClose={vi.fn()} />);
    expect(await screen.findByText("Level 1")).toBeInTheDocument();
    expect(screen.getByText(/50 XP/)).toBeInTheDocument(); // 5 × tier-1 pick = 50
    expect(screen.getByText(/21 XP to level 2/)).toBeInTheDocument(); // level 2 stands at 71 XP
  });

  it("a typed run grades his words, shows the calibration beside them, and records his verbatim text", { timeout: 30_000 }, async () => {
    render(<TrainingWindow onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "5 questions" }));
    fireEvent.click(screen.getByRole("button", { name: "Type the answer (more XP)" }));
    const start = screen.getByRole("button", { name: "Start today's training" });
    await waitFor(() => expect(start).not.toBeDisabled());
    fireEvent.click(start);

    for (let step = 0; step < 5; step++) {
      const input = await screen.findByPlaceholderText("Type the fact from memory…");
      fireEvent.change(input, { target: { value: "I think it is zanzibar nonsense" } });
      fireEvent.click(screen.getByRole("button", { name: "Answer" }));
      expect(await screen.findByText(/Your words:/)).toBeInTheDocument();
      expect(screen.getByText(/Calibrated — your answer, shorter:/)).toBeInTheDocument();
      expect(screen.getByText(/zanzibar nonsense/)).toBeInTheDocument(); // tightened, filler stripped
      fireEvent.click(screen.getByRole("button", { name: step === 4 ? "Finish" : "Next question" }));
    }

    expect(await screen.findByText(/Run complete/)).toBeInTheDocument();
    const call = recordTrainingRun.mock.calls[0]![0] as {
      data: { answers: { mode?: string; typedText?: string }[] };
    };
    expect(call.data.answers.length).toBe(5);
    for (const answer of call.data.answers) {
      expect(answer.mode).toBe("typed");
      expect(answer.typedText).toBe("I think it is zanzibar nonsense"); // verbatim in the record
    }
  });

  it("the assessment panel labels itself true and offers the baseline", async () => {
    render(<TrainingWindow onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Assessment" }));
    expect(await screen.findByText(/not a clinical IQ test/)).toBeInTheDocument();
    expect(screen.getByText(/No assessment taken yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take my first assessment" })).toBeInTheDocument();
    // The word IQ never appears as a score claim anywhere in the window.
    expect(document.body.textContent).not.toMatch(/your IQ is/i);
  });
});

describe("Sight Log window", () => {
  it("records an entry in his words and lists entries with their outcomes", async () => {
    getSightLog.mockResolvedValue({
      authorized: true,
      storageAvailable: true,
      entries: [
        { id: "s1", at: Date.UTC(2026, 0, 15, 15, 0), text: "Knew the phone would ring.", outcome: "came-to-pass" },
      ],
    });
    render(<SightLogWindow onClose={vi.fn()} />);
    expect(await screen.findByText("Knew the phone would ring.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Came to pass" })).toHaveClass("is-active");
    expect(screen.getByText(/Nothing here is analyzed or judged/)).toBeInTheDocument();
  });
});
