import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmulatorPanel, emulatorFrameSrc } from "@/avatar/emulator/EmulatorPanel";
import { EMU_SYSTEMS, SHELF, gamesForSystem } from "@/avatar/emulator/shelf";

/**
 * The emulator panel (owner order 2026-11-25): every emulator we
 * can get, both areas, click and play — games LEGAL ONLY. The pins:
 * all five systems are offered; every shelf game carries an author
 * and a license and a file under /roms; a system with no verified
 * free games says so plainly instead of faking a shelf; his side
 * has the own-game loader, her kid shape does not; tapping a game
 * points the screen at the app's own emulator host.
 */
describe("emulator panel", () => {
  it("offers every system — NES, Super Nintendo, Game Boy, Advance, Genesis", () => {
    render(<EmulatorPanel />);
    for (const system of EMU_SYSTEMS) {
      expect(screen.getByRole("tab", { name: system.label })).toBeInTheDocument();
    }
  });

  it("every shelf game is legal on its face: author, license, and a /roms file", () => {
    for (const game of SHELF) {
      expect(game.author.length).toBeGreaterThan(0);
      expect(game.license.length).toBeGreaterThan(0);
      expect(game.file.startsWith("/roms/")).toBe(true);
      expect(EMU_SYSTEMS.some((s) => s.id === game.system)).toBe(true);
    }
  });

  it("a system with no verified free games says so plainly", () => {
    render(<EmulatorPanel />);
    const emptySystem = EMU_SYSTEMS.find((s) => gamesForSystem(s.id).length === 0);
    if (!emptySystem) return; // every system has a shelf — nothing to pin
    fireEvent.click(screen.getByRole("tab", { name: emptySystem.label }));
    expect(screen.getByText(/No free games for this system yet/)).toBeInTheDocument();
    expect(screen.getByText(/homebrew and public-domain/)).toBeInTheDocument();
  });

  it("his side carries the own-game loader; her kid shape does not", () => {
    const { unmount } = render(<EmulatorPanel />);
    expect(screen.getByRole("button", { name: "Add your own game" })).toBeInTheDocument();
    expect(screen.getByText(/never uploaded or kept/)).toBeInTheDocument();
    unmount();
    render(<EmulatorPanel kid />);
    expect(screen.queryByRole("button", { name: "Add your own game" })).not.toBeInTheDocument();
  });

  it("kid shape uses the big friendly system names", () => {
    render(<EmulatorPanel kid />);
    expect(screen.getByRole("tab", { name: "Super Nintendo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Game Boy Advance" })).toBeInTheDocument();
  });

  it("tapping a shelf game points the screen at the emulator host with its core", () => {
    const first = SHELF[0];
    if (!first) return; // empty shelf — covered by the honest-empty pins
    render(<EmulatorPanel />);
    const system = EMU_SYSTEMS.find((s) => s.id === first.system)!;
    fireEvent.click(screen.getByRole("tab", { name: system.label }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(first.title) }));
    const frame = screen.getByTitle(`Playing ${first.title}`);
    const src = frame.getAttribute("src") ?? "";
    expect(src.startsWith("/emulator/play.html?")).toBe(true);
    expect(src).toContain(`core=${first.system}`);
    expect(src).toContain(encodeURIComponent(first.file));
  });

  it("the frame src builder keeps the game name and core together", () => {
    const src = emulatorFrameSrc({ core: "snes", url: "/roms/snes/game.sfc", name: "A Game" });
    expect(src).toContain("core=snes");
    expect(src).toContain("name=A+Game");
  });
});
