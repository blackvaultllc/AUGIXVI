/**
 * LAW BASE STORE — node-only, server-side.
 *
 * The core's own copy of the law base:
 * ~/.local/share/augie/law-base.json (0600, in the 0700 data
 * folder's keeping). The in-repo seed (lawBase.ts) is copied
 * here the first time the base is read on a core that has no
 * copy — and NEVER over a copy that already stands: his record
 * is his, and a hand correction on the core outranks the seed.
 * Every read passes through sanitizeLawBaseFile, whose shipping
 * rule drops any entry that lost its source.
 *
 * Where there is no node filesystem (the Cloudflare Worker)
 * the store is unavailable and says so.
 */
import {
  sanitizeLawBaseFile,
  seededLawBaseFile,
  type LawBaseFile,
} from "./lawBase";

type LawFs = typeof import("node:fs/promises");

const STORE_FILE = "law-base.json";

export interface LawBaseStore {
  read(): Promise<LawBaseFile>;
  /** The core data directory. */
  readonly dataDirectory: string;
}

export class FileLawBaseStore implements LawBaseStore {
  constructor(
    private readonly fs: LawFs,
    private readonly directory: string,
  ) {}

  private get filePath(): string {
    return `${this.directory}/${STORE_FILE}`;
  }

  get dataDirectory(): string {
    return this.directory;
  }

  async read(): Promise<LawBaseFile> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      return sanitizeLawBaseFile(parsed);
    } catch {
      // No copy on this core yet — seed it from the in-repo
      // base and keep the seeded copy. A write failure leaves
      // the in-memory seed standing for this read; the next
      // read tries the copy again.
      const seed = seededLawBaseFile(Date.now());
      try {
        await this.fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
        await this.fs.writeFile(this.filePath, JSON.stringify(seed, null, 2), {
          encoding: "utf8",
          mode: 0o600,
        });
      } catch {
        // the seed still answers this read
      }
      return seed;
    }
  }
}

let storePromise: Promise<FileLawBaseStore | null> | null = null;

export function getLawBaseStore(): Promise<FileLawBaseStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FileLawBaseStore(fs, `${home}/.local/share/augie`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}
