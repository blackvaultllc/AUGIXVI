/**
 * LOGIN GATE STORE — node-only, server-side.
 *
 * The doorbell's memory. Every recorded attempt at the gate (see
 * loginGate.ts) is appended to an append-only JSONL log, and its
 * snapshot — ONE still frame from the granted camera stream — is
 * written beside it. Both live in the core only:
 * ~/.local/share/augie/gate/ (directory 0700, files 0600), the same
 * locked pattern as the Personal Vault and the evidence store.
 * Nothing here ever leaves the machine.
 *
 * Appends are single appendFile calls serialized on a promise
 * chain — no read-modify-write, so two attempts landing together
 * cannot interleave or lose a line. The log is capped at 1 MiB and
 * rotates once, like the gate log. Photos are core-named only
 * (attempt-<stamp>-<n>.jpg); a photo is served back only when its
 * name appears in a stored attempt record — the same record-check
 * rule the vault and the sector stills use.
 *
 * This is a LOCAL desktop server feature. Where there is no node
 * filesystem (the Cloudflare Worker build), the store is
 * unavailable and nothing is recorded — the public site is a
 * different surface, and the gate check there falls back to
 * credentials with that stated on the gate.
 */
import {
  GATE_ATTEMPT_LOG_MAX_BYTES,
  isGatePhotoName,
  parseGateAttempts,
  serializeGateAttempt,
  type GateAttemptRecord,
} from "./loginGate";
import { planAppend } from "./gateLog";

type GateFs = typeof import("node:fs/promises");

export interface GateAttemptStore {
  record(record: GateAttemptRecord, photo?: Uint8Array | null): Promise<GateAttemptRecord>;
  read(): Promise<{ entries: GateAttemptRecord[]; total: number }>;
  readPhoto(photoFile: string): Promise<Uint8Array | null>;
}

/** Newest entries the operator view ever receives in one read. */
const READ_ENTRY_CAP = 200;

/** One snapshot is one frame — anything larger is not a frame. */
export const GATE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

class FileGateAttemptStore implements GateAttemptStore {
  private tail: Promise<unknown> = Promise.resolve();
  // Randomly seeded: a restart must never hand out a name an older
  // snapshot already wears (same-second attempts across a restart).
  private photoCounter = Math.floor(Math.random() * 1_000_000);

  constructor(
    private readonly fs: GateFs,
    private readonly photosDirectory: string,
    private readonly filePath: string,
    private readonly rotatedPath: string,
  ) {}

  private photoNameFor(ts: string): string {
    const stamp = ts.replace(/[^0-9]/g, "").slice(0, 14).padEnd(14, "0");
    this.photoCounter += 1;
    return `attempt-${stamp}-${this.photoCounter}.jpg`;
  }

  private async appendNow(record: GateAttemptRecord): Promise<void> {
    const line = serializeGateAttempt(record);
    const lineBytes = Buffer.byteLength(line, "utf8");
    let currentBytes = 0;
    try {
      currentBytes = (await this.fs.stat(this.filePath)).size;
    } catch {
      // No file yet: first attempt creates it.
    }
    if (planAppend(currentBytes, lineBytes, GATE_ATTEMPT_LOG_MAX_BYTES) === "rotate") {
      await this.fs.rename(this.filePath, this.rotatedPath).catch(() => undefined);
    }
    await this.fs.appendFile(this.filePath, line, { encoding: "utf8", mode: 0o600 });
  }

  record(record: GateAttemptRecord, photo?: Uint8Array | null): Promise<GateAttemptRecord> {
    const run = async (): Promise<GateAttemptRecord> => {
      let stored = record;
      if (photo && photo.byteLength > 0 && photo.byteLength <= GATE_PHOTO_MAX_BYTES) {
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

  async read(): Promise<{ entries: GateAttemptRecord[]; total: number }> {
    const readFile = async (path: string): Promise<GateAttemptRecord[]> => {
      try {
        return parseGateAttempts(await this.fs.readFile(path, "utf8"));
      } catch {
        return [];
      }
    };
    const records = [...(await readFile(this.rotatedPath)), ...(await readFile(this.filePath))];
    return { entries: records.slice(-READ_ENTRY_CAP).reverse(), total: records.length };
  }

  async readPhoto(photoFile: string): Promise<Uint8Array | null> {
    // Core-made names only, and the record check: a photo is served
    // only when a stored attempt record names it.
    if (!isGatePhotoName(photoFile)) return null;
    const { entries } = await this.read();
    if (!entries.some((entry) => entry.photoFile === photoFile)) return null;
    try {
      return await this.fs.readFile(`${this.photosDirectory}/${photoFile}`);
    } catch {
      return null;
    }
  }
}

export async function createGateAttemptStore(directory: string): Promise<GateAttemptStore | null> {
  try {
    const fs = await import("node:fs/promises");
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const photosDirectory = `${directory}/photos`;
    await fs.mkdir(photosDirectory, { recursive: true, mode: 0o700 });
    return new FileGateAttemptStore(
      fs,
      photosDirectory,
      `${directory}/attempts.jsonl`,
      `${directory}/attempts.1.jsonl`,
    );
  } catch {
    return null;
  }
}

let gateAttemptStorePromise: Promise<GateAttemptStore | null> | null = null;

function getGateAttemptStore(): Promise<GateAttemptStore | null> {
  gateAttemptStorePromise ??= (() => {
    const home = process.env["HOME"]?.trim();
    if (!home) return Promise.resolve(null);
    return createGateAttemptStore(`${home}/.local/share/augie/gate`);
  })();
  return gateAttemptStorePromise;
}

/** Record one gate attempt (with its snapshot, when there is one). */
export async function recordGateAttempt(
  record: GateAttemptRecord,
  photo?: Uint8Array | null,
): Promise<boolean> {
  const store = await getGateAttemptStore();
  if (!store) return false;
  try {
    await store.record(record, photo);
    return true;
  } catch {
    return false;
  }
}

/** Read the attempt records for the operator's gate log view. */
export async function readGateAttempts(): Promise<{
  available: boolean;
  entries: GateAttemptRecord[];
  total: number;
}> {
  const store = await getGateAttemptStore();
  if (!store) return { available: false, entries: [], total: 0 };
  const { entries, total } = await store.read();
  return { available: true, entries, total };
}

/** Read one snapshot back — only through the record check. */
export async function readGateAttemptPhoto(photoFile: string): Promise<Uint8Array | null> {
  const store = await getGateAttemptStore();
  if (!store) return null;
  return store.readPhoto(photoFile);
}
