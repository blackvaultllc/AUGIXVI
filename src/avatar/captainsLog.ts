/**
 * CAPTAIN'S LOG (Part 32, operator order 2026-11-21) — short video
 * journal entries, recorded in the window, kept on the operator's
 * own machine, exportable in one click. Storage is IndexedDB in
 * this browser (blobs are too big for localStorage); nothing is
 * uploaded anywhere, ever.
 *
 * This module is the storage + shaping layer. The pure helpers
 * (entry titles, export filenames) are unit-tested; the IDB calls
 * are thin wrappers the window drives.
 */

export type CaptainEntryMeta = {
  id: string;
  /** Epoch ms the recording started. */
  at: number;
  durationMs: number;
  /** The recorder's mime type, e.g. video/webm. */
  mimeType: string;
  sizeBytes: number;
};

const DB_NAME = "augie-captains-log";
const STORE = "entries";

export function entryTitle(at: number): string {
  return `Captain's Log — ${new Date(at).toLocaleString()}`;
}

export function exportFilename(at: number, mimeType: string): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  const ext = mimeType.includes("mp4") ? "mp4" : "webm";
  return `captains-log-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const request = run(t.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
        t.oncomplete = () => db.close();
      }),
  );
}

export async function saveEntry(meta: CaptainEntryMeta, blob: Blob): Promise<void> {
  await tx("readwrite", (store) => store.put({ ...meta, blob }));
}

export async function listEntries(): Promise<CaptainEntryMeta[]> {
  const all = await tx("readonly", (store) => store.getAll());
  return (all as (CaptainEntryMeta & { blob: Blob })[])
    .map(({ blob: _blob, ...meta }) => meta)
    .sort((a, b) => b.at - a.at);
}

export async function loadEntryBlob(id: string): Promise<Blob | null> {
  const found = await tx("readonly", (store) => store.get(id));
  return (found as { blob?: Blob } | undefined)?.blob ?? null;
}

export async function deleteEntry(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id));
}
