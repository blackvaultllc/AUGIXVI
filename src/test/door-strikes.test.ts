import { describe, expect, it } from "vitest";
import {
  applyDoorStrike,
  doorRestrictionsList,
  isDoorIpUsable,
  releaseDoorIp,
  sanitizeDoorStrikes,
  DOOR_STRIKE_LIMIT,
  type DoorStrikesMap,
} from "@/avatar/doorStrikes";
import { resolveGodKey } from "@/avatar/loginDoor";
import { OperatorRegistry } from "@/avatar/OperatorRegistry";
import { handleDoorRestriction, isDoorPageRequest } from "@/avatar/doorRestriction.server";

/**
 * THE CUBE IS THE SECURITY (owner order 2026-11-28 ~00:50
 * CST): wrong god-names at the front door are counted per
 * address, in silence; the third raises the cube and
 * restricts the address until the Captain releases it. These
 * tests pin the law in the plain module, in the registry
 * endpoints that hold the record (the Durable Object online,
 * the local file on the core — the same class), and at the
 * server entry, where a restricted address's page request is
 * answered with black before the app is reached.
 */

const IP = "203.0.113.7";
const NOW = "2026-11-28T06:50:00.000Z";
const LATER = "2026-11-28T06:51:00.000Z";

describe("door strikes — the law", () => {
  it("counts wrong names silently: strikes one and two restrict nothing", () => {
    let map: DoorStrikesMap = {};
    const first = applyDoorStrike(map, IP, NOW);
    map = first.map;
    expect(first).toMatchObject({ strikes: 1, restricted: false });
    const second = applyDoorStrike(map, IP, LATER);
    expect(second).toMatchObject({ strikes: 2, restricted: false });
    expect(second.map[IP]?.firstStrikeAt).toBe(NOW);
    expect(second.map[IP]?.lastStrikeAt).toBe(LATER);
    expect(second.map[IP]?.restrictedAt).toBeNull();
  });

  it("the third wrong name restricts the address", () => {
    let map: DoorStrikesMap = {};
    for (let i = 0; i < DOOR_STRIKE_LIMIT; i += 1) {
      map = applyDoorStrike(map, IP, LATER).map;
    }
    const record = map[IP];
    expect(record?.strikes).toBe(DOOR_STRIKE_LIMIT);
    expect(record?.restrictedAt).toBe(LATER);
    // Further wrong names keep it restricted; the count stands.
    const fourth = applyDoorStrike(map, IP, LATER);
    expect(fourth.restricted).toBe(true);
    expect(fourth.strikes).toBe(DOOR_STRIKE_LIMIT + 1);
  });

  it("the release strikes the record from the book", () => {
    let map: DoorStrikesMap = {};
    for (let i = 0; i < DOOR_STRIKE_LIMIT; i += 1) {
      map = applyDoorStrike(map, IP, NOW).map;
    }
    expect(doorRestrictionsList(map)).toHaveLength(1);
    const released = releaseDoorIp(map, IP);
    expect(released.released).toBe(true);
    expect(released.map[IP]).toBeUndefined();
    expect(doorRestrictionsList(released.map)).toHaveLength(0);
    // Releasing an address with no record releases nothing.
    expect(releaseDoorIp(released.map, IP).released).toBe(false);
  });

  it("the restriction list holds only restricted addresses", () => {
    let map: DoorStrikesMap = {};
    map = applyDoorStrike(map, "203.0.113.8", NOW).map;
    for (let i = 0; i < DOOR_STRIKE_LIMIT; i += 1) {
      map = applyDoorStrike(map, IP, NOW).map;
    }
    const list = doorRestrictionsList(map);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ ip: IP, strikes: DOOR_STRIKE_LIMIT, restrictedAt: NOW });
  });

  it("an address that cannot be named is never struck", () => {
    expect(isDoorIpUsable("unknown")).toBe(false);
    expect(isDoorIpUsable("")).toBe(false);
    expect(isDoorIpUsable("203.0.113.7")).toBe(true);
    expect(isDoorIpUsable("2001:db8::1")).toBe(true);
    expect(isDoorIpUsable("has space")).toBe(false);
    expect(isDoorIpUsable(42)).toBe(false);
  });

  it("sanitize drops malformed records and unusable addresses", () => {
    const cleaned = sanitizeDoorStrikes({
      [IP]: { strikes: 2, firstStrikeAt: NOW, lastStrikeAt: LATER, restrictedAt: null },
      unknown: { strikes: 9, firstStrikeAt: NOW, lastStrikeAt: NOW, restrictedAt: NOW },
      "198.51.100.3": { strikes: "three", firstStrikeAt: NOW, lastStrikeAt: NOW, restrictedAt: null },
      "198.51.100.4": null,
    });
    expect(Object.keys(cleaned)).toEqual([IP]);
    expect(sanitizeDoorStrikes(null)).toEqual({});
    expect(sanitizeDoorStrikes([1, 2])).toEqual({});
  });

  it("only registered god names are keys — every other name is a wrong name", () => {
    // The seated keys resolve…
    expect(resolveGodKey("Anubis")?.door).toBe("operator");
    expect(resolveGodKey("Hathor")?.door).toBe("violet");
    expect(resolveGodKey("Osiris")?.door).toBe("learner");
    // …and nothing else does: gods registered to nobody (Montu
    // stands in the structure but no seat carries him as a
    // key), other pantheons, near-misses, and the Captain's own
    // names — all open nothing, so all count as wrong names.
    for (const name of ["Montu", "Zeus", "Ra", "Anubis2", "Zero", "Domenick", "Horus", ""]) {
      expect(resolveGodKey(name), name).toBeNull();
    }
  });
});

/* ------------- the registry endpoints (the record itself) ------------- */

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

function registryRequest(path: string, body?: unknown): Request {
  return new Request(`https://operator-registry${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("door strikes — the registry record", () => {
  it("counts through the endpoints and restricts on the third", async () => {
    const { registry } = createRegistry();
    const status = async () =>
      (await (
        await registry.fetch(registryRequest("/door-status", { ip: IP }))
      ).json()) as { strikes: number; restricted: boolean };
    const strike = async () =>
      (await (
        await registry.fetch(registryRequest("/door-strike", { ip: IP }))
      ).json()) as { strikes: number; restricted: boolean };

    await expect(status()).resolves.toEqual({ strikes: 0, restricted: false });
    await expect(strike()).resolves.toEqual({ strikes: 1, restricted: false });
    await expect(strike()).resolves.toEqual({ strikes: 2, restricted: false });
    await expect(strike()).resolves.toEqual({ strikes: 3, restricted: true });
    await expect(status()).resolves.toEqual({ strikes: 3, restricted: true });
  });

  it("lists restricted addresses and honors the Captain's release", async () => {
    const { registry } = createRegistry();
    for (let i = 0; i < DOOR_STRIKE_LIMIT; i += 1) {
      await registry.fetch(registryRequest("/door-strike", { ip: IP }));
    }
    const list = (await (
      await registry.fetch(registryRequest("/door-restrictions"))
    ).json()) as { restrictions: Array<{ ip: string; strikes: number }> };
    expect(list.restrictions).toHaveLength(1);
    expect(list.restrictions[0]).toMatchObject({ ip: IP, strikes: DOOR_STRIKE_LIMIT });

    const release = (await (
      await registry.fetch(registryRequest("/door-release", { ip: IP }))
    ).json()) as { released: boolean };
    expect(release.released).toBe(true);

    const status = (await (
      await registry.fetch(registryRequest("/door-status", { ip: IP }))
    ).json()) as { strikes: number; restricted: boolean };
    expect(status).toEqual({ strikes: 0, restricted: false });
    const after = (await (
      await registry.fetch(registryRequest("/door-restrictions"))
    ).json()) as { restrictions: unknown[] };
    expect(after.restrictions).toHaveLength(0);
  });

  it("refuses an address it cannot name, and records nothing for it", async () => {
    const { registry, values } = createRegistry();
    const response = await registry.fetch(registryRequest("/door-strike", { ip: "unknown" }));
    expect(response.status).toBe(400);
    expect(values.has("door-strikes")).toBe(false);
  });
});

/* ------------- the server entry (request-time enforcement) ------------- */

function pageRequest(ip: string, path = "/"): Request {
  return new Request(`https://augixvi.example${path}`, {
    headers: { "cf-connecting-ip": ip },
  });
}

function envWithRestriction(restricted: boolean) {
  return {
    OSIRIS_OPERATOR_REGISTRY: {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async () =>
          new Response(JSON.stringify({ strikes: restricted ? 3 : 0, restricted }), {
            headers: { "content-type": "application/json" },
          }),
      }),
    },
  };
}

describe("door restriction — the entry", () => {
  it("recognizes page requests and leaves files and calls alone", () => {
    expect(isDoorPageRequest(pageRequest(IP, "/"))).toBe(true);
    expect(isDoorPageRequest(pageRequest(IP, "/avatar"))).toBe(true);
    expect(isDoorPageRequest(pageRequest(IP, "/violet"))).toBe(true);
    expect(isDoorPageRequest(pageRequest(IP, "/assets/index-abc.js"))).toBe(false);
    expect(isDoorPageRequest(pageRequest(IP, "/favicon.ico"))).toBe(false);
    expect(isDoorPageRequest(pageRequest(IP, "/api/devices/bridge"))).toBe(false);
    expect(
      isDoorPageRequest(
        new Request("https://augixvi.example/", {
          method: "POST",
          headers: { "cf-connecting-ip": IP },
        }),
      ),
    ).toBe(false);
  });

  it("answers a restricted address's page request with black, and nothing else", async () => {
    const response = await handleDoorRestriction(pageRequest(IP), envWithRestriction(true));
    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);
    const body = await response!.text();
    expect(body).toContain("background:#000");
    // No words stand on the black page (the style block is not words).
    expect(
      body
        .replace(/<style[\s\S]*?<\/style>/g, "")
        .replace(/<[^>]*>/g, "")
        .trim(),
    ).toBe("");
  });

  it("lets an unrestricted address through untouched", async () => {
    await expect(
      handleDoorRestriction(pageRequest(IP), envWithRestriction(false)),
    ).resolves.toBeNull();
    // …and a restricted address asking for a file is not this check's business.
    await expect(
      handleDoorRestriction(pageRequest(IP, "/assets/index-abc.js"), envWithRestriction(true)),
    ).resolves.toBeNull();
  });
});
