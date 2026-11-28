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
import { useCallback, useEffect, useRef, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getSupabaseClientConfig } from "./operatorAuth.server";
import { getGateLog, type GateLogView } from "./gateLog.server";
import { getGateAttemptPhoto, getGateAttempts, type GateAttemptsView } from "./loginGate.server";
import { gateAttemptFlagged, gateAttemptResultWords } from "./loginGate";
import {
  getDoorRestrictions,
  releaseDoorRestriction,
  type DoorRestrictionsResult,
} from "./doorSecurity.server";

type GateLogState =
  | { kind: "loading" }
  | { kind: "denied"; configured: boolean }
  | { kind: "unavailable" }
  | { kind: "ready"; view: GateLogView; attempts: GateAttemptsView | null };

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

type DoorRestrictionsState =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "ready"; result: DoorRestrictionsResult };

export function GateLogWindow({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<GateLogState>({ kind: "loading" });
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [restrictions, setRestrictions] = useState<DoorRestrictionsState>({ kind: "loading" });
  const tokenRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    setRestrictions({ kind: "loading" });
    try {
      const client = await loadAuthClient();
      const accessToken = client
        ? (await client.auth.getSession()).data.session?.access_token
        : undefined;
      if (!accessToken) {
        setState({ kind: "denied", configured: true });
        setRestrictions({ kind: "hidden" });
        return;
      }
      tokenRef.current = accessToken;
      // The door restriction record rides its own verification
      // and its own store (the registry — the Durable Object
      // online, the local file on the core), so it loads
      // independently of the knock log below: online, where the
      // local gate log does not exist, the restrictions still
      // stand here, with the Captain's release beside each one.
      void getDoorRestrictions({ data: { accessToken } })
        .then((result) => {
          setRestrictions(
            result.authorized ? { kind: "ready", result } : { kind: "hidden" },
          );
        })
        .catch(() => setRestrictions({ kind: "hidden" }));
      const view = await getGateLog({ data: { accessToken } });
      if (!view.authorized) {
        setState({ kind: "denied", configured: view.configured });
        return;
      }
      if (!view.available) {
        setState({ kind: "unavailable" });
        return;
      }
      // The doorbell record rides along — same verified token, and a
      // failure here never takes the knock log down with it.
      const attempts = await getGateAttempts({ data: { accessToken } }).catch(() => null);
      setState({ kind: "ready", view, attempts });
    } catch {
      setState({ kind: "unavailable" });
    }
  }, []);

  const showPhoto = useCallback(async (photoFile: string) => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;
    try {
      const photo = await getGateAttemptPhoto({ data: { accessToken, photoFile } });
      if (photo.dataUrl) {
        setPhotos((current) => ({ ...current, [photoFile]: photo.dataUrl as string }));
      }
    } catch {
      /* a photo that cannot be read simply stays unshown */
    }
  }, []);

  const release = useCallback(async (ip: string) => {
    const accessToken = tokenRef.current;
    if (!accessToken) return;
    try {
      const result = await releaseDoorRestriction({ data: { accessToken, ip } });
      if (result.released) void load();
    } catch {
      /* a release that cannot be written simply stays listed */
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FloatingWindow
      id="gate-log"
      title="Gate Log"
      onClose={onClose}
      initialWidth={460}
      initialHeight={380}
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
            {state.attempts?.available && (
              <>
                <h3 className="window-gate-log__section">At the gate — who came to the door</h3>
                <p className="window-gate-log__count">
                  {state.attempts.total === 0
                    ? "No gate attempts recorded."
                    : `${state.attempts.total} attempt${state.attempts.total === 1 ? "" : "s"} recorded.`}
                </p>
                {state.attempts.entries.length > 0 && (
                  <ol className="window-gate-log__list">
                    {state.attempts.entries.map((entry, index) => (
                      <li
                        key={`${entry.ts}-${index}`}
                        className={`window-gate-log__item${gateAttemptFlagged(entry) ? " window-gate-log__item--flagged" : ""}`}
                      >
                        <div className="window-gate-log__meta">
                          {new Date(entry.ts).toLocaleString()} ·{" "}
                          {entry.door === "learner" ? "Khadija's door" : "Operator gate"}
                          {gateAttemptFlagged(entry) && (
                            <span className="window-gate-log__flag"> · For your review</span>
                          )}
                        </div>
                        <div className="window-gate-log__path">
                          {gateAttemptResultWords(entry.result)}
                          {entry.namedAs ? ` — named ${entry.namedAs}` : ""}
                        </div>
                        {entry.note && <div className="window-gate-log__agent">{entry.note}</div>}
                        {entry.photoFile &&
                          (photos[entry.photoFile] ? (
                            <img
                              className="window-gate-log__photo"
                              src={photos[entry.photoFile]}
                              alt="The face at the gate for this attempt"
                            />
                          ) : (
                            <button
                              type="button"
                              className="window-btn"
                              onClick={() => void showPhoto(entry.photoFile as string)}
                            >
                              See the picture
                            </button>
                          ))}
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </>
        )}
        {restrictions.kind === "ready" && (
          <>
            <h3 className="window-gate-log__section">Restricted at the door — the cube's record</h3>
            {!restrictions.result.available ? (
              <p className="window-gate-log__note">
                The restriction record is not available on this server.
              </p>
            ) : restrictions.result.restrictions.length === 0 ? (
              <p className="window-gate-log__count">No addresses are restricted at the door.</p>
            ) : (
              <ol className="window-gate-log__list">
                {restrictions.result.restrictions.map((entry) => (
                  <li key={entry.ip} className="window-gate-log__item">
                    <div className="window-gate-log__meta">
                      {entry.ip} · {entry.strikes} wrong name{entry.strikes === 1 ? "" : "s"}
                    </div>
                    <div className="window-gate-log__path">
                      Restricted {new Date(entry.restrictedAt).toLocaleString()}
                    </div>
                    <button
                      type="button"
                      className="window-btn"
                      onClick={() => void release(entry.ip)}
                    >
                      Release this address
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </FloatingWindow>
  );
}
