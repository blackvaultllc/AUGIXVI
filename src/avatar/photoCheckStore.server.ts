/**
 * PHOTO CHECK STORE — node-only, server-side.
 *
 * The record of Anubis's in-session picture asks (see
 * photoCheck.ts for the law). Every answered ask is appended to
 * an append-only JSONL log, and its snapshot — ONE still frame
 * from the granted camera stream, present only on a completed
 * check — is written beside it. Both live in the core only, in
 * the same locked directory as the gate's doorbell record:
 * ~/.local/share/augie/gate/ (directory 0700, files 0600),
 * under its own file names (photo-checks.jsonl, check-*.jpg) so
 * the two records never mix. Nothing here ever leaves the
 * machine.
 *
 * Appends are single appendFile calls serialized on a promise
 * chain — no read-modify-write, so two records landing together
 * cannot interleave or lose a line. The log is capped at 1 MiB
 * and rotates once, like the gate log. A photo is served back
 * only when its name appears in a stored photo-check record —
 * the same record-check rule the gate photos keep.
 *
 * This is a LOCAL desktop server feature. Where there is no
 * node filesystem (the Cloudflare Worker build), the store is
 * unavailable and nothing is recorded — the ask there states
 * that its record lives on the home computer, the same honest
 * bound the gate states on its face.
 */
import {
  PHOTO_CHECK_LOG_MAX_BYTES,
  isPhotoCheckPhotoName,
  parsePhotoChecks,
  serializePhotoCheck,
  type PhotoCheckRecord,
} from "./photoCheck";
import { planAppend } from "./gateLog";

type PhotoCheckFs = typeof import("node:fs/promises");

export interface PhotoCheckStore {
  record(record: PhotoCheckRecord, photo?: Uint8Array | null): Promise<PhotoCheckRecord>;
  read(): Promise<{ entries: PhotoCheckRecord[]; total: number }>;
  readPhoto(photoFile: string): Promise<Uint8Array | null>;
}

/** Newest entries the operator view ever receives in one read. */
const READ_ENTRY_CAP = 200;

/** One snapshot is one frame — anything larger is not a frame. */
export const PHOTO_CHECK_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

class FilePhotoCheckStore implements PhotoCheckStore {
  private tail: Promise<unknown> = Promise.resolve();
  // Randomly seeded: a restart must never hand out a name an older
  // snapshot already wears (same-second records across a restart).
  private photoCounter = Math.floor(Math.random() * 1_000_000);

  constructor(
    private readonly fs: PhotoCheckFs,
    private readonly photosDirectory: string,
    private readonly filePath: string,
    private readonly rotatedPath: string,
  ) {}

  private photoNameFor(ts: string): string {
    const stamp = ts.replace(/[^0-9]/g, "").slice(0, 14).padEnd(14, "0");
    this.photoCounter += 1;
    return `check-${stamp}-${this.photoCounter}.jpg`;
  }

  private async appendNow(record: PhotoCheckRecord): Promise<void> {
    const line = serializePhotoCheck(record);
    const lineBytes = Buffer.byteLength(line, "utf8");
    let currentBytes = 0;
    try {
      currentBytes = (await this.fs.stat(this.filePath)).size;
    } catch {
      // No file yet: first record creates it.
    }
    if (planAppend(currentBytes, lineBytes, PHOTO_CHECK_LOG_MAX_BYTES) === "rotate") {
      await this.fs.rename(this.filePath, this.rotatedPath).catch(() => undefined);
    }
    await this.fs.appendFile(this.filePath, line, { encoding: "utf8", mode: 0o600 });
  }

  record(record: PhotoCheckRecord, photo?: Uint8Array | null): Promise<PhotoCheckRecord> {
    const run = async (): Promise<PhotoCheckRecord> => {
      let stored = record;
      // A snapshot exists ONLY on a completed check. A declined
      // or camera-failed record never carries a photo, whatever
      // the caller handed over — the law, enforced at the store.
      if (
        record.outcome === "completed" &&
        photo &&
        photo.byteLength > 0 &&
        photo.byteLength <= PHOTO_CHECK_PHOTO_MAX_BYTES
      ) {
        const photoFile = this.photoNameFor(record.ts);
        await this.fs.writeFile(`${this.photosDirectory}/${photoFile}`, photo, { mode: 0o600 });
        stored = { ...record, photoFile };
      }
      await this.appendNow(stored);
      return stored;
    };
    const result = this.tail.then(run, run);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async read(): Promise<{ entries: PhotoCheckRecord[]; total: number }> {
    const readFile = async (path: string): Promise<PhotoCheckRecord[]> => {
      try {
        return parsePhotoChecks(await this.fs.readFile(path, "utf8"));
      } catch {
        return [];
      }
    };
    const records = [...(await readFile(this.rotatedPath)), ...(await readFile(this.filePath))];
    return { entries: records.slice(-READ_ENTRY_CAP).reverse(), total: records.length };
  }

  async readPhoto(photoFile: string): Promise<Uint8Array | null> {
    // Core-made names only, and the record check: a photo is served
    // only when a stored photo-check record names it.
    if (!isPhotoCheckPhotoName(photoFile)) return null;
    const { entries } = await this.read();
    if (!entries.some((entry) => entry.photoFile === photoFile)) return null;
    try {
      return await this.fs.readFile(`${this.photosDirectory}/${photoFile}`);
    } catch {
      return null;
    }
  }
}

export async function createPhotoCheckStore(directory: string): Promise<PhotoCheckStore | null> {
  try {
    const fs = await import("node:fs/promises");
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const photosDirectory = `${directory}/photos`;
    await fs.mkdir(photosDirectory, { recursive: true, mode: 0o700 });
    return new FilePhotoCheckStore(
      fs,
      photosDirectory,
      `${directory}/photo-checks.jsonl`,
      `${directory}/photo-checks.1.jsonl`,
    );
  } catch {
    return null;
  }
}

let photoCheckStorePromise: Promise<PhotoCheckStore | null> | null = null;

function getPhotoCheckStore(): Promise<PhotoCheckStore | null> {
  photoCheckStorePromise ??= (() => {
    const home = process.env["HOME"]?.trim();
    if (!home) return Promise.resolve(null);
    // The gate's own directory: the photo-check record stands
    // beside the doorbell record, under the same lock.
    return createPhotoCheckStore(`${home}/.local/share/augie/gate`);
  })();
  return photoCheckStorePromise;
}

/** Record one answered photo check (with its snapshot, when there is one). */
export async function recordPhotoCheck(
  record: PhotoCheckRecord,
  photo?: Uint8Array | null,
): Promise<boolean> {
  const store = await getPhotoCheckStore();
  if (!store) return false;
  try {
    await store.record(record, photo);
    return true;
  } catch {
    return false;
  }
}

/** Read the photo-check records for the operator's gate log view. */
export async function readPhotoChecks(): Promise<{
  available: boolean;
  entries: PhotoCheckRecord[];
  total: number;
}> {
  const store = await getPhotoCheckStore();
  if (!store) return { available: false, entries: [], total: 0 };
  const { entries, total } = await store.read();
  return { available: true, entries, total };
}

/** Read one snapshot back — only through the record check. */
export async function readPhotoCheckPhoto(photoFile: string): Promise<Uint8Array | null> {
  const store = await getPhotoCheckStore();
  if (!store) return null;
  return store.readPhoto(photoFile);
}
