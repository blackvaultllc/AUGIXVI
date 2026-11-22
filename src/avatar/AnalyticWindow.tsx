import { FloatingWindow } from "./windows/FloatingWindow";
import { PictureAnalysis } from "./PictureAnalysis";

/**
 * ANALYTIC WINDOW (Part 27) — Picture Analysis as a small floating
 * window on the stage: the PRIMARY face. The /avatar/analyze page
 * stays as the secondary full-page face and renders the same panel.
 * Scan and upload both return the picture WITH its analysis and the
 * list of things found, right here in the window.
 */
export function AnalyticWindow({ onClose }: { onClose: () => void }) {
  return (
    <FloatingWindow
      id="analytic-window"
      title="Picture Analysis"
      onClose={onClose}
      initialWidth={440}
      initialHeight={520}
      accent="#7dd3fc"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <PictureAnalysis />
        <p style={{ margin: 0, fontSize: "13px" }}>
          <a href="/avatar/analyze">Open the full-page version</a> — same panel, more room.
        </p>
      </div>
    </FloatingWindow>
  );
}
