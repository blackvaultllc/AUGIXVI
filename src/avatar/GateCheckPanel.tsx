/**
 * THE GATE CHECK — Montu's post, working (Captain's order 2026-11-26).
 *
 * Rendered on the sign-in surface under Montu's medallion. One tap:
 *   1. The browser asks for the camera and the microphone. No grant,
 *      no entry — stated plainly on the gate. A device with no
 *      camera gets the plain statement too, never a loop.
 *   2. ONE still frame is taken from the granted stream — his
 *      doorbell picture of whoever is at the gate.
 *   3. He speaks the words ("cast in the name of God, ye not
 *      guilty"); the clip is transcribed and checked against his
 *      enrolled voiceprint. Match → the gate names him "Zero."
 *      A plain no-match refuses the attempt and records it, photo
 *      and all. No verdict → his credentials carry the entry and
 *      the attempt record carries the note (never locked out).
 *   4. The stream is released the moment the check ends — the gate
 *      never leaves a camera or microphone running (performance law).
 *
 * Khadija's door runs the same panel in learner mode: the picture
 * is taken, she says her name, and the gate names her "One." Her
 * entry still rides on her own sign-in — the panel never bars her
 * door (her wall is unchanged).
 */
import { useEffect, useRef, useState } from "react";
import { Camera, Mic } from "lucide-react";
import {
  CAPTAIN_GATE_NAME,
  GATE_PHRASE,
  LEARNER_GATE_NAME,
  gatePhraseHeard,
  gateVoiceOutcome,
  learnerWordHeard,
  type GateVoiceOutcome,
} from "./loginGate";
import { postGateAttemptRecord } from "./loginGateClient";
import { pickRecorderMimeType } from "./localEar";
import { loadVoiceCalibrationPrefs, verifyVoice } from "./voiceCalibration";

type PanelState =
  | "idle"
  | "requesting"
  | "speaking"
  | "checking"
  | "match"
  | "fallback"
  | "no-match"
  | "denied"
  | "no-camera"
  | "unavailable";

const RECORD_MS = 4000;

function mediaSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

async function transcribeClip(audio: Blob): Promise<string> {
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": audio.type || "audio/webm" },
    body: audio,
  });
  const payload = (await response.json().catch(() => ({}))) as { text?: unknown };
  if (!response.ok || typeof payload.text !== "string") {
    throw new Error("The speech service did not answer.");
  }
  return payload.text;
}

export function GateCheckPanel({
  door,
  onSnapshot,
  onOperatorOutcome,
  onLearnerHeard,
}: {
  door: "operator" | "learner";
  /** The one snapshot frame, when the camera was granted. */
  onSnapshot?: (photo: Blob) => void;
  /** Operator door: the voice outcome that decides how entry proceeds. */
  onOperatorOutcome?: (outcome: GateVoiceOutcome) => void;
  /** Learner door: whether the gate heard her name and named her One. */
  onLearnerHeard?: (named: boolean) => void;
}) {
  const [state, setState] = useState<PanelState>(() => (mediaSupported() ? "idle" : "unavailable"));
  const [heardWords, setHeardWords] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const unavailableReportedRef = useRef(false);
  const busyRef = useRef(false);

  // A browser that cannot open media at all can never run the
  // check: for the operator that is a no-verdict — credentials
  // carry the entry and the gate says so (never locked out).
  useEffect(() => {
    if (state === "unavailable" && !unavailableReportedRef.current) {
      unavailableReportedRef.current = true;
      if (door === "operator") onOperatorOutcome?.("no-verdict");
    }
  }, [state, door, onOperatorOutcome]);

  // The stream is never left running: release on unmount, always.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
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

  async function runCheck() {
    if (busyRef.current || !mediaSupported()) return;
    busyRef.current = true;
    setHeardWords(false);
    setState("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch (error) {
      busyRef.current = false;
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        setState("no-camera");
        if (door === "operator") {
          void postGateAttemptRecord({
            door,
            result: "no-camera",
            namedAs: null,
            note: "The gate check found no camera on this device.",
            photo: null,
          });
        }
      } else {
        setState("denied");
        if (door === "operator") {
          void postGateAttemptRecord({
            door,
            result: "permission-denied",
            namedAs: null,
            note: "Camera/microphone permission was refused at the gate check.",
            photo: null,
          });
        }
      }
      return;
    }
    streamRef.current = stream;
    try {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      // One frame, at the attempt — the doorbell picture.
      const photo = await captureSnapshot();
      if (photo) onSnapshot?.(photo);

      setState("speaking");
      const mime = pickRecorderMimeType((m) => MediaRecorder.isTypeSupported(m));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.start();
      await new Promise((resolve) => setTimeout(resolve, RECORD_MS));
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
      const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });

      setState("checking");
      releaseStream();

      if (door === "learner") {
        let named = false;
        try {
          named = learnerWordHeard(await transcribeClip(audio));
        } catch {
          named = false;
        }
        setHeardWords(named);
        onLearnerHeard?.(named);
        setState(named ? "match" : "fallback");
        return;
      }

      // Operator: transcription (the words) + voiceprint (the voice).
      let transcript: string | null = null;
      try {
        transcript = await transcribeClip(audio);
      } catch {
        transcript = null;
      }
      let enrolled = false;
      let voiceMatch: boolean | null = null;
      let verifyAnswered = false;
      try {
        const verdict = await verifyVoice(audio, loadVoiceCalibrationPrefs().threshold);
        verifyAnswered = true;
        enrolled = verdict.enrolled;
        voiceMatch = verdict.enrolled ? verdict.match : null;
      } catch {
        verifyAnswered = false;
      }
      const outcome = gateVoiceOutcome({
        servicesAnswered: verifyAnswered && transcript !== null,
        enrolled,
        voiceMatch,
        phraseHeard: transcript !== null && gatePhraseHeard(transcript),
      });
      if (outcome === "match") {
        setState("match");
      } else if (outcome === "no-match") {
        setState("no-match");
        // A refused attempt is recorded at once, photo and all.
        void postGateAttemptRecord({
          door,
          result: "voice-no-match",
          namedAs: null,
          note: "The voice at the gate was not the Captain's. The attempt was refused.",
          photo,
        });
      } else {
        setState("fallback");
      }
      onOperatorOutcome?.(outcome);
    } catch {
      releaseStream();
      setState("fallback");
      if (door === "operator") onOperatorOutcome?.("no-verdict");
      if (door === "learner") onLearnerHeard?.(false);
    } finally {
      busyRef.current = false;
    }
  }

  const running = state === "requesting" || state === "speaking" || state === "checking";

  return (
    <section className="gate-check" aria-label="Montu's gate check">
      <p className="gate-check__title">
        <Camera aria-hidden="true" size={15} /> <Mic aria-hidden="true" size={15} /> Montu&apos;s
        gate check
      </p>
      {door === "operator" ? (
        <>
          {state === "idle" && (
            <p>
              Before you sign in, the gate opens your camera and microphone, takes one picture of
              whoever is signing in, and listens for your voice. No camera and microphone, no
              entry.
            </p>
          )}
          {state === "requesting" && <p>Opening the camera and microphone…</p>}
          {state === "speaking" && (
            <p>
              Say the words: <strong>&ldquo;{GATE_PHRASE}&rdquo;</strong>
            </p>
          )}
          {state === "checking" && <p>The gate is listening…</p>}
          {state === "match" && (
            <p className="gate-check__named">The gate names you: {CAPTAIN_GATE_NAME}.</p>
          )}
          {state === "fallback" && (
            <p>
              The gate could not judge your voice this time. Your email and password carry this
              entry, and the attempt is written in the gate log.
            </p>
          )}
          {state === "no-match" && (
            <p className="gate-check__warn" role="alert">
              That voice is not the Captain&apos;s. This attempt has been recorded with its
              picture. If this is you, run the gate check again and speak clearly.
            </p>
          )}
          {state === "denied" && (
            <p className="gate-check__warn" role="alert">
              The camera and microphone were not allowed, so the gate cannot let anyone in. Allow
              them, then run the gate check again. No picture was taken.
            </p>
          )}
          {state === "no-camera" && (
            <p className="gate-check__warn" role="alert">
              This device has no camera the gate can open. The gate needs a camera and a
              microphone to let anyone in — sign in from a device that has both.
            </p>
          )}
          {state === "unavailable" && (
            <p>
              This browser cannot open the camera and microphone here, so the gate check cannot
              run. Your email and password carry this entry, and the attempt is noted in the gate
              log.
            </p>
          )}
        </>
      ) : (
        <>
          {state === "idle" && (
            <p>
              The gate camera can take your picture for Daddy&apos;s gate log. Tap the button, let
              it see you, and say your name out loud — it will call you {LEARNER_GATE_NAME}.
            </p>
          )}
          {(state === "requesting" || state === "checking") && <p>The gate is listening…</p>}
          {state === "speaking" && (
            <p>
              Say your name: <strong>Khadija</strong>
            </p>
          )}
          {state === "match" && (
            <p className="gate-check__named">The gate names you: {LEARNER_GATE_NAME}.</p>
          )}
          {state === "fallback" && (
            <p>
              {heardWords
                ? `The gate names you: ${LEARNER_GATE_NAME}.`
                : "The gate didn't catch your name this time — your name and year still open your door."}
            </p>
          )}
          {(state === "denied" || state === "no-camera" || state === "unavailable") && (
            <p>That&apos;s okay — your name and your birth year still open your door.</p>
          )}
          {state === "no-match" && <p>Your name and your birth year still open your door.</p>}
        </>
      )}
      {(state === "idle" ||
        state === "denied" ||
        state === "no-camera" ||
        state === "no-match" ||
        state === "fallback" ||
        state === "match") && (
        <button type="button" className="gate-check__button" onClick={() => void runCheck()}>
          {state === "idle"
            ? "Run the gate check"
            : state === "match"
              ? "Run it again"
              : "Run the gate check again"}
        </button>
      )}
      {/* His own camera view while the check runs — he sees what the
          gate sees. The element always exists so the stream can be
          attached the moment it is granted; it shows only mid-check. */}
      <video
        ref={videoRef}
        className="gate-check__preview"
        muted
        playsInline
        aria-hidden="true"
        hidden={!running}
      />
    </section>
  );
}
