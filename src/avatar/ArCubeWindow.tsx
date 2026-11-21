/**
 * AR CUBE WINDOW — the AR Cube in a small floating box on the avatar
 * screen (operator UI rule 2026-11-21: Augie's tools live in contained
 * boxes that do not take over the screen; resizable and minimizable).
 * The box hosts the same /ar-cube page the full room at /avatar/cube
 * shows, in an iframe on the app's own origin so the operator gate and
 * camera permission hold exactly as in the room. Operator-only: it
 * renders inside the signed-in stage like every other window.
 */
import { FloatingWindow } from "./windows/FloatingWindow";

export function ArCubeWindow({ onClose }: { onClose: () => void }) {
  return (
    <FloatingWindow
      id="ar-cube"
      title="AR Cube"
      onClose={onClose}
      initialWidth={520}
      initialHeight={600}
    >
      <div className="window-ar-cube">
        <iframe src="/ar-cube/index.html" title="Augie AR Cube" allow="camera; microphone" />
        <a className="window-ar-cube__room-link" href="/avatar/cube">
          Open the full AR Cube room
        </a>
      </div>
    </FloatingWindow>
  );
}
