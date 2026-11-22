/**
 * LOGS WINDOW (Part 22) — "even if it coughs I want to know the
 * reason why." Two panes:
 *
 * - Service: the local augie.service journal — the app's own output
 *   and crash reasons, newest last, read on the machine itself.
 * - Updates: the running build's version stamp against the repo's
 *   HEAD, the updater's run log, and the Apply button. Applying is
 *   a two-tap confirm and runs the one fixed update script; checks
 *   are automatic, code changes never are.
 *
 * Operator-only: every read re-verifies the operator session
 * server-side, exactly like the Gate Log. On the hosted Worker there
 * is no journal and no updater — the panes say so plainly.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getSupabaseClientConfig } from "./operatorAuth.server";
import {
  getServiceJournal,
  getUpdateView,
  requestUpdate,
  type ServiceJournalView,
  type UpdateView,
} from "./logs.server";

async function loadAuthClient(): Promise<SupabaseClient | null> {
  let url = import.meta.env["VITE_SUPABASE_URL"]?.trim();
  let publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();
  if (!url || !publishableKey) {
    const config = (await getSupabaseClientConfig().catch(() => null)) ?? null;
    url = config?.url?.trim();
    publishableKey = config?.publishableKey?.trim();
  }
  if (!url || !publishableKey) return null;
  return createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}

async function accessToken(): Promise<string | null> {
  const client = await loadAuthClient();
  if (!client) return null;
  return (await client.auth.getSession()).data.session?.access_token ?? null;
}

type Tab = "service" | "updates";

export function LogsWindow({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("service");
  const [journal, setJournal] = useState<ServiceJournalView | null>(null);
  const [updates, setUpdates] = useState<UpdateView | null>(null);
  const [denied, setDenied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [applyNote, setApplyNote] = useState("");

  const load = useCallback(async () => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    const [j, u] = await Promise.all([
      getServiceJournal({ data: { accessToken: token } }).catch(() => null),
      getUpdateView({ data: { accessToken: token } }).catch(() => null),
    ]);
    if ((j && !j.authorized) || (u && !u.authorized)) {
      setDenied(true);
      return;
    }
    setJournal(j);
    setUpdates(u);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = useCallback(async () => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    const res = await requestUpdate({ data: { accessToken: token } }).catch(() => null);
    if (!res) {
      setApplyNote("The update request could not be sent.");
    } else if (res.started) {
      setApplyNote(
        "Update started. The service will restart when the build finishes — watch the run log below.",
      );
    } else {
      setApplyNote(`Update not started: ${res.reason ?? "unknown reason"}`);
    }
    setConfirming(false);
  }, []);

  return (
    <FloatingWindow id="logs" title="Logs & Updates" onClose={onClose} initialWidth={520} initialHeight={460}>
      <div className="window-logs">
        <div className="window-logs__tabs" role="group" aria-label="Log source">
          <button
            type="button"
            className="window-btn"
            aria-pressed={tab === "service"}
            onClick={() => setTab("service")}
          >
            Service
          </button>
          <button
            type="button"
            className="window-btn"
            aria-pressed={tab === "updates"}
            onClick={() => setTab("updates")}
          >
            Updates
          </button>
          <button type="button" className="window-btn" onClick={() => void load()}>
            Refresh
          </button>
        </div>

        {denied && (
          <p className="window-logs__note">
            Your operator session could not be verified, so the logs stay closed.
          </p>
        )}

        {!denied && tab === "service" && (
          <>
            {!journal && <p className="window-logs__note">Reading the service journal…</p>}
            {journal && !journal.available && (
              <p className="window-logs__note">
                The service journal lives on the local desktop server — it is not available on
                this surface.
              </p>
            )}
            {journal && journal.available && (
              <ol className="window-logs__list">
                {journal.lines.map((line, i) => (
                  <li key={i} className="window-logs__line">
                    {line}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}

        {!denied && tab === "updates" && (
          <>
            {!updates && <p className="window-logs__note">Checking the build…</p>}
            {updates && !updates.available && (
              <p className="window-logs__note">
                Update checks run on the local desktop server — not available on this surface.
              </p>
            )}
            {updates && updates.available && (
              <div>
                <p className="window-logs__note">
                  Running build: {updates.current ? updates.current.slice(0, 12) : "unstamped"}
                  <br />
                  Repo HEAD: {updates.latest ? updates.latest.slice(0, 12) : "check unavailable"}
                  <br />
                  {updates.updateAvailable === true && "An update is available."}
                  {updates.updateAvailable === false && "Up to date."}
                  {updates.updateAvailable === null &&
                    "Update state unknown — one of the two versions could not be read."}
                </p>
                {updates.updateAvailable && !confirming && (
                  <button type="button" className="window-btn" onClick={() => setConfirming(true)}>
                    Apply update
                  </button>
                )}
                {updates.updateAvailable && confirming && (
                  <>
                    <button type="button" className="window-btn" onClick={() => void apply()}>
                      Confirm — rebuild and restart Augie
                    </button>
                    <button type="button" className="window-btn" onClick={() => setConfirming(false)}>
                      Cancel
                    </button>
                  </>
                )}
                {applyNote && (
                  <p className="window-logs__note" role="status">
                    {applyNote}
                  </p>
                )}
                {updates.logTail.length > 0 && (
                  <ol className="window-logs__list">
                    {updates.logTail.map((line, i) => (
                      <li key={i} className="window-logs__line">
                        {line}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </FloatingWindow>
  );
}
