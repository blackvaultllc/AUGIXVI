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
  enrollSilentSensor,
  forgetSilentSensor,
  probeCameraPresence,
  probeCameraStreamFollow,
  setCameraEyeMode,
  setCameraHearing,
  type CameraPresenceView,
  type CameraPresenceViewState,
} from "../cameraPresence.server";
import { cameraCanControl, type CameraProfile } from "./cameraRegistry";
import { CAMERA_EYE_MODES, eyeLabel, type CameraEyeMode } from "./cameraEyes";
import {
  heardLevelText,
  soundLevelReferenceLine,
  SILENT_SENSOR_HONESTY_NOTE,
  SILENT_SENSOR_NAME,
  SOUND_LEVEL_REFERENCE,
  SOUND_LEVEL_REFERENCE_BASIS,
} from "./silentSensor";

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
    | "turn-to-speaker"
    | "gesture-yes"
    | "gesture-no";
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
            <button type="button" className="window-btn" disabled={busy || !canControl} onClick={() => void act("gesture-yes")}>
              Nod yes
            </button>
            <button type="button" className="window-btn" disabled={busy || !canControl} onClick={() => void act("gesture-no")}>
              Shake no
            </button>
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
        {camera.lenses.some((l) => l.kind === "ptz") && (
          <button
            type="button"
            className="window-btn"
            disabled={busy || !canControl}
            onClick={() =>
              void run(async () => {
                const r = await probeCameraStreamFollow({ data: { accessToken: token, cameraId: camera.id } });
                return { note: r.note };
              })
            }
          >
            Probe the stream (does it follow the moving lens?)
          </button>
        )}
      </div>
      <p className="window-cameras__grant">
        Stream follows the moving lens:{" "}
        {state?.streamFollowsPtz === null || state?.streamFollowsPtz === undefined
          ? "not measured yet"
          : state.streamFollowsPtz
            ? "YES — measured by the stream probe"
            : "NO — measured by the stream probe; the pulled frames stay on the fixed view"}
        . {state?.streamNote ?? ""}
      </p>
      {state?.follow.active && state?.streamFollowsPtz === false && (
        <p className="window-cameras__grant">
          Follow on this camera watches and reports from the fixed view but does not steer — its picture cannot
          see the lens move (stream probe, above).
        </p>
      )}

      {state?.agamossAwake ? (
        <p className="window-cameras__grant">
          <strong>Agamoss is awake at this camera</strong> — a conversation stands: the spotlight is on
          (the listening proof) and the head answers in the code below.
        </p>
      ) : (
        <p className="window-cameras__grant">{state?.agamossLight.note ?? ""}</p>
      )}

      <div className="window-cameras__actions">
        <span>
          Eyes: <strong>{state ? eyeLabel(state.eyes.mode) : "red"}</strong>
          {state?.eyes.by ? ` — set by ${state.eyes.by}` : " — standing order"}
        </span>
        {CAMERA_EYE_MODES.map((mode: CameraEyeMode) => (
          <button
            key={mode}
            type="button"
            className="window-btn"
            disabled={busy || state?.eyes.mode === mode}
            onClick={() =>
              void run(() =>
                setCameraEyeMode({
                  data: {
                    accessToken: token,
                    cameraId: camera.id,
                    mode,
                    by: "the Captain",
                    reason: "set by the Captain's hand from the Presence panel",
                  },
                }),
              )
            }
          >
            {eyeLabel(mode)}
          </button>
        ))}
      </div>
      <p className="window-cameras__grant">
        Red eyes stand by the Captain's order (2026-11-27) — a camera never sits dark. A construct may change
        the eyes only to see something better, and every change is written in the eye log below with its reason.
      </p>

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

/**
 * MONTU SILENT SENSOR — the back motion sensors speak through
 * the cameras' ears. The card shows the one honest state of
 * the feature: a profile enrolled by his word (from which
 * camera, when, at what heard level), or the candidate his
 * test left standing, or neither — with the steps to run the
 * test. Below it, the seeded reference table of sound levels,
 * labeled as the knowledge it is.
 */
export function SilentSensorCard({
  view,
  token,
  refreshPresence,
}: {
  view: CameraPresenceView;
  token: string;
  refreshPresence: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { profile, candidate, lastTripAt } = view.silentSensor;

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

  return (
    <div className="window-cameras__card">
      <div className="window-cameras__head">
        <strong>{SILENT_SENSOR_NAME}</strong>
        <span>
          the back motion sensors cannot talk — their siren is their voice, and a hearing camera is
          their ear
        </span>
      </div>
      <p className="window-cameras__grant">{SILENT_SENSOR_HONESTY_NOTE}</p>
      {profile ? (
        <>
          <p className="window-cameras__grant">
            The siren is enrolled — taught by {profile.cameraName} on {dayTime(profile.enrolledAt)},{" "}
            {heardLevelText(profile.peakDbfs)}. When a hearing-armed outside camera matches that sound
            twice, Sector Watch logs a back motion sensor trip and the notification reaches you.
            {lastTripAt
              ? ` Last confirmed trip: ${dayTime(lastTripAt)}.`
              : " No trip has been confirmed yet."}
          </p>
          <div className="window-cameras__actions">
            <button
              type="button"
              className="window-btn"
              disabled={busy}
              onClick={() => void run(() => forgetSilentSensor({ data: { accessToken: token } }))}
            >
              Forget the siren
            </button>
          </div>
        </>
      ) : candidate ? (
        <>
          <p className="window-cameras__grant">
            A loud sound is standing unnamed: {candidate.cameraName} heard it on {dayTime(candidate.at)},{" "}
            {heardLevelText(candidate.peakDbfs)}, held for{" "}
            {(candidate.durationMs / 1000).toFixed(1).replace(/\.0$/, "")}s. It is called nothing yet.
            If that was your motion-sensor siren test, give it the name — from then on, that sound
            means a back sensor tripped.
          </p>
          <div className="window-cameras__actions">
            <button
              type="button"
              className="window-btn"
              disabled={busy}
              onClick={() => void run(() => enrollSilentSensor({ data: { accessToken: token } }))}
            >
              That was the siren — learn it as {SILENT_SENSOR_NAME}
            </button>
          </div>
        </>
      ) : (
        <p className="window-cameras__grant">
          No siren is enrolled yet, and no test sound is standing. To run the test: arm listening on
          the outside camera above, then set one of the back motion sensors off within its earshot.
          The loud sound it hears is kept here — unnamed — until you say it was the siren. It only
          works where a camera can actually hear the siren; your test is the proof.
        </p>
      )}
      {note && (
        <p className="window-hint" role="status">
          {note}
        </p>
      )}
      <div className="window-cameras__head">
        <strong>Sound levels — the reference table</strong>
        <span>{SOUND_LEVEL_REFERENCE_BASIS}</span>
      </div>
      {SOUND_LEVEL_REFERENCE.map((row) => (
        <p key={row.id} className="window-cameras__probe">
          {soundLevelReferenceLine(row)}
        </p>
      ))}
    </div>
  );
}

/**
 * AGAMOSS — the wake, the head code, and the alarm chain, as
 * the record stands (Agamoss package, 2026-11-26). Everything
 * shown comes from the core's presence record: the wake list
 * is the core config itself, and the danger flags are the
 * chain's own logged stages — no stage is shown that the
 * record does not hold.
 */
export function AgamossCard({ view }: { view: CameraPresenceView }) {
  const { wakePhrases, escalations } = view.agamoss;
  return (
    <div className="window-cameras__card">
      <div className="window-cameras__head">
        <strong>Agamoss — wake him at a camera</strong>
        <span>
          He wakes ONLY on a full wake phrase in your matched voice — your name for him alone never wakes
          him, and no other voice can wake him, move a camera, or light a spotlight.
        </span>
      </div>
      <p className="window-cameras__probe">
        The wake phrases (one list, kept in the core config — the camera-presence record on the core
        machine; edit it there and the ear follows it):
      </p>
      {wakePhrases.map((p) => (
        <p key={p} className="window-cameras__probe">
          “{p}”
        </p>
      ))}
      <p className="window-cameras__probe">
        When he wakes: the spotlight comes ON for the whole conversation (the light is the proof he is
        listening — if it is off, he is not), he turns toward where you were last seen, and he nods yes.
      </p>
      <p className="window-cameras__probe">
        The other constructs carry wake addresses of their own (order 2026-11-27): “Montu awaken” /
        “Montu wake up” and “Anubis awaken” / “Anubis wake up” — the same law: the full phrase, in your
        matched voice only. Their wakes are heard and recorded under the named construct; they do not
        open an Agamoss session at the camera.
      </p>
      <p className="window-cameras__probe">
        The head code: YES = nod up and down twice. NO = shake left and right three times. A number =
        turn right and nod the first digit, turn left and nod the second (right 8, left 6 = 86). A zero
        is one slow nod. He only answers from real checks — what he heard, what the camera reads, the
        live weather feed. A question with no check behind it gets no gesture; it waits for his full
        voice in the system.
      </p>
      <p className="window-cameras__probe">
        The alarm law: the alarm chain runs ONLY at pure danger — a weapon the watch confirmed on two
        looks, or threat words toward Khadija from a voice that is not yours. Everything else
        concerning is recorded in the watch log and nothing more. Your own word never waits on the
        chain — it acts at once and overrides any flag.
      </p>
      {escalations.length > 0 && (
        <>
          <div className="window-cameras__head">
            <strong>Danger flags — the chain's record</strong>
            <span>each stage was written as it happened; an action is chain-approved only after the chain ran</span>
          </div>
          {escalations.slice(0, 5).map((e) => (
            <p key={e.id} className="window-cameras__probe">
              <strong>{e.cameraName}</strong> · {dayTime(e.at)} — {e.reason} Stages:{" "}
              {e.history.map((h) => h.stage).join(" → ")}.
              {e.actions.map((a) => (
                <span key={a.at}>
                  {" "}
                  Action: {a.text} [{a.chainApproved ? "chain-approved" : "NOT chain-approved"}]
                </span>
              ))}
            </p>
          ))}
        </>
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
      <AgamossCard view={view} />

      <SilentSensorCard view={view} token={token} refreshPresence={refreshPresence} />

      <div className="window-cameras__card">
        <div className="window-cameras__head">
          <strong>Heard through the cameras</strong>
          <span>
            transcribed on the core — which camera heard it, and whose voice the voiceprint read it as, are
            part of the record (a voice reading is similarity, never proof of identity)
          </span>
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
              {event.kind === "name" ? "heard his name" : event.kind === "command" ? "camera command" : "speech"}
              {event.speaker === "captain"
                ? " · voice: the Captain (voiceprint match)"
                : event.speaker === "another"
                  ? " · voice: another person (no voiceprint match)"
                  : ""}{" "}
              — “{event.text}”{event.acted ? ` → ${event.acted}` : ""}
            </p>
          ))
        )}
      </div>

      <div className="window-cameras__card">
        <div className="window-cameras__head">
          <strong>The eye log</strong>
          <span>
            every change of a camera's eyes (order 2026-11-27) — red stands by default; a change names who
            made it and why, or it does not happen
          </span>
        </div>
        {view.eyeChanges.length === 0 ? (
          <p className="window-cameras__grant">
            No eye changes yet — every camera's eyes stand red, by the standing order.
          </p>
        ) : (
          view.eyeChanges.map((entry) => (
            <p key={entry.id} className="window-cameras__probe">
              <strong>{entry.cameraName}</strong> · {dayTime(entry.at)} · {eyeLabel(entry.from)} →{" "}
              {eyeLabel(entry.to)} · by {entry.by} — {entry.reason}
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
