/**
 * CORE MEMORY STORE — node-only, server-side (Part 30).
 *
 * The durable half of the phone-to-core link: exchanges and facts are
 * appended to an append-only JSONL file in the operator's protected
 * local state directory (~/.local/share/augie/, beside the operator
 * registry and the gate log). Appends are serialized on a promise
 * chain — no read-modify-write — so two surfaces writing at once
 * cannot interleave or lose a line. The file rotates at 8 MiB (one
 * generation kept).
 *
 * This store exists only where the app runs on the core machine (the
 * local node server). On the Cloudflare Worker there is no filesystem:
 * the store is unavailable, the status says NOT CONFIGURED, and
 * nothing pretends otherwise.
 */
import {
  parseCoreMemory,
  serializeCoreRecord,
  type CoreRecord,
} from "./coreMemory";

type CoreFs = typeof import("node:fs/promises");

const MAX_BYTES = 8 * 1024 * 1024;
/** Recall/status reads never load more than this many newest records. */
const READ_RECORD_CAP = 2_000;

export interface CoreMemoryStore {
  append(records: CoreRecord[]): Promise<void>;
  read(): Promise<CoreRecord[]>;
}

class FileCoreMemoryStore implements CoreMemoryStore {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly fs: CoreFs,
    private readonly filePath: string,
    private readonly rotatedPath: string,
  ) {}

  private async appendNow(records: CoreRecord[]): Promise<void> {
    const text = records.map(serializeCoreRecord).join("");
    let currentBytes = 0;
    try {
      currentBytes = (await this.fs.stat(this.filePath)).size;
    } catch {
      // No file yet: the first append creates it.
    }
    if (currentBytes + Buffer.byteLength(text, "utf8") > MAX_BYTES) {
      await this.fs.rename(this.filePath, this.rotatedPath).catch(() => undefined);
    }
    await this.fs.appendFile(this.filePath, text, "utf8");
  }

  append(records: CoreRecord[]): Promise<void> {
    if (records.length === 0) return Promise.resolve();
    const result = this.tail.then(() => this.appendNow(records));
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async read(): Promise<CoreRecord[]> {
    const readFile = async (path: string): Promise<CoreRecord[]> => {
      try {
        return parseCoreMemory(await this.fs.readFile(path, "utf8"));
      } catch {
        return [];
      }
    };
    const records = [...(await readFile(this.rotatedPath)), ...(await readFile(this.filePath))];
    return records.slice(-READ_RECORD_CAP);
  }
}

export async function createCoreMemoryStore(directory: string): Promise<CoreMemoryStore | null> {
  try {
    const fs = await import("node:fs/promises");
    await fs.mkdir(directory, { recursive: true });
    return new FileCoreMemoryStore(
      fs,
      `${directory}/core-memory.jsonl`,
      `${directory}/core-memory.1.jsonl`,
    );
  } catch {
    return null;
  }
}

let storePromise: Promise<CoreMemoryStore | null> | null = null;

function getCoreMemoryStore(): Promise<CoreMemoryStore | null> {
  storePromise ??= (() => {
    const home = process.env["HOME"]?.trim();
    if (!home) return Promise.resolve(null);
    return createCoreMemoryStore(`${home}/.local/share/augie`);
  })();
  return storePromise;
}

export async function appendCoreRecords(records: CoreRecord[]): Promise<boolean> {
  const store = await getCoreMemoryStore();
  if (!store) return false;
  await store.append(records);
  return true;
}

export async function readCoreRecords(): Promise<{ available: boolean; records: CoreRecord[] }> {
  const store = await getCoreMemoryStore();
  if (!store) return { available: false, records: [] };
  return { available: true, records: await store.read() };
}
