import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SoundWatchWindow } from "@/avatar/SoundWatchWindow";

/**
 * SOUND WATCH WINDOW (2026-11-23) — jsdom has no microphone and no
 * wasm runtime, so these pins hold the window's honest frame: the
 * YAMNet engine note (v2 — the classifier is in the build, on-device,
 * offline), the classifier load-state line (it reports loading /
 * failed honestly rather than pretending), the distance/direction
 * truth lines, the no-audio privacy line, and the empty library.
 * The live hearing path is BUILT, NOT YET VERIFIED — his ears on
 * patrol are the gate.
 */
describe("SoundWatchWindow", () => {
  it("renders the honest frame: engine note, truth lines, empty library", () => {
    render(<SoundWatchWindow onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /start watching/i })).toBeTruthy();
    // Engine honesty: YAMNet is claimed as what it is — on-device,
    // in the bundle, threshold-bound, never guessing.
    expect(screen.getAllByText(/YAMNet/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/never guesses a name/i)).toBeTruthy();
    expect(screen.getByText(/outrank/i)).toBeTruthy();
    // Distance is an estimate; direction is never claimed.
    expect(screen.getByText(/estimate from loudness only/i)).toBeTruthy();
    expect(screen.getByText(/cannot tell direction/i)).toBeTruthy();
    // Privacy: nothing recorded, no audio stored.
    expect(screen.getByText(/no audio is stored/i)).toBeTruthy();
    // The Pokédex starts empty and says how it fills.
    expect(screen.getByText(/your sound library — 0 learned/i)).toBeTruthy();
    expect(screen.getByText(/Nothing learned yet/i)).toBeTruthy();
  });

  it("starts in the off state and explains UNCLASSIFIED before any sound", () => {
    render(<SoundWatchWindow onClose={vi.fn()} voiceEarBusy={() => false} />);
    expect(screen.getByText(/Sound Watch is off/i)).toBeTruthy();
    expect(screen.getByText(/marked UNCLASSIFIED until you name them/i)).toBeTruthy();
  });
});
