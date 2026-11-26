/**
 * STOP SAFETY WINDOW — the law base, the claim check, and
 * stop mode (owner order 2026-11-26: "make sure the database
 * is really good with law… if Anubis says for me to do it I'll
 * do it, if Anubis says to say these words I'll say the words…
 * and Anubis listening will automatically record the
 * conversation so Anubis has the evidence for me").
 *
 * Three parts, one window:
 *   · THE LAW BASE — every entry with its source and
 *     jurisdiction, under the honesty header, and the GAP list
 *     in the open: topics the base does not cover, so a claim
 *     about them comes back "not in the base" instead of an
 *     invention.
 *   · CLAIM CHECK — type (or paste) what an officer said; the
 *     base answers: MATCHES, CONTRADICTS, or NOT IN THE BASE,
 *     with the entry and citation it stands on.
 *   · STOP MODE — its state, its start (only through a camera
 *     whose hearing is armed), its end, and the live record:
 *     claims checked and guidance given. While this window is
 *     open on a live stop, NEW guidance lines are spoken
 *     through the voice path as they land — the words in his
 *     ear are the base's own scripts, entry-cited, never
 *     improvised.
 *
 * Owner-only, like the vault: operator session re-verified on
 * every call; nothing here renders on Khadija's side.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getSupabaseClientConfig } from "./operatorAuth.server";
import {
  checkClaim,
  endStopModeFromPanel,
  getLawBase,
  getStopMode,
  startStopModeFromPanel,
  type CheckClaimResultView,
  type LawBaseView,
  type StopModeView,
} from "./lawBase.server";

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

function dayTime(at: number): string {
  return new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Speak one guidance line through the voice path (the same
 *  speechSynthesis road the construct's fallback voice uses). */
function speakGuidance(text: string) {
  try {
    const synth = globalThis.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    synth.speak(u);
  } catch {
    // no voice on this surface — the line still stands on screen
  }
}

export function StopSafetyWindow({ onClose }: { onClose: () => void }) {
  const [base, setBase] = useState<LawBaseView | null>(null);
  const [stop, setStop] = useState<StopModeView | null>(null);
  const [denied, setDenied] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [claim, setClaim] = useState("");
  const [claimResult, setClaimResult] = useState<CheckClaimResultView | null>(null);
  const [cameraId, setCameraId] = useState("");
  /** Guidance lines already spoken for the live stop — the ear never repeats. */
  const spokenGuidance = useRef<{ stopId: string; count: number }>({ stopId: "", count: 0 });

  const refresh = useCallback(async () => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    const [nextBase, nextStop] = await Promise.all([
      getLawBase({ data: { accessToken: token } }).catch(() => null),
      getStopMode({ data: { accessToken: token } }).catch(() => null),
    ]);
    if ((nextBase && !nextBase.authorized) || (nextStop && !nextStop.authorized)) {
      setDenied(true);
      return;
    }
    if (nextBase) setBase(nextBase);
    if (nextStop) {
      setStop(nextStop);
      if (!cameraId && nextStop.hearingCameras.length > 0) {
        setCameraId(nextStop.hearingCameras[0]!.id);
      }
      // Speak NEW guidance for the live stop, once each.
      const active = nextStop.active;
      if (active) {
        if (spokenGuidance.current.stopId !== active.id) {
          spokenGuidance.current = { stopId: active.id, count: active.guidance.length };
        } else if (active.guidance.length > spokenGuidance.current.count) {
          for (const line of active.guidance.slice(spokenGuidance.current.count)) {
            speakGuidance(line.text);
          }
          spokenGuidance.current = { stopId: active.id, count: active.guidance.length };
        }
      }
    }
  }, [cameraId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 8_000);
    return () => clearInterval(t);
  }, [refresh]);

  const runCheck = async () => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    if (!claim.trim()) return;
    setBusy(true);
    try {
      const result = await checkClaim({ data: { accessToken: token, claim: claim.trim() } });
      setClaimResult(result);
    } catch {
      setNote("The core did not answer — no check was made.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const startStop = async () => {
    const token = await accessToken().catch(() => null);
    if (!token || !cameraId) return;
    setBusy(true);
    try {
      const result = await startStopModeFromPanel({ data: { accessToken: token, cameraId } });
      setNote(result.note);
    } catch {
      setNote("The core did not answer — stop mode was not started.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const endStop = async () => {
    const token = await accessToken().catch(() => null);
    if (!token) return;
    setBusy(true);
    try {
      const result = await endStopModeFromPanel({ data: { accessToken: token } });
      setNote(result.note);
    } catch {
      setNote("The core did not answer — the stop record was not changed.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  return (
    <FloatingWindow
      id="stop-safety"
      title="Stop Safety — the law base & stop mode"
      onClose={onClose}
      initialWidth={560}
      initialHeight={620}
    >
      <div className="window-inbox">
        {denied ? (
          <p className="window-inbox__note">
            The operator session is gone — sign in again to open Stop Safety.
          </p>
        ) : !base || !stop ? (
          <p className="window-inbox__note">Reading the law base…</p>
        ) : !base.storageAvailable ? (
          <p className="window-inbox__note">
            The law base and stop mode live on the core machine — this surface has no local stores, so
            they can only be reached from the Parrot copy.
          </p>
        ) : (
          <>
            <p className="window-inbox__note">
              <strong>{base.header}</strong> Every entry below carries its source. A claim the base
              has no entry for comes back NOT IN THE BASE — Anubis does not improvise law.
            </p>

            <div className="window-inbox__feed">
              <p className="window-inbox__meta">
                <strong>Stop mode</strong>
              </p>
              {stop.active ? (
                <>
                  <p className="window-inbox__text">
                    <strong>STOP MODE IS ON</strong> — recording through {stop.active.cameraName} since{" "}
                    {dayTime(stop.active.startedAt)} (triggered by{" "}
                    {stop.active.trigger === "panel"
                      ? "this panel"
                      : stop.active.trigger === "officer"
                        ? "the officer's own words"
                        : "your declaration"}
                    ). Claims heard are being checked against the base; guidance lands below and is
                    spoken as it comes.
                  </p>
                  {stop.active.claims.map((c, i) => (
                    <p key={i} className="window-inbox__text">
                      “{c.claim}” —{" "}
                      {c.verdict === "matches"
                        ? "MATCHES the base"
                        : c.verdict === "contradicts"
                          ? "CONTRADICTS the base"
                          : "NOT IN THE BASE"}
                      . {c.note}
                    </p>
                  ))}
                  {stop.active.guidance.map((g, i) => (
                    <p key={i} className="window-inbox__note">
                      Guidance: {g.text} [{g.citation}]
                    </p>
                  ))}
                  <div className="window-inbox__actions">
                    <button type="button" className="window-btn" disabled={busy} onClick={() => void endStop()}>
                      End stop mode
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="window-inbox__note">
                    Stop mode starts itself when a camera with hearing armed hears you say you're
                    being pulled over — or hears an officer's own stop words. It records the whole
                    interaction as evidence, checks what is claimed against the base below, and puts
                    the base's exact words in your ear. It ends on your word (“end stop mode”), after
                    ten minutes of silence, or the moment the ALL-STOP is raised.
                  </p>
                  {stop.hearingCameras.length === 0 ? (
                    <p className="window-inbox__note">
                      No camera has hearing armed right now — stop mode can only record through a
                      camera Anubis is listening through. Arm a camera's hearing in the Cameras
                      window first.
                    </p>
                  ) : (
                    <div className="window-inbox__actions">
                      <label>
                        Record through{" "}
                        <select value={cameraId} onChange={(e) => setCameraId(e.target.value)} disabled={busy}>
                          {stop.hearingCameras.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="button" className="window-btn" disabled={busy || !cameraId} onClick={() => void startStop()}>
                        Start stop mode
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="window-inbox__feed">
              <p className="window-inbox__meta">
                <strong>Claim check — what did the officer claim?</strong>
              </p>
              <div className="window-inbox__actions">
                <input
                  type="text"
                  value={claim}
                  onChange={(e) => setClaim(e.target.value)}
                  placeholder="Type the claim, word for word if you can"
                  disabled={busy}
                  style={{ flex: 1, minWidth: 200 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runCheck();
                  }}
                />
                <button type="button" className="window-btn" disabled={busy || !claim.trim()} onClick={() => void runCheck()}>
                  Check it against the base
                </button>
              </div>
              {claimResult && (
                <p className="window-inbox__text">
                  <strong>
                    {claimResult.verdict === "matches"
                      ? "MATCHES the base"
                      : claimResult.verdict === "contradicts"
                        ? "CONTRADICTS the base"
                        : "NOT IN THE BASE"}
                  </strong>{" "}
                  — {claimResult.note}
                  {claimResult.entry && claimResult.entry.scripts.length > 0 && (
                    <>
                      {" "}
                      Words that stand on this entry:{" "}
                      {claimResult.entry.scripts.map((s) => `“${s}”`).join(" ")}
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="window-inbox__feed">
              <p className="window-inbox__meta">
                <strong>The law base</strong>
              </p>
              {base.entries.map((entry) => (
                <div key={entry.id} className="window-inbox__item">
                  <p className="window-inbox__meta">
                    <strong>{entry.title}</strong> · {entry.jurisdiction} · {entry.source.name} —{" "}
                    {entry.source.citation}
                  </p>
                  <p className="window-inbox__text">{entry.statement}</p>
                  {entry.scripts.length > 0 && (
                    <p className="window-inbox__note">
                      Exact words: {entry.scripts.map((s) => `“${s}”`).join(" ")}
                    </p>
                  )}
                </div>
              ))}
              <p className="window-inbox__meta">
                <strong>Not in the base — the gaps, in the open</strong>
              </p>
              {base.gaps.map((g) => (
                <p key={g.topic} className="window-inbox__note">
                  <strong>{g.topic}:</strong> {g.note}
                </p>
              ))}
            </div>
          </>
        )}
        {note && (
          <p className="window-hint" role="status">
            {note}
          </p>
        )}
      </div>
    </FloatingWindow>
  );
}
