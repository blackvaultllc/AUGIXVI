/**
 * THE UPDATE CONTROL — his own update button in the Status panel
 * (owner order 2026-11-26 ~17:37 CST). It shows the two builds in
 * plain words, runs only on his two taps, shows the run's plain
 * progress, and states a failure plainly — naming the step and
 * that nothing was changed.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateControl } from "@/avatar/UpdateControl";
import * as logsServer from "@/avatar/logs.server";
import { getOperatorAccessToken } from "@/avatar/trustedDevice";

vi.mock("@/avatar/logs.server", () => ({
  getUpdateView: vi.fn(),
  requestUpdate: vi.fn(),
}));

vi.mock("@/avatar/trustedDevice", () => ({
  getOperatorAccessToken: vi.fn(),
}));

const getUpdateView = vi.mocked(logsServer.getUpdateView);
const requestUpdate = vi.mocked(logsServer.requestUpdate);
const token = vi.mocked(getOperatorAccessToken);

const SHA_A = "aaaaaaa1111111111111111111111111111111";
const SHA_B = "bbbbbbb2222222222222222222222222222222";

function view(overrides: Partial<logsServer.UpdateView>): logsServer.UpdateView {
  return {
    authorized: true,
    available: true,
    current: SHA_A,
    latest: SHA_A,
    updateAvailable: false,
    logTail: ["=== update started 2026-11-26T10:00:00-06:00 ==="],
    run: { phase: "idle" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  token.mockResolvedValue("test-token");
});

describe("UpdateControl", () => {
  it("says up to date when the running build is the newest", async () => {
    getUpdateView.mockResolvedValue(view({}));
    render(<UpdateControl />);
    expect(await screen.findByText(/Up to date/)).toBeTruthy();
    expect(screen.getAllByText(/aaaaaaa/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Update IEM/ })).toBeNull();
  });

  it("offers the button when a new build is ready, and runs only on the second tap", async () => {
    getUpdateView.mockResolvedValue(
      view({ latest: SHA_B, updateAvailable: true }),
    );
    requestUpdate.mockResolvedValue({ authorized: true, started: true });
    render(<UpdateControl />);
    const first = await screen.findByRole("button", { name: "Update IEM" });
    fireEvent.click(first);
    expect(requestUpdate).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("button", {
      name: /Tap again to start the update/,
    });
    fireEvent.click(confirm);
    await waitFor(() => expect(requestUpdate).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/An update is running now/),
    ).toBeTruthy();
  });

  it("states a failed run plainly — the step, and that nothing changed", async () => {
    getUpdateView.mockResolvedValue(
      view({
        latest: SHA_B,
        updateAvailable: true,
        run: { phase: "failed", step: "build" },
      }),
    );
    render(<UpdateControl />);
    const words = await screen.findByText(/did not finish/);
    expect(words.textContent).toContain("build");
    expect(words.textContent).toContain("Nothing was changed");
  });

  it("shows a running run's progress from the server's reading", async () => {
    getUpdateView.mockResolvedValue(view({ run: { phase: "running" } }));
    render(<UpdateControl />);
    expect(await screen.findByText(/running now/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Update IEM/ })).toBeNull();
  });

  it("says plainly when the surface is not the core machine", async () => {
    getUpdateView.mockResolvedValue(
      view({ current: null, latest: null, updateAvailable: null, logTail: [] }),
    );
    render(<UpdateControl />);
    expect(
      await screen.findByText(/cannot update itself/),
    ).toBeTruthy();
  });

  it("asks for the operator sign-in when there is no token", async () => {
    token.mockResolvedValue(null);
    render(<UpdateControl />);
    expect(
      await screen.findByText(/Sign in as the operator/),
    ).toBeTruthy();
    expect(getUpdateView).not.toHaveBeenCalled();
  });

  it("reports a refused start with its reason — nothing dressed up", async () => {
    getUpdateView.mockResolvedValue(
      view({ latest: SHA_B, updateAvailable: true }),
    );
    requestUpdate.mockResolvedValue({
      authorized: true,
      started: false,
      reason: "an update is already running — let it finish and read its result",
    });
    render(<UpdateControl />);
    fireEvent.click(await screen.findByRole("button", { name: "Update IEM" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /Tap again to start/ }),
    );
    expect(await screen.findByText(/already running/)).toBeTruthy();
  });
});
