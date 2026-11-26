/**
 * EVIDENCE STORE — node-only, server-side.
 *
 * Stop mode's recordings and records, on the core machine
 * only: ~/.local/share/augie/evidence/ — the folder is 0700,
 * the recordings and the index (index.json) are 0600. The
 * audio of a stop is evidence: it is written here, listed
 * here, and served only through the vault's door after the
 * record check. It never leaves the core.
 *
 * Where there is no node filesystem (the Cloudflare Worker)
 * the store is unavailable and says so.
 */
import {
  sanitizeEvidenceFile,
  type EvidenceFile,
} from "./evidence";

type EvidenceFs = typeof import("node:fs/promises");

const INDEX_FILE = "index.json";

export interface EvidenceStore {
  read(): Promise<EvidenceFile>;
  /** Serialized read-modify-write; the mutator returns the next file. */
  update(mutator: (file: EvidenceFile) => EvidenceFile): Promise<EvidenceFile>;
  /** Read one recording's bytes by its bare name. */
  readRecording(fileName: string): Promise<Uint8Array | null>;
  /** The evidence folder itself (recordings are written into it by the runtime). */
  readonly directory: string;
}

export class FileEvidenceStore implements EvidenceStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: EvidenceFs,
    private readonly evidenceDirectory: string,
  ) {}

  get directory(): string {
    return this.evidenceDirectory;
  }

  private get indexPath(): string {
    return `${this.evidenceDirectory}/${INDEX_FILE}`;
  }

  async read(): Promise<EvidenceFile> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.indexPath, "utf8"));
      return sanitizeEvidenceFile(parsed);
    } catch {
      return sanitizeEvidenceFile(null);
    }
  }

  private async writeAll(file: EvidenceFile): Promise<void> {
    await this.fs.mkdir(this.evidenceDirectory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.indexPath, JSON.stringify(file, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  update(mutator: (file: EvidenceFile) => EvidenceFile): Promise<EvidenceFile> {
    const job = async () => {
      const current = await this.read();
      const next = sanitizeEvidenceFile(mutator(current));
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

  async readRecording(fileName: string): Promise<Uint8Array | null> {
    try {
      return await this.fs.readFile(`${this.evidenceDirectory}/${fileName}`);
    } catch {
      return null;
    }
  }
}

let storePromise: Promise<FileEvidenceStore | null> | null = null;

export function getEvidenceStore(): Promise<FileEvidenceStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FileEvidenceStore(fs, `${home}/.local/share/augie/evidence`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}
