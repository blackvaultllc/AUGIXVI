/**
 * THE TEST AREA WINDOW (Part 24) — Domenick's compare-and-contrast
 * board. Every ability, a Run button, a verdict with its reason, and
 * the verdict's age: fresh, STALE, or never run. Failures also land
 * in the Logs (Part 22) and can be captured straight from here into
 * a Part 15 bundle.
 */
import { useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getOperatorAccessToken } from "./trustedDevice";
import { recordTestResult } from "./eventsLog.server";
import { downloadCapture } from "./capture";
import {
  ABILITY_TESTS,
  loadLedger,
  recordVerdict,
  verdictFreshness,
  type Ledger,
} from "./testArea";

export function TestAreaWindow({
  onClose,
  settings,
  replyHistory,
}: {
  onClose: () => void;
  settings: unknown;
  replyHistory: readonly unknown[];
}) {
  const [ledger, setLedger] = useState<Ledger>(() => loadLedger());
  const [running, setRunning] = useState<string | null>(null);

  const runOne = async (id: string) => {
    const test = ABILITY_TESTS.find((t) => t.id === id);
    if (!test) return;
    setRunning(id);
    let result: { works: boolean; reason: string };
    try {
      result = await test.run();
    } catch (err) {
      result = { works: false, reason: `The test itself threw: ${err instanceof Error ? err.message : "unknown"}` };
    }
    setLedger(recordVerdict(id, { works: result.works, at: Date.now(), reason: result.reason }));
    setRunning(null);
    const token = await getOperatorAccessToken();
    if (token) {
      void recordTestResult({
        data: { accessToken: token, testName: test.name, works: result.works, reason: result.reason },
      });
    }
  };

  const runAll = async () => {
    for (const test of ABILITY_TESTS) {
      await runOne(test.id);
    }
  };

  const captureFailure = (id: string) => {
    const test = ABILITY_TESTS.find((t) => t.id === id);
    const verdict = ledger[id];
    if (!test || !verdict) return;
    downloadCapture({
      at: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      lastCommand: `test area: ${test.name}`,
      lastAnswer: verdict.reason,
      responseSource: "test-area",
      settings,
      replyHistory,
      openWindows: ["test-area"],
      notes: `Test Area failure capture — ${test.name} (${test.id}) recorded DOESN'T WORK at ${new Date(verdict.at).toISOString()}: ${verdict.reason}`,
    });
  };

  return (
    <FloatingWindow id="test-area" title="Test Area — Compare & Contrast" onClose={onClose} initialWidth={640} initialHeight={620} accent="#34d399">
      <div className="window-testarea">
        <p className="window-testarea__intro">
          Nothing here shows WORKS without a real run behind it. A pass older than a day reads
          STALE. Failures land in the Logs with their reasons, and any failure can be captured
          into a bundle for Muse.
        </p>
        <button type="button" onClick={() => void runAll()} disabled={running !== null}>
          {running ? "Running…" : "Run all tests"}
        </button>
        <ul className="window-testarea__list">
          {ABILITY_TESTS.map((test) => {
            const verdict = ledger[test.id];
            const freshness = verdictFreshness(verdict);
            return (
              <li key={test.id} className="window-testarea__row">
                <div className="window-testarea__main">
                  <b>{test.name}</b>
                  <span className="window-testarea__what">{test.what}</span>
                  {verdict && (
                    <span className="window-testarea__reason">
                      {new Date(verdict.at).toLocaleString()} — {verdict.reason}
                    </span>
                  )}
                </div>
                <div className="window-testarea__side">
                  <span
                    className={`window-testarea__verdict is-${!verdict ? "never" : freshness === "stale" ? "stale" : verdict.works ? "works" : "fails"}`}
                  >
                    {!verdict
                      ? "NEVER RUN"
                      : freshness === "stale"
                        ? `STALE — ${verdict.works ? "was WORKS" : "was DOESN'T WORK"}`
                        : verdict.works
                          ? "WORKS"
                          : "DOESN'T WORK"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void runOne(test.id)}
                    disabled={running !== null}
                  >
                    {running === test.id ? "Running…" : "Run"}
                  </button>
                  {verdict && !verdict.works && (
                    <button type="button" onClick={() => captureFailure(test.id)}>
                      Capture failure
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </FloatingWindow>
  );
}
