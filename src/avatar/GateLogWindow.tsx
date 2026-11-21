/**
 * GATE LOG WINDOW — every knock on the gate, recorded.
 *
 * Reads the server-side gate log (trap-path probes: /.env, /wp-admin,
 * /.git/config, …) through getGateLog, which re-verifies the operator
 * session server-side before returning a single entry. The list states
 * facts only — time, source address, method, path, user agent — newest
 * first, with the total count. Operator-only: it renders inside the
 * signed-in stage like every other window.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getSupabaseClientConfig } from "./operatorAuth.server";
import { getGateLog, type GateLogView } from "./gateLog.server";

type GateLogState =
  | { kind: "loading" }
  | { kind: "denied"; configured: boolean }
  | { kind: "unavailable" }
  | { kind: "ready"; view: GateLogView };

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

export function GateLogWindow({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<GateLogState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const client = await loadAuthClient();
      const accessToken = client
        ? (await client.auth.getSession()).data.session?.access_token
        : undefined;
      if (!accessToken) {
        setState({ kind: "denied", configured: true });
        return;
      }
      const view = await getGateLog({ data: { accessToken } });
      if (!view.authorized) {
        setState({ kind: "denied", configured: view.configured });
        return;
      }
      if (!view.available) {
        setState({ kind: "unavailable" });
        return;
      }
      setState({ kind: "ready", view });
    } catch {
      setState({ kind: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FloatingWindow
      id="gate-log"
      title="Gate Log"
      onClose={onClose}
      initialWidth={560}
      initialHeight={480}
    >
      <div className="window-gate-log">
        {state.kind === "loading" && <p className="window-gate-log__note">Reading the gate log…</p>}
        {state.kind === "denied" && (
          <p className="window-gate-log__note">
            {state.configured
              ? "Your operator session could not be verified, so the gate log stays closed."
              : "Operator sign-in is not configured on the server, so the gate log cannot be opened."}
          </p>
        )}
        {state.kind === "unavailable" && (
          <p className="window-gate-log__note">
            The gate log is not available on this server. It is kept on the local desktop server.
          </p>
        )}
        {state.kind === "ready" && (
          <>
            <p className="window-gate-log__count">
              {state.view.total === 0
                ? "No knocks recorded."
                : `${state.view.total} knock${state.view.total === 1 ? "" : "s"} recorded.`}
            </p>
            {state.view.entries.length > 0 && (
              <ol className="window-gate-log__list">
                {state.view.entries.map((entry, index) => (
                  <li key={`${entry.ts}-${index}`} className="window-gate-log__item">
                    <div className="window-gate-log__meta">
                      {new Date(entry.ts).toLocaleString()} · {entry.ip}
                    </div>
                    <div className="window-gate-log__path">
                      {entry.method} {entry.path}
                    </div>
                    {entry.userAgent && (
                      <div className="window-gate-log__agent" title={entry.userAgent}>
                        {entry.userAgent}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <button type="button" className="window-btn" onClick={() => void load()}>
              Refresh
            </button>
          </>
        )}
      </div>
    </FloatingWindow>
  );
}
