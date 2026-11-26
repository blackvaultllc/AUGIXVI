/**
 * UPDATE RUN STATUS — the plain reading of the updater's own run log
 * (owner order 2026-11-26 ~17:37 CST: an Update button he can run
 * himself, with a plain progress and a plain result — no terminal).
 *
 * The one fixed update path (scripts/parrot-update.sh, installed as
 * ~/augie-app/update.sh) logs every run to
 * ~/.local/share/augie/update-run.log with three marker lines:
 *
 *   === update started <iso> ===
 *   UPDATE FAILED at step: <step> (<iso>)
 *   === update complete <iso> — now at <sha> ===
 *
 * This module reads those markers and nothing else. It is pure so
 * the server (logs.server.ts, over the whole log) and the client
 * (over the returned tail, as a fallback) read a run the same way.
 *
 * The honesty law stands: a run whose ending marker is not in the
 * log is RUNNING or was cut off — never "succeeded". A failed run
 * changed nothing: the script only restarts the service after a
 * successful build, and this module's words say exactly that.
 */

export type UpdateRunPhase =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "succeeded"; at: string | null }
  | { phase: "failed"; step: string | null };

const STARTED = /^=== update started /;
const COMPLETE = /^=== update complete .*— now at ([0-9a-f]{7,64}) ===/;
const FAILED = /^UPDATE FAILED at step: (.+?) \(/;

/** The last marker in the log decides the run's state. */
export function deriveUpdateRun(lines: readonly string[]): UpdateRunPhase {
  let run: UpdateRunPhase = { phase: "idle" };
  for (const line of lines) {
    if (STARTED.test(line)) {
      run = { phase: "running" };
      continue;
    }
    const complete = COMPLETE.exec(line);
    if (complete) {
      run = { phase: "succeeded", at: complete[1] ?? null };
      continue;
    }
    const failed = FAILED.exec(line);
    if (failed) {
      run = { phase: "failed", step: failed[1]?.trim() || null };
    }
  }
  return run;
}

/** The one plain sentence the panel shows for a run's state. */
export function updateRunWords(run: UpdateRunPhase): string | null {
  switch (run.phase) {
    case "idle":
      return null;
    case "running":
      return "An update is running now — pulling the newest build, rebuilding, and restarting. It can take a few minutes.";
    case "succeeded":
      return "The last update finished — this copy is running the build it pulled.";
    case "failed":
      return `The last update did not finish — it stopped at the ${run.step ?? "unknown"} step. Nothing was changed: the build that was already running kept running.`;
  }
}
