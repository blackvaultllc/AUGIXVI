/**
 * CONNECTIONS STORE — node-only, server-side.
 *
 * The values the Captain enters in the Connections area live HERE
 * and nowhere else: one JSON file beside his other protected local
 * state (~/.local/share/augie/connection-slots.json), written with
 * owner-only permissions (0600). Values are keyed by their server
 * env name (connections.ts names them). Nothing in this module
 * ever returns a value to a client — reads hand values only to
 * server plumbing: at boot, and again the moment a slot is saved,
 * stored values are applied to the server process's environment,
 * so the consumers that already read env names (the brain pipe,
 * the server voice) pick a filled slot up with no rewiring.
 *
 * This is a LOCAL core-machine feature. Where there is no node
 * filesystem (the Cloudflare Worker), the store is unavailable and
 * says so: there, slots are filled by setting the Worker secret of
 * the same name — the established Cloudflare pattern — and the
 * status read still reports them from the environment.
 */
type ConnectionsFs = typeof import("node:fs/promises");

export interface ConnectionsStore {
  /** All stored values, by env name. Server-side only — never serialized to a client. */
  readAll(): Promise<Record<string, string>>;
  set(envName: string, value: string): Promise<void>;
  clear(envName: string): Promise<void>;
}

const STORE_FILE = "connection-slots.json";

class FileConnectionsStore implements ConnectionsStore {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly fs: ConnectionsFs,
    private readonly directory: string,
  ) {}

  private get filePath(): string {
    return `${this.directory}/${STORE_FILE}`;
  }

  async readAll(): Promise<Record<string, string>> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      if (!parsed || typeof parsed !== "object") return {};
      const out: Record<string, string> = {};
      for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string" && value.trim()) out[name] = value;
      }
      return out;
    } catch {
      return {};
    }
  }

  private async writeAll(values: Record<string, string>): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true });
    await this.fs.writeFile(this.filePath, JSON.stringify(values, null, 2), {
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

  set(envName: string, value: string): Promise<void> {
    return this.enqueue(async () => {
      const values = await this.readAll();
      values[envName] = value;
      await this.writeAll(values);
    });
  }

  clear(envName: string): Promise<void> {
    return this.enqueue(async () => {
      const values = await this.readAll();
      delete values[envName];
      await this.writeAll(values);
    });
  }
}

let storePromise: Promise<ConnectionsStore | null> | null = null;

export function getConnectionsStore(): Promise<ConnectionsStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FileConnectionsStore(fs, `${home}/.local/share/augie`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}

/**
 * Apply stored slot values to this server process's environment —
 * only for names the environment does not already carry (a real
 * environment value, e.g. a Worker secret, always wins). Called at
 * boot from server.ts and after every save, so a filled slot is
 * live in the plumbing that reads env names. Returns how many
 * values were applied. No-op where the store is unavailable.
 */
export async function applyStoredConnectionsToEnv(): Promise<number> {
  const store = await getConnectionsStore();
  if (!store) return 0;
  const values = await store.readAll();
  let applied = 0;
  for (const [name, value] of Object.entries(values)) {
    if (!process.env[name]) {
      process.env[name] = value;
      applied += 1;
    }
  }
  return applied;
}
