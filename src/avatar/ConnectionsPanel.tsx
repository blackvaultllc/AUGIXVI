/**
 * CONNECTIONS — THE UNIVERSAL API / DATA SLOTS AREA (owner order
 * 2026-11-22).
 *
 * The universal area he asked for: open slots for APIs and data
 * from other websites, each with a plain label and a plain
 * statement of what it is for, organized by category like
 * everything else now is. He fills a slot himself; the value goes
 * to the server and is NEVER shown back — a slot only ever reads
 * CONNECTED or OPEN, in plain words. Empty slots say what they
 * wait for. Capacity built now, not retrofitted later.
 *
 * Operator-only: the panel lives in the back area, and every call
 * re-verifies the operator session server-side before states are
 * reported or a value is stored.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { CategorySection } from "./CategorySection";
import { getSupabaseClientConfig } from "./operatorAuth.server";
import {
  CONNECTION_CATEGORIES,
  CONNECTION_SLOTS,
  slotStateLine,
  type ConnectionSlot,
} from "./connections";
import {
  clearConnectionSlot,
  getConnectionSlots,
  saveConnectionSlot,
  type ConnectionsView,
} from "./connections.server";

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

type PanelState =
  | { kind: "loading" }
  | { kind: "denied"; configured: boolean }
  | { kind: "ready"; view: ConnectionsView };

export function ConnectionsPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const token = useCallback(async (): Promise<string | null> => {
    const client = await loadAuthClient();
    if (!client) return null;
    return (await client.auth.getSession()).data.session?.access_token ?? null;
  }, []);

  const refresh = useCallback(async () => {
    const accessToken = await token();
    if (!accessToken) {
      setState({ kind: "denied", configured: true });
      return;
    }
    const view = await getConnectionSlots({ data: { accessToken } });
    if (!view.authorized) {
      setState({ kind: "denied", configured: view.configured });
      return;
    }
    setState({ kind: "ready", view });
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async (slot: ConnectionSlot) => {
    const value = (drafts[slot.id] ?? "").trim();
    if (!value) return;
    setBusySlot(slot.id);
    try {
      const accessToken = await token();
      if (!accessToken) {
        setNotes((current) => ({ ...current, [slot.id]: "The operator session is gone — sign in again." }));
        return;
      }
      const result = await saveConnectionSlot({ data: { accessToken, slotId: slot.id, value } });
      // The value leaves this panel the moment it is stored — the
      // draft is wiped either way, and it is never shown back.
      setDrafts((current) => ({ ...current, [slot.id]: "" }));
      setNotes((current) => ({ ...current, [slot.id]: result.note }));
      if (result.stored) await refresh();
    } finally {
      setBusySlot(null);
    }
  };

  const clear = async (slot: ConnectionSlot) => {
    setBusySlot(slot.id);
    try {
      const accessToken = await token();
      if (!accessToken) {
        setNotes((current) => ({ ...current, [slot.id]: "The operator session is gone — sign in again." }));
        return;
      }
      const result = await clearConnectionSlot({ data: { accessToken, slotId: slot.id } });
      setNotes((current) => ({ ...current, [slot.id]: result.note }));
      if (result.stored) await refresh();
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <FloatingWindow
      id="connections"
      title="Connections — APIs & data slots"
      onClose={onClose}
      initialWidth={480}
      initialHeight={640}
    >
      <div className="connections-panel">
        <p className="window-hint">
          Open slots for APIs and data from other websites. You fill a slot yourself; the value
          goes to the server and is never shown back — a slot only ever reads Connected or Open.
        </p>
        {state.kind === "loading" && <p className="window-hint">Reading the slots…</p>}
        {state.kind === "denied" && (
          <p className="window-hint">
            {state.configured
              ? "Connections are operator-only — this session is not the operator's."
              : "Operator sign-in is not configured on this surface, so the slots stay shut."}
          </p>
        )}
        {state.kind === "ready" && (
          <>
            {!state.view.storageAvailable && (
              <p className="window-hint">
                This surface has no local store: fill a slot by setting the Worker secret of the
                same name in Cloudflare — it will read Connected here.
              </p>
            )}
            {CONNECTION_CATEGORIES.map((category, index) => (
              <CategorySection key={category} title={category} defaultOpen={index === 0}>
                <div className="connections-panel__slots">
                  {CONNECTION_SLOTS.filter((slot) => slot.category === category).map((slot) => {
                    const slotState = state.view.slots.find((entry) => entry.slotId === slot.id);
                    const connected = slotState?.connected ?? false;
                    const fromEnvironment = slotState?.source === "environment";
                    return (
                      <div key={slot.id} className="connections-panel__slot">
                        <div className="connections-panel__slot-head">
                          <span
                            className={`connections-panel__light connections-panel__light--${connected ? "on" : "off"}`}
                            role="img"
                            aria-label={connected ? "connected" : "open"}
                          />
                          <span className="connections-panel__slot-name">{slot.label}</span>
                        </div>
                        <p className="connections-panel__purpose">{slot.purpose}</p>
                        <p className="connections-panel__state">
                          {slotStateLine(slot, connected)}
                          {connected && fromEnvironment
                            ? " It lives in the environment (a Worker secret or the machine's own settings)."
                            : connected
                              ? " It lives in this server's store."
                              : ""}
                        </p>
                        {state.view.storageAvailable && !fromEnvironment && (
                          <div className="connections-panel__entry">
                            <input
                              type="password"
                              value={drafts[slot.id] ?? ""}
                              onChange={(event) =>
                                setDrafts((current) => ({ ...current, [slot.id]: event.target.value }))
                              }
                              placeholder={
                                slot.kind === "url"
                                  ? "Paste the address — stored, never shown"
                                  : "Paste the key — stored, never shown"
                              }
                              aria-label={`${slot.label} — value, stored on the server and never shown`}
                              autoComplete="off"
                              autoCapitalize="off"
                              spellCheck={false}
                            />
                            <button
                              type="button"
                              className="window-btn"
                              disabled={busySlot === slot.id || !(drafts[slot.id] ?? "").trim()}
                              onClick={() => void save(slot)}
                            >
                              <KeyRound aria-hidden="true" /> Store it
                            </button>
                            {connected && (
                              <button
                                type="button"
                                className="window-btn"
                                disabled={busySlot === slot.id}
                                onClick={() => void clear(slot)}
                                aria-label={`Empty the ${slot.label} slot`}
                              >
                                <Trash2 aria-hidden="true" /> Empty
                              </button>
                            )}
                          </div>
                        )}
                        {notes[slot.id] && (
                          <p className="connections-panel__note" role="status">
                            {notes[slot.id]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CategorySection>
            ))}
            <button type="button" className="window-btn" onClick={() => void refresh()}>
              <RefreshCw aria-hidden="true" /> Refresh the slots
            </button>
          </>
        )}
      </div>
    </FloatingWindow>
  );
}
