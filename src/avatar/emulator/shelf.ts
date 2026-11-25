/**
 * THE GAME SHELF — every game Augie's emulators carry, and the law
 * they got there by (the Captain's grid-down legal-only rule, restated
 * on the emulator order 2026-11-25: "all the games we can get" —
 * legally).
 *
 * A game is on this shelf ONLY when it is homebrew, public-domain,
 * or freeware whose author/license clearly allows free distribution.
 * Each entry names its author and its license basis; the full source
 * record lives beside this file in SOURCES.md. Commercial ROMs are
 * never bundled — not "abandonware", not ROM packs. For the games he
 * owns, the panel's "Add your own game" loader plays his own files
 * from his own device; nothing of his is uploaded or kept.
 *
 * The emulator cores are EmulatorJS 4.2.3 (open source) running
 * entirely in the browser on this machine — no internet, no account.
 * The app carries the default core for each system it offers; the
 * package's Nintendo 64 and PlayStation cores were left out for
 * size and can be added the same way later.
 */

export type EmuSystem = "nes" | "snes" | "gb" | "gba" | "segaMD";

export const EMU_SYSTEMS: { id: EmuSystem; label: string; kidLabel: string }[] = [
  { id: "nes", label: "NES", kidLabel: "Nintendo (NES)" },
  { id: "snes", label: "Super Nintendo", kidLabel: "Super Nintendo" },
  { id: "gb", label: "Game Boy / Color", kidLabel: "Game Boy" },
  { id: "gba", label: "Game Boy Advance", kidLabel: "Game Boy Advance" },
  { id: "segaMD", label: "Genesis / Mega Drive", kidLabel: "Genesis" },
];

export interface ShelfGame {
  title: string;
  system: EmuSystem;
  /** Path under the app's public root, e.g. /roms/snes/game.sfc */
  file: string;
  author: string;
  /** Why this game is legal to carry — the license / free-distribution basis. */
  license: string;
}

export const SHELF: ShelfGame[] = [
  {
    title: "Blade Buster",
    system: "nes",
    file: "/roms/nes/blade-buster.nes",
    author: "High Level Challenge (HLC Project)",
    license: "Freeware homebrew — the author offers the ROM free on his own site",
  },
  {
    title: "Nova the Squirrel",
    system: "nes",
    file: "/roms/nes/nova-the-squirrel.nes",
    author: "NovaSquirrel",
    license: "Open source (GPL-3.0) — the author's own GitHub release",
  },
  {
    title: "Super Boss Gaiden",
    system: "snes",
    file: "/roms/snes/super-boss-gaiden.sfc",
    author: "Dieter von Laser (d4s) and Chrono Moogle",
    license: "Freeware homebrew — released as a free download by its authors (2016)",
  },
  {
    title: "Tobu Tobu Girl",
    system: "gb",
    file: "/roms/gb/tobu-tobu-girl.gb",
    author: "Tangram Games (Simon Larsen)",
    license: "Open source — code MIT, assets CC BY 4.0",
  },
  {
    title: "Sheep It Up!",
    system: "gb",
    file: "/roms/gb/sheep-it-up.gb",
    author: "Dr. Ludos",
    license: "Free ROM version — the game itself says: free to distribute to anyone",
  },
  {
    title: "µCity (uCity)",
    system: "gb",
    file: "/roms/gb/ucity.gbc",
    author: "Antonio Niño Díaz (AntonioND)",
    license: "Open source (GPL-3.0) — a Game Boy Color city builder",
  },
  {
    title: "Anguna: Warriors of Virtue",
    system: "gba",
    file: "/roms/gba/anguna.gba",
    author: "Nathan Tolbert (gauauu) / Bite the Chili Productions",
    license: "Freeware — the author's readme allows free distribution in binary form",
  },
  {
    title: "Old Towers",
    system: "segaMD",
    file: "/roms/segaMD/old-towers.bin",
    author: "RetroSouls (Denis Grachev; music Oleg Nikitin)",
    license: "CC BY-NC-SA 4.0 — free release, may be shared, never sold",
  },
];

export function gamesForSystem(system: EmuSystem): ShelfGame[] {
  return SHELF.filter((game) => game.system === system);
}
