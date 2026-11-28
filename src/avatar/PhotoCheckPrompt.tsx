/**
 * THE PHOTO CHECK PROMPT — Anubis's occasional in-session ask
 * (owner law 2026-11-28 ~07:28 CST; the law and its bounds live
 * in photoCheck.ts).
 *
 * The card stands on the operator stage when a check is due —
 * by the standing cadence, or because a sensitive action (the
 * Personal Vault) is about to open while a check is due. It
 * asks FIRST, in plain words: what is being asked, why, and
 * that it is one picture, this once.
 *
 * PERMISSION IS ABSOLUTE, enforced here in fact:
 *   · The camera is opened ONLY inside the yes path — rendering
 *     this card, and pressing "Not now", never touch it.
 *   · A decline takes no snapshot, posts a declined record, and
 *     the session — and the sensitive action, if that is what
 *     brought the ask — carries on exactly as before. No
 *     penalty, no lockout, no suspicion.
 *   · On a yes, ONE frame is taken (the gate check's own
 *     discipline: wait for a real frame first), the stream is
 *     released the moment the picture exists, and the snapshot
 *     goes to the record. The card then says plainly what the
 *     record holds: there is no face on file to match against
 *     yet, so no match was run.
 *   · Whatever the answer, the cadence clock on this device
 *     restarts — a "no" is never chased inside the window.
 *
 * The cadence itself can be changed on this card — his three
 * values, one place (photoCheck.ts holds the setting).
 */
import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import {
  PHOTO_CHECK_ASK_TITLE,
  PHOTO_CHECK_CADENCE_OPTIONS,
  PHOTO_CHECK_NO_MATCH_NOTE,
  loadPhotoCheckCadenceDays,
  photoCheckAskBody,
  photoCheckCadenceWords,
  savePhotoCheckCadenceDays,
  savePhotoCheckLastAskAt,
  type PhotoCheckCadenceDays,
  type PhotoCheckOutcome,
  type PhotoCheckTrigger,
} from "./photoCheck";
import { postPhotoCheckRecord } from "./photoCheckClient";

type PromptState = "ask" | "capturing" | "completed" | "declined" | "camera-unavailable";

function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function PhotoCheckPrompt({
  trigger,
  actionName,
  onResolved,
}: {
  trigger: PhotoCheckTrigger;
  /** The sensitive action that brought the ask, in plain words (e.g. "your Personal Vault"). */
  actionName?: string;
  /** The ask is answered and done — the session (and any waiting action) carries on. */
  onResolved: () => void;
}) {
  const [state, setState] = useState<PromptState>("ask");
  const [cadence, setCadence] = useState<PhotoCheckCadenceDays>(() => loadPhotoCheckCadenceDays());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const resolvedRef = useRef(false);

  // The stream is never left running: release on unmount, always.
  useEffect(() => {
    const stream = streamRef;
    return () => {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, []);

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  /** The gate's own discipline: wait until the camera delivers a real frame. */
  async function waitForFrame(): Promise<boolean> {
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      const video = videoRef.current;
      if (video && video.videoWidth > 0 && video.readyState >= 2) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  }

  async function captureSnapshot(): Promise<Blob | null> {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  }

  function noteFor(outcome: PhotoCheckOutcome): string {
    const brought =
      trigger === "sensitive-action"
        ? `Asked before ${actionName ?? "a sensitive action"}.`
        : "Asked by the standing cadence.";
    switch (outcome) {
      case "completed":
        return `${brought} One picture taken for the record. No face on file to match it against yet — no match was run.`;
      case "declined":
        return `${brought} The person said no. No picture was taken, and nothing was held against them.`;
      case "camera-unavailable":
        return `${brought} The person said yes, but the camera could not open or gave no picture. No picture was taken.`;
    }
  }

  /** Every answer lands the same way: record it, restart the clock, carry on. */
  function finish(outcome: PhotoCheckOutcome, photo: Blob | null) {
    savePhotoCheckLastAskAt(Date.now());
    void postPhotoCheckRecord({ trigger, outcome, note: noteFor(outcome), photo });
    setState(outcome === "completed" ? "completed" : outcome === "declined" ? "declined" : "camera-unavailable");
  }

  function done() {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onResolved();
  }

  function decline() {
    if (busyRef.current || state !== "ask") return;
    // No camera is opened on this path — that is the law, in code.
    finish("declined", null);
  }

  async function grant() {
    if (busyRef.current || state !== "ask") return;
    if (!cameraSupported()) {
      finish("camera-unavailable", null);
      return;
    }
    busyRef.current = true;
    setState("capturing");
    let stream: MediaStream;
    try {
      // THE ONLY camera opening in this component: after the yes.
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch {
      busyRef.current = false;
      finish("camera-unavailable", null);
      return;
    }
    streamRef.current = stream;
    try {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      const framed = await waitForFrame();
      const photo = framed ? await captureSnapshot() : null;
      releaseStream();
      busyRef.current = false;
      if (photo) finish("completed", photo);
      else finish("camera-unavailable", null);
    } catch {
      releaseStream();
      busyRef.current = false;
      finish("camera-unavailable", null);
    }
  }

  function chooseCadence(days: PhotoCheckCadenceDays) {
    setCadence(days);
    savePhotoCheckCadenceDays(days);
  }

  const settled = state === "completed" || state === "declined" || state === "camera-unavailable";

  return (
    <section className="photo-check" aria-label="Anubis's photo check">
      <p className="photo-check__title">
        <Camera aria-hidden="true" size={15} /> {PHOTO_CHECK_ASK_TITLE}
      </p>
      {state === "ask" && (
        <>
          {trigger === "sensitive-action" && (
            <p>
              You are opening {actionName ?? "something private"}. First, Anubis asks his
              standing question — the vault opens either way, whatever you answer.
            </p>
          )}
          <p>{photoCheckAskBody(cadence)}</p>
          <div className="photo-check__cadence" role="group" aria-label="How often Anubis may ask">
            <span>How often Anubis may ask:</span>
            {PHOTO_CHECK_CADENCE_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                className="photo-check__cadence-option"
                aria-pressed={cadence === days}
                onClick={() => chooseCadence(days)}
              >
                {photoCheckCadenceWords(days)}
              </button>
            ))}
          </div>
          <div className="photo-check__buttons">
            <button type="button" className="photo-check__button" onClick={() => void grant()}>
              Yes — take my picture
            </button>
            <button type="button" className="photo-check__button" onClick={decline}>
              Not now
            </button>
          </div>
        </>
      )}
      {state === "capturing" && <p>Opening the camera — one picture, this once…</p>}
      {state === "completed" && (
        <>
          <p>One picture taken. The camera is closed.</p>
          <p>{PHOTO_CHECK_NO_MATCH_NOTE}</p>
        </>
      )}
      {state === "declined" && (
        <p>No picture was taken. That&apos;s fine — nothing changes, and Anubis will not ask again until the next standing time.</p>
      )}
      {state === "camera-unavailable" && (
        <p>
          The camera could not open, so no picture was taken. Nothing changes — you carry on as
          you were.
        </p>
      )}
      {settled && (
        <div className="photo-check__buttons">
          <button type="button" className="photo-check__button" onClick={done}>
            Done
          </button>
        </div>
      )}
      {/* His own camera view while the picture is taken — he sees
          what Anubis sees. The element always exists so the stream
          can be attached the moment it is granted; it shows only
          while the camera is open. */}
      <video
        ref={videoRef}
        className="photo-check__preview"
        muted
        playsInline
        aria-hidden="true"
        hidden={state !== "capturing"}
      />
    </section>
  );
}
