/**
 * NOTIFICATIONS WINDOW — Anubis's inbox (owner orders
 * 2026-11-26: a notification button in the command base; click
 * it and see his updates — suggestions he makes on his own
 * judgment, system activity he performed, and pictures he
 * captured WITH the reasoning that was saved with them).
 *
 * Every entry here was derived from a real record in the core
 * and names the record it came from — no event, no entry.
 * Captures show their reasoning and offer the picture itself:
 * shown from the core on the Captain's tap (through the
 * sector door, which checks the file against the record) and
 * downloadable from there.
 *
 * The window's second half is the PROPERTY FEED: the outside
 * camera's record for Bellwood Haven ("Anubis security"), with
 * its export. The wall stands in the open here: nothing from
 * inside the house is ever in the feed — the writer refuses
 * interior zones in code.
 *
 * Operator-only: every read re-verifies the operator session
 * server-side, like every window in this house.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getSupabaseClientConfig } from "./operatorAuth.server";
import {
  exportPropertyFeed,
  getNotifications,
  getPropertyFeed,
  markAllNotificationsRead,
  markNotificationRead,
  type InboxView,
  type PropertyFeedView,
} from "./notifications.server";
import { getSectorStill } from "./sectorWatch.server";
import type { AnubisNotification } from "./cameras/anubisInbox";

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

function kindLabel(entry: AnubisNotification): string {
  switch (entry.kind) {
    case "suggestion":
      return "His suggestion";
    case "system":
      return "System";
    case "capture":
      return "Picture kept";
    case "request":
      return "A request for you";
  }
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function NotificationsWindow({ onClose }: { onClose: () => void }) {
  const [inbox, setInbox] = useState<InboxView | null>(null);
  const [feed, setFeed] = useState<PropertyFeedView | null>(null);
  const [denied, setDenied] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  /** Kept stills the Captain has opened — file name → data URL, loaded on his tap only. */
  const [stills, setStills] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    const [nextInbox, nextFeed] = await Promise.all([
      getNotifications({ data: { accessToken: token } }).catch(() => null),
      getPropertyFeed({ data: { accessToken: token } }).catch(() => null),
    ]);
    if (nextInbox && !nextInbox.authorized) {
      setDenied(true);
      return;
    }
    if (nextInbox) setInbox(nextInbox);
    if (nextFeed) setFeed(nextFeed);
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

  const showStill = async (file: string) => {
    const token = await accessToken().catch(() => null);
    if (!token) return;
    const r = await getSectorStill({ data: { accessToken: token, file } }).catch(() => null);
    if (r?.dataUrl) {
      setStills((prev) => ({ ...prev, [file]: r.dataUrl as string }));
    } else if (r) {
      setNote(r.note);
    }
  };

  const exportFeed = async () => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    setBusy(true);
    try {
      const result = await exportPropertyFeed({ data: { accessToken: token } });
      setNote(result.note);
      if (result.ok && result.content) downloadTextFile(result.fileName, result.content);
    } catch {
      setNote("The core did not answer — nothing was exported.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FloatingWindow
      id="anubis-inbox"
      title="Notifications — Anubis's inbox"
      onClose={onClose}
      initialWidth={520}
      initialHeight={560}
      fitContentHeight
    >
      <div className="window-inbox">
        {denied ? (
          <p className="window-inbox__note">
            The operator session is gone — sign in again to read Anubis's inbox.
          </p>
        ) : !inbox ? (
          <p className="window-inbox__note">Reading the inbox…</p>
        ) : !inbox.storageAvailable ? (
          <p className="window-inbox__note">
            The inbox lives on the core machine — this surface has no local inbox store, so his
            updates can only be read from the Parrot copy.
          </p>
        ) : (
          <>
            <p className="window-inbox__note">
              Everything here came from a real record in the core — a watch event, a picture he
              kept, a line in the core's own events log — and every entry names the record it
              came from. No event, no entry.{" "}
              {inbox.unread > 0
                ? `${inbox.unread} unread.`
                : "Nothing unread."}
            </p>
            {inbox.unread > 0 && (
              <div className="window-inbox__actions">
                <button
                  type="button"
                  className="window-btn"
                  disabled={busy}
                  onClick={() =>
                    void run((token) => markAllNotificationsRead({ data: { accessToken: token } }))
                  }
                >
                  Mark all read
                </button>
              </div>
            )}
            {inbox.entries.length === 0 ? (
              <p className="window-inbox__note">
                The inbox is empty. When Anubis keeps a picture, makes a suggestion from what the
                watch recorded, or the core logs its own activity, it lands here.
              </p>
            ) : (
              inbox.entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`window-inbox__item${entry.read ? "" : " window-inbox__item--unread"}`}
                >
                  <p className="window-inbox__meta">
                    <strong>{kindLabel(entry)}</strong> · {dayTime(entry.at)}
                    {entry.cameraName ? ` · ${entry.cameraName}` : ""} — {entry.title}{" "}
                    {entry.read ? (
                      "Read."
                    ) : (
                      <button
                        type="button"
                        className="window-btn"
                        disabled={busy}
                        onClick={() =>
                          void run((token) =>
                            markNotificationRead({
                              data: { accessToken: token, entryId: entry.id },
                            }),
                          )
                        }
                      >
                        Mark read
                      </button>
                    )}
                  </p>
                  <p className="window-inbox__text">{entry.text}</p>
                  {entry.kind === "capture" && entry.reasoning && (
                    <p className="window-inbox__note">
                      Why this picture was kept (the reasoning saved with it): {entry.reasoning}
                    </p>
                  )}
                  {entry.kind === "capture" && entry.still && (
                    <div className="window-inbox__still">
                      {stills[entry.still] ? (
                        <>
                          <img
                            src={stills[entry.still]}
                            alt={`Kept picture ${entry.still}`}
                            style={{ display: "block", maxWidth: "100%", borderRadius: 6 }}
                          />
                          <a
                            className="window-btn"
                            href={stills[entry.still]}
                            download={entry.still}
                            style={{ display: "inline-block", marginTop: 6 }}
                          >
                            Download this picture
                          </a>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="window-btn"
                          onClick={() => void showStill(entry.still)}
                        >
                          Show picture ({entry.still})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            <div className="window-inbox__feed">
              <p className="window-inbox__meta">
                <strong>Property feed — “Anubis security” for Bellwood Haven</strong>
              </p>
              <p className="window-inbox__note">
                The OUTSIDE camera's record only: suspicious activity and vehicles at the front
                of the property, kept for incident reports and property knowledge reports.
                Nothing from inside the house is ever in this feed — the feed writer refuses
                interior cameras in code, by zone; there is no switch that changes that.
              </p>
              {!feed || !feed.storageAvailable ? (
                <p className="window-inbox__note">
                  The property feed lives on the core machine — it can only be read from the
                  Parrot copy.
                </p>
              ) : feed.entries.length === 0 ? (
                <p className="window-inbox__note">
                  Nothing in the feed yet. The first confirmed front event or judgment picture
                  lands here on its own.
                </p>
              ) : (
                <>
                  {feed.entries.slice(0, 30).map((entry) => (
                    <p key={entry.id} className="window-inbox__text">
                      <strong>{entry.cameraName}</strong> · {dayTime(entry.at)} · {entry.kind}
                      {entry.draft ? " · DRAFT (a judgment reading, below the event line)" : ""}{" "}
                      — {entry.reasoning}
                      {entry.capture ? ` Picture kept: ${entry.capture}.` : " No picture kept."}
                    </p>
                  ))}
                  <div className="window-inbox__actions">
                    <button
                      type="button"
                      className="window-btn"
                      disabled={busy}
                      onClick={() => void exportFeed()}
                    >
                      Export the property feed (JSON)
                    </button>
                  </div>
                  <p className="window-inbox__note">
                    The export is one JSON file with every feed entry and the picture file names
                    it refers to — hand it to the Bellwood Haven records. The pictures themselves
                    live on the core in ~/.local/share/augie/sector-events/.
                  </p>
                </>
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
