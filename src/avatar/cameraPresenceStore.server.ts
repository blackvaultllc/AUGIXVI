/**
 * CAMERA PRESENCE STORE — node-only, server-side.
 *
 * The durable half of Camera Presence: per-camera presence
 * state (hearing armed, patrol, follow, the spotlight/tracking
 * probe verdicts), the heard-speech record, the recordings
 * list, and the creator enrollment meta. One JSON file beside
 * the camera registry (~/.local/share/augie/camera-presence.json),
 * owner-only (0600). It holds NO password and NO audio — hearing
 * events are transcripts (words the speech service returned),
 * and enrollment frames live as files in their own folder,
 * named here only.
 *
 * Every read passes through sanitizePresenceFile: a state that
 * was never measured stays at its honest default, and a claim
 * in the wrong shape does not survive the read.
 *
 * Where there is no node filesystem (the Cloudflare Worker) the
 * store is unavailable and says so — presence is a capability
 * of the core machine, like the cameras themselves.
 */
import {
  sanitizePresenceFile,
  type CameraPresenceFile,
} from "./cameras/cameraPresence";

type PresenceFs = typeof import("node:fs/promises");

const STORE_FILE = "camera-presence.json";

export interface CameraPresenceStore {
  read(): Promise<CameraPresenceFile>;
  /** Serialized read-modify-write; the mutator returns the next file. */
  update(mutator: (file: CameraPresenceFile) => CameraPresenceFile): Promise<CameraPresenceFile>;
}

class FileCameraPresenceStore implements CameraPresenceStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: PresenceFs,
    private readonly directory: string,
  ) {}

  private get filePath(): string {
    return `${this.directory}/${STORE_FILE}`;
  }

  /** The folder enrollment frames and recordings live under. */
  get dataDirectory(): string {
    return this.directory;
  }

  async read(): Promise<CameraPresenceFile> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      return sanitizePresenceFile(parsed);
    } catch {
      return sanitizePresenceFile(null);
    }
  }

  private async writeAll(file: CameraPresenceFile): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.filePath, JSON.stringify(file, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  update(
    mutator: (file: CameraPresenceFile) => CameraPresenceFile,
  ): Promise<CameraPresenceFile> {
    const job = async () => {
      const current = await this.read();
      const next = sanitizePresenceFile(mutator(current));
      await this.writeAll(next);
      return next;
    };
    const result = this.tail.then(job, job);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

let storePromise: Promise<FileCameraPresenceStore | null> | null = null;

export function getCameraPresenceStore(): Promise<FileCameraPresenceStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FileCameraPresenceStore(fs, `${home}/.local/share/augie`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}
