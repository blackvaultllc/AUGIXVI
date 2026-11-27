/**
 * SECTOR WATCH PANEL — the Cameras window's Sector Watch card
 * (Sector Watch pass, owner order 2026-11-26: Anubis watches on
 * his own and enforces the room rules).
 *
 * What the Captain controls here: the watch on/off per camera,
 * each camera's ZONE (with an Edit control — the standing rule),
 * the cycle interval, the household enrollment (the faces the
 * bedroom rule can clear), the watch log, and the security
 * events — his acknowledgment on an event is what releases it
 * from the Alert Ring.
 *
 * Honesty rules, same as the rest of the window: every reading
 * shown is labeled the analyzer's draft; an event exists only
 * where a second look confirmed the first; and until a face is
 * enrolled the card says plainly that any person in the bedroom
 * raises a no-access event — recognition is never pretended.
 */
import { useCallback, useEffect, useState } from "react";
import {
  acknowledgeSectorEvent,
  acknowledgeSectorJudgment,
  enrollHousehold,
  getSectorStill,
  getSectorWatch,
  removeHousehold,
  setSectorAutonomy,
  setSectorCamera,
  setSectorInterval,
  type SectorWatchView,
} from "../sectorWatch.server";
import {
  zoneLabel,
  SECTOR_ZONES,
  type SectorZone,
} from "./sectorWatch";
import type { CameraProfile } from "./cameraRegistry";
import type { CameraPresenceView } from "../cameraPresence.server";

function dayTime(at: number): string {
  return new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * One kept still, named on the record: its caption, and the
 * picture itself on the Captain's tap (loaded from the core as
 * a data URL — it never sits in the page before he asks).
 */
function StillLine({
  file,
  caption,
  stills,
  onShow,
}: {
  file: string;
  caption: string;
  stills: Record<string, string>;
  onShow: (file: string) => void;
}) {
  const url = stills[file];
  return (
    <div className="window-cameras__probe">
      <span>
        {file} — {caption}
      </span>{" "}
      {url ? (
        <>
          <img
            src={url}
            alt={`Kept still ${file}`}
            style={{ display: "block", maxWidth: "100%", marginTop: 6, borderRadius: 6 }}
          />
          <a className="window-btn" href={url} download={file} style={{ display: "inline-block", marginTop: 6 }}>
            Download this picture
          </a>
        </>
      ) : (
        <button type="button" className="window-btn" onClick={() => onShow(file)}>
          Show picture
        </button>
      )}
    </div>
  );
}

export function SectorWatchPanel({
  cameras,
  token,
  presenceView,
}: {
  cameras: CameraProfile[];
  token: string;
  /** The presence record, for each camera's measured stream verdict. */
  presenceView: CameraPresenceView | null;
}) {
  const [view, setView] = useState<SectorWatchView | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [intervalDraft, setIntervalDraft] = useState("");
  const [zoneEdit, setZoneEdit] = useState<string | null>(null);
  const [zoneDraft, setZoneDraft] = useState<SectorZone>("common");
  const [enrollName, setEnrollName] = useState("");
  const [enrollCameraId, setEnrollCameraId] = useState("");
  /** Kept stills the Captain has opened — file name → data URL, loaded on his tap only. */
  const [stills, setStills] = useState<Record<string, string>>({});

  const showStill = useCallback(
    async (file: string) => {
      const r = await getSectorStill({ data: { accessToken: token, file } }).catch(() => null);
      const url = r?.dataUrl ?? null;
      if (url) {
        setStills((prev) => ({ ...prev, [file]: url }));
      } else if (r) {
        setNote(r.note);
      }
    },
    [token],
  );

  const refresh = useCallback(async () => {
    const next = await getSectorWatch({ data: { accessToken: token } }).catch(() => null);
    if (next?.authorized) setView(next);
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<{ note: string }>) => {
    setBusy(true);
    try {
      const result = await fn();
      setNote(result.note);
    } catch {
      setNote("The core did not answer — nothing was changed.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  if (!view) {
    return (
      <div className="window-cameras__card">
        <div className="window-cameras__head">
          <strong>Sector Watch</strong>
          <span>reading the sector record…</span>
        </div>
      </div>
    );
  }

  if (!view.storageAvailable) {
    return (
      <div className="window-cameras__card">
        <div className="window-cameras__head">
          <strong>Sector Watch</strong>
          <span>Anubis watches the cameras on his own</span>
        </div>
        <p className="window-cameras__grant">
          Sector Watch lives on the core machine — this surface has no local sector record, so the
          watch can only be run and read from the Parrot copy.
        </p>
      </div>
    );
  }

  const defaultEnrollCamera =
    cameras.find((c) => c.id === "bedroom")?.id ?? cameras[0]?.id ?? "";
  const enrollCamera = enrollCameraId || defaultEnrollCamera;
  const bedroomCamera = cameras.find((c) => view.cameras[c.id]?.zone === "bedroom");

  return (
    <>
      <div className="window-cameras__card">
        <div className="window-cameras__head">
          <strong>Sector Watch — Anubis watches on his own</strong>
          <span>
            {view.schedulerRunning
              ? `watching — a fresh look every ${view.intervalSec} seconds per camera`
              : "the watch scheduler is not running on this core"}
          </span>
        </div>
        <p className="window-cameras__grant">
          {view.schedulerRunning ? "The watch is running" : "The watch is NOT running"}
        </p>
        <p className="window-cameras__grant">
          On his own cycle, Anubis pulls a frame from each watched camera and asks the picture
          analyzer the sector question. Every reading is a draft: a first “yes” is checked by a
          second look, and only when both agree does anything become an event. The watch judges
          the view each camera's stream shows the core — whether that view follows the moving
          lens is measured per camera by the stream probe (on the camera's Presence controls,
          and shown on each row below). The ALL-STOP halts the watch like everything else, and
          your hand on a camera (the PTZ pad, a patrol, a follow) pauses its watch until you
          are done.
        </p>
        <div className="window-cameras__row">
          <label>
            Look every (seconds)
            <input
              type="number"
              min={20}
              max={900}
              value={intervalDraft || String(view.intervalSec)}
              onChange={(e) => setIntervalDraft(e.target.value)}
            />
          </label>
          <div className="window-cameras__actions">
            <button
              type="button"
              className="window-btn"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  setSectorInterval({
                    data: { accessToken: token, intervalSec: Number(intervalDraft) || view.intervalSec },
                  }),
                )
              }
            >
              Save interval
            </button>
          </div>
        </div>
        <p className="window-cameras__grant">
          <strong>Autonomy: {view.autonomy.enabled ? "ON" : "OFF"}</strong> —{" "}
          {view.autonomy.enabled
            ? "the cameras choose their own look targets inside their zones and carry their own patrol, until a recorded order turns it off (Captain's order, 2026-11-27)."
            : `off by recorded order${view.autonomy.since ? ` since ${dayTime(view.autonomy.since)}` : ""} — the cameras hold their set patrol and watch only.`}
        </p>
        <div className="window-cameras__actions">
          <button
            type="button"
            className="window-btn"
            disabled={busy}
            onClick={() =>
              void run(() =>
                setSectorAutonomy({ data: { accessToken: token, enabled: !view.autonomy.enabled } }),
              )
            }
          >
            {view.autonomy.enabled ? "Turn autonomy off (recorded order)" : "Turn autonomy on"}
          </button>
        </div>

        {cameras.map((camera) => {
          const config = view.cameras[camera.id];
          if (!config) return null;
          const lastReading = view.log.find((e) => e.cameraId === camera.id);
          const editing = zoneEdit === camera.id;
          return (
            <div key={camera.id} className="window-cameras__presence">
              <strong>{camera.name}</strong>
              <p className="window-cameras__grant">Sector: {zoneLabel(config.zone)}</p>
              {editing ? (
                <div className="window-cameras__row">
                  <label>
                    Sector
                    <select
                      value={zoneDraft}
                      onChange={(e) => setZoneDraft(e.target.value as SectorZone)}
                    >
                      {SECTOR_ZONES.map((zone) => (
                        <option key={zone} value={zone}>
                          {zoneLabel(zone)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="window-cameras__actions">
                    <button
                      type="button"
                      className="window-btn"
                      disabled={busy}
                      onClick={() => {
                        void run(() =>
                          setSectorCamera({
                            data: { accessToken: token, cameraId: camera.id, zone: zoneDraft },
                          }),
                        );
                        setZoneEdit(null);
                      }}
                    >
                      Save
                    </button>
                    <button type="button" className="window-btn" onClick={() => setZoneEdit(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="window-cameras__actions">
                  <button
                    type="button"
                    className="window-btn"
                    disabled={busy}
                    onClick={() => {
                      setZoneDraft(config.zone);
                      setZoneEdit(camera.id);
                    }}
                  >
                    Edit sector
                  </button>
                </div>
              )}
              <label className="window-cameras__check">
                <input
                  type="checkbox"
                  checked={config.watch}
                  disabled={busy}
                  onChange={(e) =>
                    void run(() =>
                      setSectorCamera({
                        data: { accessToken: token, cameraId: camera.id, watch: e.target.checked },
                      }),
                    )
                  }
                />
                Anubis watches this camera on his own
              </label>
              {camera.ownerConfirmed !== true && (
                <p className="window-cameras__grant">
                  The watch waits: ownership is not confirmed on this camera's card, and the
                  Permission Law holds unconfirmed cameras to no watching at all.
                </p>
              )}
              <p className="window-cameras__grant">
                Stream follows the moving lens:{" "}
                {(() => {
                  const follows = presenceView?.cameras[camera.id]?.streamFollowsPtz;
                  if (follows === null || follows === undefined) {
                    return "not measured yet — run the stream probe on this camera's Presence controls; until then the watch claims nothing about it";
                  }
                  return follows
                    ? "YES (stream probe) — the watch sees what the lens sees"
                    : "NO (stream probe) — the watch judges this camera's fixed view";
                })()}
              </p>
              {lastReading && (
                <p className="window-cameras__probe">
                  Last look {dayTime(lastReading.at)} — {lastReading.text}
                </p>
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

      <div className="window-cameras__card">
        <div className="window-cameras__head">
          <strong>The household — faces the bedroom rule can clear</strong>
          <span>enrolled by you; the frames live only on the core machine</span>
        </div>
        <p className="window-cameras__grant">
          The Captain's room is his and Khadija's only. When the watch confirms a person{" "}
          {bedroomCamera ? `in ${bedroomCamera.name}` : "in the bedroom"}, it checks the face
          against this list: a match is logged and raises nothing; no match — or no clear answer —
          is a NO ACCESS event.{" "}
          {view.household.length === 0
            ? "Nobody is enrolled yet — until at least one face is enrolled, ANY person the watch confirms in the bedroom raises the no-access event. Recognition is not pretended before it exists."
            : view.householdFromCreatorOnly
              ? "Right now the list is your creator enrollment standing in as “The Captain.” Enroll Khadija here so the rule can clear her too."
              : ""}
        </p>
        {view.household.map((member) => (
          <p key={member.name} className="window-cameras__probe">
            <strong>{member.name}</strong> — enrolled from {member.cameraName} on{" "}
            {dayTime(member.at)} · {member.frames.length} reference frame
            {member.frames.length === 1 ? "" : "s"}
            {!view.householdFromCreatorOnly && (
              <>
                {" "}
                <button
                  type="button"
                  className="window-btn"
                  disabled={busy}
                  onClick={() =>
                    void run(() => removeHousehold({ data: { accessToken: token, name: member.name } }))
                  }
                >
                  Remove
                </button>
              </>
            )}
          </p>
        ))}
        <div className="window-cameras__row">
          <label>
            Name (e.g. The Captain, Khadija)
            <input
              value={enrollName}
              onChange={(e) => setEnrollName(e.target.value)}
              placeholder="Whose face is this?"
            />
          </label>
          <label>
            Camera they stand in front of
            <select value={enrollCamera} onChange={(e) => setEnrollCameraId(e.target.value)}>
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="window-cameras__actions">
          <button
            type="button"
            className="window-btn"
            disabled={busy || !enrollName.trim() || !enrollCamera}
            onClick={() =>
              void run(() =>
                enrollHousehold({
                  data: { accessToken: token, cameraId: enrollCamera, name: enrollName.trim() },
                }),
              )
            }
          >
            Enroll this face (3 frames from that camera)
          </button>
        </div>
      </div>

      <div className="window-cameras__card">
        <div className="window-cameras__head">
          <strong>Security events</strong>
          <span>
            confirmed readings only — stills are kept on the core machine, nothing is sent anywhere
          </span>
        </div>
        {view.events.length === 0 ? (
          <p className="window-cameras__grant">
            No security events. An event lands here only when the analyzer's first look and its
            second look agree — a possible break-in at the front, or a person in the Captain's room
            the house rules cannot clear.
          </p>
        ) : (
          view.events.map((event) => (
            <div key={event.id} className="window-cameras__presence">
              <p className="window-cameras__probe">
                <strong>{event.cameraName}</strong> · {dayTime(event.at)} — {event.summary}{" "}
                {event.reading}
                {event.frames.length > 0
                  ? ` Stills kept on the core: ${event.frames.join(", ")}.`
                  : " No still could be kept."}{" "}
                {event.acknowledged ? (
                  "Acknowledged."
                ) : (
                  <button
                    type="button"
                    className="window-btn"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        acknowledgeSectorEvent({ data: { accessToken: token, eventId: event.id } }),
                      )
                    }
                  >
                    Acknowledge
                  </button>
                )}
              </p>
              {event.reasoning && (
                <p className="window-cameras__grant">
                  Why these pictures were kept (the reasoning saved with them, proof of
                  concept): {event.reasoning}
                </p>
              )}
              {event.personReading && (
                <p className="window-cameras__grant">
                  Draft description of the person (the analyzer's reading — the stills are the
                  evidence): {event.personReading}
                </p>
              )}
              {event.crossExam.length > 0 && (
                <p className="window-cameras__grant">
                  Cross-examination (each a labeled reading, never merged):{" "}
                  {event.crossExam.map((e) => `${e.tool} — ${e.reading}`).join("; ")}
                </p>
              )}
              {event.frames.map((file) => (
                <StillLine key={file} file={file} caption="kept still" stills={stills} onShow={(f) => void showStill(f)} />
              ))}
              {event.evidence.length > 0 && (
                <>
                  <p className="window-cameras__grant">
                    Evidence burst — full-resolution stills captured around this event, kept on
                    the core for your reports:
                  </p>
                  {event.evidence.map((still) => (
                    <div key={still.file}>
                      {still.reasoning && (
                        <p className="window-cameras__grant">Why kept: {still.reasoning}</p>
                      )}
                      <StillLine
                        file={still.file}
                        caption={still.plateNote}
                        stills={stills}
                        onShow={(f) => void showStill(f)}
                      />
                    </div>
                  ))}
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className="window-cameras__card">
        <div className="window-cameras__head">
          <strong>Anubis wants you to look</strong>
          <span>
            his judgment calls — below the event line, Second-Looked before they were raised, at
            most one per camera every 15 minutes
          </span>
        </div>
        {view.judgments.length === 0 ? (
          <p className="window-cameras__grant">
            Nothing here. When a reading catches Anubis's eye without reaching the event line —
            a person at a vehicle the second look could not confirm, say — he keeps a picture and
            raises it here for your eyes instead of raising an alarm.
          </p>
        ) : (
          view.judgments.map((judgment) => (
            <div key={judgment.id} className="window-cameras__presence">
              <p className="window-cameras__probe">
                <strong>{judgment.cameraName}</strong> · {dayTime(judgment.at)} — {judgment.text}{" "}
                {judgment.acknowledged ? (
                  "Seen."
                ) : (
                  <button
                    type="button"
                    className="window-btn"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        acknowledgeSectorJudgment({
                          data: { accessToken: token, judgmentId: judgment.id },
                        }),
                      )
                    }
                  >
                    Seen it
                  </button>
                )}
              </p>
              {judgment.reasoning && (
                <p className="window-cameras__grant">
                  Why this picture was kept (the reasoning saved with it): {judgment.reasoning}
                </p>
              )}
              {judgment.crossExam.length > 0 && (
                <p className="window-cameras__grant">
                  Cross-examination (indicators, labeled — they informed this judgment; they are
                  not findings):{" "}
                  {judgment.crossExam.map((e) => `${e.tool} — ${e.reading}`).join("; ")}
                </p>
              )}
              {judgment.still ? (
                <StillLine
                  file={judgment.still}
                  caption="the picture Anubis kept"
                  stills={stills}
                  onShow={(f) => void showStill(f)}
                />
              ) : (
                <p className="window-cameras__grant">No picture could be kept for this one.</p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="window-cameras__card">
        <div className="window-cameras__head">
          <strong>Watch log</strong>
          <span>what the watch read, cycle by cycle — drafts labeled as drafts</span>
        </div>
        {view.log.length === 0 ? (
          <p className="window-cameras__grant">
            Nothing logged yet. The first cycle lands here within one interval of the watch
            running.
          </p>
        ) : (
          view.log.slice(0, 25).map((entry) => (
            <p key={entry.id} className="window-cameras__probe">
              <strong>{entry.cameraName}</strong> · {dayTime(entry.at)} · {entry.kind} — {entry.text}
            </p>
          ))
        )}
      </div>
    </>
  );
}
