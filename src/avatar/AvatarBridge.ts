export type AvatarState = "IDLE" | "LISTENING" | "THINKING" | "SPEAKING" | "GLITCH";
export type Gesture = { type: "wave" | "snap"; data?: unknown };
type Fn<T = void> = (v: T) => void;

/** Single adapter between any AI (STT/TTS/LLM) and the avatar renderer. */
export class AvatarBridge {
  state: AvatarState = "IDLE";
  speechLevel = 0;
  private stateCbs = new Set<Fn<AvatarState>>();
  private summonCbs = new Set<Fn>();
  private gestureCbs = new Set<Fn<Gesture>>();
  private speechStartCbs = new Set<Fn>();
  private speechEndCbs = new Set<Fn>();
  presenting: string | null = null;
  private presentCbs = new Set<Fn<string | null>>();
  /** Hands pull an item (e.g. a file) out of nowhere into view. Pass null to put it away. */
  present(label: string | null = "file") { this.presenting = label; this.presentCbs.forEach((c) => c(label)); }
  onPresent(cb: Fn<string | null>) { this.presentCbs.add(cb); return () => this.presentCbs.delete(cb); }
  private analyser: AnalyserNode | null = null;
  private buf: Float32Array<ArrayBuffer> | null = null;

  setState(s: AvatarState) { if (s === this.state) return; this.state = s; this.stateCbs.forEach((c) => c(s)); }
  setSpeechLevel(v: number) { this.speechLevel = Math.max(0, Math.min(1, v)); }
  /** Connect real TTS output; RMS drives speech level automatically each frame. */
  connectAudioSource(node: AudioNode) {
    this.analyser = node.context.createAnalyser();
    this.analyser.fftSize = 1024;
    node.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
  }
  disconnectAudioSource() { this.analyser?.disconnect(); this.analyser = null; }
  /** Called by renderer per frame. */
  sampleAudio() {
    if (!this.analyser || !this.buf) return;
    this.analyser.getFloatTimeDomainData(this.buf);
    let s = 0; for (const x of this.buf) s += x * x;
    this.setSpeechLevel(Math.sqrt(s / this.buf.length) * 4);
  }
  onStateChange(cb: Fn<AvatarState>) { this.stateCbs.add(cb); return () => this.stateCbs.delete(cb); }
  onSummon(cb: Fn) { this.summonCbs.add(cb); return () => this.summonCbs.delete(cb); }
  onGesture(cb: Fn<Gesture>) { this.gestureCbs.add(cb); return () => this.gestureCbs.delete(cb); }
  onUserSpeechStart(cb: Fn) { this.speechStartCbs.add(cb); return () => this.speechStartCbs.delete(cb); }
  onUserSpeechEnd(cb: Fn) { this.speechEndCbs.add(cb); return () => this.speechEndCbs.delete(cb); }
  emitSummon() { this.summonCbs.forEach((c) => c()); }
  emitGesture(g: Gesture) { this.gestureCbs.forEach((c) => c(g)); }
  emitUserSpeechStart() { this.speechStartCbs.forEach((c) => c()); }
  emitUserSpeechEnd() { this.speechEndCbs.forEach((c) => c()); }
}
