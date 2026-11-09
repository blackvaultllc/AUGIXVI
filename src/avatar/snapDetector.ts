export type SnapOptions = { sensitivity: number; cooldownMs: number; requireAudio: boolean; windowMs?: number };

/** Fires when a thumb–middle fingertip velocity spike and an audio transient coincide. */
export class SnapDetector {
  private lastDist: number | null = null;
  private lastT = 0;
  private handSpikeAt = -Infinity;
  private audioSpikeAt = -Infinity;
  private lastFire = -Infinity;
  constructor(public opts: SnapOptions) {}

  /** Velocity threshold in hand-widths/sec; higher sensitivity → lower threshold. */
  get velocityThreshold() { return 12 - this.opts.sensitivity * 8; }

  pushHand(t: number, dist: number): boolean {
    if (this.lastDist !== null && t > this.lastT) {
      const v = Math.abs(dist - this.lastDist) / ((t - this.lastT) / 1000);
      if (v > this.velocityThreshold) this.handSpikeAt = t;
    }
    this.lastDist = dist; this.lastT = t;
    return this.check(t);
  }
  pushAudioOnset(t: number): boolean { this.audioSpikeAt = t; return this.check(t); }
  resetHand() { this.lastDist = null; }

  private check(t: number): boolean {
    if (t - this.lastFire < this.opts.cooldownMs) return false;
    const w = this.opts.windowMs ?? 200;
    const hand = t - this.handSpikeAt <= w;
    const audio = t - this.audioSpikeAt <= w;
    if (hand && (audio || !this.opts.requireAudio)) {
      this.lastFire = t; this.handSpikeAt = this.audioSpikeAt = -Infinity;
      return true;
    }
    return false;
  }
}

/** High-frequency onset: current band energy jumps over its running average. */
export class OnsetDetector {
  private avg = 0;
  constructor(public sensitivity: number) {}
  push(energy: number): boolean {
    const k = 3.5 - this.sensitivity * 2;
    const hit = energy > 0.02 && energy > this.avg * k;
    this.avg = this.avg * 0.92 + energy * 0.08;
    return hit;
  }
}
