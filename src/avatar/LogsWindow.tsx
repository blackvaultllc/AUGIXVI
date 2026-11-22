/**
 * THE LOGS WINDOW (Part 22, owner order 2026-11-21) — ALL logs in one
 * place: the service journal (with the REASON for every cough), the
 * gate log, and Augie's own event log (update checks, update
 * requests, repair proposals, test results). Plus the updater's
 * controls: check automatically, apply only on his confirmed say —
 * and even then the apply is recorded here and run through the
 * deploy path, never silently from this window.
 */
import { useCallback, useEffect, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getOperatorAccessToken } from "./trustedDevice";
import {
  getLogs,
  recordRepairProposal,
  recordUpdateRequest,
  runUpdateCheck,
  type LogsPayload,
} from "./eventsLog.server";

export function LogsWindow({ onClose }: { onClose: () => void }) {
  const [payload, setPayload] = useState<LogsPayload | null>(null);
  const [checkLine, setCheckLine] = useState("");
  const [repairSummary, setRepairSummary] = useState("");
  const [repairDetail, setRepairDetail] = useState("");
  const [actionLine, setActionLine] = useState("");

  const load = useCallback(async () => {
    const token = await getOperatorAccessToken();
    if (!token) {
      setPayload({ authorized: false, gate: { available: false, total: 0, recent: [] }, events: [], service: { available: false, lines: [] } });
      return;
    }
    setPayload(await getLogs({ data: { accessToken: token } }));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const check = async () => {
    const token = await getOperatorAccessToken();
    if (!token) return;
    setCheckLine("Checking…");
    const result = await runUpdateCheck({ data: { accessToken: token } });
    setCheckLine(result.authorized ? result.summary : "Not authorized.");
    void load();
  };

  const requestApply = async () => {
    const token = await getOperatorAccessToken();
    if (!token) return;
    const result = await recordUpdateRequest({
      data: { accessToken: token, note: "Requested from the Logs window after an update check." },
    });
    setActionLine(
      result.recorded
        ? "Update request recorded in the log. The apply itself runs through the deploy path (sync → rebuild → restart) — never silently from here."
        : "Not authorized.",
    );
    void load();
  };

  const proposeRepair = async () => {
    const token = await getOperatorAccessToken();
    if (!token || !repairSummary.trim()) return;
    const result = await recordRepairProposal({
      data: { accessToken: token, summary: repairSummary.trim(), detail: repairDetail.trim() || "No detail given." },
    });
    setActionLine(
      result.recorded
        ? "Repair proposal recorded with its reason. No code was changed — code-changing fixes wait for your say."
        : "Not authorized.",
    );
    setRepairSummary("");
    setRepairDetail("");
    void load();
  };

  return (
    <FloatingWindow id="logs" title="Logs — Everything, With Reasons" onClose={onClose} initialWidth={640} initialHeight={600} accent="#f59e0b">
      <div className="window-logs">
        {!payload && <p>Reading the logs…</p>}
        {payload && !payload.authorized && (
          <p role="alert">Operator sign-in could not be verified — the logs stay closed.</p>
        )}
        {payload?.authorized && (
          <>
            <section>
              <h3>Updater</h3>
              <div className="window-logs__row">
                <button type="button" onClick={() => void check()}>
                  Check for updates
                </button>
                <button type="button" onClick={() => void requestApply()}>
                  Record update request
                </button>
                <button type="button" onClick={() => void load()}>
                  Read logs again
                </button>
              </div>
              {checkLine && <p>{checkLine}</p>}
              {actionLine && <p>{actionLine}</p>}
              <p className="window-logs__note">
                Self-healing as it stands: crashes recover automatically (augie.service runs
                Restart=on-failure). Anything that would CHANGE CODE is a proposal in this log —
                it runs only with your say, through the deploy path.
              </p>
            </section>

            <section>
              <h3>Event log — updates, repairs, tests</h3>
              {payload.events.length === 0 ? (
                <p>No events recorded yet. Update checks, repair proposals, and test results land here.</p>
              ) : (
                <ul className="window-logs__events">
                  {payload.events.map((event, i) => (
                    <li key={`${event.at}-${i}`}>
                      <b>{event.type}</b> · {new Date(event.at).toLocaleString()} — {event.summary}
                      {event.detail && <span className="window-logs__detail"> {event.detail}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3>Gate log</h3>
              {payload.gate.available ? (
                <>
                  <p>{payload.gate.total} knock(s) recorded on the gate.</p>
                  <ul className="window-logs__events">
                    {payload.gate.recent.map((knock, i) => (
                      <li key={i}>
                        {new Date(knock.ts).toLocaleString()} — {knock.ip} → {knock.path}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>The gate log store is not present on this build.</p>
              )}
            </section>

            <section>
              <h3>Service journal — augie.service</h3>
              {payload.service.available ? (
                <pre className="window-logs__journal">{payload.service.lines.join("\n")}</pre>
              ) : (
                <p>{payload.service.reason ?? "The service journal is not readable from this build."}</p>
              )}
            </section>

            <section>
              <h3>Propose a repair</h3>
              <div className="window-logs__row">
                <input
                  value={repairSummary}
                  onChange={(event) => setRepairSummary(event.target.value)}
                  placeholder="What looks broken"
                  aria-label="Repair summary"
                />
                <input
                  value={repairDetail}
                  onChange={(event) => setRepairDetail(event.target.value)}
                  placeholder="Why — the reason, in your words"
                  aria-label="Repair reason"
                />
                <button type="button" onClick={() => void proposeRepair()}>
                  Record proposal
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </FloatingWindow>
  );
}
