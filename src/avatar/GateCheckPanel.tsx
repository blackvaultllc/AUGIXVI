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
 *
 * THE THREE PATHS (owner order 2026-11-27, operator door only):
 * before any sign-in field exists, the visitor verifies one of
 * three ways — (1) take their picture (the check above: photo +
 * voice), (2) scan their badge QR code, (3) upload the ID/badge
 * picture. Paths 2 and 3 read the badge with the browser's own
 * BarcodeDetector where it exists; there is no decoder bundled
 * with the app and no badge registry on this surface, so a read
 * badge is written into the gate log with its serial and the
 * attempt proceeds as a no-verdict — credentials still decide
 * the entry, and the gate never calls a code it cannot check
 * against a registry a match. Where the detector does not
 * exist, the panel says so plainly and never fakes a scan.
 *
 * THE BYPASS, FIXED (owner report 2026-11-27 — "the gate check
 * does not actually run"): three defects made the check a
 * wave-through. (1) A browser that could not open media reported
 * a no-verdict BY ITSELF on mount — fields appeared with no gate
 * activity and no record; now the visitor presses a continue
 * button that writes the attempt first. (2) The snapshot was
 * taken before the camera delivered a frame, so the record
 * often carried no picture; the check now waits for a real
 * frame. (3) On a copy with no road to the home core, the
 * judging services (transcription + voiceprint, both served
 * from the core) never answer, so every run ended in the same
 * silent no-verdict; the outcome is still a no-verdict —
 * credentials carry the entry, he is never locked out — but the
 * gate now names the reason on its face: the picture was taken
 * and logged, and the voice could not be judged from here.
 */
import { useEffect, useRef, useState } from "react";
import { Camera, IdCard, Mic, ScanQrCode } from "lucide-react";
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
  | "core-unreachable"
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

function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/* ---------- Badge QR reading (operator paths 2 and 3) ---------- */
type DetectedBarcode = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: ImageBitmap | HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

function createBarcodeDetector(): BarcodeDetectorLike | null {
  if (typeof window === "undefined") return null;
  const ctor = (
    window as unknown as {
      BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike;
    }
  ).BarcodeDetector;
  if (!ctor) return null;
  try {
    return new ctor({ formats: ["qr_code"] });
  } catch {
    try {
      return new ctor();
    } catch {
      return null;
    }
  }
}

/** A badge QR carries the verify URL; the serial is its last path part. */
function badgeSerialFromValue(value: string): string {
  const serial = value.match(/\/verify\/([^/?#]+)/)?.[1];
  if (serial) {
    try {
      return decodeURIComponent(serial);
    } catch {
      return serial;
    }
  }
  return value.trim();
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
  const [continued, setContinued] = useState(false);
  const busyRef = useRef(false);

  // THE THREE PATHS (operator door only — see the header note).
  // Every path ends at the same gate state in the parent: the
  // sign-in fields exist only after one of them reports.
  const [path, setPath] = useState<"photo" | "badge" | "upload">("photo");
  const [badgeState, setBadgeState] = useState<
    "idle" | "scanning" | "read" | "missed" | "unsupported" | "denied"
  >("idle");
  const [badgeSerial, setBadgeSerial] = useState("");
  const [uploadState, setUploadState] = useState<"idle" | "done" | "error">("idle");
  const [uploadName, setUploadName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scanStopRef = useRef(false);

  // A browser that cannot open media at all can never run the
  // check. It used to report a no-verdict on its own the moment it
  // mounted — the sign-in fields simply appeared, no gate activity,
  // no record: an automatic bypass (owner report 2026-11-27, "the
  // gate check does not actually run"). Now nothing is reported
  // until the visitor presses the continue button below: the
  // attempt is written in the gate log first, and only then do the
  // credentials carry the entry (never locked out — the button is
  // right there, and the gate says what happened).
  function continueWithoutCheck() {
    if (continued) return;
    setContinued(true);
    void postGateAttemptRecord({
      door,
      result: "credentials-fallback",
      namedAs: null,
      note: "This browser cannot open the camera and microphone, so the gate check could not run. The visitor continued to credentials by the button on the gate.",
      photo: null,
    });
    onOperatorOutcome?.("no-verdict");
  }

  // The stream is never left running: release on unmount, always.
  useEffect(() => {
    const scanStop = scanStopRef;
    return () => {
      scanStop.current = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  /**
   * Wait until the camera is actually delivering a frame. The
   * snapshot used to be taken the instant play() resolved — often
   * before the first frame existed — so the attempt record carried
   * no picture at all and the "picture" step of the gate had not
   * really run (owner report 2026-11-27). Poll briefly; a camera
   * that never delivers a frame proceeds without one, noted by the
   * missing photo, and never bars the door by itself.
   */
  async function waitForFrame(): Promise<void> {
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      const video = videoRef.current;
      if (video && video.videoWidth > 0 && video.readyState >= 2) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
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
      // One frame, at the attempt — the doorbell picture. Wait for
      // the camera to deliver a real frame first, so the picture
      // step of the check genuinely happens.
      await waitForFrame();
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
      let transcribeAnswered = false;
      try {
        transcript = await transcribeClip(audio);
        transcribeAnswered = true;
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
      } else if (!transcribeAnswered && !verifyAnswered) {
        // Neither judging service answered at all. Those services
        // live on the home core (the speech service at the core's
        // own address); a copy with no road to the core — the
        // online copy today — can take the picture and write the
        // log but can never judge a voice. That is still a
        // no-verdict (credentials carry the entry, never locked
        // out), but the gate says THIS, plainly, instead of
        // dressing a structural bypass up as a check that ran.
        setState("core-unreachable");
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

  /* ---------- Path 2: scan the badge QR ---------- */

  function choosePath(next: "photo" | "badge" | "upload") {
    if (next !== "badge" && badgeState === "scanning") {
      // Leaving the badge path mid-scan: stop looking, free the camera.
      scanStopRef.current = true;
      releaseStream();
      busyRef.current = false;
      setBadgeState("idle");
    }
    setPath(next);
  }

  async function runBadgeScan() {
    if (busyRef.current) return;
    const detector = createBarcodeDetector();
    if (!detector || !cameraSupported()) {
      // No live QR reading in this browser — say so plainly and
      // never fake a scan. The upload path can still read a badge
      // picture where the detector exists there.
      setBadgeState("unsupported");
      return;
    }
    busyRef.current = true;
    scanStopRef.current = false;
    setBadgeState("scanning");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch {
      busyRef.current = false;
      setBadgeState("denied");
      return;
    }
    streamRef.current = stream;
    let found = "";
    let photo: Blob | null = null;
    try {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      const deadline = Date.now() + 25_000;
      while (!scanStopRef.current && Date.now() < deadline) {
        const video = videoRef.current;
        if (video && video.videoWidth > 0) {
          try {
            const codes = await detector.detect(video);
            const raw = codes.find((code) => code.rawValue)?.rawValue;
            if (raw) {
              found = raw;
              break;
            }
          } catch {
            /* a frame that cannot be read is not a verdict — keep looking */
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      if (found) photo = await captureSnapshot();
    } finally {
      releaseStream();
      busyRef.current = false;
    }
    if (!found) {
      if (!scanStopRef.current) setBadgeState("missed");
      return;
    }
    if (photo) onSnapshot?.(photo);
    const serial = badgeSerialFromValue(found);
    setBadgeSerial(serial);
    setBadgeState("read");
    void postGateAttemptRecord({
      door,
      result: "credentials-fallback",
      namedAs: null,
      note: `Badge QR read at the gate (${serial}). The badge opened the credential step; email, password, and authenticator still decide the entry.`,
      photo,
    });
    onOperatorOutcome?.("no-verdict");
  }

  /* ---------- Path 3: upload the ID / badge picture ---------- */

  async function handleUploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadState("error");
      return;
    }
    setUploadName(file.name);
    // Read a badge QR out of the picture where the browser can.
    let serial = "";
    const detector = createBarcodeDetector();
    if (detector && typeof createImageBitmap !== "undefined") {
      try {
        const bitmap = await createImageBitmap(file);
        try {
          const codes = await detector.detect(bitmap);
          serial = codes.find((code) => code.rawValue)?.rawValue ?? "";
        } finally {
          bitmap.close();
        }
      } catch {
        serial = "";
      }
    }
    onSnapshot?.(file);
    void postGateAttemptRecord({
      door,
      result: "credentials-fallback",
      namedAs: null,
      note: serial
        ? `ID picture uploaded at the gate; badge QR read from it (${badgeSerialFromValue(serial)}). Credentials still decide the entry.`
        : "ID picture uploaded at the gate and kept with the attempt record. Credentials still decide the entry.",
      photo: file,
    });
    setUploadState("done");
    onOperatorOutcome?.("no-verdict");
  }

  const running = state === "requesting" || state === "speaking" || state === "checking";

  return (
    <section className="gate-check" aria-label="Montu's gate check">
      <p className="gate-check__title">
        <Camera aria-hidden="true" size={15} /> <Mic aria-hidden="true" size={15} /> Montu&apos;s
        gate check
      </p>
      {door === "operator" && (
        <div className="gate-check__paths" role="group" aria-label="Ways to verify at the gate">
          <button
            type="button"
            className="gate-check__path"
            aria-pressed={path === "photo"}
            onClick={() => choosePath("photo")}
          >
            <Camera aria-hidden="true" size={14} /> Take my picture
          </button>
          <button
            type="button"
            className="gate-check__path"
            aria-pressed={path === "badge"}
            onClick={() => choosePath("badge")}
          >
            <ScanQrCode aria-hidden="true" size={14} /> Scan my badge
          </button>
          <button
            type="button"
            className="gate-check__path"
            aria-pressed={path === "upload"}
            onClick={() => choosePath("upload")}
          >
            <IdCard aria-hidden="true" size={14} /> Upload my ID
          </button>
        </div>
      )}
      {door === "operator" && path === "badge" ? (
        <>
          {badgeState === "idle" && (
            <p>
              Hold your badge&apos;s QR code up to the camera. The gate reads the code and writes
              the attempt in the gate log — your email, password, and authenticator still decide
              the entry.
            </p>
          )}
          {badgeState === "scanning" && (
            <p>Looking for your badge — hold the code steady in the light…</p>
          )}
          {badgeState === "read" && (
            <p className="gate-check__named">
              Badge read: {badgeSerial}. Your email and password carry this entry.
            </p>
          )}
          {badgeState === "missed" && (
            <p>
              The gate didn&apos;t read a badge that time. Hold it steady, close and in the
              light — or take another path.
            </p>
          )}
          {badgeState === "unsupported" && (
            <p>
              This browser cannot read QR codes live, so the gate will not pretend to scan.
              Upload a picture of the badge instead — the gate reads the code from the picture
              where it can.
            </p>
          )}
          {badgeState === "denied" && (
            <p className="gate-check__warn" role="alert">
              The camera was not allowed, so the gate cannot look for your badge. Allow it, then
              scan again. No picture was taken.
            </p>
          )}
          {(badgeState === "idle" || badgeState === "missed" || badgeState === "denied") && (
            <button type="button" className="gate-check__button" onClick={() => void runBadgeScan()}>
              {badgeState === "idle" ? "Start the badge scan" : "Scan again"}
            </button>
          )}
        </>
      ) : door === "operator" && path === "upload" ? (
        <>
          {uploadState === "idle" && (
            <p>
              Choose a picture of your ID or badge. The picture is kept with this attempt in the
              gate log — your email, password, and authenticator still decide the entry.
            </p>
          )}
          {uploadState === "done" && (
            <p className="gate-check__named">
              Picture received{uploadName ? ` — ${uploadName}` : ""}. Your email and password
              carry this entry.
            </p>
          )}
          {uploadState === "error" && (
            <p className="gate-check__warn" role="alert">
              That file was not a picture. Choose an image of your ID or badge.
            </p>
          )}
          <button
            type="button"
            className="gate-check__button"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadState === "done" ? "Choose a different picture" : "Choose the picture"}
          </button>
        </>
      ) : door === "operator" ? (
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
          {state === "core-unreachable" && (
            <p>
              Your picture was taken and this attempt is written in the gate log. The gate&apos;s
              ears — the speech service that hears your words and judges your voice — live on the
              home computer, and this copy could not reach them, so your voice could not be judged
              from here. Your email and password carry this entry.
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
          {state === "unavailable" && !continued && (
            <>
              <p>
                This browser cannot open the camera and microphone here, so the gate check cannot
                run. Your email and password can still carry this entry — press the button and
                the attempt is noted in the gate log first.
              </p>
              <button type="button" className="gate-check__button" onClick={continueWithoutCheck}>
                Continue with email and password
              </button>
            </>
          )}
          {state === "unavailable" && continued && (
            <p>
              Noted in the gate log — this browser could not run the gate check. Your email and
              password carry this entry.
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
      {(door === "learner" || path === "photo") &&
        (state === "idle" ||
          state === "denied" ||
          state === "no-camera" ||
          state === "no-match" ||
          state === "fallback" ||
          state === "core-unreachable" ||
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
          attached the moment it is granted; it shows only mid-check
          and mid badge scan. */}
      <video
        ref={videoRef}
        className="gate-check__preview"
        muted
        playsInline
        aria-hidden="true"
        hidden={!running && badgeState !== "scanning"}
      />
      {door === "operator" && (
        <input
          ref={fileInputRef}
          className="gate-check__file"
          type="file"
          accept="image/*"
          aria-label="Upload a picture of your ID or badge"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleUploadFile(file);
          }}
        />
      )}
    </section>
  );
}
