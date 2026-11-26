/**
 * WEBSITE PROJECTS STORE — node-only, server-side.
 *
 * His project registry and the marks he leaves on the pages,
 * on the core machine only:
 * ~/.local/share/augie/website-marks/website-marks.json — the
 * folder is 0700, the file 0600.
 *
 * The first read on a core that has no copy seeds the registry
 * from the in-repo seed (websiteProjects.ts — every entry
 * verified against the workspace before it was written) and
 * keeps the seeded copy. A copy that already stands is NEVER
 * overwritten by the seed: his registry is his, and his edits
 * and marks outrank it. A copy that exists but does not parse
 * reads as an empty registry — the seed does not resurrect
 * entries over a file that is already there.
 *
 * Where there is no node filesystem (the Cloudflare Worker)
 * the store is unavailable and says so — the saved area for
 * websites is a capability of the core machine, like the vault.
 */
import {
  emptyWebsiteProjectsFile,
  sanitizeWebsiteProjectsFile,
  seededWebsiteProjects,
  type WebsiteProjectsFile,
} from "./websiteProjects";

type WebsiteFs = typeof import("node:fs/promises");

const STORE_FILE = "website-marks.json";

export interface WebsiteProjectsStore {
  read(): Promise<WebsiteProjectsFile>;
  /** Serialized read-modify-write; the mutator returns the next file. */
  update(
    mutator: (file: WebsiteProjectsFile) => WebsiteProjectsFile,
  ): Promise<WebsiteProjectsFile>;
  /** The folder the saved area lives in. */
  readonly directory: string;
}

export class FileWebsiteProjectsStore implements WebsiteProjectsStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: WebsiteFs,
    private readonly storeDirectory: string,
  ) {}

  get directory(): string {
    return this.storeDirectory;
  }

  private get filePath(): string {
    return `${this.storeDirectory}/${STORE_FILE}`;
  }

  private async persist(file: WebsiteProjectsFile): Promise<void> {
    await this.fs.mkdir(this.storeDirectory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.filePath, JSON.stringify(file, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  async read(): Promise<WebsiteProjectsFile> {
    let raw: string;
    try {
      raw = await this.fs.readFile(this.filePath, "utf8");
    } catch {
      // No copy on this core yet — seed the registry from the
      // in-repo seed and keep the seeded copy. A write failure
      // leaves the in-memory seed standing for this read.
      const seed = seededWebsiteProjects(Date.now());
      try {
        await this.persist(seed);
      } catch {
        // the seed still answers this read
      }
      return seed;
    }
    try {
      return sanitizeWebsiteProjectsFile(JSON.parse(raw));
    } catch {
      // A copy stands but does not parse — read it as an empty
      // registry rather than resurrecting the seed over it.
      return emptyWebsiteProjectsFile();
    }
  }

  update(
    mutator: (file: WebsiteProjectsFile) => WebsiteProjectsFile,
  ): Promise<WebsiteProjectsFile> {
    const job = async () => {
      const current = await this.read();
      const next = sanitizeWebsiteProjectsFile(mutator(current));
      await this.persist(next);
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

let storePromise: Promise<FileWebsiteProjectsStore | null> | null = null;

export function getWebsiteProjectsStore(): Promise<FileWebsiteProjectsStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FileWebsiteProjectsStore(fs, `${home}/.local/share/augie/website-marks`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}
