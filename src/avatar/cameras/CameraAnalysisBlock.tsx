/**
 * The rendered face of one lens's analysis state (camera run-3
 * follow-up, 2026-11-23). Kept apart from the window so the
 * honesty contract is testable on its own: a reading ONLY ever
 * renders under the draft label, and a failure renders as plain
 * words with no reading anywhere.
 */
import { parseAnalysis } from "../analysisParsing";
import { CAMERA_ANALYSIS_DRAFT_LABEL, type LensAnalysisState } from "./cameraAnalysis";

export function CameraAnalysisBlock({ state }: { state: LensAnalysisState }) {
  if (state.kind === "idle") return null;

  if (state.kind === "failed") {
    return (
      <p className="window-cameras__analysis-note" role="status">
        {state.note}
      </p>
    );
  }

  if (state.kind === "working") {
    const live = state.partial ? parseAnalysis(state.partial) : null;
    return (
      <div className="window-cameras__analysis">
        <p className="window-cameras__analysis-status" role="status">
          Analyzing this view with the local vision model… {state.elapsed}s — it runs on this
          machine and can take 20 seconds or more. The words appear as the model writes them.
        </p>
        {live && (live.summary || live.findings.length > 0) && (
          <>
            <p className="window-cameras__draft-label">{CAMERA_ANALYSIS_DRAFT_LABEL}</p>
            {live.summary && <p className="window-cameras__reading">{live.summary}</p>}
            {live.findings.length > 0 && (
              <ul className="window-cameras__findings">
                {live.findings.map((finding, index) => (
                  <li key={`${index}-${finding}`}>{finding}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="window-cameras__analysis">
      <p className="window-cameras__draft-label">{CAMERA_ANALYSIS_DRAFT_LABEL}</p>
      <p className="window-cameras__reading">{state.reading.text}</p>
      {state.reading.findings.length > 0 && (
        <ul className="window-cameras__findings">
          {state.reading.findings.map((finding, index) => (
            <li key={`${index}-${finding}`}>{finding}</li>
          ))}
        </ul>
      )}
      <p className="window-hint">
        Model {state.reading.model} · {new Date(state.at).toLocaleTimeString()} · read from the
        snapshot shown above, taken for this reading.
      </p>
    </div>
  );
}
