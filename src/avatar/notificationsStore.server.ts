/**
 * ANUBIS'S INBOX STORE — node-only, server-side.
 *
 * The durable half of the notifications pass: Anubis's
 * suggestions, the system entries, and the capture entries,
 * with the Captain's read marks. One JSON file beside the
 * sector record (~/.local/share/augie/anubis-inbox.json),
 * owner-only (0600). It holds no password and no frames —
 * capture stills live in sector-events/, named here only.
 *
 * Every read passes through sanitizeInboxFile. Entries are
 * derived from real core records by the runtime
 * (notificationsRuntime.server.ts) — the store itself never
 * invents one.
 *
 * Where there is no node filesystem (the Cloudflare Worker)
 * the store is unavailable and says so — the inbox is a
 * capability of the core machine, like the cameras.
 */
import {
  sanitizeInboxFile,
  type AnubisInboxFile,
} from "./cameras/anubisInbox";

type InboxFs = typeof import("node:fs/promises");

const STORE_FILE = "anubis-inbox.json";

export interface NotificationsStore {
  read(): Promise<AnubisInboxFile>;
  /** Serialized read-modify-write; the mutator returns the next file. */
  update(mutator: (file: AnubisInboxFile) => AnubisInboxFile): Promise<AnubisInboxFile>;
  /** The core data directory (capture stills live under it, in sector-events/). */
  readonly dataDirectory: string;
}

export class FileNotificationsStore implements NotificationsStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: InboxFs,
    private readonly directory: string,
  ) {}

  private get filePath(): string {
    return `${this.directory}/${STORE_FILE}`;
  }

  get dataDirectory(): string {
    return this.directory;
  }

  async read(): Promise<AnubisInboxFile> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      return sanitizeInboxFile(parsed);
    } catch {
      return sanitizeInboxFile(null);
    }
  }

  private async writeAll(file: AnubisInboxFile): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.filePath, JSON.stringify(file, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  update(mutator: (file: AnubisInboxFile) => AnubisInboxFile): Promise<AnubisInboxFile> {
    const job = async () => {
      const current = await this.read();
      const next = sanitizeInboxFile(mutator(current));
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

let storePromise: Promise<FileNotificationsStore | null> | null = null;

export function getNotificationsStore(): Promise<FileNotificationsStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FileNotificationsStore(fs, `${home}/.local/share/augie`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}
