import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LearnerHome } from "@/avatar/learner/LearnerHome";
import { LearnerGate } from "@/avatar/learner/LearnerGate";
import { LearnerHeartDoor } from "@/avatar/learner/LearnerHeartDoor";
import { RoomGate } from "@/avatar/RoomGate";
import { startLearnerSession } from "@/avatar/learner/learnerProfile";
import { addDiaryEntry, setupDiary, unlockDiary } from "@/avatar/learner/diaryCrypto";
import { saveProject, saveSquishy } from "@/avatar/learner/learnerStore";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  clientConfig: vi.fn(),
  verifySession: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/avatar/operatorAuth.server", () => ({
  getOperatorBootstrapStatus: vi.fn(),
  verifySupabaseOperatorSession: mocks.verifySession,
  getSupabaseClientConfig: mocks.clientConfig,
}));

// RoomGate's fallback renders a router Link; outside a router it is
// just an anchor for this test.
vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    Link: (props: { to: string; children: React.ReactNode }) =>
      React.createElement("a", { href: props.to }, props.children),
  };
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubEnv("VITE_SUPABASE_URL", "https://project.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "public-placeholder");
  mocks.createClient.mockReset().mockReturnValue({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  });
  mocks.verifySession.mockReset();
  mocks.clientConfig.mockReset().mockResolvedValue(null);
});

describe("the heart door", () => {
  it("renders a big heart button labeled as Khadija's door in a footer", () => {
    render(<LearnerHeartDoor />);
    const button = screen.getByRole("button", { name: /Khadija's door/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByText("Khadija")).toBeInTheDocument();
  });
});

describe("her sign-in and grand page", () => {
  it("shows the sign-in first — no cabinets until she signs in", () => {
    render(<LearnerHome />);
    expect(screen.getByRole("heading", { name: "Khadija's Door" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Learn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "My Diary" })).not.toBeInTheDocument();
  });

  it("turns away a wrong name with a friendly message", () => {
    render(<LearnerHome />);
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Somebody Else" } });
    fireEvent.change(screen.getByLabelText("Your birth year"), { target: { value: "2019" } });
    fireEvent.click(screen.getByRole("button", { name: "Open my door" }));
    expect(screen.getByText("That's not it — try again.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Learn" })).not.toBeInTheDocument();
  });

  it("opens her grand page with all four cabinets after her sign-in", () => {
    render(<LearnerHome />);
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Khadija Leila Hall" },
    });
    fireEvent.change(screen.getByLabelText("Your birth year"), { target: { value: "2019" } });
    fireEvent.click(screen.getByRole("button", { name: "Open my door" }));

    expect(screen.getByRole("heading", { name: "Hi, Khadija!" })).toBeInTheDocument();
    for (const label of ["Learn", "My Diary", "Squishy Projects", "Homework & Tests"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    // The Learn cabinet is open: her game and her starter shelf.
    expect(screen.getByRole("link", { name: /Legend of Logic/i })).toHaveAttribute(
      "href",
      "/learner/game",
    );
    expect(screen.getByText("Starter diagrams — more are coming.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Parts of a Flower" })).toBeInTheDocument();
  });

  it("renders NO operator surfaces anywhere on her page", () => {
    startLearnerSession();
    render(<LearnerHome />);
    for (const operatorLabel of [
      "AR Cube",
      "Picture Analysis",
      "Gate Log",
      "Sandbox",
      "Pulse",
      "Cloud Keys",
      "Operator sign-in",
    ]) {
      expect(screen.queryByText(operatorLabel)).not.toBeInTheDocument();
    }
  });
});

describe("her cabinets", () => {
  it("shows her saved squishies in the gallery", () => {
    startLearnerSession();
    saveSquishy({ name: "Berry", dataUrl: TINY_PNG });
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "Squishy Projects" }));
    expect(screen.getByAltText("Berry")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Berry" })).toBeInTheDocument();
  });

  it("shows a homework project with front and back photos, and the honest picture note", () => {
    startLearnerSession();
    saveProject({
      kind: "homework",
      title: "Math page 4",
      pastedText: "3 + 4 = 7",
      frontDataUrl: TINY_PNG,
      backDataUrl: TINY_PNG,
    });
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "Homework & Tests" }));
    expect(screen.getByText("Math page 4")).toBeInTheDocument();
    expect(screen.getByAltText("Front of paper")).toBeInTheDocument();
    expect(screen.getByAltText("Back of paper")).toBeInTheDocument();
    expect(
      screen.getByText("Augie is still learning to read pictures — paste the words works now."),
    ).toBeInTheDocument();
  });

  it("opens the diary only with her picture + secret word; wrong word leaks nothing", async () => {
    startLearnerSession();
    const key = await setupDiary("heart:rose");
    await addDiaryEntry(key, "I saw a rainbow today.");
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "My Diary" }));

    fireEvent.change(screen.getByLabelText("Your secret word"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Open my diary" }));
    expect(await screen.findByText("That's not it.")).toBeInTheDocument();
    expect(screen.queryByText("I saw a rainbow today.")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Your secret word"), { target: { value: "rose" } });
    fireEvent.click(screen.getByRole("button", { name: "Open my diary" }));
    expect(await screen.findByText("I saw a rainbow today.")).toBeInTheDocument();
  });
});

describe("her new cabinets — Squishy Maker, the Flower, and her art", () => {
  it("shows all seven cabinets on her grand page", () => {
    startLearnerSession();
    render(<LearnerHome />);
    for (const label of [
      "Learn",
      "Squishy Maker",
      "Augie the Flower",
      "My Diary",
      "Squishy Projects",
      "Homework & Tests",
      "My Art",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("the Squishy Maker cabinet links to her game room inside Augie", () => {
    startLearnerSession();
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "Squishy Maker" }));
    expect(screen.getByRole("link", { name: /Play Squishy Maker/i })).toHaveAttribute(
      "href",
      "/learner/squishy",
    );
  });

  it("her art opens on the first picture and walks with Back and Next", () => {
    startLearnerSession();
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "My Art" }));
    expect(screen.getByAltText("The Princess and the Heart Squishy")).toHaveAttribute(
      "src",
      "/learner-art/princess-squishy.webp",
    );
    expect(screen.getByText("Picture 1 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to the next picture" }));
    expect(screen.getByAltText("The Artist Whose Drawings Come Alive")).toBeInTheDocument();
    expect(screen.getByText("Picture 2 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to the picture before" }));
    expect(screen.getByText("Picture 1 of 3")).toBeInTheDocument();
  });

  it("the Flower teaches a manners lesson in its own words", () => {
    startLearnerSession();
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "Augie the Flower" }));
    expect(screen.getByText(/I am Augie the Flower/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Please and Thank You" }));
    expect(screen.getByText(/Say “please” when you ask for something/)).toBeInTheDocument();
    expect(screen.getByText("A good-manners lesson from your Flower.")).toBeInTheDocument();
  });

  it("the Flower answers from a book, names it, and saves a verified learning note", async () => {
    startLearnerSession();
    const fetchMock = vi.fn(async () =>
      Response.json({
        answer: "The sky looks blue in the day.",
        mode: "book",
        source: { bookTitle: "Simple English Wikipedia", articleTitle: "Sky" },
        verified: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "Augie the Flower" }));
    fireEvent.click(screen.getByRole("button", { name: "Why is the sky blue?" }));
    expect(await screen.findByText("The sky looks blue in the day.")).toBeInTheDocument();
    expect(
      screen.getByText("From the book: Simple English Wikipedia — “Sky”"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/learner/ask",
      expect.objectContaining({ method: "POST" }),
    );
    const { loadFlowerNotes } = await import("@/avatar/learner/flowerNotes");
    const notes = loadFlowerNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      question: "Why is the sky blue?",
      sourceBook: "Simple English Wikipedia",
      verified: true,
    });
    vi.unstubAllGlobals();
  });

  it("the Flower has a living presence: name, Listening state, and a gentle motion class", () => {
    startLearnerSession();
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "Augie the Flower" }));
    expect(screen.getByRole("heading", { name: "Augie the Flower" })).toBeInTheDocument();
    expect(screen.getByText("Listening…")).toBeInTheDocument();
    const face = screen.getByRole("img", {
      name: "Augie the Flower, a smiling pink flower",
    });
    expect(face).toHaveClass("is-listening");
  });

  it("the Flower speaks her lessons aloud with her voice, and the toggle turns it off", () => {
    const spoken: string[] = [];
    class FakeUtterance {
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    vi.stubGlobal("speechSynthesis", {
      cancel: vi.fn(),
      speak: vi.fn((utterance: FakeUtterance) => {
        spoken.push(utterance.text);
        utterance.onstart?.();
      }),
    });
    startLearnerSession();
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "Augie the Flower" }));
    fireEvent.click(screen.getByRole("button", { name: "Please and Thank You" }));
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toMatch(/Say “please” when you ask for something/);
    // Speaking state is visible while her voice is going.
    expect(screen.getByText("Speaking…")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Voice On/ }));
    fireEvent.click(screen.getByRole("button", { name: "Kind Words" }));
    expect(spoken).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("with no speech voice on the device, the Flower says so plainly instead of faking it", () => {
    startLearnerSession();
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "Augie the Flower" }));
    expect(
      screen.getByText(/This device has no voice for me/),
    ).toBeInTheDocument();
  });
});

describe("her remembered device (Part 8)", () => {
  it("a remembered device offers one-tap entry and lands on her grand page", async () => {
    const { rememberLearnerDevice } = await import("@/avatar/learner/learnerProfile");
    rememberLearnerDevice();
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: "Come in, Khadija" }));
    expect(screen.getByRole("button", { name: "Augie the Flower" })).toBeInTheDocument();
    expect(screen.getByText(/Hi, Khadija!/)).toBeInTheDocument();
  });

  it("forgetting the device brings back the full name-and-year door", async () => {
    const { rememberLearnerDevice } = await import("@/avatar/learner/learnerProfile");
    rememberLearnerDevice();
    render(<LearnerHome />);
    fireEvent.click(screen.getByRole("button", { name: /Forget this device/ }));
    expect(screen.queryByRole("button", { name: "Come in, Khadija" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open my door" })).toBeInTheDocument();
  });
});

describe("the wall, both directions", () => {
  it("learner gate blocks its content with no learner session", () => {
    render(
      <LearnerGate roomName="Legend of Logic">
        <div>game-content</div>
      </LearnerGate>,
    );
    expect(screen.queryByText("game-content")).not.toBeInTheDocument();
    expect(screen.getByText(/Khadija's learning place/)).toBeInTheDocument();
  });

  it("learner gate renders for her session", () => {
    startLearnerSession();
    render(
      <LearnerGate roomName="Legend of Logic">
        <div>game-content</div>
      </LearnerGate>,
    );
    expect(screen.getByText("game-content")).toBeInTheDocument();
  });

  it("a learner session opens NO operator room — RoomGate still demands the operator", async () => {
    startLearnerSession();
    render(
      <RoomGate roomName="AR Cube">
        <div>operator-room-content</div>
      </RoomGate>,
    );
    expect(await screen.findByText(/operator-only/)).toBeInTheDocument();
    expect(screen.queryByText("operator-room-content")).not.toBeInTheDocument();
    expect(mocks.verifySession).not.toHaveBeenCalled();
  });
});
