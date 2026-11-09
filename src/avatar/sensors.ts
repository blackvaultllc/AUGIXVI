import type { AvatarBridge } from "./AvatarBridge";
import { OnsetDetector, SnapDetector } from "./snapDetector";

export type SensorCallbacks = {
  onPalm: (x: number, y: number) => void; // normalized 0..1, mirrored
  onHandLost: () => void;
  onWave: (vx: number) => void;
  onMicLevel: (l: number) => void;
};
export type SensorStatus = { camera: boolean; mic: boolean; hands: boolean; error?: string };

/** Owns camera + mic streams (one of each), hand tracking and snap detection. */
export class Sensors {
  video = document.createElement("video");
  snap: SnapDetector; onset: OnsetDetector;
  private stopped = false; private raf = 0; private streams: MediaStream[] = [];
  private audioCtx: AudioContext | null = null; private landmarker: { detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks: { x: number; y: number }[][] }; close: () => void } | null = null;
  private lastPalmX: number | null = null; private lastT = 0; private lastVideoTime = -1;
  private userSpeaking = false; private quietSince = 0;
  status: SensorStatus = { camera: false, mic: false, hands: false };

  constructor(private bridge: AvatarBridge, private cb: SensorCallbacks, opts: { sensitivity: number; cooldownMs: number }) {
    this.snap = new SnapDetector({ ...opts, requireAudio: true });
    this.onset = new OnsetDetector(opts.sensitivity);
  }
  setOptions(o: { sensitivity: number; cooldownMs: number }) { Object.assign(this.snap.opts, o); this.onset.sensitivity = o.sensitivity; }

  async start(): Promise<SensorStatus> {
    try {
      const v = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      this.streams.push(v); this.video.srcObject = v; this.video.muted = true; this.video.playsInline = true; await this.video.play();
      this.status.camera = true;
    } catch (e) { this.status.error = "Camera unavailable — using mouse/touch."; }
    try {
      const a = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      this.streams.push(a); this.audioCtx = new AudioContext();
      const an = this.audioCtx.createAnalyser(); an.fftSize = 1024; this.audioCtx.createMediaStreamSource(a).connect(an);
      this.status.mic = true; this.audioLoop(an);
    } catch { this.snap.opts.requireAudio = false; }
    if (this.status.camera) {
      try {
        const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
        const fs = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm");
        this.landmarker = await HandLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
          runningMode: "VIDEO", numHands: 1,
        });
        if (this.stopped) { this.landmarker.close(); return this.status; }
        this.status.hands = true; this.handLoop();
      } catch { this.status.error = "Hand tracking failed to load — using mouse/touch."; }
    }
    return this.status;
  }
  private audioLoop(an: AnalyserNode) {
    const f = new Uint8Array(an.frequencyBinCount), td = new Float32Array(an.fftSize);
    const hz = (this.audioCtx!.sampleRate / 2) / f.length; const from = Math.floor(3000 / hz);
    const loop = () => {
      if (this.stopped) return;
      an.getByteFrequencyData(f); an.getFloatTimeDomainData(td);
      let e = 0; for (let i = from; i < f.length; i++) e += f[i]!; e /= (f.length - from) * 255;
      if (this.onset.push(e)) { if (this.snap.pushAudioOnset(performance.now())) this.fireSummon(); }
      let s = 0; for (const x of td) s += x * x; const rms = Math.sqrt(s / td.length);
      this.cb.onMicLevel(rms);
      const now = performance.now();
      if (rms > 0.04 && this.bridge.state === "LISTENING") { if (!this.userSpeaking) { this.userSpeaking = true; this.bridge.emitUserSpeechStart(); } this.quietSince = now; }
      else if (this.userSpeaking && now - this.quietSince > 900) { this.userSpeaking = false; this.bridge.emitUserSpeechEnd(); }
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
    if (!lm) { this.cb.onHandLost(); this.snap.resetHand(); this.lastPalmX = null; return; }
    const P = (i: number) => lm[i]!; const palm = P(9); const x = 1 - palm.x, y = palm.y;
    this.cb.onPalm(x, y);
    const size = Math.hypot(P(0).x - P(9).x, P(0).y - P(9).y) || 0.1;
    const d = Math.hypot(P(4).x - P(12).x, P(4).y - P(12).y) / size;
    if (this.snap.pushHand(now, d)) this.fireSummon();
    if (this.lastPalmX !== null) { const vx = (x - this.lastPalmX) / ((now - this.lastT) / 1000); if (Math.abs(vx) > 2.5) this.cb.onWave(vx); }
    this.lastPalmX = x; this.lastT = now;
  };
  private fireSummon() { this.bridge.emitGesture({ type: "snap" }); this.bridge.emitSummon(); }
  stop() {
    this.stopped = true; cancelAnimationFrame(this.raf);
    this.landmarker?.close(); this.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    void this.audioCtx?.close();
  }
}
