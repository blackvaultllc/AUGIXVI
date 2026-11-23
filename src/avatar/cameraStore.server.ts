/**
 * CAMERA STORE — node-only, server-side.
 *
 * The camera registry AND its credentials live here and nowhere
 * else: one JSON file beside his other protected local state
 * (~/.local/share/augie/cameras.json), written owner-only (0600).
 * The registry half is what the client sees (cameraRegistry.ts —
 * names, addresses, paths, fingerprints, grant flags, and a
 * hasPassword STATE). The password half never leaves this module:
 * reads hand a password only to the server plumbing that dials the
 * camera (the stream bridge, the ONVIF client), never to a client,
 * never to a log, never into an error.
 *
 * Local core-machine feature: where there is no node filesystem
 * (the Cloudflare Worker) the store is unavailable and says so —
 * cameras are a LAN capability of the Parrot build.
 */
import { sanitizeCamera, type CameraProfile } from "./cameras/cameraRegistry";

type CamerasFs = typeof import("node:fs/promises");

/** What the store file holds: the public profile + the secret. */
export type StoredCamera = CameraProfile & { password?: string | undefined };

const STORE_FILE = "cameras.json";

function toStored(raw: unknown): StoredCamera | null {
  if (!raw || typeof raw !== "object") return null;
  const profile = sanitizeCamera(raw);
  if (!profile) return null;
  const password = (raw as Record<string, unknown>)["password"];
  return {
    ...profile,
    hasPassword: typeof password === "string" && password.length > 0 ? true : profile.hasPassword,
    password: typeof password === "string" && password.length > 0 ? password : undefined,
  };
}

/** The client-safe view of a stored camera: profile, no secret. */
export function toPublicCamera(stored: StoredCamera): CameraProfile {
  const { password: _password, ...rest } = stored;
  return { ...rest, hasPassword: stored.password ? true : stored.hasPassword };
}

export interface CameraStore {
  list(): Promise<StoredCamera[]>;
  get(id: string): Promise<StoredCamera | null>;
  upsert(camera: StoredCamera): Promise<void>;
  remove(id: string): Promise<void>;
}

class FileCameraStore implements CameraStore {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly fs: CamerasFs,
    private readonly directory: string,
  ) {}

  private get filePath(): string {
    return `${this.directory}/${STORE_FILE}`;
  }

  private async readAll(): Promise<StoredCamera[]> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      if (!parsed || typeof parsed !== "object") return [];
      const list = (parsed as Record<string, unknown>)["cameras"];
      if (!Array.isArray(list)) return [];
      return list.map(toStored).filter((c): c is StoredCamera => c !== null);
    } catch {
      return [];
    }
  }

  private async writeAll(cameras: StoredCamera[]): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.filePath, JSON.stringify({ cameras }, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const result = this.tail.then(job, job);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  list(): Promise<StoredCamera[]> {
    return this.readAll();
  }

  async get(id: string): Promise<StoredCamera | null> {
    const all = await this.readAll();
    return all.find((c) => c.id === id) ?? null;
  }

  upsert(camera: StoredCamera): Promise<void> {
    return this.enqueue(async () => {
      const all = await this.readAll();
      const existing = all.find((c) => c.id === camera.id);
      // A save that carries no password keeps the stored one — the
      // client never holds the value, so an edit form cannot be
      // made to wipe it by leaving the field blank.
      const merged: StoredCamera = {
        ...camera,
        password: camera.password ?? existing?.password,
        hasPassword: (camera.password ?? existing?.password) ? true : camera.hasPassword,
        addedAt: existing?.addedAt ?? camera.addedAt,
      };
      const next = existing ? all.map((c) => (c.id === camera.id ? merged : c)) : [merged, ...all];
      await this.writeAll(next);
    });
  }

  remove(id: string): Promise<void> {
    return this.enqueue(async () => {
      const all = await this.readAll();
      await this.writeAll(all.filter((c) => c.id !== id));
    });
  }
}

let storePromise: Promise<CameraStore | null> | null = null;

export function getCameraStore(): Promise<CameraStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FileCameraStore(fs, `${home}/.local/share/augie`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}
