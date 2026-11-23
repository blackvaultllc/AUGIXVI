/**
 * PULSE WINDOW — Augie's pulse sense in a small floating box (operator
 * order 2026-11-21: "Augie should read heartbeats and frequencies in
 * the area — detect a human by their pulsation"). Three live reads:
 *
 *   PRESENCE + MOTION — the camera watches the room; a face tracker
 *   (MediaPipe FaceLandmarker, the same tasks-vision stack sensors.ts
 *   uses for hands) says whether a person is in frame, and frame
 *   difference says how much is moving.
 *
 *   HEART-RATE ESTIMATE (rPPG) — subtle color changes in THREE face
 *   regions (forehead + both cheeks), POS method with heart-band
 *   filtering, motion-artifact rejection, and a stabilization window
 *   (see pulse.ts). Always labeled an estimate, always with a live
 *   signal-quality read, and UNAVAILABLE / SEARCHING whenever there
 *   is no face, the light is too low, or the signal is too weak. It
 *   never invents a number.
 *
 *   FREQUENCY — the microphone's live spectrum with the dominant
 *   frequency labeled in Hz: a readout of the sound in the room.
 *
 * PRIVACY BY DESIGN (the operator's doctrine): everything is computed
 * in this browser on this machine. Nothing is recorded or stored,
 * nothing leaves the device, and no face is identified or recognized —
 * presence and pulse only.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { DEFAULT_MEDIAPIPE_WASM_ROOT } from "./sensors";
import {
  GOOD_QUALITY,
  WEAK_QUALITY,
  dominantFrequency,
  estimatePulseFromRois,
  frameMotion,
  motionLabel,
  pulseSummary,
  stabilizeReading,
  type MotionLabel,
  type MotionSample,
  type PulseReadout,
  type RoiSample,
  type TimedReading,
} from "./pulse";
import { expressionCues, perceptionSentence, voiceCues } from "./perception";

/**
 * FaceLandmarker model — BUNDLED with the app under public/mediapipe/
 * (Part 19): Pulse no longer fetches it from Google's bucket at
 * runtime, so the tracker loads with the network unplugged. Presence
 * runs on the landmarker: landmarks present = a face is in frame, and
 * their extent gives the box the pulse ROI is cut from.
 */
export const FACE_LANDMARKER_MODEL_URL = "/mediapipe/face_landmarker.task";

/** Below this mean ROI brightness (0..255) the room is too dark to read. */
const TOO_DARK = 28;
/** Rolling sample window fed to the estimator. */
const SAMPLE_WINDOW_MS = 14_000;
/** A detection counts as presence if seen within this long. */
const PRESENCE_HOLD_MS = 1_500;

type FaceBox = { x: number; y: number; w: number; h: number };

type Detector = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => { faceLandmarks?: { x: number; y: number }[][] };
  close: () => void;
};

async function loadFaceDetector(): Promise<Detector> {
  const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(DEFAULT_MEDIAPIPE_WASM_ROOT);
  const make = (delegate: "GPU" | "CPU") =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL, delegate },
      runningMode: "VIDEO",
      numFaces: 1,
    }) as unknown as Promise<Detector>;
  try {
    return await make("GPU");
  } catch {
    return await make("CPU");
  }
}

/** Face box in pixels from a landmark set's extent in the frame. */
function landmarksBox(
  landmarks: { x: number; y: number }[],
  width: number,
  height: number,
): FaceBox | null {
  if (!landmarks.length) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = (maxX - minX) * width;
  const h = (maxY - minY) * height;
  if (w < 12 || h < 12) return null;
  return { x: minX * width, y: minY * height, w, h };
}

/** Forehead band of the face box — the primary pulse region. */
function foreheadRoi(face: FaceBox): FaceBox {
  return {
    x: face.x + face.w * 0.21,
    y: face.y + face.h * 0.03,
    w: face.w * 0.58,
    h: face.h * 0.27,
  };
}

/**
 * MULTI-ROI (tightening round, 2026-11-23): the pulse is read from
 * THREE skin patches — forehead and both cheeks — and the estimator
 * combines them quality-weighted (see pulse.ts). One patch in shadow
 * or under a glasses frame no longer decides the reading alone.
 * Order matters: index 0 is the forehead (the brightness reference).
 */
function pulseRois(face: FaceBox): FaceBox[] {
  const cheek = (fx: number): FaceBox => ({
    x: face.x + face.w * fx,
    y: face.y + face.h * 0.52,
    w: face.w * 0.24,
    h: face.h * 0.2,
  });
  return [foreheadRoi(face), cheek(0.14), cheek(0.62)];
}

/**
 * The camera implementation of Pulse (presence, motion, rPPG estimate,
 * room frequencies). Kept whole under the source switch — Part 20's
 * extension adds the WATCH source beside it, and switching away
 * unmounts this panel, which stops the camera and mic.
 */
function CameraPulsePanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const specRef = useRef<HTMLCanvasElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const samplesRef = useRef<RoiSample[][]>([[], [], []]);
  /** Frame-motion readings aligned with the samples (rejection). */
  const motionSamplesRef = useRef<MotionSample[]>([]);
  /** Recent per-tick estimates — the stabilization window's input. */
  const readingHistoryRef = useRef<TimedReading[]>([]);
  const faceRef = useRef<{
    box: FaceBox;
    at: number;
    /** Raw landmarks of the latest detection — Part 25's cue input.
     * Used live for geometry ratios only; never stored, never an
     * identity template. */
    landmarks: readonly { x: number; y: number }[] | null;
  } | null>(null);
  const prevGrayRef = useRef<Uint8ClampedArray | null>(null);
  const motionEmaRef = useRef(0);
  const lastDetectRef = useRef(0);
  const lastEstimateRef = useRef(0);
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [micError, setMicError] = useState("");
  const [detectorError, setDetectorError] = useState("");
  const [presence, setPresence] = useState<boolean | null>(null);
  const [motion, setMotion] = useState<MotionLabel | null>(null);
  const [readout, setReadout] = useState<PulseReadout>({
    state: "unavailable",
    reason: "not started",
  });
  const [domFreq, setDomFreq] = useState<{ hz: number; strength: number } | null>(null);
  /** The stream's own aspect ("640 / 480") once it is live — Part 21:
   * the stage takes the frame's shape so the FULL frame is the
   * default view, never an aggressive crop. */
  const [frameAspect, setFrameAspect] = useState<string | undefined>(undefined);
  const [freqState, setFreqState] = useState<"off" | "live" | "quiet">("off");
  /** Part 25: the live perception sentence ("Cues suggest: …") or null. */
  const [perception, setPerception] = useState<string | null>(null);

  const drawSparkline = useCallback((waveform: number[]) => {
    const canvas = sparkRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    if (waveform.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 1.6;
    waveform.forEach((v, i) => {
      const x = (i / (waveform.length - 1)) * width;
      const y = height / 2 - v * (height / 2 - 3);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, []);

  const drawSpectrum = useCallback(() => {
    const canvas = specRef.current;
    const analyser = analyserRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !analyser) return;
    if (!freqDataRef.current || freqDataRef.current.length !== analyser.frequencyBinCount) {
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    }
    const data = freqDataRef.current;
    analyser.getByteFrequencyData(data);
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const bars = 48;
    // Voice and room sound live below ~8 kHz; pool that range into bars.
    const usable = Math.min(data.length, Math.floor((8000 / (analyser.context.sampleRate / 2)) * data.length));
    const per = Math.max(1, Math.floor(usable / bars));
    ctx.fillStyle = "#38bdf8";
    for (let i = 0; i < bars; i++) {
      let max = 0;
      for (let k = i * per; k < (i + 1) * per && k < usable; k++) {
        if (data[k]! > max) max = data[k]!;
      }
      const h = (max / 255) * (height - 4);
      ctx.fillRect((i / bars) * width + 1, height - h, width / bars - 2, h);
    }
    return data;
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioStreamRef.current = null;
    detectorRef.current?.close();
    detectorRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    analyserRef.current = null;
    samplesRef.current = [[], [], []];
    motionSamplesRef.current = [];
    readingHistoryRef.current = [];
    faceRef.current = null;
    prevGrayRef.current = null;
    setRunning(false);
    setPresence(null);
    setMotion(null);
    setReadout({ state: "unavailable", reason: "not started" });
    setDomFreq(null);
    setFreqState("off");
    setPerception(null);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    rafRef.current = requestAnimationFrame(loop);
    const video = videoRef.current;
    const now = performance.now();

    // --- microphone spectrum (dominant frequency on the tick below) --
    if (analyserRef.current) drawSpectrum();

    if (!video || video.readyState < 2 || video.videoWidth === 0) return;

    // --- face detection (throttled) ---------------------------------
    const detector = detectorRef.current;
    if (detector && now - lastDetectRef.current > 150) {
      lastDetectRef.current = now;
      try {
        const res = detector.detectForVideo(video, now);
        const landmarks = res.faceLandmarks?.[0] ?? null;
        const box = landmarks
          ? landmarksBox(landmarks, video.videoWidth, video.videoHeight)
          : null;
        if (box) {
          faceRef.current = { box, at: now, landmarks };
        }
      } catch {
        // A failed frame is not a failed sense; the next tick retries.
      }
    }

    // --- sample the frame -------------------------------------------
    if (!sampleCanvasRef.current) {
      const c = document.createElement("canvas");
      c.width = 192;
      c.height = 144;
      sampleCanvasRef.current = c;
    }
    const sc = sampleCanvasRef.current;
    const sctx = sc.getContext("2d", { willReadFrequently: true });
    if (!sctx) return;
    sctx.drawImage(video, 0, 0, sc.width, sc.height);
    const frame = sctx.getImageData(0, 0, sc.width, sc.height);
    const px = frame.data;

    // motion from grayscale frame difference
    const gray = new Uint8ClampedArray(sc.width * sc.height);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      gray[j] = (px[i]! + px[i + 1]! + px[i + 2]!) / 3;
    }
    if (prevGrayRef.current) {
      const m = frameMotion(prevGrayRef.current, gray);
      motionEmaRef.current = motionEmaRef.current * 0.8 + m * 0.2;
    }
    prevGrayRef.current = gray;

    // presence: a face seen recently
    const face = faceRef.current;
    const present = face !== null && now - face.at < PRESENCE_HOLD_MS;

    // ROI color samples when a face is in view — all three patches.
    let brightness: number | null = null;
    if (present && face) {
      const cutoff = now - SAMPLE_WINDOW_MS;
      pulseRois(face.box).forEach((roi, roiIndex) => {
        const sx = Math.max(0, Math.floor((roi.x / video.videoWidth) * sc.width));
        const sy = Math.max(0, Math.floor((roi.y / video.videoHeight) * sc.height));
        const sw = Math.max(2, Math.floor((roi.w / video.videoWidth) * sc.width));
        const sh = Math.max(2, Math.floor((roi.h / video.videoHeight) * sc.height));
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let y = sy; y < Math.min(sc.height, sy + sh); y++) {
          for (let x = sx; x < Math.min(sc.width, sx + sw); x++) {
            const idx = (y * sc.width + x) * 4;
            r += px[idx]!;
            g += px[idx + 1]!;
            b += px[idx + 2]!;
            count++;
          }
        }
        if (count > 0) {
          r /= count;
          g /= count;
          b /= count;
          if (roiIndex === 0) brightness = (r + g + b) / 3;
          const trace = samplesRef.current[roiIndex]!;
          trace.push({ t: now, r, g, b });
          while (trace.length && trace[0]!.t < cutoff) trace.shift();
        }
      });
      motionSamplesRef.current.push({ t: now, m: motionEmaRef.current });
      while (
        motionSamplesRef.current.length &&
        motionSamplesRef.current[0]!.t < cutoff
      ) {
        motionSamplesRef.current.shift();
      }
    } else {
      // No face: the trace is meaningless — do not let stale samples
      // from a previous face produce a reading for an empty chair.
      samplesRef.current = [[], [], []];
      motionSamplesRef.current = [];
      readingHistoryRef.current = [];
    }

    // overlay: face box + forehead ROI
    const overlay = overlayRef.current;
    const octx = overlay?.getContext("2d");
    if (overlay && octx) {
      if (overlay.width !== video.videoWidth) overlay.width = video.videoWidth;
      if (overlay.height !== video.videoHeight) overlay.height = video.videoHeight;
      octx.clearRect(0, 0, overlay.width, overlay.height);
      if (present && face) {
        octx.strokeStyle = "#22d3ee";
        octx.lineWidth = 3;
        octx.strokeRect(face.box.x, face.box.y, face.box.w, face.box.h);
        octx.strokeStyle = "#4ade80";
        octx.lineWidth = 2;
        for (const roi of pulseRois(face.box)) {
          octx.strokeRect(roi.x, roi.y, roi.w, roi.h);
        }
      }
    }

    // --- estimate tick (2 Hz) ---------------------------------------
    if (now - lastEstimateRef.current > 500) {
      lastEstimateRef.current = now;
      setPresence(detectorRef.current ? present : null);
      setMotion(motionLabel(motionEmaRef.current));
      if (analyserRef.current && freqDataRef.current) {
        const dom = dominantFrequency(
          freqDataRef.current,
          analyserRef.current.context.sampleRate,
          analyserRef.current.fftSize,
        );
        setDomFreq(dom);
        setFreqState(dom ? "live" : "quiet");
      }
      // Part 25: the perception read — expression + voice cues,
      // live only. No face in view means no sentence, honestly.
      {
        const faceCues =
          present && face?.landmarks ? expressionCues(face.landmarks) : [];
        let voice: string[] = [];
        const analyser = analyserRef.current;
        if (analyser) {
          const buf = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(buf);
          voice = voiceCues(buf, analyser.context.sampleRate).cues;
        }
        setPerception(perceptionSentence(faceCues, voice));
      }
      if (!detectorRef.current) {
        setReadout({ state: "unavailable", reason: "face tracker unavailable" });
      } else if (!present) {
        setReadout({ state: "unavailable", reason: "no face in view" });
        drawSparkline([]);
      } else if (brightness !== null && brightness < TOO_DARK) {
        setReadout({ state: "unavailable", reason: "light too low" });
        drawSparkline([]);
      } else {
        const est = estimatePulseFromRois(samplesRef.current, {
          motion: motionSamplesRef.current,
        });
        drawSparkline(est.waveform);
        // STABILIZATION: a number is shown only once recent
        // estimates agree (stabilizeReading) — until then the panel
        // stays SEARCHING and shows the live signal quality, so the
        // Captain can see the signal he is giving the camera.
        if (est.bpm !== null && est.quality >= WEAK_QUALITY) {
          readingHistoryRef.current = [
            ...readingHistoryRef.current.filter((h) => now - h.at <= 6_000),
            { bpm: est.bpm, quality: est.quality, at: now },
          ];
        }
        const stable = stabilizeReading(readingHistoryRef.current, now);
        if (stable) {
          setReadout({ state: "reading", bpm: stable.bpm, quality: stable.quality });
        } else {
          setReadout({ state: "searching", quality: est.quality });
        }
      }
    }
  }, [drawSparkline, drawSpectrum]);

  const start = async () => {
    setStarting(true);
    setCameraError("");
    setMicError("");
    setDetectorError("");
    let videoOk = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
        if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
          setFrameAspect(`${videoRef.current.videoWidth} / ${videoRef.current.videoHeight}`);
        }
      }
      videoOk = true;
    } catch {
      setCameraError(
        "The camera could not be opened. Allow camera access for this site in the browser, then start again — presence, motion and pulse all need the camera.",
      );
    }
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = audio;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.55;
      ctx.createMediaStreamSource(audio).connect(analyser);
      analyserRef.current = analyser;
    } catch {
      setMicError(
        "The microphone could not be opened. Allow microphone access for this site, then start again — the frequency readout needs the mic. Nothing is recorded either way.",
      );
    }
    if (videoOk) {
      try {
        detectorRef.current = await loadFaceDetector();
      } catch {
        setDetectorError(
          "The face tracker could not be loaded from the app's own bundled MediaPipe files. Presence and pulse are unavailable until it loads — motion and frequency still work.",
        );
      }
    }
    setStarting(false);
    if (videoOk || audioStreamRef.current) {
      runningRef.current = true;
      setRunning(true);
      rafRef.current = requestAnimationFrame(loop);
    }
  };

  const summary = pulseSummary({ presence, motion, pulse: readout });
  const pulseBig =
    readout.state === "reading" ? (
      <>
        <span className="window-pulse__bpm">{Math.round(readout.bpm)}</span>
        <span className="window-pulse__bpm-unit">BPM · estimate</span>
        <span className="window-pulse__quality">
          {readout.quality >= GOOD_QUALITY ? "good signal" : "weak signal"} · signal quality{" "}
          {Math.round(readout.quality * 100)}%
        </span>
      </>
    ) : readout.state === "searching" ? (
      <span className="window-pulse__state">
        SEARCHING — face the camera, hold still, good light
        {readout.quality !== undefined &&
          ` · signal quality ${Math.round(readout.quality * 100)}%`}
      </span>
    ) : (
      <span className="window-pulse__state">
        UNAVAILABLE — {readout.state === "unavailable" ? readout.reason : ""}
      </span>
    );

  return (
    <div className="window-pulse">
      <div
        className="window-pulse__stage"
        style={frameAspect ? { aspectRatio: frameAspect } : undefined}
      >
        <video ref={videoRef} className="window-pulse__video" playsInline muted autoPlay />
        <canvas ref={overlayRef} className="window-pulse__overlay" aria-hidden="true" />
        {!running && (
          <div className="window-pulse__idle">
            <p>
              Presence, motion, a heart-rate estimate from the camera, and the room's sound
              frequencies — all read live on this machine.
            </p>
            <button
              type="button"
              className="window-btn"
              onClick={() => void start()}
              disabled={starting}
            >
              {starting ? "Starting…" : "Start sensing"}
            </button>
          </div>
        )}
      </div>
      {cameraError && (
        <p role="alert" className="window-pulse__error">
          {cameraError}
        </p>
      )}
      {micError && (
        <p role="alert" className="window-pulse__error">
          {micError}
        </p>
      )}
      {detectorError && (
        <p role="alert" className="window-pulse__error">
          {detectorError}
        </p>
      )}
      <div className="window-pulse__panes">
        <section className="window-pulse__pane" aria-label="Heart rate estimate">
          <h3>Heart rate · camera estimate</h3>
          <div className="window-pulse__reading">{pulseBig}</div>
          <canvas ref={sparkRef} className="window-pulse__spark" width={260} height={44} />
          <p className="window-pulse__presence">
            Presence:{" "}
            {presence === null ? "—" : presence ? "person in view" : "no face in view"} · Motion:{" "}
            {motion ?? "—"}
          </p>
        </section>
        <section className="window-pulse__pane" aria-label="Room sound frequencies">
          <h3>Frequencies · room sound</h3>
          <canvas ref={specRef} className="window-pulse__spec" width={260} height={64} />
          <p className="window-pulse__freq">
            {freqState === "off" && "Microphone off."}
            {freqState === "quiet" && "Listening — no dominant frequency right now."}
            {freqState === "live" &&
              domFreq &&
              `Dominant frequency: ~${domFreq.hz} Hz (the loudest sound in the room)`}
          </p>
        </section>
      </div>
      <p className="window-pulse__summary" role="status">
        {summary}
      </p>
      {perception && (
        <p className="window-pulse__perception" role="status">
          {perception}
          <span className="window-pulse__privacy">
            {" "}
            — cues only, read live; expression is not identity, and nothing here is stored.
          </span>
        </p>
      )}
      {running && (
        <button type="button" className="window-btn" onClick={stop}>
          Stop sensing
        </button>
      )}
      <p className="window-pulse__privacy">
        All processing happens in this browser on this machine. Nothing is recorded or stored, and
        no faces are identified — presence and pulse only.
      </p>
    </div>
  );
}

/**
 * The WATCH source (Part 20 extension). The watch is the primary
 * vitals sensor in the owner's design — blood pressure, stress,
 * oxygen, heart data — but its readings reach Augie only through the
 * phone: watch -> phone (Bluetooth, its own app) -> Ghost Protocol
 * One -> the core. That pipe has not delivered a single real reading
 * yet, so this source is honestly UNAVAILABLE and shows no numbers.
 * The day the pipe lands, real readings render here — never before.
 */
function WatchPulsePanel() {
  return (
    <div className="window-pulse">
      <p className="window-pulse__state" role="status">
        WATCH — UNAVAILABLE
      </p>
      <p>
        No watch data pipe yet. Your watch talks to your phone; the phone-side bridge (Ghost
        Protocol One) is what will carry its readings — heart rate, blood pressure, stress,
        oxygen — into Augie. Until that pipe delivers a real reading, this source stays empty on
        purpose: Augie never invents vitals.
      </p>
      <p className="window-pulse__privacy">
        When the pipe lands, watch data stays local — your machine, your core, nobody else's
        servers.
      </p>
    </div>
  );
}

type PulseSource = "camera" | "watch";

/**
 * PULSE with its vitals SOURCE SWITCH (Part 20 extension): Camera or
 * Watch, switchable in the window. Camera is the working sense today;
 * the watch is the primary sensor in the design and reads UNAVAILABLE
 * until its phone pipe delivers real data.
 */
export function PulsePanel() {
  const [source, setSource] = useState<PulseSource>("camera");
  return (
    <div className="window-pulse__wrap">
      <div className="window-pulse__source" role="group" aria-label="Vitals source">
        <span className="window-pulse__source-label">Source</span>
        <button
          type="button"
          className="window-btn"
          aria-pressed={source === "camera"}
          onClick={() => setSource("camera")}
        >
          Camera
        </button>
        <button
          type="button"
          className="window-btn"
          aria-pressed={source === "watch"}
          onClick={() => setSource("watch")}
        >
          Watch
        </button>
      </div>
      {source === "camera" ? <CameraPulsePanel /> : <WatchPulsePanel />}
    </div>
  );
}

export function PulseWindow({ onClose }: { onClose: () => void }) {
  return (
    <FloatingWindow
      id="pulse"
      title="Pulse"
      onClose={onClose}
      initialWidth={440}
      initialHeight={500}
      accent="#f87171"
      // NO EMPTY GAPS (owner law 2026-11-22): Pulse opens sized to
      // its content — on his phone the fixed 500px frame stood
      // taller than the readouts and the bottom of the box was a
      // dead void under content huddled at the top.
      fitContentHeight
    >
      <PulsePanel />
    </FloatingWindow>
  );
}
