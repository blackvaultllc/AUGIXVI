import type { AvatarBridge } from "./AvatarBridge";
import { OnsetDetector, SnapDetector } from "./snapDetector";

export type SensorCallbacks = {
  onPalm: (x: number, y: number) => void; // normalized 0..1, mirrored
  onHandLost: () => void;
  onWave: (vx: number) => void;
  onMicLevel: (l: number) => void;
};
export type SensorStatus = { camera: boolean; mic: boolean; hands: boolean; error?: string };
export type SensorOptions = {
  sensitivity: number;
  cooldownMs: number;
  wasmRoot?: string | undefined;
  handModelUrl?: string | undefined;
};

/**
 * MediaPipe assets are BUNDLED WITH THE APP (Part 19, owner order
 * 2026-11-21): the wasm fileset and both landmarker models live under
 * public/mediapipe/ and are served from Augie's own origin, so hand
 * and face tracking work with the network unplugged. They used to be
 * fetched from jsDelivr / Google's bucket at runtime — on the Parrot
 * that made Pulse a coin flip on the connection. Env overrides still
 * win where a build sets them.
 */
export const DEFAULT_MEDIAPIPE_WASM_ROOT = "/mediapipe/wasm";
export const DEFAULT_MEDIAPIPE_HAND_MODEL_URL = "/mediapipe/hand_landmarker.task";

export function getVisionAssetCandidates(wasmRoot?: string, handModelUrl?: string) {
  const configured = {
    wasmRoot: wasmRoot || DEFAULT_MEDIAPIPE_WASM_ROOT,
    handModelUrl: handModelUrl || DEFAULT_MEDIAPIPE_HAND_MODEL_URL,
  };
  const defaults = {
    wasmRoot: DEFAULT_MEDIAPIPE_WASM_ROOT,
    handModelUrl: DEFAULT_MEDIAPIPE_HAND_MODEL_URL,
  };
  const hasOverride =
    configured.wasmRoot !== defaults.wasmRoot || configured.handModelUrl !== defaults.handModelUrl;
  return hasOverride ? [configured, defaults] : [defaults];
}

/**
 * The delegates hand tracking tries, in order (owner's phone,
 * 2026-11-24: CAM on → "hand tracking failed to load"). MediaPipe's
 * GPU delegate throws at creation on a large class of Android
 * phones — flaky WebGL stacks, driver blocklists — and the old code
 * asked for GPU only, so the whole load died and hands never
 * started. CPU inference is slower per frame but it WORKS on those
 * phones; the hand loop only needs palm position, not 60fps ML.
 */
export const HAND_DELEGATE_ORDER = ["GPU", "CPU"] as const;

/** Owns camera + mic streams (one of each), hand tracking and snap detection. */
export class Sensors {
  video = document.createElement("video");
  snap: SnapDetector;
  onset: OnsetDetector;
  private stopped = false;
  private raf = 0;
  private streams: MediaStream[] = [];
  private audioCtx: AudioContext | null = null;
  private landmarker: {
    detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks: { x: number; y: number }[][] };
    close: () => void;
  } | null = null;
  private lastPalmX: number | null = null;
  private lastT = 0;
  private lastVideoTime = -1;
  private userSpeaking = false;
  private quietSince = 0;
  status: SensorStatus = { camera: false, mic: false, hands: false };

  constructor(
    private bridge: AvatarBridge,
    private cb: SensorCallbacks,
    private opts: SensorOptions,
  ) {
    const { sensitivity, cooldownMs } = opts;
    this.snap = new SnapDetector({ sensitivity, cooldownMs, requireAudio: true });
    this.onset = new OnsetDetector(sensitivity);
  }
  setOptions(o: { sensitivity: number; cooldownMs: number }) {
    Object.assign(this.snap.opts, o);
    this.onset.sensitivity = o.sensitivity;
  }

  get cameraIsActive() {
    const stream = this.video.srcObject;
    return (
      this.status.camera &&
      stream instanceof MediaStream &&
      stream.getVideoTracks().some((track) => track.enabled && track.readyState === "live")
    );
  }

  async start(): Promise<SensorStatus> {
    try {
      const v = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      this.streams.push(v);
      this.video.srcObject = v;
      this.video.muted = true;
      this.video.playsInline = true;
      await this.video.play();
      this.status.camera = true;
    } catch (e) {
      this.status.error = "Camera unavailable — using mouse/touch.";
    }
    try {
      const a = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      this.streams.push(a);
      this.audioCtx = new AudioContext();
      const an = this.audioCtx.createAnalyser();
      an.fftSize = 1024;
      this.audioCtx.createMediaStreamSource(a).connect(an);
      this.status.mic = true;
      this.audioLoop(an);
    } catch {
      this.snap.opts.requireAudio = false;
    }
    if (this.status.camera) {
      try {
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const candidates = getVisionAssetCandidates(
          this.opts.wasmRoot || import.meta.env["VITE_MEDIAPIPE_WASM_ROOT"],
          this.opts.handModelUrl || import.meta.env["VITE_MEDIAPIPE_HAND_MODEL_URL"],
        );
        for (const candidate of candidates) {
          try {
            const fs = await FilesetResolver.forVisionTasks(candidate.wasmRoot);
            for (const delegate of HAND_DELEGATE_ORDER) {
              try {
                this.landmarker = await HandLandmarker.createFromOptions(fs, {
                  baseOptions: { modelAssetPath: candidate.handModelUrl, delegate },
                  runningMode: "VIDEO",
                  numHands: 1,
                });
                break;
              } catch (error) {
                console.warn(`Hand tracking ${delegate} delegate failed to load.`, error);
              }
            }
            if (this.landmarker) break;
          } catch (error) {
            console.warn("Hand tracking asset configuration failed to load.", error);
          }
        }
        if (!this.landmarker) {
          this.status.error =
            candidates.length > 1
              ? "HAND TRACKING IS NOT CONFIGURED — configured and default vision assets both failed to load. Using mouse/touch."
              : "Hand tracking failed to load — using mouse/touch.";
          return this.status;
        }
        if (this.stopped) {
          this.landmarker.close();
          return this.status;
        }
        this.status.hands = true;
        this.handLoop();
      } catch {
        this.status.error = "Hand tracking failed to load — using mouse/touch.";
      }
    }
    return this.status;
  }
  private audioLoop(an: AnalyserNode) {
    const f = new Uint8Array(an.frequencyBinCount),
      td = new Float32Array(an.fftSize);
    const hz = this.audioCtx!.sampleRate / 2 / f.length;
    const from = Math.floor(3000 / hz);
    const loop = () => {
      if (this.stopped) return;
      an.getByteFrequencyData(f);
      an.getFloatTimeDomainData(td);
      let e = 0;
      for (let i = from; i < f.length; i++) e += f[i]!;
      e /= (f.length - from) * 255;
      if (this.onset.push(e)) {
        if (this.snap.pushAudioOnset(performance.now())) this.fireSummon();
      }
      let s = 0;
      for (const x of td) s += x * x;
      const rms = Math.sqrt(s / td.length);
      this.cb.onMicLevel(rms);
      const now = performance.now();
      // Barge-in: voice activity counts whenever the avatar is engaged (not IDLE),
      // so the user can interrupt it mid-sentence instead of talking over it.
      if (rms > 0.04 && this.bridge.state !== "IDLE") {
        if (!this.userSpeaking) {
          this.userSpeaking = true;
          this.bridge.emitUserSpeechStart();
        }
        this.quietSince = now;
      } else if (this.userSpeaking && now - this.quietSince > 900) {
        this.userSpeaking = false;
        this.bridge.emitUserSpeechEnd();
      }
      setTimeout(loop, 16);
    };
    loop();
  }
  private handLoop = () => {
    if (this.stopped || !this.landmarker) return;
    this.raf = requestAnimationFrame(this.handLoop);
    if (document.hidden || this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;
    const now = performance.now();
    const res = this.landmarker.detectForVideo(this.video, now);
    const lm = res.landmarks[0];
    if (!lm) {
      this.cb.onHandLost();
      this.snap.resetHand();
      this.lastPalmX = null;
      return;
    }
    const P = (i: number) => lm[i]!;
    const palm = P(9);
    const x = 1 - palm.x,
      y = palm.y;
    this.cb.onPalm(x, y);
    const size = Math.hypot(P(0).x - P(9).x, P(0).y - P(9).y) || 0.1;
    const d = Math.hypot(P(4).x - P(12).x, P(4).y - P(12).y) / size;
    if (this.snap.pushHand(now, d)) this.fireSummon();
    if (this.lastPalmX !== null) {
      const vx = (x - this.lastPalmX) / ((now - this.lastT) / 1000);
      if (Math.abs(vx) > 2.5) this.cb.onWave(vx);
    }
    this.lastPalmX = x;
    this.lastT = now;
  };
  private fireSummon() {
    this.bridge.emitGesture({ type: "snap" });
    this.bridge.emitSummon();
  }
  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.landmarker?.close();
    this.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    void this.audioCtx?.close();
  }
}
