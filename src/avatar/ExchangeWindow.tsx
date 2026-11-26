/**
 * GRID-DOWN EXCHANGE WINDOW — the Captain's file-exchange door
 * (owner order 2026-11-26: FTP for grid-down, made careful).
 *
 * The honest name stands at the top: this door is SFTP — the
 * secure form of his FTP idea. Plain FTP sends passwords and
 * files in the open; this door never does. There are no
 * passwords at all: each person he names gets their own login
 * and their own KEY, made on the core. The private half is
 * shown ONCE, in this window, at the moment he makes the
 * grant — it is not kept anywhere, and this window cannot
 * show it again.
 *
 * Everything shown is read from the core at open: the door
 * switch, the law's resolution of it (the ALL-STOP closes the
 * door), whether the service is really listening, this
 * machine's real addresses, the grants, the folders, and the
 * log. Nothing is drawn from hope.
 *
 * Operator-only: every read re-verifies the operator session
 * server-side, like every window in this house. Khadija's
 * side has no road here at all.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getSupabaseClientConfig } from "./operatorAuth.server";
import {
  createExchangeGrant,
  deleteExchangeFile,
  downloadExchangeFile,
  getExchangeState,
  revokeExchangeGrant,
  setExchangeEnabled,
  uploadOutboxFile,
  type CreateGrantResult,
  type ExchangeView,
} from "./exchange.server";
import { accessWords, type ExchangeAccess } from "./exchange";

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
  if (!at) return "time not recorded";
  return new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sizeWords(size: number): string {
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadBytes(fileName: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes]));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadText(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExchangeWindow({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<ExchangeView | null>(null);
  const [denied, setDenied] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [access, setAccess] = useState<ExchangeAccess>("download");
  const [days, setDays] = useState(7);
  const [freshKey, setFreshKey] = useState<CreateGrantResult | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    const next = await getExchangeState({ data: { accessToken: token } }).catch(() => null);
    if (next && !next.authorized) {
      setDenied(true);
      return;
    }
    if (next) setView(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: (token: string) => Promise<{ note: string }>) => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    setBusy(true);
    try {
      const result = await fn(token);
      setNote(result.note);
    } catch {
      setNote("The core did not answer — nothing was changed.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const createGrant = async () => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    setBusy(true);
    try {
      const result = await createExchangeGrant({
        data: { accessToken: token, name: name.trim(), access, daysValid: days },
      });
      setNote(result.note);
      if (result.ok) {
        setFreshKey(result);
        setName("");
      }
    } catch {
      setNote("The core did not answer — no access was made.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const pickOutboxFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const base64 = dataUrl.split(",")[1] ?? "";
      void run((token) => uploadOutboxFile({ data: { accessToken: token, name: file.name, base64 } }));
    };
    reader.readAsDataURL(file);
  };

  const doorLine = view
    ? view.allStop
      ? "Closed — the ALL-STOP is in force. The door stays closed until you release it."
      : !view.enabled
        ? "Closed. Your switch is off — nobody can use this door, key or no key."
        : view.serviceListening
          ? "Open — and the exchange service on this machine is listening right now."
          : "Open in the record — but the exchange service is NOT running on this machine yet, so nobody can actually connect until it is set up and started (see the manual entry: Grid-Down Exchange)."
    : "";

  return (
    <FloatingWindow
      id="grid-down-exchange"
      title="Grid-Down Exchange — the secure file door"
      onClose={onClose}
      initialWidth={560}
      initialHeight={620}
    >
      <div className="window-inbox">
        {denied ? (
          <p className="window-inbox__note">
            The operator session is gone — sign in again to work the exchange door.
          </p>
        ) : !view ? (
          <p className="window-inbox__note">Reading the door…</p>
        ) : !view.storageAvailable ? (
          <p className="window-inbox__note">
            The exchange lives on the core machine — this surface has no local exchange store, so
            the door can only be worked from the Parrot copy.
          </p>
        ) : (
          <>
            <p className="window-inbox__note">
              This door is <strong>SFTP — the secure form of FTP</strong>. Plain FTP sends
              passwords and files in the open for anyone listening to read; this door never does.
              There are no passwords: each person you name gets their own login and their own key,
              made here on the core. You hand them three things — the address, their login name,
              and their key file.
            </p>
            {note && <p className="window-inbox__note">{note}</p>}

            <div className="window-inbox__item">
              <p className="window-inbox__meta">
                <strong>The door</strong> — {doorLine}
              </p>
              {view.addresses.length > 0 ? (
                view.addresses.map((a) => (
                  <p key={a.address} className="window-inbox__text">
                    Give out: <strong>{a.address}</strong>, port <strong>{view.port}</strong> —{" "}
                    {a.source}, read from this machine just now. They connect to{" "}
                    <strong>sftp://login-name@{a.address}:{view.port}</strong> with their key.
                  </p>
                ))
              ) : (
                <p className="window-inbox__text">
                  This machine shows no outward network address right now — there is no address to
                  give out until it is on a network.
                </p>
              )}
              <div className="window-inbox__actions">
                {view.enabled ? (
                  <button
                    type="button"
                    className="window-btn"
                    disabled={busy}
                    onClick={() => void run((token) => setExchangeEnabled({ data: { accessToken: token, enabled: false } }))}
                  >
                    Close the door
                  </button>
                ) : (
                  <button
                    type="button"
                    className="window-btn"
                    disabled={busy || view.allStop}
                    onClick={() => void run((token) => setExchangeEnabled({ data: { accessToken: token, enabled: true } }))}
                  >
                    Open the door
                  </button>
                )}
              </div>
            </div>

            <div className="window-inbox__item">
              <p className="window-inbox__meta">
                <strong>Give someone access</strong>
              </p>
              <p className="window-inbox__text">
                One person, one key, with an end date. When the date passes — or the moment you
                revoke it — that key opens nothing.
              </p>
              <div className="window-inbox__actions">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Their name"
                  aria-label="Their name"
                />
                <select
                  value={access}
                  onChange={(e) => setAccess(e.target.value as ExchangeAccess)}
                  aria-label="What they may do"
                >
                  <option value="download">Download only</option>
                  <option value="upload">Upload only</option>
                  <option value="both">Both ways</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  aria-label="Days the access lasts"
                />
                <button
                  type="button"
                  className="window-btn"
                  disabled={busy || !name.trim()}
                  onClick={() => void createGrant()}
                >
                  Make their key
                </button>
              </div>
              {freshKey && (
                <div className="window-inbox__still">
                  <p className="window-inbox__text">
                    <strong>Shown once — this is the only copy.</strong> Login name:{" "}
                    <strong>{freshKey.username}</strong> · Key fingerprint: {freshKey.keyFingerprint}{" "}
                    · Works until {dayTime(freshKey.expiresAt)}. Save the key file now and hand it
                    to them with the address above. When this panel closes, the key cannot be
                    shown again — if it is lost, revoke this access and make a new one.
                  </p>
                  <textarea
                    readOnly
                    value={freshKey.privateKeyPem}
                    rows={6}
                    style={{ width: "100%" }}
                    aria-label="Their private key — shown once"
                  />
                  <div className="window-inbox__actions">
                    <button
                      type="button"
                      className="window-btn"
                      onClick={() => downloadText(`${freshKey.username}-exchange-key.txt`, freshKey.privateKeyPem)}
                    >
                      Download the key file
                    </button>
                    <button type="button" className="window-btn" onClick={() => setFreshKey(null)}>
                      I have saved it — clear it
                    </button>
                  </div>
                </div>
              )}
            </div>

            {view.grants.length > 0 && (
              <div className="window-inbox__item">
                <p className="window-inbox__meta">
                  <strong>Who has access</strong>
                </p>
                {view.grants.map((g) => (
                  <p key={g.id} className="window-inbox__text">
                    <strong>{g.name}</strong> ({g.username}) — {accessWords(g.access)}.{" "}
                    {g.revokedAt > 0
                      ? `Revoked ${dayTime(g.revokedAt)}.`
                      : g.live
                        ? `Live until ${dayTime(g.expiresAt)}.`
                        : `Expired ${dayTime(g.expiresAt)}.`}{" "}
                    Key: {g.keyFingerprint}
                    {g.revokedAt === 0 && (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="window-btn"
                          disabled={busy}
                          onClick={() =>
                            void run((token) => revokeExchangeGrant({ data: { accessToken: token, grantId: g.id } }))
                          }
                        >
                          Revoke
                        </button>
                      </>
                    )}
                  </p>
                ))}
              </div>
            )}

            <div className="window-inbox__item">
              <p className="window-inbox__meta">
                <strong>Outbox</strong> — files you offer for download
              </p>
              {view.outbox.length === 0 ? (
                <p className="window-inbox__text">The Outbox is empty.</p>
              ) : (
                view.outbox.map((f) => (
                  <p key={f.name} className="window-inbox__text">
                    {f.name} — {sizeWords(f.size)} · {dayTime(f.modifiedAt)}{" "}
                    <button
                      type="button"
                      className="window-btn"
                      disabled={busy}
                      onClick={() =>
                        void run(async (token) => {
                          const r = await downloadExchangeFile({
                            data: { accessToken: token, folder: "outbox", path: f.path },
                          });
                          if (r.ok && r.base64) downloadBytes(f.name, r.base64);
                          return r;
                        })
                      }
                    >
                      Download
                    </button>{" "}
                    <button
                      type="button"
                      className="window-btn"
                      disabled={busy}
                      onClick={() =>
                        void run((token) => deleteExchangeFile({ data: { accessToken: token, folder: "outbox", path: f.path } }))
                      }
                    >
                      Remove
                    </button>
                  </p>
                ))
              )}
              <div className="window-inbox__actions">
                <input
                  ref={fileInput}
                  type="file"
                  style={{ display: "none" }}
                  onChange={(e) => pickOutboxFile(e.target.files?.[0] ?? null)}
                />
                <button type="button" className="window-btn" disabled={busy} onClick={() => fileInput.current?.click()}>
                  Put a file in the Outbox
                </button>
              </div>
            </div>

            <div className="window-inbox__item">
              <p className="window-inbox__meta">
                <strong>Inbox</strong> — files left for you
              </p>
              {view.inbox.length === 0 ? (
                <p className="window-inbox__text">
                  Nothing has arrived. Careful is the rule here: a file from the wrong person is a
                  dangerous file. Only open what you were expecting, from who you were expecting.
                </p>
              ) : (
                view.inbox.map((f) => (
                  <p key={f.path} className="window-inbox__text">
                    {f.name} — {sizeWords(f.size)} · arrived {dayTime(f.modifiedAt)}
                    {f.fromUser ? ` · left by ${f.fromUser}` : ""}{" "}
                    <button
                      type="button"
                      className="window-btn"
                      disabled={busy}
                      onClick={() =>
                        void run(async (token) => {
                          const r = await downloadExchangeFile({
                            data: { accessToken: token, folder: "inbox", path: f.path },
                          });
                          if (r.ok && r.base64) downloadBytes(f.name, r.base64);
                          return r;
                        })
                      }
                    >
                      Download
                    </button>{" "}
                    <button
                      type="button"
                      className="window-btn"
                      disabled={busy}
                      onClick={() =>
                        void run((token) => deleteExchangeFile({ data: { accessToken: token, folder: "inbox", path: f.path } }))
                      }
                    >
                      Remove
                    </button>
                  </p>
                ))
              )}
            </div>

            <div className="window-inbox__item">
              <p className="window-inbox__meta">
                <strong>The log</strong> — what the door has done
              </p>
              {!view.daemonLogAvailable && (
                <p className="window-inbox__text">
                  The exchange service has not run on this machine yet, so there are no connections
                  to show. When it runs, its own connection record will stand here.
                </p>
              )}
              {view.log.length === 0 ? (
                <p className="window-inbox__text">Nothing yet. The door has not moved.</p>
              ) : (
                [...view.log].reverse().map((entry) => (
                  <p key={entry.id} className="window-inbox__text">
                    {dayTime(entry.at)} — {entry.text}
                  </p>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </FloatingWindow>
  );
}
