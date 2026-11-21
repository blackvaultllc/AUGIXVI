import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SandboxWindow } from "@/avatar/SandboxWindow";

/**
 * SANDBOX WINDOW (2026-11-21) — the attack-simulation and
 * antivirus-design bench as a small floating box. These tests pin the
 * teaching loop: four big scenario buttons, a trace that starts at
 * rest, stepping that reveals each stage with what the defender sees
 * AND the countermeasure that hooks it, a blueprint derived when the
 * trace completes, a reset that returns to rest, and the simulation-
 * only footer that never leaves the window.
 */
describe("Sandbox window", () => {
  beforeEach(() => {
    localStorage.clear();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  it("renders in a floating window with all four scenarios and the simulation-only footer", () => {
    render(<SandboxWindow onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Close Sandbox" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Phishing Takeover/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ransomware/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Worm Propagation/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /USB Drop/ })).toBeTruthy();
    expect(
      screen.getByText(/Simulation only — no real malware runs here\. Every path shown is a model/),
    ).toBeTruthy();
    // At rest: the first scenario introduces itself, nothing has happened.
    expect(screen.getByText(/At rest — nothing has happened yet/)).toBeTruthy();
    expect(screen.getByText(/Every stage of every attack has a hook/)).toBeTruthy();
  });

  it("stepping forward reveals the stage, its telemetry, and the antivirus hook", () => {
    render(<SandboxWindow onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Step forward/ }));
    expect(screen.getByText("Stage 1: The lure is delivered")).toBeTruthy();
    expect(screen.getByText(/SPF\/DMARC alignment FAIL/)).toBeTruthy();
    expect(screen.getByText("Stop it at the gate")).toBeTruthy();
    expect(screen.getByText(/Stage 1 of 6/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Step back/ }));
    expect(screen.getByText(/At rest — nothing has happened yet/)).toBeTruthy();
  });

  it("stepping to the end derives the antivirus blueprint, and reset clears it", () => {
    render(<SandboxWindow onClose={vi.fn()} />);
    const step = screen.getByRole("button", { name: /Step forward/ });
    for (let i = 0; i < 6; i++) fireEvent.click(step);
    expect(screen.getByText(/Trace complete — 6 stages/)).toBeTruthy();
    expect(screen.getByText("Antivirus blueprint — Phishing Takeover")).toBeTruthy();
    expect(screen.getByText(/Prevention — stop it before it lands/)).toBeTruthy();
    expect(screen.getByText(/Detection — see it the moment it moves/)).toBeTruthy();
    expect(screen.getByText(/Response — cut it off and recover/)).toBeTruthy();
    // The final stage's hook shows in both the antivirus panel and the
    // blueprint's response layer — the blueprint entry names its stage.
    expect(screen.getByText(/Stage 6 — The takeover is used:/)).toBeTruthy();
    expect(screen.getAllByText(/Reset, revoke, and sweep/).length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    expect(screen.getByText(/At rest — nothing has happened yet/)).toBeTruthy();
    expect(screen.queryByText("Antivirus blueprint — Phishing Takeover")).toBeNull();
  });

  it("switching scenarios restarts the trace on the new attack", () => {
    render(<SandboxWindow onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Step forward/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ransomware/ }));
    expect(screen.getByText(/At rest — nothing has happened yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Step forward/ }));
    expect(screen.getByText("Stage 1: The trapped attachment arrives")).toBeTruthy();
    expect(screen.getByText("Match it against the catalogue")).toBeTruthy();
  });

  it("minimizes to the title bar and closes through the X button", () => {
    const onClose = vi.fn();
    const { container } = render(<SandboxWindow onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Minimize Sandbox" }));
    expect(container.querySelector(".window-sandbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restore Sandbox" }));
    expect(container.querySelector(".window-sandbox")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close Sandbox" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
