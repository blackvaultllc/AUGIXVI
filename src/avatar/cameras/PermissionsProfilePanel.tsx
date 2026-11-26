/**
 * PERMISSIONS PROFILE PANEL — the Cameras window's uniform
 * permissions card (the Captain's standing rule, 2026-11-26:
 * all permissions the same for every camera and device unless
 * he changes them for one item himself).
 *
 * What he controls here: the ONE shared profile (owner
 * confirmed + control granted) that every registered camera
 * and device inherits, and — per item — an explicit deviation,
 * shown plainly wherever one stands. New registrations take
 * the shared profile on their own (the core reconciles); a
 * retired device is listed for the record and never touched.
 */
import { useCallback, useEffect, useState } from "react";
import {
  getPermissionsProfile,
  setPermissionDeviation,
  setSharedProfile,
  type PermissionsProfileView,
} from "../permissionsProfile.server";
import type { PermissionFlags } from "../permissionsProfile";

export function PermissionsProfilePanel({ token }: { token: string }) {
  const [view, setView] = useState<PermissionsProfileView | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharedDraft, setSharedDraft] = useState<PermissionFlags | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PermissionFlags>>({});

  const refresh = useCallback(async () => {
    const v = await getPermissionsProfile({ data: { accessToken: token } }).catch(() => null);
    if (v?.authorized) {
      setView(v);
      setSharedDraft(v.profile);
      setDrafts({});
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<{ note: string }>) => {
    setBusy(true);
    try {
      const r = await fn();
      setNote(r.note);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!view) return null;
  if (!view.available) {
    return (
      <div className="window-cameras__card">
        <div className="window-cameras__head">
          <strong>Permissions — one shared profile</strong>
          <span>core only</span>
        </div>
        <p className="window-cameras__grant">
          The shared permission profile lives on the core machine — it is not available on this
          surface.
        </p>
      </div>
    );
  }

  const shared = sharedDraft ?? view.profile;

  return (
    <div className="window-cameras__card">
      <div className="window-cameras__head">
        <strong>Permissions — one shared profile</strong>
        <span>every camera and every registered device inherits it</span>
      </div>
      <p className="window-cameras__grant">
        One profile for the whole fleet — cameras and Bluetooth devices alike. Change it here and
        the core reconciles all of them at once. A single item may stand apart only where you set
        it apart yourself, and this card says so plainly wherever that is true. New cameras and
        devices take the shared profile by default — nobody hand-sets their flags.
      </p>
      <label className="window-cameras__check">
        <input
          type="checkbox"
          checked={shared.ownerConfirmed}
          disabled={busy}
          onChange={(e) => setSharedDraft({ ...shared, ownerConfirmed: e.target.checked })}
        />
        Owner confirmed (the fleet is the Captain's)
      </label>
      <label className="window-cameras__check">
        <input
          type="checkbox"
          checked={shared.controlGranted}
          disabled={busy}
          onChange={(e) => setSharedDraft({ ...shared, controlGranted: e.target.checked })}
        />
        Control granted (Anubis may act on the fleet)
      </label>
      <div className="window-cameras__actions">
        <button
          type="button"
          className="window-btn"
          disabled={busy}
          onClick={() =>
            void run(() =>
              setSharedProfile({
                data: { accessToken: token, ownerConfirmed: shared.ownerConfirmed, controlGranted: shared.controlGranted },
              }),
            )
          }
        >
          Save the shared profile (applies to all)
        </button>
      </div>

      {view.items.map((item) => {
        const draft = drafts[item.key] ?? item.effective;
        return (
          <div key={item.key} className="window-cameras__presence">
            <strong>{item.name}</strong>
            <p className="window-cameras__grant">
              {item.kind === "camera" ? "Camera" : "Device"}
              {item.retired
                ? " — retired. Its flags were stripped at retirement and no profile touches it."
                : item.deviates
                  ? " — DEVIATES from the shared profile: these flags were set for this item only."
                  : " — follows the shared profile."}{" "}
              Standing now: owner {item.current.ownerConfirmed ? "confirmed" : "not confirmed"} ·
              control {item.current.controlGranted ? "granted" : "not granted"}.
            </p>
            {!item.retired && (
              <>
                <label className="window-cameras__check">
                  <input
                    type="checkbox"
                    checked={draft.ownerConfirmed}
                    disabled={busy}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [item.key]: { ...draft, ownerConfirmed: e.target.checked },
                      }))
                    }
                  />
                  Owner confirmed — this item only
                </label>
                <label className="window-cameras__check">
                  <input
                    type="checkbox"
                    checked={draft.controlGranted}
                    disabled={busy}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [item.key]: { ...draft, controlGranted: e.target.checked },
                      }))
                    }
                  />
                  Control granted — this item only
                </label>
                <div className="window-cameras__actions">
                  <button
                    type="button"
                    className="window-btn"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        setPermissionDeviation({
                          data: { accessToken: token, kind: item.kind, id: item.id, flags: draft },
                        }),
                      )
                    }
                  >
                    Set for this item only
                  </button>
                  {item.deviates && (
                    <button
                      type="button"
                      className="window-btn"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          setPermissionDeviation({
                            data: { accessToken: token, kind: item.kind, id: item.id, flags: null },
                          }),
                        )
                      }
                    >
                      Return to the shared profile
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
      {note && (
        <p className="window-hint" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
