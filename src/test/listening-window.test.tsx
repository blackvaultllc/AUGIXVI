import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListeningWindow } from "@/avatar/ListeningWindow";

/**
 * LISTENING MODE WINDOW (Part 12 + 13) — jsdom has no microphone and
 * no speech service, so these tests pin the honest states against a
 * mocked /api: disarmed says OFF with an arm button, armed shows the
 * LISTENING indicator with the service's own line count, the speaker
 * panel says separation is not running when no voiceprint is
 * enrolled, and arming with no mic available says so in words instead
 * of pretending to feed the session.
 */

function mockApi(handlers: Record<string, () => unknown>) {
  return vi.fn(async (input: string, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const key = `${method} ${path}`;
    const handler = handlers[key] ?? handlers[path];
    if (!handler) return Response.json({ error: `unmocked ${key}` }, { status: 404 });
    return Response.json(handler());
  });
}

const DISARMED = { armed: false, sessionId: null, startedAt: null, lineCount: 0, wakeHeard: false };
const NOT_ENROLLED = {
  enrolled: false,
  separationAvailable: false,
  state: "not-enrolled",
  kept: "embeddings and transcripts only — raw audio is never retained",
  entries: [],
  speakers: [],
};

describe("Listening window", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    vi.restoreAllMocks();
  });

  it("shows OFF, the arm button, and the not-enrolled speaker state", async () => {
    vi.stubGlobal(
      "fetch",
      mockApi({
        "/api/listening/status": () => DISARMED,
        "/api/speakers/others": () => NOT_ENROLLED,
      }),
    );
    render(<ListeningWindow onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Listening is OFF/)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /Arm listening/ })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText(/Speaker separation is not running/)).toBeTruthy();
    });
    expect(screen.getByText(/raw audio is never retained/)).toBeTruthy();
    expect(screen.getByText(/No other voices stored yet/)).toBeTruthy();
  });

  it("shows the LISTENING indicator with the service's line count while armed", async () => {
    vi.stubGlobal(
      "fetch",
      mockApi({
        "/api/listening/status": () => ({
          armed: true,
          sessionId: "listen-9",
          startedAt: "2026-11-22T09:20:57Z",
          lineCount: 4,
          wakeHeard: true,
        }),
        "/api/speakers/others": () => ({
          ...NOT_ENROLLED,
          enrolled: true,
          separationAvailable: true,
          state: "ready",
          speakers: [{ label: "Speaker 2", utterances: 2, firstHeard: "t1", lastHeard: "t2" }],
          entries: [
            {
              timestamp: "2026-11-22T09:21:02Z",
              label: "Speaker 2",
              similarity: 0.15,
              transcript: "hello there",
              duration_s: 2,
            },
          ],
        }),
      }),
    );
    render(<ListeningWindow onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("listening-indicator").textContent).toContain("LISTENING");
    });
    expect(screen.getByText(/4 line\(s\) recorded/)).toBeTruthy();
    expect(screen.getByText(/Osiris heard his name/)).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText(/Speaker 2/).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/hello there/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Disarm/ })).toBeTruthy();
  });

  it("arming with no microphone available says so — never a silent fake feed", async () => {
    vi.stubGlobal(
      "fetch",
      mockApi({
        "/api/listening/status": () => DISARMED,
        "/api/speakers/others": () => NOT_ENROLLED,
        "POST /api/listening/arm": () => ({
          armed: true,
          sessionId: "listen-10",
          startedAt: "2026-11-22T09:20:57Z",
          lineCount: 0,
          wakeHeard: false,
        }),
      }),
    );
    render(<ListeningWindow onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Arm listening/ })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /Arm listening/ }));
    await waitFor(() => {
      expect(screen.getByText(/The microphone could not be opened/)).toBeTruthy();
    });
    // The indicator still reports the service's armed state truthfully.
    expect(screen.getByTestId("listening-indicator").textContent).toContain("LISTENING");
  });
});
