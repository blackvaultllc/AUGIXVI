import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PulseWindow } from "@/avatar/PulseWindow";

const baseCss = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

/** One CSS rule block (selector through its closing brace). */
function cssRule(selector: string): string {
  const start = baseCss.indexOf(`${selector} {`);
  expect(start, `rule for ${selector}`).toBeGreaterThanOrEqual(0);
  const end = baseCss.indexOf("}", start);
  return baseCss.slice(start, end);
}

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

  it("layout (2026-11-24): one consolidated row — readouts flank the picture, stats inside the frame, fixed sizes", () => {
    // The Captain's screenshot showed the old waste: picture in the
    // middle with black gaps beside it, every readout stacked below.
    // Now the main grid stacks picture-then-readouts when the panel
    // is narrow, and a container query on the PANEL's own width
    // opens the wide row: heart rate left, picture center,
    // frequencies right.
    const main = cssRule(".window-pulse__main");
    expect(main).toContain("display: grid");
    expect(main).toContain('"stage"');
    expect(baseCss).toContain("@container pulse (min-width: 60rem)");
    expect(baseCss).toContain('grid-template-areas: "heart stage freq"');
    // The stage is the center column — no height cap holds it small.
    const stage = cssRule(".window-pulse__stage");
    expect(stage).toContain("grid-area: stage");
    expect(stage).not.toContain("max-height");
    const video = cssRule(".window-pulse__video");
    expect(video).not.toContain("max-height");
    // The live summary rides INSIDE the picture as a dark overlay
    // box at its corner — never over the face at the center.
    expect(cssRule(".window-pulse__hud-box")).toContain("position: absolute");
    // FIXED DIMENSIONS (his anti-jump order): the live regions hold
    // their size, so a changing value never reflows the page.
    expect(cssRule(".window-pulse__summary")).toContain("height: 5.4rem");
    expect(cssRule(".window-pulse__reading")).toContain("height: 4.4rem");
    expect(cssRule(".window-pulse__perception")).toContain("height:");
  });

  it("layout (2026-11-23): the analytics type is bold — bifocal-readable sizes", () => {
    const bpm = cssRule(".window-pulse__bpm");
    const bpmSize = /font-size: ([\d.]+)rem/.exec(bpm);
    expect(bpmSize).not.toBeNull();
    expect(Number(bpmSize![1])).toBeGreaterThanOrEqual(2.4);
    for (const sel of [
      ".window-pulse__pane h3",
      ".window-pulse__quality",
      ".window-pulse__state",
      ".window-pulse__summary",
    ]) {
      const m = /font-size: ([\d.]+)rem/.exec(cssRule(sel));
      expect(m, sel).not.toBeNull();
      expect(Number(m![1]), sel).toBeGreaterThanOrEqual(0.85);
    }
    const presence = /font-size: ([\d.]+)rem/.exec(cssRule(".window-pulse__freq"));
    expect(presence).not.toBeNull();
    expect(Number(presence![1])).toBeGreaterThanOrEqual(0.9);
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
