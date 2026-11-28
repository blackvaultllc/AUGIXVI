/**
 * ACCOUNT-LOCK REQUESTS STORE — node-only, server-side.
 *
 * The durable half of the account lock (owner order
 * 2026-11-27 ~23:18 CST): one JSON file on the core
 * (~/.local/share/augie/account-lock-requests.json),
 * owner-only (0600), holding every lock/unlock request an
 * agent has filed from their own side.
 *
 * Filing is one act with two records, both from the request
 * itself — the section requests' law, kept: the request lands
 * in this store, and a REQUEST entry lands in the Captain's
 * notifications (the Anubis inbox), written here at the moment
 * of filing, carrying the request's id as its source, so
 * Anubis lets him know and the request stands where his
 * Office reads its world. He reviews and contacts the agent
 * himself; nothing in this path locks or unlocks anything on
 * its own.
 *
 * Where there is no node filesystem (the Cloudflare Worker)
 * the store is unavailable and says so — the requests live on
 * the core machine, like the inbox itself.
 */
import { randomUUID } from "node:crypto";
import {
  lockRequestNotification,
  newLockRequestId,
  sanitizeLockRequestsFile,
  LOCK_REQUEST_NOTE_MAX,
  type LockRequest,
  type LockRequestKind,
  type LockRequestsFile,
} from "./accountLock";
import { getNotificationsStore } from "./notificationsStore.server";
import { INBOX_MAX } from "./cameras/anubisInbox";

type RequestsFs = typeof import("node:fs/promises");

const STORE_FILE = "account-lock-requests.json";

export class FileLockRequestsStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: RequestsFs,
    private readonly directory: string,
  ) {}

  private get filePath(): string {
    return `${this.directory}/${STORE_FILE}`;
  }

  async read(): Promise<LockRequestsFile> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      return sanitizeLockRequestsFile(parsed);
    } catch {
      return sanitizeLockRequestsFile(null);
    }
  }

  private async writeAll(file: LockRequestsFile): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.filePath, JSON.stringify(file, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  private update(
    mutator: (file: LockRequestsFile) => LockRequestsFile,
  ): Promise<LockRequestsFile> {
    const job = async () => {
      const current = await this.read();
      const next = sanitizeLockRequestsFile(mutator(current));
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

  /** Append one request; returns the stored record. */
  async append(request: LockRequest): Promise<LockRequest> {
    await this.update((file) => ({ requests: [request, ...file.requests] }));
    return request;
  }
}

let storePromise: Promise<FileLockRequestsStore | null> | null = null;

export function getLockRequestsStore(): Promise<FileLockRequestsStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FileLockRequestsStore(fs, `${home}/.local/share/augie`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}

/**
 * File one lock/unlock request from an agent's own side.
 * Returns the stored request, or null where the core store
 * does not exist on this surface. The inbox mirror is
 * best-effort in one direction only: the request record is
 * written FIRST, and the mirror is written from it — if the
 * inbox store were missing, the request still stands on its
 * own record.
 */
export async function fileLockRequest(input: {
  seat: number;
  fromName: string;
  kind: LockRequestKind;
  note?: string;
}): Promise<LockRequest | null> {
  const fromName = input.fromName.trim().slice(0, 80);
  if (!fromName) return null;
  if (!Number.isInteger(input.seat) || input.seat < 0 || input.seat > 15) return null;
  const store = await getLockRequestsStore();
  if (!store) return null;
  const at = Date.now();
  const request: LockRequest = {
    id: newLockRequestId(at, randomUUID()),
    at,
    seat: input.seat,
    fromName,
    kind: input.kind,
    note: (input.note ?? "").trim().slice(0, LOCK_REQUEST_NOTE_MAX),
  };
  await store.append(request);
  const inbox = await getNotificationsStore();
  if (inbox) {
    const entry = lockRequestNotification(request);
    await inbox.update((file) => {
      if (file.entries.some((e) => e.id === entry.id)) return file;
      return {
        entries: [entry, ...file.entries].sort((a, b) => b.at - a.at).slice(0, INBOX_MAX),
      };
    });
  }
  return request;
}
