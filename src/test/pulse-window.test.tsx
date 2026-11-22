import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PulseWindow } from "@/avatar/PulseWindow";

/**
 * PULSE WINDOW (2026-11-21) — the pulse sense as a small floating box
 * (the operator's standing UI rule: contained, resizable, minimizable,
 * never a full-screen takeover). jsdom has no camera or microphone, so
 * these tests pin the honest states: the window explains itself before
 * anything starts, carries the privacy sentence, and when sensing is
 * started with no devices available it says so in plain words for BOTH
 * the camera and the mic — never a silent dead box, never a fake
 * reading.
 */
describe("Pulse window", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it("renders in a floating window with the privacy sentence and an honest idle state", () => {
    render(<PulseWindow onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Close Pulse" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start sensing" })).toBeTruthy();
    expect(screen.getByText(/Nothing is recorded or stored/)).toBeTruthy();
    expect(screen.getByText(/UNAVAILABLE — not started/)).toBeTruthy();
    expect(screen.getByText(/Presence: — · Motion: — · Pulse: unavailable/)).toBeTruthy();
  });

  it("with no camera or mic available, starting sensing explains both — never silently dead", async () => {
    render(<PulseWindow onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Start sensing" }));
    await waitFor(() => {
      expect(screen.getByText(/The camera could not be opened/)).toBeTruthy();
    });
    expect(screen.getByText(/The microphone could not be opened/)).toBeTruthy();
    // Still no invented reading after the failed start.
    expect(screen.queryByText(/BPM · estimate/)).toBeNull();
  });

  it("switches vitals source: Watch reads honestly UNAVAILABLE with no invented numbers (Part 20)", () => {
    render(<PulseWindow onClose={vi.fn()} />);
    const watch = screen.getByRole("button", { name: "Watch" });
    const camera = screen.getByRole("button", { name: "Camera" });
    expect(camera).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(watch);
    expect(watch).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/WATCH — UNAVAILABLE/)).toBeTruthy();
    expect(screen.getByText(/Ghost Protocol One/)).toBeTruthy();
    // The camera sense is gone while the watch source is showing, and
    // no vitals number of any kind is displayed.
    expect(screen.queryByRole("button", { name: "Start sensing" })).toBeNull();
    expect(screen.queryByText(/BPM/)).toBeNull();
    fireEvent.click(camera);
    expect(screen.getByRole("button", { name: "Start sensing" })).toBeTruthy();
  });

  it("minimizes to the title bar and closes through the X button", () => {
    const onClose = vi.fn();
    const { container } = render(<PulseWindow onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Minimize Pulse" }));
    expect(container.querySelector(".window-pulse")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restore Pulse" }));
    expect(container.querySelector(".window-pulse")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close Pulse" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
