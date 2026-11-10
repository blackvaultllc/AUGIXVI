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
  let transactionTail: Promise<void> = Promise.resolve();
  const storage: TestStorage = {
    async get<T>(key: string) {
      return values.get(key) as T | undefined;
    },
    async put<T>(key: string, value: T) {
      values.set(key, value);
    },
    transaction<T>(callback: (transaction: TestStorageTransaction) => Promise<T>): Promise<T> {
      const result = transactionTail.then(() => callback(storage));
      transactionTail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
  return { registry: new OperatorRegistry({ storage }), values };
}

function authorizationRequest(userId: string): Request {
  return new Request("https://operator-registry/authorize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

describe("operator registry", () => {
  it("allows exactly one account to win concurrent first claims", async () => {
    const { registry, values } = createRegistry();
    const firstId = "11111111-1111-4111-8111-111111111111";
    const secondId = "22222222-2222-4222-8222-222222222222";

    const responses = await Promise.all([
      registry.fetch(authorizationRequest(firstId)),
      registry.fetch(authorizationRequest(secondId)),
    ]);
    const results = await Promise.all(
      responses.map((response) => response.json() as Promise<{ authorized: boolean }>),
    );

    expect(results.filter((result) => result.authorized)).toHaveLength(1);
    expect([firstId, secondId]).toContain(values.get("operator-user-id"));
  });

  it("keeps the first verified account as the only operator", async () => {
    const { registry } = createRegistry();
    const ownerId = "11111111-1111-4111-8111-111111111111";
    const otherId = "22222222-2222-4222-8222-222222222222";

    const claimResponse = await registry.fetch(authorizationRequest(ownerId));
    const ownerResponse = await registry.fetch(authorizationRequest(ownerId));
    const otherResponse = await registry.fetch(authorizationRequest(otherId));
    const ownerCheckResponse = await registry.fetch(
      new Request("https://operator-registry/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: ownerId }),
      }),
    );
    const otherCheckResponse = await registry.fetch(
      new Request("https://operator-registry/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: otherId }),
      }),
    );
    const statusResponse = await registry.fetch(new Request("https://operator-registry/status"));

    await expect(claimResponse.json()).resolves.toEqual({ authorized: true });
    await expect(ownerResponse.json()).resolves.toEqual({ authorized: true });
    await expect(otherResponse.json()).resolves.toEqual({ authorized: false });
    await expect(ownerCheckResponse.json()).resolves.toEqual({ claimed: true, isOwner: true });
    await expect(otherCheckResponse.json()).resolves.toEqual({ claimed: true, isOwner: false });
    await expect(statusResponse.json()).resolves.toEqual({ claimed: true });
  });

  it("rejects malformed claims without changing the owner", async () => {
    const { registry, values } = createRegistry();
    const response = await registry.fetch(authorizationRequest("not-a-user-id"));

    expect(response.status).toBe(400);
    expect(values.has("operator-user-id")).toBe(false);
  });
});
