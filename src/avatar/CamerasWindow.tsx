/**
 * CAMERAS — Augie's eyes on the Captain's own network (operator
 * order 2026-11-23: "Get him hooked up for that now. Make sure he
 * can access any camera that I own.").
 *
 * Every registered camera shows both its lenses live (the server
 * bridges RTSP → MJPEG; the browser never touches the camera's
 * password), a snapshot button, a probe that proves which paths
 * answer, and — only where his Permission-Law grant is on the
 * card — a PTZ pad for the moving lens.
 *
 * Honesty rules: a lens that has not produced a frame says so; a
 * camera that does not answer says so, with the exact step that
 * opens its door (on the O-KAM family, ONVIF/RTSP stays off until
 * a device password is set in the app). Nothing here fakes a
 * picture.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getSupabaseClientConfig } from "./operatorAuth.server";
import {
  getCameras,
  probeCamera,
  ptzCamera,
  removeCamera,
  saveCamera,
  type CamerasView,
  type ProbeResult,
} from "./cameras.server";
import {
  cameraCanControl,
  newCameraId,
  type CameraLens,
  type CameraProfile,
} from "./cameras/cameraRegistry";
import { loadRegistry, upsertDevice, type DeviceProfile } from "./devices/deviceRegistry";

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

/** The desk unit, prepared from the Captain's order of 2026-11-23:
 *  his grant (owner + control) is on this draft because he gave it
 *  in words that morning. Ports/paths are the O-KAM family's
 *  documented doors — the probe proves them against the real unit. */
function szsinocamDraft(): CameraProfile {
  return {
    id: newCameraId(),
    name: "Desk Camera — SZSinocam Dual Lens",
    host: "",
    rtspPort: 10554,
    onvifPort: 10080,
    username: "admin",
    hasPassword: false,
    lenses: [
      { id: "lens-1", label: "Fixed lens", kind: "fixed", rtspPath: "/tcp/av0_0" },
      { id: "lens-2", label: "PTZ lens", kind: "ptz", rtspPath: "/tcp/av0_1" },
    ],
    ownerConfirmed: true,
    controlGranted: true,
    notes:
      "Dual-lens unit on his desk (fixed + PTZ). Control granted by the Captain 2026-11-23. ONVIF/RTSP opens when the device password is set in the O-KAM app.",
    addedAt: Date.now(),
  };
}

/** Mirror a camera into the browser device registry, so the
 *  Devices sector carries the same card (fingerprint + grant). */
function mirrorIntoDeviceRegistry(camera: CameraProfile): void {
  try {
    const profile: DeviceProfile = {
      id: `device-${camera.id}`,
      displayName: camera.name,
      kind: "camera",
      transport: "wifi",
      externalId: camera.mac ?? camera.host,
      placement: "fixed",
      address: camera.host,
      protocol: "RTSP/ONVIF",
      ports: [
        { port: camera.rtspPort, protocol: "tcp", service: "RTSP stream" },
        { port: camera.onvifPort, protocol: "tcp", service: "ONVIF device service" },
      ],
      controls: camera.lenses.some((l) => l.kind === "ptz")
        ? [
            {
              id: "onvif-ptz",
              label: "PTZ — pan / tilt / zoom",
              kind: "stick",
              detail: "ONVIF ContinuousMove via the media profile of the PTZ lens",
              verified: camera.ptzVerified === true,
            },
          ]
        : undefined,
      ownerConfirmed: camera.ownerConfirmed,
      controlGranted: camera.controlGranted,
      presence: "unknown",
      presenceEvents: [],
      source: "manual",
      declaredServices: [],
      capabilities: camera.lenses.map((l) => `${l.label} — live view`),
      limitations: [],
      deviceInfo: {
        manufacturer: camera.manufacturer,
        model: camera.model,
        firmware: camera.firmware,
      },
      batteryLevel: null,
      measured: { streamType: "RTSP bridged to MJPEG by the core machine" },
      firstSeen: camera.addedAt,
      lastSeen: Date.now(),
    };
    upsertDevice(loadRegistry(), profile);
  } catch {
    // the mirror is best-effort; the server registry is the truth
  }
}

type PanelState =
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "ready"; view: CamerasView };

function streamUrl(token: string, cameraId: string, lensId: string): string {
  return `/api/cameras/stream?t=${encodeURIComponent(token)}&id=${encodeURIComponent(cameraId)}&lens=${encodeURIComponent(lensId)}`;
}

function LensView({
  camera,
  lens,
  token,
}: {
  camera: CameraProfile;
  lens: CameraLens;
  token: string;
}) {
  const [live, setLive] = useState(false);
  const [still, setStill] = useState<string | null>(null);
  const [stillNote, setStillNote] = useState<string>("");
  const [streamFailed, setStreamFailed] = useState(false);
  const stillRef = useRef<string | null>(null);

  const takeSnapshot = useCallback(async () => {
    setStillNote("Grabbing a frame…");
    try {
      const res = await fetch(
        `/api/cameras/snapshot?t=${encodeURIComponent(token)}&id=${encodeURIComponent(camera.id)}&lens=${encodeURIComponent(lens.id)}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      if (stillRef.current) URL.revokeObjectURL(stillRef.current);
      const url = URL.createObjectURL(blob);
      stillRef.current = url;
      setStill(url);
      setStillNote(`Snapshot — ${new Date().toLocaleTimeString()}`);
    } catch {
      setStillNote("No frame came back — the lens path is silent or refused.");
    }
  }, [camera.id, lens.id, token]);

  return (
    <div className="window-cameras__lens">
      <div className="window-cameras__lens-head">
        <strong>{lens.label}</strong>
        <span className="window-cameras__lens-state">
          {lens.verified ? "path verified — frames pulled" : "path not yet proven"}
        </span>
      </div>
      {live && !streamFailed ? (
        <img
          className="window-cameras__video"
          src={streamUrl(token, camera.id, lens.id)}
          alt={`${camera.name} — ${lens.label} live view`}
          onError={() => setStreamFailed(true)}
        />
      ) : still ? (
        <img className="window-cameras__video" src={still} alt={`${camera.name} — ${lens.label} snapshot`} />
      ) : (
        <div className="window-cameras__novideo">
          {streamFailed
            ? "The live bridge got no picture from this lens. Try a snapshot, or run Probe — the path may be silent until the camera's app password is set."
            : "No picture yet. Start the live view or take a snapshot."}
        </div>
      )}
      <div className="window-cameras__actions">
        <button
          type="button"
          className="window-btn"
          onClick={() => {
            setStreamFailed(false);
            setLive((v) => !v);
          }}
        >
          {live ? "Stop live view" : "Live view"}
        </button>
        <button type="button" className="window-btn" onClick={() => void takeSnapshot()}>
          Snapshot
        </button>
        {stillNote && (
          <span className="window-hint" role="status">
            {stillNote}
          </span>
        )}
      </div>
      <p className="window-cameras__transport">
        Live view is the core machine transcoding the camera's RTSP stream (MJPEG, about 10 frames a
        second, under a second behind real time).
      </p>
    </div>
  );
}

function PtzPad({ camera, token }: { camera: CameraProfile; token: string }) {
  const [note, setNote] = useState("");
  const move = useCallback(
    async (pan: number, tilt: number, zoom: number, stop = false) => {
      const result = await ptzCamera({
        data: { accessToken: token, cameraId: camera.id, pan, tilt, zoom, stop },
      });
      setNote(result.note);
    },
    [camera.id, token],
  );
  const hold = (pan: number, tilt: number, zoom: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      void move(pan, tilt, zoom);
    },
    onPointerUp: () => void move(0, 0, 0, true),
    onPointerLeave: () => void move(0, 0, 0, true),
  });
  return (
    <div className="window-cameras__ptz">
      <strong>PTZ — hold a button to move the lens</strong>
      <div className="window-cameras__pad">
        <span />
        <button type="button" className="window-btn" {...hold(0, 1, 0)} aria-label="Tilt up">
          ↑
        </button>
        <span />
        <button type="button" className="window-btn" {...hold(-1, 0, 0)} aria-label="Pan left">
          ←
        </button>
        <button type="button" className="window-btn" {...hold(0, 0, 0)} aria-label="Stop">
          ■
        </button>
        <button type="button" className="window-btn" {...hold(1, 0, 0)} aria-label="Pan right">
          →
        </button>
        <span />
        <button type="button" className="window-btn" {...hold(0, -1, 0)} aria-label="Tilt down">
          ↓
        </button>
        <span />
      </div>
      <div className="window-cameras__actions">
        <button type="button" className="window-btn" {...hold(0, 0, 1)}>
          Zoom in (hold)
        </button>
        <button type="button" className="window-btn" {...hold(0, 0, -1)}>
          Zoom out (hold)
        </button>
        {note && (
          <span className="window-hint" role="status">
            {note}
          </span>
        )}
      </div>
    </div>
  );
}

type FormState = CameraProfile & { password: string };

function CameraForm({
  initial,
  token,
  onSaved,
  onCancel,
}: {
  initial: CameraProfile;
  token: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>({ ...initial, password: "" });
  const [note, setNote] = useState("");
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const setLens = (index: number, patch: Partial<CameraLens>) =>
    setForm((f) => ({
      ...f,
      lenses: f.lenses.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));

  const submit = async () => {
    if (!form.name.trim() || !form.host.trim()) {
      setNote("The camera needs a name and its network address (the IP shown in its app).");
      return;
    }
    const { password, ...profile } = form;
    const result = await saveCamera({
      data: { accessToken: token, camera: profile, password: password || undefined },
    });
    setNote(result.note);
    if (result.stored) onSaved();
  };

  return (
    <div className="window-cameras__form">
      <label>
        Name
        <input value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <label>
        Network address (IP on your Wi-Fi)
        <input
          value={form.host}
          placeholder="e.g. 10.0.0.50 — the app shows it under device information"
          onChange={(e) => set({ host: e.target.value })}
        />
      </label>
      <div className="window-cameras__row">
        <label>
          RTSP port
          <input
            type="number"
            value={form.rtspPort}
            onChange={(e) => set({ rtspPort: Number(e.target.value) || 554 })}
          />
        </label>
        <label>
          ONVIF port
          <input
            type="number"
            value={form.onvifPort}
            onChange={(e) => set({ onvifPort: Number(e.target.value) || 8080 })}
          />
        </label>
        <label>
          Username
          <input value={form.username} onChange={(e) => set({ username: e.target.value })} />
        </label>
      </div>
      <label>
        Device password (goes to the core machine's protected store only — never shown again)
        <input
          type="password"
          value={form.password}
          placeholder={form.hasPassword ? "Set — leave blank to keep it" : "The password set in the camera's app"}
          onChange={(e) => set({ password: e.target.value })}
          autoComplete="new-password"
        />
      </label>
      {form.lenses.map((lens, i) => (
        <div className="window-cameras__row" key={lens.id}>
          <label>
            Lens {i + 1} name
            <input value={lens.label} onChange={(e) => setLens(i, { label: e.target.value })} />
          </label>
          <label>
            Kind
            <select
              value={lens.kind}
              onChange={(e) => setLens(i, { kind: e.target.value as CameraLens["kind"] })}
            >
              <option value="fixed">Fixed</option>
              <option value="ptz">PTZ (moves)</option>
            </select>
          </label>
          <label>
            RTSP path
            <input value={lens.rtspPath} onChange={(e) => setLens(i, { rtspPath: e.target.value })} />
          </label>
        </div>
      ))}
      <label className="window-cameras__check">
        <input
          type="checkbox"
          checked={form.ownerConfirmed === true}
          onChange={(e) => set({ ownerConfirmed: e.target.checked ? true : undefined })}
        />
        This is my camera (ownership confirmed)
      </label>
      <label className="window-cameras__check">
        <input
          type="checkbox"
          checked={form.controlGranted === true}
          onChange={(e) => set({ controlGranted: e.target.checked ? true : undefined })}
        />
        Augie may CONTROL this camera (move the PTZ lens) — the Permission Law requires this grant
      </label>
      <div className="window-cameras__actions">
        <button type="button" className="window-btn" onClick={() => void submit()}>
          Save camera
        </button>
        <button type="button" className="window-btn" onClick={onCancel}>
          Cancel
        </button>
        {note && (
          <span className="window-hint" role="status">
            {note}
          </span>
        )}
      </div>
    </div>
  );
}

function CameraCard({
  camera,
  token,
  refresh,
}: {
  camera: CameraProfile;
  token: string;
  refresh: () => void;
}) {
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [probing, setProbing] = useState(false);
  const [editing, setEditing] = useState(false);
  const canControl = cameraCanControl(camera);

  const runProbe = async () => {
    setProbing(true);
    try {
      const result = await probeCamera({ data: { accessToken: token, cameraId: camera.id } });
      setProbe(result);
      refresh();
    } finally {
      setProbing(false);
    }
  };

  if (editing) {
    return (
      <CameraForm
        initial={camera}
        token={token}
        onSaved={() => {
          setEditing(false);
          refresh();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="window-cameras__card">
      <div className="window-cameras__head">
        <strong>{camera.name}</strong>
        <span>
          {camera.host} · RTSP {camera.rtspPort} · ONVIF {camera.onvifPort}
        </span>
      </div>
      {(camera.manufacturer || camera.model || camera.firmware || camera.serial) && (
        <p className="window-cameras__fingerprint">
          {[camera.manufacturer, camera.model, camera.firmware && `firmware ${camera.firmware}`, camera.serial && `serial ${camera.serial}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <p className="window-cameras__grant">
        {canControl
          ? "Your camera — control granted. Augie may view both lenses and move the PTZ."
          : camera.ownerConfirmed
            ? "Your camera — observation only. Control is not granted on this card."
            : "Ownership not confirmed on this card — observation only."}
        {camera.ptzVerified ? " PTZ driven and proven." : ""}
      </p>
      {camera.lenses.map((lens) => (
        <LensView key={lens.id} camera={camera} lens={lens} token={token} />
      ))}
      {camera.lenses.some((l) => l.kind === "ptz") &&
        (canControl ? (
          <PtzPad camera={camera} token={token} />
        ) : (
          <p className="window-cameras__grant">
            The PTZ pad stays locked until control is granted for this camera.
          </p>
        ))}
      <div className="window-cameras__actions">
        <button type="button" className="window-btn" onClick={() => void runProbe()} disabled={probing}>
          {probing ? "Probing…" : "Probe — prove the paths"}
        </button>
        <button type="button" className="window-btn" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          type="button"
          className="window-btn"
          onClick={() => {
            void removeCamera({ data: { accessToken: token, cameraId: camera.id } }).then(refresh);
          }}
        >
          Remove
        </button>
      </div>
      {probe && (
        <p className="window-cameras__probe" role="status">
          {probe.note} ONVIF: {probe.onvif}.
          {probe.lenses.map((l) => (
            <span key={l.lensId}>
              {" "}
              {camera.lenses.find((c) => c.id === l.lensId)?.label ?? l.lensId}: {l.state}.
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

export function CamerasPanel() {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [token, setToken] = useState<string | null>(null);
  const [adding, setAdding] = useState<CameraProfile | null>(null);

  const tokenFn = useCallback(async (): Promise<string | null> => {
    const client = await loadAuthClient();
    if (!client) return null;
    return (await client.auth.getSession()).data.session?.access_token ?? null;
  }, []);

  const refresh = useCallback(async () => {
    const accessToken = await tokenFn();
    if (!accessToken) {
      setState({ kind: "denied" });
      return;
    }
    setToken(accessToken);
    const view = await getCameras({ data: { accessToken } });
    if (!view.authorized) {
      setState({ kind: "denied" });
      return;
    }
    setState({ kind: "ready", view });
    for (const camera of view.cameras) mirrorIntoDeviceRegistry(camera);
  }, [tokenFn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="window-cameras">
      <p className="window-cameras__intro">
        Your cameras, on your network, through Augie. Both lenses live, the moving lens under your
        grant — and any RTSP/ONVIF camera you own can be added the same way.
      </p>
      {state.kind === "loading" && <p role="status">Reading the camera registry…</p>}
      {state.kind === "denied" && (
        <p role="status">The operator session is gone — sign in again to reach the cameras.</p>
      )}
      {state.kind === "ready" && !state.view.storageAvailable && (
        <p role="status">
          Cameras live on the core machine — this surface has no local camera store, so nothing can
          be registered or viewed from here.
        </p>
      )}
      {state.kind === "ready" && state.view.storageAvailable && (
        <>
          {state.view.cameras.length === 0 && !adding && (
            <div className="window-cameras__card">
              <strong>The desk camera is prepared — two steps open its door.</strong>
              <p>
                Augie swept your network from this machine and the SZSinocam did not answer on any
                camera port. On its platform (the O-KAM app family) that is expected until:
              </p>
              <ol className="window-cameras__steps">
                <li>
                  In the <strong>O-KAM app</strong>, open the camera's settings and{" "}
                  <strong>set the device password</strong> (the plaintext-password setting, 8–31
                  characters). That password is the switch that turns ONVIF and RTSP on — username{" "}
                  <strong>admin</strong>.
                </li>
                <li>
                  The camera and this computer must be on the <strong>same Wi-Fi</strong> (this
                  machine is on its home network now). The app's device information shows the
                  camera's IP address.
                </li>
              </ol>
              <p>
                Then register it below with that IP and the same password — the password goes only
                into this machine's protected store. Your grant from this morning (his camera, his
                control) is already on the prepared card.
              </p>
              <div className="window-cameras__actions">
                <button type="button" className="window-btn" onClick={() => setAdding(szsinocamDraft())}>
                  Register the desk camera
                </button>
                <button
                  type="button"
                  className="window-btn"
                  onClick={() =>
                    setAdding({
                      id: newCameraId(),
                      name: "",
                      host: "",
                      rtspPort: 554,
                      onvifPort: 8080,
                      username: "admin",
                      hasPassword: false,
                      lenses: [
                        { id: "lens-1", label: "Lens", kind: "fixed", rtspPath: "/ucast/11" },
                      ],
                      addedAt: Date.now(),
                    })
                  }
                >
                  Add another camera
                </button>
              </div>
            </div>
          )}
          {state.view.cameras.map((camera) => (
            <CameraCard key={camera.id} camera={camera} token={token ?? ""} refresh={() => void refresh()} />
          ))}
          {adding ? (
            <CameraForm
              initial={adding}
              token={token ?? ""}
              onSaved={() => {
                setAdding(null);
                void refresh();
              }}
              onCancel={() => setAdding(null)}
            />
          ) : (
            state.view.cameras.length > 0 && (
              <div className="window-cameras__actions">
                <button
                  type="button"
                  className="window-btn"
                  onClick={() =>
                    setAdding({
                      id: newCameraId(),
                      name: "",
                      host: "",
                      rtspPort: 554,
                      onvifPort: 8080,
                      username: "admin",
                      hasPassword: false,
                      lenses: [{ id: "lens-1", label: "Lens", kind: "fixed", rtspPath: "/ucast/11" }],
                      addedAt: Date.now(),
                    })
                  }
                >
                  Add a camera
                </button>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

export function CamerasWindow({ onClose }: { onClose: () => void }) {
  return (
    <FloatingWindow
      id="cameras"
      title="Cameras"
      onClose={onClose}
      initialWidth={560}
      initialHeight={640}
      accent="#38bdf8"
    >
      <CamerasPanel />
    </FloatingWindow>
  );
}
