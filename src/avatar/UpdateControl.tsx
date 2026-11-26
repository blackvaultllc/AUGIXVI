/**
 * THE UPDATE CONTROL — the Captain's own update button (owner order
 * 2026-11-26 ~17:37 CST): "you can create an update button so if you
 * do create an update online I can click that button and it will
 * update everything it needs. So I don't always have to have you
 * doing it."
 *
 * It stands in the operator Status panel, under the IEM brand block.
 * One tap checks; when a newer build exists, the button reads
 * UPDATE IEM and a second tap confirms — then the one fixed update
 * path runs (logs.server.ts spawns ~/augie-app/update.sh, the repo's
 * scripts/parrot-update.sh): pull, rebuild, restart, health check.
 * The panel shows the run's plain progress and its plain result,
 * read from the updater's own run log markers — never guessed.
 *
 * Honesty law: a failed run says so and names the step it stopped
 * at; the script changes nothing on failure (the service restarts
 * only after a successful build), and the words here say exactly
 * that. The control only ever runs on his tap. While a run goes, the
 * panel re-reads the view on a slow timer — the service restarts
 * mid-run, so a failed read is expected and simply retried; the
 * polling stops the moment the run resolves (performance law).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getUpdateView, requestUpdate, type UpdateView } from "./logs.server";
import { getOperatorAccessToken } from "./trustedDevice";
import { deriveUpdateRun, updateRunWords, type UpdateRunPhase } from "./updateRunStatus";

const POLL_MS = 10_000;
const POLL_CAP_MS = 30 * 60 * 1000;

function shortSha(sha: string | null): string {
  return sha ? sha.slice(0, 7) : "unknown";
}

export function UpdateControl() {
  const [view, setView] = useState<UpdateView | null>(null);
  const [denied, setDenied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [localRun, setLocalRun] = useState<UpdateRunPhase | null>(null);
  const pollStartRef = useRef<number | null>(null);

  const load = useCallback(async (): Promise<UpdateView | null> => {
    const token = await getOperatorAccessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return null;
    }
    const next = await getUpdateView({ data: { accessToken: token } }).catch(() => null);
    if (next && !next.authorized) {
      setDenied(true);
      return null;
    }
    if (next) setView(next);
    return next;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const serverRun: UpdateRunPhase =
    view?.run ?? (view ? deriveUpdateRun(view.logTail) : { phase: "idle" });
  const run: UpdateRunPhase =
    localRun?.phase === "running" && serverRun.phase === "idle" ? localRun : serverRun;
  const running = run.phase === "running";

  // While a run is in progress, re-read the view until it resolves.
  useEffect(() => {
    if (!running) {
      pollStartRef.current = null;
      return;
    }
    pollStartRef.current ??= Date.now();
    const timer = setInterval(() => {
      if (pollStartRef.current && Date.now() - pollStartRef.current > POLL_CAP_MS) {
        clearInterval(timer);
        return;
      }
      void load().then((next) => {
        if (next && next.run.phase !== "running") setLocalRun(null);
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, load]);

  const startUpdate = useCallback(async () => {
    const token = await getOperatorAccessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    const res = await requestUpdate({ data: { accessToken: token } }).catch(() => null);
    setConfirming(false);
    if (!res) {
      setNote("The update request could not be sent — nothing was started.");
      return;
    }
    if (!res.authorized) {
      setDenied(true);
      return;
    }
    if (!res.started) {
      setNote(`Update not started: ${res.reason ?? "unknown reason"}`);
      return;
    }
    setNote(null);
    setLocalRun({ phase: "running" });
    pollStartRef.current = Date.now();
    void load();
  }, [load]);

  if (denied) {
    return (
      <div className="avatar-update" aria-label="Update this copy of IEM">
        <div className="avatar-update__title">UPDATE</div>
        <div className="avatar-update__line">
          Sign in as the operator to update this copy.
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="avatar-update" aria-label="Update this copy of IEM">
        <div className="avatar-update__title">UPDATE</div>
        <div className="avatar-update__line">Checking this build…</div>
      </div>
    );
  }

  const runWords = updateRunWords(run);
  const onCoreMachine = view.current !== null || view.logTail.length > 0;

  return (
    <div className="avatar-update" aria-label="Update this copy of IEM">
      <div className="avatar-update__title">UPDATE — THIS COPY OF IEM</div>
      {!onCoreMachine && (
        <div className="avatar-update__line">
          Updates run on the core machine — this surface cannot update itself.
        </div>
      )}
      {onCoreMachine && (
        <>
          <div className="avatar-update__line">
            This build: <span className="avatar-update__value">{shortSha(view.current)}</span>
            {" · "}
            Newest build: <span className="avatar-update__value">{shortSha(view.latest)}</span>
          </div>
          {running ? (
            <div className="avatar-update__line" role="status" aria-live="polite">
              {runWords}
            </div>
          ) : view.updateAvailable === true ? (
            <>
              <div className="avatar-update__line" role="status">
                A new build is ready.
              </div>
              {!confirming ? (
                <button
                  type="button"
                  className="avatar-update__button"
                  onClick={() => setConfirming(true)}
                >
                  Update IEM
                </button>
              ) : (
                <button
                  type="button"
                  className="avatar-update__button avatar-update__button--confirm"
                  onClick={() => void startUpdate()}
                >
                  Tap again to start the update
                </button>
              )}
            </>
          ) : view.updateAvailable === false ? (
            <div className="avatar-update__line" role="status">
              Up to date — this is the newest build.
            </div>
          ) : (
            <div className="avatar-update__line" role="status">
              Update state unknown — one of the two builds could not be read.
            </div>
          )}
          {!running && runWords && (
            <div className="avatar-update__line" role="status">
              {runWords}
            </div>
          )}
          {note && (
            <div className="avatar-update__line avatar-update__line--warn" role="status">
              {note}
            </div>
          )}
        </>
      )}
    </div>
  );
}
