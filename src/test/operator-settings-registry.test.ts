import { describe, expect, it } from "vitest";
import { OperatorRegistry } from "@/avatar/OperatorRegistry";

interface TestStorageTransaction {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

interface TestStorage extends TestStorageTransaction {
  transaction<T>(callback: (transaction: TestStorageTransaction) => Promise<T>): Promise<T>;
}

function createRegistry() {
  const values = new Map<string, unknown>();
  const storage: TestStorage = {
    async get<T>(key: string) {
      return values.get(key) as T | undefined;
    },
    async put<T>(key: string, value: T) {
      values.set(key, value);
    },
    async transaction<T>(callback: (transaction: TestStorageTransaction) => Promise<T>) {
      return callback(storage);
    },
  };
  return { registry: new OperatorRegistry({ storage }), values };
}

function getSettingsRequest(): Request {
  return new Request("https://operator-registry/settings", { method: "GET" });
}

function putSettingsRequest(body: unknown): Request {
  return new Request("https://operator-registry/settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const RECORD = {
  settings: { bloom: 0, theme: "purple", customColor: "#22c55e", maxParticles: 60_000 },
  updatedAt: "2026-11-21T18:00:00.000Z",
};

describe("operator registry — account settings record", () => {
  it("reads back null before the account has ever saved", async () => {
    const { registry } = createRegistry();
    const response = await registry.fetch(getSettingsRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ settings: null });
  });

  it("saves a record and reads the same record back", async () => {
    const { registry, values } = createRegistry();
    const put = await registry.fetch(putSettingsRequest(RECORD));
    expect(put.status).toBe(200);
    await expect(put.json()).resolves.toEqual({ saved: true });
    expect(values.get("operator-settings")).toEqual(RECORD);

    const get = await registry.fetch(getSettingsRequest());
    await expect(get.json()).resolves.toEqual({ settings: RECORD });
  });

  it("a later save replaces the earlier one — latest save wins", async () => {
    const { registry } = createRegistry();
    await registry.fetch(putSettingsRequest(RECORD));
    const newer = {
      settings: { bloom: 0.5, theme: "green" },
      updatedAt: "2026-11-21T19:30:00.000Z",
    };
    await registry.fetch(putSettingsRequest(newer));
    const get = await registry.fetch(getSettingsRequest());
    await expect(get.json()).resolves.toEqual({ settings: newer });
  });

  it("rejects malformed records instead of storing them", async () => {
    const { registry, values } = createRegistry();
    for (const bad of [
      { settings: "not-an-object", updatedAt: "2026-11-21T18:00:00.000Z" },
      { settings: { bloom: 0 } },
      { updatedAt: "2026-11-21T18:00:00.000Z" },
      { settings: [1, 2, 3], updatedAt: "2026-11-21T18:00:00.000Z" },
      null,
    ]) {
      const response = await registry.fetch(putSettingsRequest(bad));
      expect(response.status).toBe(400);
    }
    expect(values.has("operator-settings")).toBe(false);
  });
});
