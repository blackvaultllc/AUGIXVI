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
import {
  answerKhadijaCall,
  endKhadijaCall,
  listDaddyInbox,
  markDaddyInboxRead,
  replyToKhadija,
  type DaddyInboxView,
} from "./learner/daddyInbox.server";

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

type Tab = "service" | "updates" | "khadija";

export function LogsWindow({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("service");
  const [journal, setJournal] = useState<ServiceJournalView | null>(null);
  const [updates, setUpdates] = useState<UpdateView | null>(null);
  const [inbox, setInbox] = useState<DaddyInboxView | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyNote, setReplyNote] = useState("");
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

  /**
   * KHADIJA'S TAB (owner order 2026-11-24): her messages and her
   * calls, in his Logs where he reads his records. Opening the tab
   * shows him the thread and marks her words read; the call's
   * Answer button is here, and his reply box writes straight back
   * to her Daddy cabinet. The tab refreshes itself while it is open
   * so a ringing call cannot sit unseen behind a stale pane.
   */
  const loadInbox = useCallback(async () => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    const view = await listDaddyInbox({ data: { accessToken: token } }).catch(() => null);
    if (!view || !view.authorized) {
      setDenied(true);
      return;
    }
    setInbox(view);
    if (view.available && view.unread.length > 0) {
      await markDaddyInboxRead({ data: { accessToken: token } }).catch(() => null);
    }
  }, []);

  useEffect(() => {
    if (tab !== "khadija") return;
    void loadInbox();
    const timer = setInterval(() => void loadInbox(), 15_000);
    return () => clearInterval(timer);
  }, [tab, loadInbox]);

  const actOnCall = useCallback(
    async (action: "answer" | "end") => {
      const token = await accessToken().catch(() => null);
      if (!token) {
        setDenied(true);
        return;
      }
      if (action === "answer") {
        await answerKhadijaCall({ data: { accessToken: token } }).catch(() => null);
        setReplyNote("You answered. Khadija's page now shows you are with her — write her below.");
      } else {
        await endKhadijaCall({ data: { accessToken: token } }).catch(() => null);
        setReplyNote("The call is ended.");
      }
      void loadInbox();
    },
    [loadInbox],
  );

  const sendReply = useCallback(async () => {
    const text = replyDraft.trim();
    if (!text) return;
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    const res = await replyToKhadija({ data: { accessToken: token, text } }).catch(() => null);
    if (res?.sent) {
      setReplyDraft("");
      setReplyNote("Sent to Khadija — it is on her Daddy cabinet now.");
    } else {
      setReplyNote("The reply could not be sent from this surface.");
    }
    void loadInbox();
  }, [replyDraft, loadInbox]);

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
          <button
            type="button"
            className="window-btn"
            aria-pressed={tab === "khadija"}
            onClick={() => setTab("khadija")}
          >
            Khadija
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

        {!denied && tab === "khadija" && (
          <>
            {!inbox && <p className="window-logs__note">Reading Khadija's inbox…</p>}
            {inbox && !inbox.available && (
              <p className="window-logs__note">
                Khadija's inbox lives in the core on the Parrot — it is not available on this
                surface.
              </p>
            )}
            {inbox && inbox.available && (
              <div>
                {inbox.call?.state === "ringing" && (
                  <p className="window-logs__note" role="alert">
                    <strong>Khadija is calling you.</strong>{" "}
                    <button type="button" className="window-btn" onClick={() => void actOnCall("answer")}>
                      Answer
                    </button>{" "}
                    <button type="button" className="window-btn" onClick={() => void actOnCall("end")}>
                      Let it go to her inbox
                    </button>
                  </p>
                )}
                {inbox.call?.state === "answered" && (
                  <p className="window-logs__note" role="status">
                    <strong>You are with Khadija now.</strong> She sees that you answered.{" "}
                    <button type="button" className="window-btn" onClick={() => void actOnCall("end")}>
                      End the call
                    </button>
                  </p>
                )}
                {inbox.messages.length === 0 && (
                  <p className="window-logs__note">No messages from Khadija yet.</p>
                )}
                <ol className="window-logs__list">
                  {inbox.messages.map((message) => (
                    <li key={message.id} className="window-logs__line">
                      <strong>{message.from === "daddy" ? "You" : "Khadija"}:</strong>{" "}
                      {message.text}
                    </li>
                  ))}
                </ol>
                <div className="window-logs__reply">
                  <label>
                    Write back to Khadija
                    <input
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      placeholder="Your words for Khadija"
                      maxLength={500}
                    />
                  </label>
                  <button
                    type="button"
                    className="window-btn"
                    onClick={() => void sendReply()}
                    disabled={!replyDraft.trim()}
                  >
                    Send to Khadija
                  </button>
                </div>
                {replyNote && (
                  <p className="window-logs__note" role="status">
                    {replyNote}
                  </p>
                )}
              </div>
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
