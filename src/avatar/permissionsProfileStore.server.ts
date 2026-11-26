/**
 * PERMISSIONS PROFILE STORE — node-only, server-side. The one
 * shared permission profile (the Captain's uniform-permissions
 * rule, 2026-11-26) and its reconcile bookkeeping: the
 * deviations the Captain explicitly set per item, and what
 * reconcile last applied per item. One JSON file beside the
 * other core records (~/.local/share/augie/permissions-profile.json),
 * owner-only (0600). No passwords, no frames — flags only.
 *
 * Where there is no node filesystem (the Cloudflare Worker)
 * the store is unavailable and says so.
 */
import {
  sanitizePermissionsProfile,
  type PermissionsProfileFile,
} from "./permissionsProfile";

type PermissionsFs = typeof import("node:fs/promises");

const STORE_FILE = "permissions-profile.json";

export interface PermissionsProfileStore {
  read(): Promise<PermissionsProfileFile>;
  /** Serialized read-modify-write; the mutator returns the next file. */
  update(
    mutator: (file: PermissionsProfileFile) => PermissionsProfileFile,
  ): Promise<PermissionsProfileFile>;
  readonly dataDirectory: string;
}

class FilePermissionsProfileStore implements PermissionsProfileStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: PermissionsFs,
    private readonly directory: string,
  ) {}

  private get filePath(): string {
    return `${this.directory}/${STORE_FILE}`;
  }

  get dataDirectory(): string {
    return this.directory;
  }

  async read(): Promise<PermissionsProfileFile> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      return sanitizePermissionsProfile(parsed);
    } catch {
      return sanitizePermissionsProfile(null);
    }
  }

  private async writeAll(file: PermissionsProfileFile): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.filePath, JSON.stringify(file, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  update(
    mutator: (file: PermissionsProfileFile) => PermissionsProfileFile,
  ): Promise<PermissionsProfileFile> {
    const job = async () => {
      const current = await this.read();
      const next = sanitizePermissionsProfile(mutator(current));
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

let cached: Promise<PermissionsProfileStore | null> | undefined;

export function getPermissionsProfileStore(): Promise<PermissionsProfileStore | null> {
  cached ??= (async () => {
    try {
      const fs = await import("node:fs/promises");
      const { homedir } = await import("node:os");
      const { join } = await import("node:path");
      const directory =
        process.env["AUGIE_PERMISSIONS_DIR"] ?? join(homedir(), ".local", "share", "augie");
      return new FilePermissionsProfileStore(fs, directory);
    } catch {
      return null;
    }
  })();
  return cached;
}
