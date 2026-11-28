/**
 * THE CUBE STRIKE — the cube is the security (owner order
 * 2026-11-28 ~00:50 CST).
 *
 * What a struck-out visitor sees, in place of the door: the
 * cube itself — the same cube document the HEXO view stands
 * on (buildHexoCubeDocument, untouched) — taking the whole
 * screen over black. The frame's own turn compounds the cube's
 * spin: it turns faster and faster, and then the black veil
 * closes over it, and black is all that is left. No words, no
 * buttons, no door. The screen is a deterrent, not a surface:
 * it takes no input and offers nothing to press.
 *
 * The presentation is the stage's; the RESTRICTION is the
 * registry's record (doorStrikes.ts) — this screen is what the
 * record looks like from outside, never the record itself.
 */
import { useMemo } from "react";
import { buildHexoCubeDocument } from "./HexoWindow";

export function CubeStrike() {
  const document_ = useMemo(buildHexoCubeDocument, []);
  return (
    <div className="cube-strike" data-testid="cube-strike" aria-hidden="true">
      <div className="cube-strike__spin">
        <iframe srcDoc={document_} title="" tabIndex={-1} />
      </div>
      <div className="cube-strike__veil" />
    </div>
  );
}
