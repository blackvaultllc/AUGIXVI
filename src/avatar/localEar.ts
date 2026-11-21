/**
 * LOCAL EAR — Augie's offline speech-to-text input.
 *
 * The old ear was the browser's SpeechRecognition, which on Linux
 * Chromium quietly depends on Google's cloud speech service: when it
 * failed, it failed silently and the mic appeared to turn on and off
 * again with no explanation. It also needed the internet, which Augie
 * is built to survive without.
 *
 * This ear is local end to end: the browser only records
 * (getUserMedia + MediaRecorder). The clip goes to the app's own
 * /api/transcribe route, which forwards it to the faster-whisper
 * service running on this same machine. The transcript then feeds the
 * exact same sendCommand(text, "voice") path as typed commands.
 *
 * Push-to-talk: click the mic and it listens — and STAYS listening —
 * until a phrase is captured (speech, then a beat of silence) or the
 * operator clicks again. Every failure is spoken in words through
 * onError; the mic never dies quietly.
 *
 * VOICE CALIBRATION (phase 2): the stage may install a voice verifier
 * (setVoiceVerifier). When one is installed, the SAME clip that would
 * be transcribed is checked against the operator's voiceprint first.
 * A failed check — or a check that cannot be completed — means the
 * clip is never transcribed and never executed: the ear reports the
 * rejection through onVoiceRejected and the stage speaks the lock
 * line. No verifier installed = the ear behaves exactly as before.
 */

export type EarState = "idle" | "starting" | "listening" | "transcribing" | "error";

/** The voiceprint service's verdict on one recorded clip. */
export interface VoiceVerdict {
  match: boolean;
  /** Cosine similarity against the stored voiceprint, when scored. */
  score: number | null;
}

/**
 * Checks one recorded clip against the operator's voiceprint.
 * Resolves with the verdict; REJECTS (throws) when the check itself
 * could not be completed — service down, no voiceprint, bad audio —
 * and the ear treats that as a failed check (fail closed).
 */
export type VoiceVerifier = (audio: Blob) => Promise<VoiceVerdict>;

export interface VoiceRejection {
  /** "mismatch": scored, and it was not the operator's voice.
   *  "unavailable": the check could not be completed at all. */
  reason: "mismatch" | "unavailable";
  score: number | null;
}

export interface EarEvents {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  onState?: (state: EarState) => void;
  /** A voice clip was blocked by the calibration gate (see above). */
  onVoiceRejected?: (rejection: VoiceRejection) => void;
}

/** The slice of MediaRecorder the ear relies on (fakeable in tests). */
export interface RecorderLike {
  mimeType: string;
  start: () => void;
  stop: () => void;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
}

/** The slice of an analyser-based level meter the ear relies on. */
export interface LevelMonitorLike {
  /** Current RMS level, roughly 0..1. */
  level: () => number;
  stop: () => void;
}

export interface EarDeps {
  getUserMedia: (constraints: { audio: boolean }) => Promise<MediaStream>;
  createRecorder: (stream: MediaStream) => RecorderLike;
  createLevelMonitor: (stream: MediaStream) => LevelMonitorLike;
  transcribe: (audio: Blob) => Promise<{ text: string }>;
  setIntervalFn: (cb: () => void, ms: number) => unknown;
  clearIntervalFn: (handle: unknown) => void;
  now: () => number;
}

const TICK_MS = 100;
const SPEECH_RMS = 0.05;
const MIN_SPEECH_MS = 300;
const END_OF_PHRASE_SILENCE_MS = 1400;
const MAX_LISTEN_MS = 60_000;
/** A stop sooner than this with nothing heard is a cancel, not a phrase. */
const ACCIDENTAL_STOP_MS = 1500;

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
] as const;

export function pickRecorderMimeType(
  isTypeSupported: (mime: string) => boolean,
): string {
  for (const mime of RECORDER_MIME_CANDIDATES) {
    try {
      if (isTypeSupported(mime)) return mime;
    } catch {
      /* keep looking */
    }
  }
  return "";
}

/** Plain-words reason a microphone could not be opened — never silent. */
export function micErrorMessage(error: unknown): string {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone unavailable: permission was denied. Allow microphone access for this page in the browser, then click the mic again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Microphone unavailable: no microphone was found on this machine.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Microphone unavailable: the microphone could not be opened — another app may be using it.";
  }
  const detail = error instanceof Error ? error.message : "";
  return `Microphone unavailable${detail ? `: ${detail}` : "."}`;
}

async function postToTranscribeRoute(audio: Blob): Promise<{ text: string }> {
  let response: Response;
  try {
    response = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": audio.type || "audio/webm" },
      body: audio,
    });
  } catch {
    throw new Error(
      "Local speech service is unreachable — the transcription route did not answer.",
    );
  }
  let payload: { text?: string; error?: string } = {};
  try {
    payload = (await response.json()) as { text?: string; error?: string };
  } catch {
    /* an unreadable body falls through to the status-based message */
  }
  if (!response.ok) {
    throw new Error(payload.error || `Transcription failed (HTTP ${response.status}).`);
  }
  return { text: payload.text ?? "" };
}

function browserDeps(): EarDeps {
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createRecorder: (stream) => {
      const mime = pickRecorderMimeType((m) => MediaRecorder.isTypeSupported(m));
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      return recorder as unknown as RecorderLike;
    },
    createLevelMonitor: (stream) => {
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buffer = new Uint8Array(analyser.fftSize);
      return {
        level: () => {
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (const value of buffer) {
            const delta = (value - 128) / 128;
            sum += delta * delta;
          }
          return Math.sqrt(sum / buffer.length);
        },
        stop: () => {
          try {
            source.disconnect();
          } catch {
            /* already closed */
          }
          void context.close().catch(() => undefined);
        },
      };
    },
    transcribe: postToTranscribeRoute,
    setIntervalFn: (cb, ms) => setInterval(cb, ms),
    clearIntervalFn: (handle) => clearInterval(handle as number),
    now: () => Date.now(),
  };
}

export function earSupportedInBrowser(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

export class LocalEar {
  readonly supported: boolean;
  private readonly events: EarEvents;
  private readonly deps: EarDeps;
  private state: EarState = "idle";
  private stream: MediaStream | null = null;
  private recorder: RecorderLike | null = null;
  private monitor: LevelMonitorLike | null = null;
  private timer: unknown = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private lastSpeechAt = 0;
  private speechMs = 0;
  private heardSpeech = false;
  private cancelRequested = false;
  private disposed = false;
  private voiceVerifier: VoiceVerifier | null = null;

  constructor(events: EarEvents, deps?: EarDeps) {
    this.events = events;
    this.deps = deps ?? browserDeps();
    this.supported = deps ? true : earSupportedInBrowser();
  }

  get currentState(): EarState {
    return this.state;
  }

  /**
   * Install (or clear, with null) the voice-calibration gate. While a
   * verifier is installed, every captured phrase is voice-checked
   * before transcription; see the header note.
   */
  setVoiceVerifier(verifier: VoiceVerifier | null): void {
    this.voiceVerifier = verifier;
  }

  private setState(next: EarState) {
    this.state = next;
    this.events.onState?.(next);
  }

  async start(): Promise<void> {
    if (this.disposed) return;
    if (this.state === "starting" || this.state === "listening" || this.state === "transcribing") {
      return;
    }
    if (!this.supported) {
      this.fail(
        "Microphone unavailable: this browser cannot record audio (no media devices support).",
      );
      return;
    }
    this.setState("starting");
    this.cancelRequested = false;
    let stream: MediaStream;
    try {
      stream = await this.deps.getUserMedia({ audio: true });
    } catch (error) {
      this.fail(micErrorMessage(error));
      return;
    }
    if (this.disposed || this.cancelRequested) {
      stream.getTracks().forEach((track) => track.stop());
      this.setState("idle");
      return;
    }
    this.stream = stream;
    this.chunks = [];
    this.speechMs = 0;
    this.heardSpeech = false;
    this.lastSpeechAt = 0;
    try {
      this.monitor = this.deps.createLevelMonitor(stream);
      this.recorder = this.deps.createRecorder(stream);
    } catch (error) {
      this.fail(micErrorMessage(error));
      return;
    }
    this.recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.onstop = () => {
      void this.finishRecording();
    };
    this.startedAt = this.deps.now();
    try {
      this.recorder.start();
    } catch (error) {
      this.fail(micErrorMessage(error));
      return;
    }
    this.setState("listening");
    this.timer = this.deps.setIntervalFn(() => this.tick(), TICK_MS);
  }

  /** The mic button: start listening, or stop and use what was said. */
  toggle(): void {
    if (this.state === "listening") {
      this.stop();
    } else if (this.state === "starting") {
      this.cancelRequested = true;
    } else {
      void this.start();
    }
  }

  /** Operator clicked again: finish the phrase (or cancel an accidental tap). */
  stop(): void {
    if (this.state !== "listening") return;
    const elapsed = this.deps.now() - this.startedAt;
    if (!this.heardSpeech && elapsed < ACCIDENTAL_STOP_MS) {
      this.teardown();
      this.setState("idle");
      return;
    }
    this.beginTranscription();
  }

  dispose(): void {
    this.disposed = true;
    this.teardown();
    this.state = "idle";
  }

  private tick(): void {
    if (this.state !== "listening" || !this.monitor) return;
    const now = this.deps.now();
    if (this.monitor.level() >= SPEECH_RMS) {
      this.heardSpeech = true;
      this.speechMs += TICK_MS;
      this.lastSpeechAt = now;
    }
    const elapsed = now - this.startedAt;
    if (
      this.heardSpeech &&
      this.speechMs >= MIN_SPEECH_MS &&
      now - this.lastSpeechAt >= END_OF_PHRASE_SILENCE_MS
    ) {
      this.beginTranscription();
      return;
    }
    if (elapsed >= MAX_LISTEN_MS) {
      if (this.heardSpeech) {
        this.beginTranscription();
      } else {
        this.fail(
          "I didn't hear anything — the microphone stayed silent, so listening stopped. Click the mic and speak right after it turns on.",
        );
      }
    }
  }

  private beginTranscription(): void {
    if (this.timer !== null) {
      this.deps.clearIntervalFn(this.timer);
      this.timer = null;
    }
    this.setState("transcribing");
    const recorder = this.recorder;
    if (!recorder) {
      void this.finishRecording();
      return;
    }
    try {
      recorder.stop(); // onstop → finishRecording
    } catch {
      void this.finishRecording();
    }
  }

  private async finishRecording(): Promise<void> {
    const mimeType = this.recorder?.mimeType || "audio/webm";
    const chunks = this.chunks;
    this.releaseHardware();
    if (this.disposed) return;
    const audio = new Blob(chunks, { type: mimeType });
    if (audio.size === 0) {
      this.fail("No audio was captured from the microphone. Click the mic and try again.");
      return;
    }
    // VOICE CALIBRATION GATE: the same clip, checked before it is
    // transcribed. A mismatch — or a check that cannot complete —
    // ends here: no transcript, no command, just the rejection event.
    const verifier = this.voiceVerifier;
    if (verifier) {
      let verdict: VoiceVerdict;
      try {
        verdict = await verifier(audio);
      } catch {
        if (this.disposed) return;
        this.setState("idle");
        this.events.onVoiceRejected?.({ reason: "unavailable", score: null });
        return;
      }
      if (this.disposed) return;
      if (!verdict.match) {
        this.setState("idle");
        this.events.onVoiceRejected?.({ reason: "mismatch", score: verdict.score });
        return;
      }
    }
    try {
      const { text } = await this.deps.transcribe(audio);
      if (this.disposed) return;
      const clean = text.trim();
      if (!clean) {
        this.fail(
          "I heard sound but couldn't make out any words. Try again, a little closer to the microphone.",
        );
        return;
      }
      this.setState("idle");
      this.events.onTranscript(clean);
    } catch (error) {
      if (this.disposed) return;
      this.fail(
        error instanceof Error ? error.message : "Transcription failed for an unknown reason.",
      );
    }
  }

  private fail(message: string): void {
    this.releaseHardware();
    if (this.timer !== null) {
      this.deps.clearIntervalFn(this.timer);
      this.timer = null;
    }
    this.setState("error");
    this.events.onError(message);
  }

  private teardown(): void {
    if (this.timer !== null) {
      this.deps.clearIntervalFn(this.timer);
      this.timer = null;
    }
    this.releaseHardware();
  }

  private releaseHardware(): void {
    if (this.recorder) {
      this.recorder.ondataavailable = null;
      this.recorder.onstop = null;
      try {
        this.recorder.stop();
      } catch {
        /* already stopped */
      }
      this.recorder = null;
    }
    if (this.monitor) {
      try {
        this.monitor.stop();
      } catch {
        /* already stopped */
      }
      this.monitor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}

export function createLocalEar(events: EarEvents, deps?: EarDeps): LocalEar {
  return new LocalEar(events, deps);
}
