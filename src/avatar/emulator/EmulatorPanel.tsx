/**
 * THE EMULATOR PANEL — Battle Box inside Augie (the Captain's order
 * 2026-11-25: "every emulator we can get and all the games we can
 * get", in his area AND in Khadija's area, click and play).
 *
 * One panel, two homes: his stage window (full shelf + the own-game
 * loader) and her Play cabinet (kid=true — the same legal shelf in
 * big friendly tiles, no loader; Daddy adds games on his side).
 *
 * The machines are EmulatorJS cores (open source) covering NES,
 * Super Nintendo, Game Boy / Color, Game Boy Advance, and Genesis /
 * Mega Drive, running in the browser on this machine — no internet,
 * no account, nothing leaves the device. The games on the shelf are
 * homebrew / public-domain / freeware only, each carrying its author
 * and license (see shelf.ts). "Add your own game" plays a file he
 * owns from his own device — it is never uploaded or kept.
 */
import { useMemo, useRef, useState } from "react";
import { EMU_SYSTEMS, gamesForSystem, type EmuSystem } from "./shelf";

interface Playing {
  core: EmuSystem;
  url: string;
  name: string;
}

export function emulatorFrameSrc(playing: Playing): string {
  const params = new URLSearchParams({
    core: playing.core,
    rom: playing.url,
    name: playing.name,
  });
  return `/emulator/play.html?${params.toString()}`;
}

export function EmulatorPanel({ kid = false }: { kid?: boolean }) {
  const [system, setSystem] = useState<EmuSystem>("snes");
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [ownName, setOwnName] = useState("");
  const ownUrlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const games = useMemo(() => gamesForSystem(system), [system]);
  const systemLabel = EMU_SYSTEMS.find((s) => s.id === system);

  function playShelfGame(file: string, title: string) {
    setOwnName("");
    setPlaying({ core: system, url: file, name: title });
  }

  function playOwnGame(file: File) {
    if (ownUrlRef.current) URL.revokeObjectURL(ownUrlRef.current);
    const url = URL.createObjectURL(file);
    ownUrlRef.current = url;
    setOwnName(file.name);
    setPlaying({ core: system, url, name: file.name });
  }

  return (
    <div className={kid ? "emulator-panel emulator-panel--kid" : "emulator-panel"}>
      <div className="emulator-panel__systems" role="tablist" aria-label="Game systems">
        {EMU_SYSTEMS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={system === s.id}
            className={
              system === s.id
                ? "emulator-panel__system emulator-panel__system--active"
                : "emulator-panel__system"
            }
            onClick={() => setSystem(s.id)}
          >
            {kid ? s.kidLabel : s.label}
          </button>
        ))}
      </div>

      <div className="emulator-panel__shelf" aria-label={`${systemLabel?.label ?? ""} games`}>
        {games.length === 0 && (
          <p className="emulator-panel__empty">
            No free games for this system yet. The shelf only carries games that are free to
            share — homebrew and public-domain games.
            {kid ? " Daddy can add more on his side." : " You can still add a game you own below."}
          </p>
        )}
        {games.map((game) => (
          <button
            key={game.file}
            type="button"
            className="emulator-panel__game"
            onClick={() => playShelfGame(game.file, game.title)}
          >
            <span className="emulator-panel__game-title">{game.title}</span>
            {!kid && (
              <span className="emulator-panel__game-meta">
                {game.author} · {game.license}
              </span>
            )}
          </button>
        ))}
      </div>

      {!kid && (
        <div className="emulator-panel__own">
          <input
            ref={fileRef}
            type="file"
            hidden
            aria-label="Add your own game file"
            accept=".nes,.sfc,.smc,.gb,.gbc,.gba,.md,.gen,.bin,.zip"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) playOwnGame(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="emulator-panel__own-button"
            onClick={() => fileRef.current?.click()}
          >
            Add your own game
          </button>
          <span className="emulator-panel__own-note">
            A game file from your own device, for the system picked above. It plays here and is
            never uploaded or kept.
          </span>
          {ownName && <span className="emulator-panel__own-name">Loaded: {ownName}</span>}
        </div>
      )}

      <div className="emulator-panel__screen">
        {playing ? (
          <iframe
            key={playing.url + playing.name}
            src={emulatorFrameSrc(playing)}
            title={`Playing ${playing.name}`}
            allow="gamepad; autoplay; fullscreen"
          />
        ) : (
          <p className="emulator-panel__idle">
            {kid
              ? "Tap a game up top and it starts right here!"
              : "Pick a game from the shelf and it starts right here."}
          </p>
        )}
      </div>

      {!kid && (
        <p className="emulator-panel__law">
          EmulatorJS cores (open source), running on this machine. Shelf games are homebrew,
          public-domain, or freeware — each one names its author and license. No commercial ROMs
          are bundled, ever.
        </p>
      )}
    </div>
  );
}
