# Emulator Shelf — Sources & Licenses

Staged 2026-11-25. LEGAL ONLY: EmulatorJS (open source) + homebrew / public-domain /
freeware ROMs whose authors allow free distribution. No commercial ROMs, no
"abandonware", no ROM-pack sites were used.

## Emulator runtime — EmulatorJS

- **Version:** 4.2.3 (data/version.json in the extracted package confirms `"version": "4.2.3"`)
- **Source URL (exact):** https://github.com/EmulatorJS/EmulatorJS/releases/download/v4.2.3/4.2.3.7z
  (official GitHub release asset `4.2.3.7z`, 303,554,683 bytes, from
  https://github.com/EmulatorJS/EmulatorJS/releases — latest stable v4.x as of 2026-11-25.
  The npm package `emulatorjs` was checked first and is unpublished/404 on npm, so the
  GitHub release was used.)
- **Location:** `emulatorjs/data/` — loader.js, emulator.min.js, emulator.min.css,
  emulator.css, version.json, src/, compression/, localization/, cores/
- **Final size of `emulatorjs/` folder: 54 MB** (the full upstream data/ folder is
  296 MB / ~50 cores, so cores were pruned to the list below to stay well under ~200 MB;
  loader.js and every kept core retain all 4 build variants:
  wasm / thread-wasm / legacy-wasm / thread-legacy-wasm)
- **Cores kept (12):**
  - `fceumm`, `nestopia` — NES
  - `snes9x` — SNES
  - `gambatte` — Game Boy + Game Boy Color
  - `mgba` — Game Boy Advance (also GB/GBC)
  - `genesis_plus_gx`, `picodrive` — Sega Genesis / Mega Drive (segaMD)
  - `smsplus` — Sega Master System (bonus, small)
  - `mupen64plus_next`, `parallel_n64` — Nintendo 64 (included because the pruned
    total stayed far under the ~200 MB cap)
  - `pcsx_rearmed`, `mednafen_psx_hw` — PlayStation (same reason)
- **Cores pruned:** all other upstream cores (arcade fbneo/mame, PSP ppsspp, DS
  desmume/melonds, Saturn yabause, DOS dosbox_pure, Commodore vice_*, etc.) — not
  needed for this shelf and they are what pushed the full package to 296 MB.
- EmulatorJS itself is open source (see the upstream repo's LICENSE); the cores are
  libretro cores under their own open-source licenses (see cores/cores.json and
  cores/core-README.md, kept in the folder).

## Game ROMs

Every file was sanity-checked after download: correct extension, non-trivial size,
and magic bytes where the format has them (NES header `NES\x1a` ✓ on both NES ROMs;
Nintendo logo at 0x104 ✓ on all GB/GBC ROMs and the GBA ROM; `SEGA MEGA DRIVE`
header at 0x100 ✓ on the Genesis ROM; SNES has no standard magic — 512 KB .sfc).

### NES — roms/nes/blade-buster.nes (393,232 bytes)
- **Title:** Blade Buster
- **Author:** High Level Challenge (HLC Project)
- **License / basis:** Freeware homebrew. The author distributes the ROM free from
  his own site (the Raspberry Pi Foundation's legal-ROMs guide also lists it as a
  free legal download from the developer's website).
- **Source URL (exact file downloaded):** http://hlc6502.web.fc2.com/BB_20120301.zip
  (linked as "BLADE BUSTER Download" from the author's page
  http://hlc6502.web.fc2.com/Bbuster.htm ; the .nes inside the zip was extracted)

### NES — roms/nes/nova-the-squirrel.nes (262,160 bytes)
- **Title:** Nova the Squirrel
- **Author:** NovaSquirrel
- **License / basis:** Open source — GPL-3.0 (source headers in the repo state GPLv3;
  author's own GitHub release asset).
- **Source URL (exact):** https://github.com/NovaSquirrel/NovaTheSquirrel/releases/download/v1.0.6a/nova.nes
- **Note:** the original Nova the Squirrel is an NES game. Its SNES sequel
  (NovaTheSquirrel2) has no published ROM release on GitHub, so it was not used —
  see Skipped below.

### SNES — roms/snes/super-boss-gaiden.sfc (524,288 bytes)
- **Title:** Super Boss Gaiden
- **Authors:** Dieter von Laser (d4s) and Chrono Moogle
- **License / basis:** Freeware homebrew — released as a free download by the
  authors on 2016-07-10 via superfamicom.org (contemporary coverage: Nintendo Life,
  Siliconera, Digital Trends all describe the authors' free release). No formal
  license text ships in the package — this is the least formally documented license
  on the shelf; the basis is the authors' own public free release.
- **Source URL (exact file downloaded):** https://raw.githubusercontent.com/retrobrews/snes-games/master/superbossgaiden.sfc
  (retrobrews = curated free-homebrew collection; the file is the authors' free
  SNES ROM version)

### GB — roms/gb/tobu-tobu-girl.gb (262,144 bytes)
- **Title:** Tobu Tobu Girl
- **Author:** Tangram Games (Simon Larsen; music by potato-tan)
- **License / basis:** Open source — code under MIT License, assets under
  CC BY 4.0 (LICENSE in https://github.com/SimonLarsen/tobutobugirl); ROM offered
  free by the author.
- **Source URL (exact file downloaded):** https://raw.githubusercontent.com/gbdev/database/master/entries/tobutobugirl/tobu.gb
  (gbdev Homebrew Hub database — the GB homebrew community's author-submitted
  archive; used because itch.io does not offer a direct unauthenticated download)

### GB — roms/gb/sheep-it-up.gb (32,768 bytes)
- **Title:** Sheep It Up!
- **Author:** Dr. Ludos
- **License / basis:** This is the author's designated "Free ROM" version; the text
  file bundled with it (sheepitup.txt in the same archive entry) says verbatim:
  "You're currently playing a 'Free ROM' version of the game. Feel free to
  distribute it to anyone you want!"
- **Source URL (exact file downloaded):** https://raw.githubusercontent.com/gbdev/database/master/entries/sheepitup/sheepitup.gb

### GB (GBC ROM) — roms/gb/ucity.gbc (131,072 bytes)
- **Title:** µCity (uCity)
- **Author:** Antonio Niño Díaz (AntonioND)
- **License / basis:** Open source — GPL-3.0 (gpl-3.0.txt in the author's repo);
  author's own GitHub release asset, v1.3.
- **Source URL (exact):** https://github.com/AntonioND/ucity/releases/download/v1.3/ucity.gbc
- **Note:** it is a Game Boy Color ROM (.gbc) shelved under roms/gb/ and listed as
  system "gb" in manifest.json per the shelf's system set — the EmulatorJS `gb`
  core (gambatte) covers GB + GBC.

### GBA — roms/gba/anguna.gba (1,710,888 bytes)
- **Title:** Anguna: Warriors of Virtue
- **Author:** Nathan Tolbert (gauauu) / Bite the Chili Productions; art by
  Chris Hildenbrand
- **License / basis:** Freeware — the author's bundled readme (anguna.txt) states:
  "Anguna may be distributed freely in binary form, as long as the text of this
  file is made available with it." (That readme is in the retrobrews gba-games
  repo next to the ROM.)
- **Source URL (exact file downloaded):** https://raw.githubusercontent.com/retrobrews/gba-games/master/anguna.gba
  (author also offers it free at https://gauauu.itch.io/anguna)

### Genesis / Mega Drive — roms/segaMD/old-towers.bin (786,432 bytes)
- **Title:** Old Towers (v1.2, 2019-03-18)
- **Author:** RetroSouls — game by Denis Grachev, music by Oleg Nikitin (n1k-o)
- **License / basis:** CC BY-NC-SA 4.0 — the full license text is bundled in the
  game's readme (oldtowers.txt); the itch.io release is "FREE or pay what you
  want" and the readme notes the software "can be used [for] any purpose and
  redistributed freely. However, it cannot be sold."
- **Source URL (exact file downloaded):** https://raw.githubusercontent.com/retrobrews/md-games/master/oldtowers.bin
  (author's page: https://retrosouls.itch.io/old-towers)

## Skipped / not used — and why

- **Nova the Squirrel (SNES version):** the SNES sequel repo
  (NovaSquirrel/NovaTheSquirrel2) publishes no ROM release; only the NES original
  has an author's release. Used the NES original instead of bending the rule.
- **Deadeus (GB):** present in the gbdev database, but its entry carries no license
  or free-distribution statement I could verify — skipped rather than assumed.
- **Misplaced (Genesis, RetroSouls):** free on itch.io, but itch.io offers no
  direct unauthenticated download and no author GitHub/mirror copy was verified —
  skipped; Old Towers covers Genesis.
- **Tobu Tobu Girl Deluxe (GBC):** free and MIT/CC-BY like the original, but no
  direct download was reachable outside itch.io — the original Tobu Tobu Girl
  (via gbdev) covers GB; not a license problem, a download-path problem.
- **N-Warp Daisakusen (SNES):** a multiplayer homebrew built around a commercial
  game's assets/hack lineage — excluded per instructions.
- **Micro Mages (NES), Goodboy Galaxy (GBA), Haunted Halloween '85 demo:** commercial
  products — excluded, as instructed.
- **2048gb and other gbdev entries:** not individually license-verified in this
  pass — not included rather than padded in unverified.
