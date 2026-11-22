/**
 * PICTURE ANALYSIS WINDOW (Part 27 rebuild, owner order 2026-11-21).
 * The analytic tool's PRIMARY face is this small floating window —
 * his standing rule: tools live in small contained boxes that never
 * take over the screen. The full-page route (/avatar/analyze) remains
 * as a secondary face rendering the same component.
 */
import { FloatingWindow } from "./windows/FloatingWindow";
import { PictureAnalysis } from "./PictureAnalysis";

export function PictureAnalysisWindow({ onClose }: { onClose: () => void }) {
  return (
    <FloatingWindow
      id="picture-analysis"
      title="Picture Analysis — Analytic Window"
      onClose={onClose}
      initialWidth={520}
      initialHeight={560}
      accent="#d4af37"
    >
      <div className="window-picture-analysis">
        <PictureAnalysis />
      </div>
    </FloatingWindow>
  );
}
