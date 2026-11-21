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
