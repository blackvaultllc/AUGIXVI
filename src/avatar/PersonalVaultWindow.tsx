/**
 * PERSONAL VAULT WINDOW — the Captain's own papers, in Anubis
 * (owner order 2026-11-26: his driver's license, passport, and
 * car documentation — title/pink slip — kept in the construct
 * so they are with him if he is ever pulled over and questioned).
 *
 * The files live ONLY on the core machine
 * (~/.local/share/augie/personal-vault/, owner-only). This
 * window is the door: upload from his surface, the list (type,
 * label, date), and view/download — each served by the core
 * after the record check, into this signed-in window only.
 * Nothing here is published or sent anywhere.
 *
 * The lower half is INTERACTION RECORDINGS: the stop-mode
 * evidence — each finished stop with its claim record and the
 * recording itself, downloadable from the same door.
 *
 * Owner-only: the window opens from the operator's own Tools
 * menu and every read re-verifies the operator session
 * server-side. It does not exist on Khadija's side.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getSupabaseClientConfig } from "./operatorAuth.server";
import {
  addVaultDocument,
  getEvidenceRecording,
  getPersonalVault,
  getVaultDocument,
  removeVaultDocument,
  type VaultView,
} from "./personalVault.server";
import {
  VAULT_DOC_TYPE_LABELS,
  VAULT_DOC_TYPES,
  type VaultDocType,
} from "./personalVault";

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
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function readFileAsBase64(file: File): Promise<{ mediaType: string; dataBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file did not read."));
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      const comma = url.indexOf(",");
      if (comma < 0) {
        reject(new Error("That file did not read."));
        return;
      }
      resolve({ mediaType: file.type || "application/octet-stream", dataBase64: url.slice(comma + 1) });
    };
    reader.readAsDataURL(file);
  });
}

export function PersonalVaultWindow({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<VaultView | null>(null);
  const [denied, setDenied] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [docType, setDocType] = useState<VaultDocType>("drivers-license");
  const [label, setLabel] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);
  /** Documents he has opened — id → data URL, loaded on his tap only. */
  const [opened, setOpened] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    const next = await getPersonalVault({ data: { accessToken: token } }).catch(() => null);
    if (next && !next.authorized) {
      setDenied(true);
      return;
    }
    if (next) setView(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = async (file: File) => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    setBusy(true);
    try {
      const { mediaType, dataBase64 } = await readFileAsBase64(file);
      const result = await addVaultDocument({
        data: {
          accessToken: token,
          type: docType,
          label: label.trim() || VAULT_DOC_TYPE_LABELS[docType],
          mediaType,
          dataBase64,
        },
      });
      setNote(result.note);
      if (result.ok) setLabel("");
    } catch {
      setNote("That file did not read — nothing was stored.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const showDocument = async (id: string) => {
    const token = await accessToken().catch(() => null);
    if (!token) return;
    const r = await getVaultDocument({ data: { accessToken: token, id } }).catch(() => null);
    if (r?.dataUrl) {
      setOpened((prev) => ({ ...prev, [id]: r.dataUrl as string }));
    } else if (r) {
      setNote(r.note);
    }
  };

  const remove = async (id: string, docLabel: string) => {
    const token = await accessToken().catch(() => null);
    if (!token) return;
    setBusy(true);
    try {
      const result = await removeVaultDocument({ data: { accessToken: token, id } });
      setNote(result.note || `“${docLabel}” removed.`);
    } catch {
      setNote("The core did not answer — nothing was changed.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const downloadRecording = async (stopId: string) => {
    const token = await accessToken().catch(() => null);
    if (!token) return;
    setBusy(true);
    try {
      const r = await getEvidenceRecording({ data: { accessToken: token, stopId } });
      if (r.dataUrl && r.fileName) {
        const anchor = document.createElement("a");
        anchor.href = r.dataUrl;
        anchor.download = r.fileName;
        anchor.click();
        setNote("The recording is downloading — it stays yours; the copy on the core stands.");
      } else {
        setNote(r.note);
      }
    } catch {
      setNote("The core did not answer — nothing was downloaded.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FloatingWindow
      id="personal-vault"
      title="Personal Vault — your papers, on the core"
      onClose={onClose}
      initialWidth={540}
      initialHeight={600}
    >
      <div className="window-inbox">
        {denied ? (
          <p className="window-inbox__note">
            The operator session is gone — sign in again to open your vault.
          </p>
        ) : !view ? (
          <p className="window-inbox__note">Opening the vault…</p>
        ) : !view.storageAvailable ? (
          <p className="window-inbox__note">
            The vault lives on the core machine — this surface has no local vault store, so your papers
            can only be reached from the Parrot copy.
          </p>
        ) : (
          <>
            <p className="window-inbox__note">
              Your papers, stored ONLY on this machine (~/.local/share/augie/personal-vault/, readable
              by no one else on it). Nothing in the vault is published or sent anywhere — a document
              leaves the core only into this window, on your tap.
            </p>

            <div className="window-inbox__actions">
              <label>
                Type{" "}
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as VaultDocType)}
                  disabled={busy}
                >
                  {VAULT_DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {VAULT_DOC_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Name it (e.g. License — front)"
                disabled={busy}
                style={{ flex: 1, minWidth: 140 }}
              />
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="window-btn"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                Add a document…
              </button>
            </div>

            {view.documents.length === 0 ? (
              <p className="window-inbox__note">
                The vault is empty. Add your driver's license, your passport, and your car papers —
                title (pink slip), registration, insurance card — and they stand here, on the core,
                whenever you need them.
              </p>
            ) : (
              view.documents.map((doc) => (
                <div key={doc.id} className="window-inbox__item">
                  <p className="window-inbox__meta">
                    <strong>{VAULT_DOC_TYPE_LABELS[doc.type]}</strong> · {doc.label} · added{" "}
                    {dayTime(doc.addedAt)} · {(doc.bytes / 1024).toFixed(0)} KB
                  </p>
                  {opened[doc.id] ? (
                    <>
                      {doc.mediaType.startsWith("image/") ? (
                        <img
                          src={opened[doc.id]}
                          alt={doc.label}
                          style={{ display: "block", maxWidth: "100%", borderRadius: 6 }}
                        />
                      ) : (
                        <p className="window-inbox__text">This document is a {doc.mediaType} file.</p>
                      )}
                      <div className="window-inbox__actions">
                        <a
                          className="window-btn"
                          href={opened[doc.id]}
                          download={doc.file}
                          style={{ display: "inline-block" }}
                        >
                          Download
                        </a>
                        <button
                          type="button"
                          className="window-btn"
                          disabled={busy}
                          onClick={() => void remove(doc.id, doc.label)}
                        >
                          Remove from the vault
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="window-btn"
                      onClick={() => void showDocument(doc.id)}
                    >
                      Show document
                    </button>
                  )}
                </div>
              ))
            )}

            <div className="window-inbox__feed">
              <p className="window-inbox__meta">
                <strong>Interaction recordings — your stop evidence</strong>
              </p>
              <p className="window-inbox__note">
                Every stop Anubis recorded in stop mode stands here with its claim record — what was
                claimed, what the law base said, and the words he put in your ear. The recordings
                live on the core in ~/.local/share/augie/evidence/.
              </p>
              {view.activeStop && (
                <p className="window-inbox__text">
                  <strong>A stop is being recorded right now</strong> — through{" "}
                  {view.activeStop.cameraName}, since {dayTime(view.activeStop.startedAt)}.
                </p>
              )}
              {view.stops.length === 0 && !view.activeStop ? (
                <p className="window-inbox__note">No stops recorded yet.</p>
              ) : (
                view.stops.map((stop) => (
                  <div key={stop.id} className="window-inbox__item">
                    <p className="window-inbox__meta">
                      <strong>Stop</strong> · {dayTime(stop.startedAt)} · heard through{" "}
                      {stop.cameraName} · triggered by{" "}
                      {stop.trigger === "panel"
                        ? "the panel"
                        : stop.trigger === "officer"
                          ? "the officer's own words"
                          : "your declaration"}{" "}
                      · ended{" "}
                      {stop.endKind === "his-word"
                        ? "on your word"
                        : stop.endKind === "all-stop"
                          ? "by the ALL-STOP"
                          : stop.endKind === "silence"
                            ? "after ten minutes of silence"
                            : "from the panel"}
                    </p>
                    {stop.claims.length === 0 ? (
                      <p className="window-inbox__text">No claims were checked during this stop.</p>
                    ) : (
                      stop.claims.map((c, i) => (
                        <p key={i} className="window-inbox__text">
                          “{c.claim}” —{" "}
                          {c.verdict === "matches"
                            ? "MATCHES the base"
                            : c.verdict === "contradicts"
                              ? "CONTRADICTS the base"
                              : "NOT IN THE BASE"}
                          . {c.note}
                        </p>
                      ))
                    )}
                    {stop.guidance.map((g, i) => (
                      <p key={i} className="window-inbox__note">
                        Guidance given: {g.text} [{g.citation}]
                      </p>
                    ))}
                    {stop.recording ? (
                      <div className="window-inbox__actions">
                        <button
                          type="button"
                          className="window-btn"
                          disabled={busy}
                          onClick={() => void downloadRecording(stop.id)}
                        >
                          Download the recording ({stop.recording.file})
                        </button>
                      </div>
                    ) : (
                      <p className="window-inbox__note">This stop has no recording file.</p>
                    )}
                  </div>
                ))
              )}
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
