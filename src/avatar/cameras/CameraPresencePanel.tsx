/**
 * CAMERA PRESENCE PANEL — the Cameras window's presence controls
 * (Camera Presence pass, owner orders 2026-11-26).
 *
 * Per camera: hearing (the camera's audio, transcribed on the
 * core), patrol, follow (with the unit's own tracking where the
 * probe found a real door), the spotlight (a switch ONLY where
 * the probe found a real door — otherwise the probe's plain
 * words stand where a switch would be), and recording.
 *
 * Panel-wide: what the cameras have heard, the recordings list,
 * and the creator enrollment. Every state shown comes from the
 * core's presence record — a control that cannot be true to the
 * record is not rendered.
 */
import { useState } from "react";
import {
  cameraPresenceAction,
  checkCreatorFace,
  clearCreatorEnrollment,
  enrollCreatorFace,
  probeCameraPresence,
  setCameraHearing,
  type CameraPresenceView,
  type CameraPresenceViewState,
} from "../cameraPresence.server";
import { cameraCanControl, type CameraProfile } from "./cameraRegistry";

function time(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayTime(at: number): string {
  return new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CameraPresenceSection({
  camera,
  presence,
  token,
  refreshPresence,
}: {
  camera: CameraProfile;
  presence: CameraPresenceViewState | undefined;
  token: string;
  refreshPresence: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const canControl = cameraCanControl(camera);
  const state = presence;

  const run = async (fn: () => Promise<{ note: string }>) => {
    setBusy(true);
    try {
      const result = await fn();
      setNote(result.note);
    } catch {
      setNote("The core did not answer — nothing was changed.");
    } finally {
      setBusy(false);
      refreshPresence();
    }
  };

  type PresenceAction =
    | "patrol-start"
    | "patrol-stop"
    | "follow-start"
    | "follow-stop"
    | "stop-motion"
    | "record-start"
    | "record-stop"
    | "spotlight"
    | "tracking"
    | "turn-to-speaker";
  const act = (action: PresenceAction, on?: boolean) =>
    run(() =>
      cameraPresenceAction({
        data: { accessToken: token, cameraId: camera.id, action, ...(on !== undefined ? { on } : {}) },
      }),
    );

  return (
    <div className="window-cameras__presence">
      <strong>Presence — hearing, patrol, follow, recording</strong>

      <label className="window-cameras__check">
        <input
          type="checkbox"
          checked={state?.hearing === true}
          disabled={busy}
          onChange={(e) =>
            void run(() =>
              setCameraHearing({
                data: {
                  accessToken: token,
                  cameraId: camera.id,
                  hearing: e.target.checked,
                  commands: e.target.checked ? state?.commands === true : false,
                },
              }),
            )
          }
        />
        Listen through this camera (its sound is transcribed on the core machine — nothing leaves it)
      </label>
      {state?.hearing && (
        <label className="window-cameras__check">
          <input
            type="checkbox"
            checked={state?.commands === true}
            disabled={busy}
            onChange={(e) =>
              void run(() =>
                setCameraHearing({
                  data: { accessToken: token, cameraId: camera.id, hearing: true, commands: e.target.checked },
                }),
              )
            }
          />
          Obey what it hears: camera commands act, other speech goes to Anubis
        </label>
      )}
      {state?.hearing && (
        <p className="window-cameras__grant">
          {state.listening
            ? "Listening now — speech through this camera is being transcribed on the core."
            : "Hearing is armed but the audio pull is down — the camera's stream may be unreachable."}
        </p>
      )}

      {camera.lenses.some((l) => l.kind === "ptz") && (
        <>
          <div className="window-cameras__actions">
            {state?.patrol.active ? (
              <button type="button" className="window-btn" disabled={busy} onClick={() => void act("patrol-stop")}>
                Stop patrol
              </button>
            ) : (
              <button
                type="button"
                className="window-btn"
                disabled={busy || !canControl}
                onClick={() => void act("patrol-start")}
              >
                Start patrol (left–right sweep)
              </button>
            )}
            {state?.follow.active ? (
              <button type="button" className="window-btn" disabled={busy} onClick={() => void act("follow-stop")}>
                Stop following
              </button>
            ) : (
              <button
                type="button"
                className="window-btn"
                disabled={busy || !canControl}
                onClick={() => void act("follow-start")}
              >
                Follow movement
              </button>
            )}
            {(state?.patrol.active || state?.follow.active) && (
              <button type="button" className="window-btn" disabled={busy} onClick={() => void act("stop-motion")}>
                Stop all motion
              </button>
            )}
          </div>
          {state?.follow.active && (
            <p className="window-cameras__grant">
              Following is standing on:{" "}
              {state.follow.basis === "person"
                ? "the analyzer's draft reading — it said a person is in the frame"
                : "measured movement between frames (no person confirmed)"}
              .
            </p>
          )}
          {!canControl && (
            <p className="window-cameras__grant">Patrol and follow stay locked until control is granted for this camera.</p>
          )}
        </>
      )}

      <div className="window-cameras__actions">
        <button
          type="button"
          className="window-btn"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const r = await probeCameraPresence({ data: { accessToken: token, cameraId: camera.id } });
              return { note: `Spotlight: ${r.spotlightNote} Tracking: ${r.trackingNote}` };
            })
          }
        >
          Probe presence doors (spotlight · tracking)
        </button>
      </div>

      {state?.spotlight.door ? (
        <div className="window-cameras__actions">
          <span>Spotlight (door: {state.spotlight.door.replace(/^aux:/, "")})</span>
          <button type="button" className="window-btn" disabled={busy || !canControl} onClick={() => void act("spotlight", true)}>
            On
          </button>
          <button type="button" className="window-btn" disabled={busy || !canControl} onClick={() => void act("spotlight", false)}>
            Off
          </button>
          {state.spotlight.on !== null && <span className="window-hint">last set: {state.spotlight.on ? "on" : "off"}</span>}
        </div>
      ) : (
        <p className="window-cameras__grant">Spotlight: {state?.spotlight.note ?? "Not probed yet."}</p>
      )}

      {state?.tracking.door ? (
        <label className="window-cameras__check">
          <input
            type="checkbox"
            checked={state.tracking.on === true}
            disabled={busy || !canControl}
            onChange={(e) => void act("tracking", e.target.checked)}
          />
          The unit's own auto-tracking (through its ONVIF analytics door)
        </label>
      ) : (
        <p className="window-cameras__grant">Unit tracking: {state?.tracking.note ?? "Not probed yet."}</p>
      )}

      <div className="window-cameras__actions">
        {state?.recordingNow ? (
          <button type="button" className="window-btn" disabled={busy} onClick={() => void act("record-stop")}>
            Stop recording
          </button>
        ) : (
          <button
            type="button"
            className="window-btn"
            disabled={busy || camera.ownerConfirmed !== true}
            onClick={() => void act("record-start")}
          >
            Record this camera (on the core machine)
          </button>
        )}
        <button
          type="button"
          className="window-btn"
          disabled={busy}
          onClick={() =>
            void run(() => enrollCreatorFace({ data: { accessToken: token, cameraId: camera.id } }))
          }
        >
          Enroll my face with this camera
        </button>
        <button
          type="button"
          className="window-btn"
          disabled={busy}
          onClick={() =>
            void run(() => checkCreatorFace({ data: { accessToken: token, cameraId: camera.id } }))
          }
        >
          Check who it sees now
        </button>
      </div>
      {note && (
        <p className="window-hint" role="status">
          {note}
        </p>
      )}
    </div>
  );
}

export function CameraPresenceRecords({
  view,
  token,
  refreshPresence,
}: {
  view: CameraPresenceView;
  token: string;
  refreshPresence: () => void;
}) {
  const [note, setNote] = useState("");
  return (
    <>
      <div className="window-cameras__card">
        <div className="window-cameras__head">
          <strong>Heard through the cameras</strong>
          <span>transcribed on the core — which camera heard it is part of the record</span>
        </div>
        {view.hearing.length === 0 ? (
          <p className="window-cameras__grant">
            Nothing heard yet. Arm listening on a camera above and speak near it — what it hears lands here,
            with the camera's name on it.
          </p>
        ) : (
          view.hearing.map((event) => (
            <p key={event.id} className="window-cameras__probe">
              <strong>{event.cameraName}</strong> · {dayTime(event.at)} ·{" "}
              {event.kind === "name" ? "heard his name" : event.kind === "command" ? "camera command" : "speech"} — “
              {event.text}”{event.acted ? ` → ${event.acted}` : ""}
            </p>
          ))
        )}
      </div>

      <div className="window-cameras__card">
        <div className="window-cameras__head">
          <strong>Recordings</strong>
          <span>saved on the core machine only (~/.local/share/augie/camera-recordings/)</span>
        </div>
        {view.recordings.length === 0 ? (
          <p className="window-cameras__grant">No recordings yet. Start one from a camera's Presence controls above.</p>
        ) : (
          view.recordings.map((rec) => (
            <p key={rec.id} className="window-cameras__probe">
              <strong>{rec.cameraName}</strong> · {rec.file} · started {dayTime(rec.startedAt)} ·{" "}
              {rec.live
                ? "recording now"
                : rec.stoppedAt
                  ? `stopped ${time(rec.stoppedAt)}${rec.bytes !== null ? ` · ${(rec.bytes / 1_000_000).toFixed(1)} MB` : ""}`
                  : "not running"}
            </p>
          ))
        )}
      </div>

      <div className="window-cameras__card">
        <div className="window-cameras__head">
          <strong>Creator enrollment</strong>
          <span>his face, for the cameras — reference frames live only on the core machine</span>
        </div>
        {view.enrollment ? (
          <>
            <p className="window-cameras__grant">
              Enrolled from {view.enrollment.cameraName} on {dayTime(view.enrollment.at)} — {view.enrollment.frames.length}{" "}
              reference frame{view.enrollment.frames.length === 1 ? "" : "s"}. A “check” asks the analyzer whether the
              person in view matches; its answer is a draft reading, never proof of identity.
            </p>
            <div className="window-cameras__actions">
              <button
                type="button"
                className="window-btn"
                onClick={() => {
                  void clearCreatorEnrollment({ data: { accessToken: token } }).then((r) => {
                    setNote(r.note);
                    refreshPresence();
                  });
                }}
              >
                Clear enrollment
              </button>
              {note && (
                <span className="window-hint" role="status">
                  {note}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="window-cameras__grant">
            Not enrolled. Stand in front of a camera and use “Enroll my face with this camera” on its card — three
            frames are kept on the core machine, nowhere else.
          </p>
        )}
      </div>
    </>
  );
}
