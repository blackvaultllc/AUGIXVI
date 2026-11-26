/**
 * VOICE SETTINGS STORE — node-only, server-side. The Voice Lab's
 * choice (which catalog voice the construct speaks with) lives in
 * the core, in one JSON file beside the other core records
 * (~/.local/share/augie/voice-settings.json), owner-only (0600) —
 * so the choice the Captain makes on one device is the voice on
 * every surface, because they all speak through this core.
 *
 * Where there is no node filesystem (the Cloudflare Worker) the
 * store is unavailable and says so; the say path then resolves as
 * a fresh store (the deep default, when its model is installed).
 */
import {
  sanitizeVoiceSettings,
  type VoiceSettingsFile,
} from "./voiceSettings";

type VoiceFs = typeof import("node:fs/promises");

const STORE_FILE = "voice-settings.json";

export interface VoiceSettingsStore {
  read(): Promise<VoiceSettingsFile>;
  /** Serialized read-modify-write; the mutator returns the next file. */
  update(
    mutator: (file: VoiceSettingsFile) => VoiceSettingsFile,
  ): Promise<VoiceSettingsFile>;
  readonly dataDirectory: string;
}

class FileVoiceSettingsStore implements VoiceSettingsStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: VoiceFs,
    private readonly directory: string,
  ) {}

  private get filePath(): string {
    return `${this.directory}/${STORE_FILE}`;
  }

  get dataDirectory(): string {
    return this.directory;
  }

  async read(): Promise<VoiceSettingsFile> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      return sanitizeVoiceSettings(parsed);
    } catch {
      return sanitizeVoiceSettings(null);
    }
  }

  private async writeAll(file: VoiceSettingsFile): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.filePath, JSON.stringify(file, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  update(
    mutator: (file: VoiceSettingsFile) => VoiceSettingsFile,
  ): Promise<VoiceSettingsFile> {
    const job = async () => {
      const current = await this.read();
      const next = sanitizeVoiceSettings(mutator(current));
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

export function createVoiceSettingsStore(
  fs: VoiceFs,
  directory: string,
): VoiceSettingsStore {
  return new FileVoiceSettingsStore(fs, directory);
}

const cached = new Map<string, Promise<VoiceSettingsStore | null>>();

export async function getVoiceSettingsStore(): Promise<VoiceSettingsStore | null> {
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  const directory =
    process.env["AUGIE_VOICE_DIR"] ?? join(homedir(), ".local", "share", "augie");
  let entry = cached.get(directory);
  if (!entry) {
    entry = (async () => {
      try {
        const fs = await import("node:fs/promises");
        return new FileVoiceSettingsStore(fs, directory);
      } catch {
        return null;
      }
    })();
    cached.set(directory, entry);
  }
  return entry;
}
