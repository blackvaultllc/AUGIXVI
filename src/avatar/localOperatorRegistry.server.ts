import { OperatorRegistry } from "./OperatorRegistry";

// Local stand-in for the OSIRIS_OPERATOR_REGISTRY Durable Object, used only
// when the Cloudflare binding is absent (e.g. the local node-server build).
// It runs the real OperatorRegistry over storage backed by a JSON file, so
// endpoint semantics and response shapes are identical to the Durable Object,
// and the claim survives rebuilds and restarts.

type RegistryFs = typeof import("node:fs/promises");

interface RegistryTransaction {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

class LocalRegistryStorage {
  private values = new Map<string, unknown>();
  private loaded = false;
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly fs: RegistryFs,
    private readonly directory: string,
    private readonly filePath: string,
  ) {}

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await this.fs.readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [key, value] of Object.entries(parsed)) {
          this.values.set(key, value);
        }
      }
    } catch {
      // A missing or unreadable state file is a fresh registry, matching a
      // Durable Object that has never been written to.
    }
  }

  private async persist(values: Map<string, unknown>): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await this.fs.writeFile(
      temporaryPath,
      `${JSON.stringify(Object.fromEntries(values), null, 2)}\n`,
      "utf8",
    );
    await this.fs.rename(temporaryPath, this.filePath);
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.load();
    return this.values.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    await this.load();
    this.values.set(key, value);
    await this.persist(this.values);
  }

  transaction<T>(callback: (transaction: RegistryTransaction) => Promise<T>): Promise<T> {
    // Serialized, with draft-then-commit so a failed callback leaves the
    // stored state untouched, as a Durable Object transaction would.
    const result = this.transactionTail.then(async () => {
      await this.load();
      const draft = new Map(this.values);
      const transaction: RegistryTransaction = {
        async get<V>(key: string) {
          return draft.get(key) as V | undefined;
        },
        async put<V>(key: string, value: V) {
          draft.set(key, value);
        },
      };
      const value = await callback(transaction);
      this.values = draft;
      await this.persist(draft);
      return value;
    });
    this.transactionTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export async function createLocalOperatorRegistry(
  directory: string,
  filePath: string,
): Promise<OperatorRegistry | null> {
  try {
    const fs = await import("node:fs/promises");
    return new OperatorRegistry({
      storage: new LocalRegistryStorage(fs, directory, filePath),
    });
  } catch {
    return null;
  }
}
