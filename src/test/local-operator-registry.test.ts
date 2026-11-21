import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OperatorRegistry } from "@/avatar/OperatorRegistry";
import { createLocalOperatorRegistry } from "@/avatar/localOperatorRegistry.server";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

let directory: string;
let filePath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "augie-operator-registry-"));
  filePath = join(directory, "operator-registry.json");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function createRegistry(): Promise<OperatorRegistry> {
  const registry = await createLocalOperatorRegistry(directory, filePath);
  if (!registry) throw new Error("Local operator registry was unavailable.");
  return registry;
}

function registryRequest(path: string, userId?: string): Request {
  if (userId === undefined) return new Request(`https://operator-registry${path}`);
  return new Request(`https://operator-registry${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

describe("local operator registry fallback", () => {
  it("starts unclaimed and rejects malformed claims", async () => {
    const registry = await createRegistry();

    const statusResponse = await registry.fetch(registryRequest("/status"));
    await expect(statusResponse.json()).resolves.toEqual({ claimed: false });

    const malformedResponse = await registry.fetch(registryRequest("/authorize", "not-a-user-id"));
    expect(malformedResponse.status).toBe(400);

    const afterResponse = await registry.fetch(registryRequest("/status"));
    await expect(afterResponse.json()).resolves.toEqual({ claimed: false });
  });

  it("persists the first claim to disk across instances", async () => {
    const first = await createRegistry();
    const claimResponse = await first.fetch(registryRequest("/authorize", ownerId));
    await expect(claimResponse.json()).resolves.toEqual({ authorized: true });

    const onDisk: unknown = JSON.parse(await readFile(filePath, "utf8"));
    expect(onDisk).toEqual({ "operator-user-id": ownerId });

    // A new instance over the same file stands in for a server restart.
    const second = await createRegistry();
    const statusResponse = await second.fetch(registryRequest("/status"));
    await expect(statusResponse.json()).resolves.toEqual({ claimed: true });

    const ownerCheck = await second.fetch(registryRequest("/check", ownerId));
    await expect(ownerCheck.json()).resolves.toEqual({ claimed: true, isOwner: true });

    const otherCheck = await second.fetch(registryRequest("/check", otherId));
    await expect(otherCheck.json()).resolves.toEqual({ claimed: true, isOwner: false });

    const otherAuthorize = await second.fetch(registryRequest("/authorize", otherId));
    await expect(otherAuthorize.json()).resolves.toEqual({ authorized: false });
  });
});
