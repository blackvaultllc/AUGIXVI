import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkTrustedDevice,
  listTrustedDevices,
  registerIfAuthorized,
  registerTrustedDevice,
  revokeTrustedDevice,
} from "@/avatar/trustedDevices.server";
import { learnerCanAccess } from "@/avatar/learner/learnerProfile";

/**
 * PART 8 — trusted devices (operator side). The layer is a signal +
 * convenience on top of password + MFA: it must fail closed in
 * every direction — unknown device, wrong IP, no IP, revoked, and
 * above all: no registration without an authorized verification.
 */
const TOKEN = "device-token-1234567890abcdef";
const TOKEN2 = "device-token-fedcba0987654321";

async function tempStore(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "augie-trusted-"));
  return join(dir, "trusted-devices.json");
}

describe("trusted device registry", () => {
  it("an unknown device gets no trust — full verification applies", async () => {
    const store = await tempStore();
    expect(await checkTrustedDevice(TOKEN, "100.67.177.55", store)).toEqual({ trusted: false });
    expect(await listTrustedDevices(store)).toEqual([]);
  });

  it("a device confirmed from one IP is not trusted from another", async () => {
    const store = await tempStore();
    await registerTrustedDevice({ token: TOKEN, ip: "100.67.177.55", userAgent: "test" }, store);
    expect((await checkTrustedDevice(TOKEN, "100.67.177.55", store)).trusted).toBe(true);
    expect((await checkTrustedDevice(TOKEN, "10.0.0.99", store)).trusted).toBe(false);
    expect((await checkTrustedDevice(TOKEN2, "100.67.177.55", store)).trusted).toBe(false);
  });

  it("fails closed when the IP cannot be determined", async () => {
    const store = await tempStore();
    expect(await registerTrustedDevice({ token: TOKEN, ip: "unknown" }, store)).toBeNull();
    expect(await registerTrustedDevice({ token: TOKEN, ip: "" }, store)).toBeNull();
    await registerTrustedDevice({ token: TOKEN, ip: "100.67.177.55" }, store);
    expect((await checkTrustedDevice(TOKEN, "unknown", store)).trusted).toBe(false);
    expect((await checkTrustedDevice(TOKEN, null, store)).trusted).toBe(false);
    expect((await checkTrustedDevice("", "100.67.177.55", store)).trusted).toBe(false);
  });

  it("stores only the token's hash — the raw token is never on disk", async () => {
    const store = await tempStore();
    await registerTrustedDevice({ token: TOKEN, ip: "100.67.177.55" }, store);
    const raw = await readFile(store, "utf8");
    expect(raw).not.toContain(TOKEN);
    const [device] = await listTrustedDevices(store);
    expect(device).toMatchObject({ ip: "100.67.177.55" });
    expect(device).not.toHaveProperty("tokenHash");
  });

  it("revocation returns the device to full verification", async () => {
    const store = await tempStore();
    const view = await registerTrustedDevice({ token: TOKEN, ip: "100.67.177.55" }, store);
    expect(view).not.toBeNull();
    expect(await revokeTrustedDevice(view!.id, store)).toBe(true);
    expect((await checkTrustedDevice(TOKEN, "100.67.177.55", store)).trusted).toBe(false);
    expect(await revokeTrustedDevice(view!.id, store)).toBe(false);
  });

  it("registration is impossible without an authorized verification — auth wrong, nothing written", async () => {
    const store = await tempStore();
    const denied = await registerIfAuthorized(
      { authorized: false },
      { token: TOKEN, ip: "100.67.177.55" },
      store,
    );
    expect(denied.registered).toBe(false);
    expect(await listTrustedDevices(store)).toEqual([]);
    const allowed = await registerIfAuthorized(
      { authorized: true },
      { token: TOKEN, ip: "100.67.177.55" },
      store,
    );
    expect(allowed.registered).toBe(true);
    expect((await checkTrustedDevice(TOKEN, "100.67.177.55", store)).trusted).toBe(true);
  });

  it("re-registering the same device from a new IP updates it after full verification", async () => {
    const store = await tempStore();
    await registerTrustedDevice({ token: TOKEN, ip: "100.67.177.55" }, store);
    await registerTrustedDevice({ token: TOKEN, ip: "10.0.0.79" }, store);
    expect(await listTrustedDevices(store)).toHaveLength(1);
    expect((await checkTrustedDevice(TOKEN, "10.0.0.79", store)).trusted).toBe(true);
    expect((await checkTrustedDevice(TOKEN, "100.67.177.55", store)).trusted).toBe(false);
  });
});

describe("the trusted-device layer never touches her wall", () => {
  it("operator surfaces stay outside her allowlist, trusted or not", () => {
    for (const path of ["/avatar", "/avatar/cube", "/avatar/world", "/api/transcribe"]) {
      expect(learnerCanAccess(path), path).toBe(false);
    }
  });
});
