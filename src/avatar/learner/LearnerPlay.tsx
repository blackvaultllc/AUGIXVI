/**
 * HER PLAY CABINET — the emulators, in her own space (the Captain's
 * order 2026-11-25: emulators in her area too, click and play —
 * Super Nintendo named by name).
 *
 * The same Battle Box panel Daddy has on his stage, in its kid
 * shape: big system buttons, big game tiles, and only the legal
 * shelf — homebrew and public-domain games that are free to share.
 * Tap a game and it plays right here. No downloads, no accounts,
 * no leaving her page.
 */
import { EmulatorPanel } from "../emulator/EmulatorPanel";

export function LearnerPlay() {
  return (
    <div className="learner-play">
      <h2>Play Games</h2>
      <p className="learner-play__line">
        Real game machines, right here! Pick a machine, tap a game, and play.
      </p>
      <EmulatorPanel kid />
    </div>
  );
}
