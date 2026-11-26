/**
 * PERSONAL VAULT STORE — node-only, server-side.
 *
 * The Captain's own papers, on the core machine only:
 * ~/.local/share/augie/personal-vault/ — the folder is 0700,
 * every file in it 0600, and the index (index.json) is one of
 * those files. The documents themselves are stored as their
 * own files beside the index, under names the core chose.
 *
 * Nothing leaves the core: this store has no network in it,
 * and the only reader is the vault's own server door, which
 * serves a file only when its name stands on the index.
 *
 * Where there is no node filesystem (the Cloudflare Worker)
 * the store is unavailable and says so — the vault is a
 * capability of the core machine, like the cameras.
 */
import {
  sanitizeVaultIndex,
  type VaultIndexFile,
} from "./personalVault";

type VaultFs = typeof import("node:fs/promises");

const INDEX_FILE = "index.json";

export interface PersonalVaultStore {
  read(): Promise<VaultIndexFile>;
  /** Serialized read-modify-write; the mutator returns the next index. */
  update(mutator: (file: VaultIndexFile) => VaultIndexFile): Promise<VaultIndexFile>;
  /** Write one document's bytes under a core-chosen bare name (0600). */
  writeDocument(fileName: string, bytes: Uint8Array): Promise<void>;
  /** Read one document's bytes by its bare name. */
  readDocument(fileName: string): Promise<Uint8Array | null>;
  /** Remove one document's file (a missing file is not an error). */
  removeDocument(fileName: string): Promise<void>;
  /** The vault folder itself. */
  readonly directory: string;
}

export class FilePersonalVaultStore implements PersonalVaultStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: VaultFs,
    private readonly vaultDirectory: string,
  ) {}

  get directory(): string {
    return this.vaultDirectory;
  }

  private get indexPath(): string {
    return `${this.vaultDirectory}/${INDEX_FILE}`;
  }

  async read(): Promise<VaultIndexFile> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.indexPath, "utf8"));
      return sanitizeVaultIndex(parsed);
    } catch {
      return sanitizeVaultIndex(null);
    }
  }

  private async writeIndex(file: VaultIndexFile): Promise<void> {
    await this.fs.mkdir(this.vaultDirectory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.indexPath, JSON.stringify(file, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  update(mutator: (file: VaultIndexFile) => VaultIndexFile): Promise<VaultIndexFile> {
    const job = async () => {
      const current = await this.read();
      const next = sanitizeVaultIndex(mutator(current));
      await this.writeIndex(next);
      return next;
    };
    const result = this.tail.then(job, job);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async writeDocument(fileName: string, bytes: Uint8Array): Promise<void> {
    await this.fs.mkdir(this.vaultDirectory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(`${this.vaultDirectory}/${fileName}`, bytes, { mode: 0o600 });
  }

  async readDocument(fileName: string): Promise<Uint8Array | null> {
    try {
      return await this.fs.readFile(`${this.vaultDirectory}/${fileName}`);
    } catch {
      return null;
    }
  }

  async removeDocument(fileName: string): Promise<void> {
    await this.fs.unlink(`${this.vaultDirectory}/${fileName}`).catch(() => undefined);
  }
}

let storePromise: Promise<FilePersonalVaultStore | null> | null = null;

export function getPersonalVaultStore(): Promise<FilePersonalVaultStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FilePersonalVaultStore(fs, `${home}/.local/share/augie/personal-vault`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}
