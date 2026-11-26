/**
 * THE PROPERTY FEED STORE — node-only, server-side.
 *
 * The durable half of the Bellwood Haven property feed: one
 * JSON file beside the sector record
 * (~/.local/share/augie/property-feed.json), owner-only
 * (0600). It holds no password and no frames — captures live
 * in sector-events/, named here only.
 *
 * THE WALL LIVES HERE: the only way an entry gets into this
 * file is append(), and append() runs every entry through
 * propertyFeedRefusal first. An entry from any zone but the
 * property / outside zone ("front") is refused — the bedroom
 * camera and every interior camera, whoever hands the entry
 * over. The refusal is code, not a setting: there is no flag
 * on this store that turns it off.
 *
 * Where there is no node filesystem (the Cloudflare Worker)
 * the store is unavailable and says so.
 */
import {
  mergeFeedEntries,
  partitionFeedEntries,
  sanitizePropertyFeedFile,
  type PropertyFeedEntry,
  type PropertyFeedFile,
} from "./cameras/propertyFeed";

type FeedFs = typeof import("node:fs/promises");

const STORE_FILE = "property-feed.json";

export interface PropertyFeedAppendResult {
  /** Entries actually written (new ids only). */
  written: number;
  /** Entries the wall turned away, each with its reason. */
  refused: { entry: PropertyFeedEntry; reason: string }[];
}

export interface PropertyFeedStore {
  read(): Promise<PropertyFeedFile>;
  /**
   * The ONLY write door. Every entry passes the wall
   * (partitionFeedEntries → propertyFeedRefusal); accepted
   * entries merge by id. Refusals are reported, never silent.
   */
  append(entries: PropertyFeedEntry[]): Promise<PropertyFeedAppendResult>;
  readonly dataDirectory: string;
}

export class FilePropertyFeedStore implements PropertyFeedStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: FeedFs,
    private readonly directory: string,
  ) {}

  private get filePath(): string {
    return `${this.directory}/${STORE_FILE}`;
  }

  get dataDirectory(): string {
    return this.directory;
  }

  async read(): Promise<PropertyFeedFile> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      return sanitizePropertyFeedFile(parsed);
    } catch {
      return sanitizePropertyFeedFile(null);
    }
  }

  private async writeAll(file: PropertyFeedFile): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.filePath, JSON.stringify(file, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  append(entries: PropertyFeedEntry[]): Promise<PropertyFeedAppendResult> {
    const { accepted, refused } = partitionFeedEntries(entries);
    if (accepted.length === 0) return Promise.resolve({ written: 0, refused });
    const job = async () => {
      const current = await this.read();
      const next = sanitizePropertyFeedFile(mergeFeedEntries(current, accepted));
      await this.writeAll(next);
      return {
        written: next.entries.length - current.entries.length,
        refused,
      };
    };
    const result = this.tail.then(job, job);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

let storePromise: Promise<FilePropertyFeedStore | null> | null = null;

export function getPropertyFeedStore(): Promise<FilePropertyFeedStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FilePropertyFeedStore(fs, `${home}/.local/share/augie`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}
