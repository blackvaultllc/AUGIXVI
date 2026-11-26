/**
 * SECTOR WATCH STORE — node-only, server-side.
 *
 * The durable half of Sector Watch: the sector settings (each
 * camera's zone, its watch on/off, the cycle interval), the
 * watch log, and the security events. One JSON file beside the
 * camera registry and the presence record
 * (~/.local/share/augie/sector-watch.json), owner-only (0600).
 * It holds NO password and NO frames — event stills live as
 * files in their own folder (sector-events/), named here only.
 *
 * Every read passes through sanitizeSectorWatchFile: a claim in
 * the wrong shape does not survive the read, and a state that
 * was never set stands at its honest default.
 *
 * Where there is no node filesystem (the Cloudflare Worker) the
 * store is unavailable and says so — the watch is a capability
 * of the core machine, like the cameras themselves.
 */
import {
  sanitizeSectorWatchFile,
  type SectorWatchFile,
} from "./cameras/sectorWatch";

type SectorFs = typeof import("node:fs/promises");

const STORE_FILE = "sector-watch.json";

export interface SectorWatchStore {
  read(): Promise<SectorWatchFile>;
  /** Serialized read-modify-write; the mutator returns the next file. */
  update(mutator: (file: SectorWatchFile) => SectorWatchFile): Promise<SectorWatchFile>;
  /**
   * Lay the first-run seed down ONLY if no sector record file
   * exists yet — true when this call wrote the seed. An
   * existing record is the Captain's and is never overwritten.
   */
  seedIfAbsent(seed: SectorWatchFile): Promise<boolean>;
  /** The folder event stills live under (the core data directory). */
  readonly dataDirectory: string;
}

class FileSectorWatchStore implements SectorWatchStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: SectorFs,
    private readonly directory: string,
  ) {}

  private get filePath(): string {
    return `${this.directory}/${STORE_FILE}`;
  }

  get dataDirectory(): string {
    return this.directory;
  }

  async read(): Promise<SectorWatchFile> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      return sanitizeSectorWatchFile(parsed);
    } catch {
      return sanitizeSectorWatchFile(null);
    }
  }

  private async writeAll(file: SectorWatchFile): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.filePath, JSON.stringify(file, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  update(mutator: (file: SectorWatchFile) => SectorWatchFile): Promise<SectorWatchFile> {
    const job = async () => {
      const current = await this.read();
      const next = sanitizeSectorWatchFile(mutator(current));
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

  seedIfAbsent(seed: SectorWatchFile): Promise<boolean> {
    const job = async () => {
      try {
        await this.fs.access(this.filePath);
        return false;
      } catch {
        await this.writeAll(sanitizeSectorWatchFile(seed));
        return true;
      }
    };
    const result = this.tail.then(job, job);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

let storePromise: Promise<FileSectorWatchStore | null> | null = null;

export function getSectorWatchStore(): Promise<FileSectorWatchStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FileSectorWatchStore(fs, `${home}/.local/share/augie`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}
