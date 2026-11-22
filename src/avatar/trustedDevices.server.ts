/**
 * TRUSTED DEVICES — the operator's device + IP confirmation layer
 * (Part 8, Domenick's order 2026-11-21).
 *
 * WHAT IT IS: a convenience + signal layer ON TOP of the existing
 * operator auth (Supabase password + TOTP MFA + the operator
 * registry). After a FULLY verified sign-in (password + MFA, i.e.
 * verifySupabaseOperatorSession returns authorized), this device is
 * remembered server-side: a hashed device token + the IP it signed
 * in from. On return, the sign-in screen can honestly say "this
 * device is confirmed" and present no extra steps or checkboxes.
 *
 * WHAT IT IS NOT: it never mints a session, never skips the
 * password, and never skips the authenticator code. A device token
 * alone authorizes NOTHING — every management call below re-verifies
 * the caller's operator session first, exactly like the gate log.
 * Domenick's guardrail, kept: recognition must never weaken the
 * gate. (Skipping TOTP on a trusted device WOULD weaken it, so it
 * is not done — it is flagged for his explicit decision instead.)
 *
 * Fail-closed rules:
 *  - Unknown token, wrong IP, or an IP we cannot determine
 *    ("unknown") is NOT trusted — full verification applies.
 *  - A device is only registered after an authorized verification.
 *  - The raw device token is never stored; only its SHA-256 hash.
 *  - The list is revocable from the operator's Settings.
 *
 * Storage follows the localOperatorRegistry pattern: a JSON file
 * under ~/.local/share/augie (env override AUGIE_TRUSTED_DEVICES_PATH),
 * written atomically (tmp + rename) with serialized writes.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { clientIpFromRequest } from "./gateLogStore.server";

export interface TrustedDeviceEntry {
  id: string;
  tokenHash: string;
  ip: string;
  userAgent: string;
  firstSeen: string;
  lastSeen: string;
}

export type TrustedDeviceView = Omit<TrustedDeviceEntry, "tokenHash">;

const MAX_DEVICES = 10;

export function trustedDevicesStorePath(
  env: Record<string, string | undefined> = process.env,
): string {
  const override = env["AUGIE_TRUSTED_DEVICES_PATH"]?.trim();
  if (override) return override;
  const home = env["HOME"]?.trim() || "/home/blackhatter";
  return `${home}/.local/share/augie/trusted-devices.json`;
}

type Fs = typeof import("node:fs/promises");
type Crypto = typeof import("node:crypto");

let writeChain: Promise<void> = Promise.resolve();

async function loadEntries(storePath: string): Promise<TrustedDeviceEntry[]> {
  try {
    const fs: Fs = await import("node:fs/promises");
    const raw = await fs.readFile(storePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is TrustedDeviceEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as TrustedDeviceEntry).id === "string" &&
        typeof (entry as TrustedDeviceEntry).tokenHash === "string" &&
        typeof (entry as TrustedDeviceEntry).ip === "string",
    );
  } catch {
    return [];
  }
}

async function saveEntries(storePath: string, entries: TrustedDeviceEntry[]): Promise<void> {
  const fs: Fs = await import("node:fs/promises");
  const path = await import("node:path");
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  const temporaryPath = `${storePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, storePath);
}

function mutate<T>(storePath: string, fn: (entries: TrustedDeviceEntry[]) => Promise<T>): Promise<T> {
  const run = writeChain.then(async () => {
    const entries = await loadEntries(storePath);
    const result = await fn(entries);
    await saveEntries(storePath, entries);
    return result;
  });
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function hashDeviceToken(token: string): Promise<string> {
  const crypto: Crypto = await import("node:crypto");
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function usableIp(ip: string | null | undefined): string | null {
  const trimmed = (ip ?? "").trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return null;
  return trimmed;
}

/** Is this exact device token + IP pair confirmed? Fail-closed on
 *  empty tokens and undeterminable IPs. */
export async function checkTrustedDevice(
  token: string,
  ip: string | null | undefined,
  storePath: string = trustedDevicesStorePath(),
): Promise<{ trusted: boolean; deviceId?: string }> {
  const goodIp = usableIp(ip);
  if (!token || token.length < 16 || !goodIp) return { trusted: false };
  const tokenHash = await hashDeviceToken(token);
  const entries = await loadEntries(storePath);
  const found = entries.find((entry) => entry.tokenHash === tokenHash && entry.ip === goodIp);
  return found ? { trusted: true, deviceId: found.id } : { trusted: false };
}

/** Remember a device after a fully verified sign-in. Refuses to
 *  register when the IP cannot be determined — a device we cannot
 *  tie to an address is not confirmed, by design. */
export async function registerTrustedDevice(
  device: { token: string; ip: string | null | undefined; userAgent?: string },
  storePath: string = trustedDevicesStorePath(),
): Promise<TrustedDeviceView | null> {
  const goodIp = usableIp(device.ip);
  if (!device.token || device.token.length < 16 || !goodIp) return null;
  const tokenHash = await hashDeviceToken(device.token);
  const crypto: Crypto = await import("node:crypto");
  const now = new Date().toISOString();
  return mutate(storePath, async (entries) => {
    const existing = entries.find((entry) => entry.tokenHash === tokenHash);
    if (existing) {
      existing.ip = goodIp;
      existing.userAgent = device.userAgent?.slice(0, 200) ?? existing.userAgent;
      existing.lastSeen = now;
      return toView(existing);
    }
    const entry: TrustedDeviceEntry = {
      id: crypto.randomUUID(),
      tokenHash,
      ip: goodIp,
      userAgent: (device.userAgent ?? "").slice(0, 200),
      firstSeen: now,
      lastSeen: now,
    };
    entries.push(entry);
    entries.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
    entries.splice(MAX_DEVICES);
    return toView(entry);
  });
}

function toView(entry: TrustedDeviceEntry): TrustedDeviceView {
  const { tokenHash: _hidden, ...view } = entry;
  return view;
}

export async function listTrustedDevices(
  storePath: string = trustedDevicesStorePath(),
): Promise<TrustedDeviceView[]> {
  const entries = await loadEntries(storePath);
  return entries.map(toView);
}

export async function revokeTrustedDevice(
  id: string,
  storePath: string = trustedDevicesStorePath(),
): Promise<boolean> {
  return mutate(storePath, async (entries) => {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    entries.splice(index, 1);
    return true;
  });
}

/**
 * The fail-closed gate the confirm endpoint runs through: a device
 * is registered ONLY when the caller's operator session verified as
 * authorized (password + MFA + registry). Anything less writes
 * nothing.
 */
export async function registerIfAuthorized(
  verification: { authorized: boolean },
  device: { token: string; ip: string | null | undefined; userAgent?: string },
  storePath: string = trustedDevicesStorePath(),
): Promise<{ registered: boolean; device: TrustedDeviceView | null }> {
  if (!verification.authorized) return { registered: false, device: null };
  const view = await registerTrustedDevice(device, storePath);
  return { registered: view !== null, device: view };
}

/* ---------------- server functions (operator-verified) ---------------- */

type TokenInput = { token: string };
type ConfirmInput = { token: string; accessToken: string };
type AccessInput = { accessToken: string };
type RevokeInput = { accessToken: string; deviceId: string };

function isToken(value: unknown): value is string {
  return typeof value === "string" && value.length >= 16 && value.length <= 512;
}

function isAccessToken(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 16_384;
}

/** Public-by-design status probe: answers only "is THIS token+IP
 *  confirmed" for the caller's own device token. It grants nothing. */
export const getTrustedDeviceStatus = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (typeof input !== "object" || input === null || !isToken((input as TokenInput).token)) {
      throw new Error("Invalid device status request.");
    }
    return input as TokenInput;
  })
  .handler(async ({ data }): Promise<{ trusted: boolean; ip: string }> => {
    const request = getRequest();
    const ip = clientIpFromRequest(request);
    const result = await checkTrustedDevice(data.token, ip);
    return { trusted: result.trusted, ip };
  });

/** Called by the gate right after a fully verified sign-in. */
export const confirmTrustedDevice = createServerFn({ method: "POST" })
  .validator((input: unknown): ConfirmInput => {
    if (
      typeof input !== "object" ||
      input === null ||
      !isToken((input as ConfirmInput).token) ||
      !isAccessToken((input as ConfirmInput).accessToken)
    ) {
      throw new Error("Invalid device confirmation request.");
    }
    return input as ConfirmInput;
  })
  .handler(async ({ data }): Promise<{ registered: boolean }> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    const request = getRequest();
    const result = await registerIfAuthorized(verification, {
      token: data.token,
      ip: clientIpFromRequest(request),
      userAgent: request.headers.get("user-agent") ?? "",
    });
    return { registered: result.registered };
  });

export const getTrustedDevices = createServerFn({ method: "POST" })
  .validator((input: unknown): AccessInput => {
    if (typeof input !== "object" || input === null || !isAccessToken((input as AccessInput).accessToken)) {
      throw new Error("Invalid trusted devices request.");
    }
    return input as AccessInput;
  })
  .handler(
    async ({ data }): Promise<{ authorized: boolean; devices: TrustedDeviceView[] }> => {
      const verification = await verifySupabaseOperatorSession({
        data: { accessToken: data.accessToken },
      });
      if (!verification.authorized) return { authorized: false, devices: [] };
      return { authorized: true, devices: await listTrustedDevices() };
    },
  );

export const revokeTrustedDeviceFn = createServerFn({ method: "POST" })
  .validator((input: unknown): RevokeInput => {
    if (
      typeof input !== "object" ||
      input === null ||
      !isAccessToken((input as RevokeInput).accessToken) ||
      typeof (input as RevokeInput).deviceId !== "string" ||
      (input as RevokeInput).deviceId.length === 0
    ) {
      throw new Error("Invalid device revoke request.");
    }
    return input as RevokeInput;
  })
  .handler(async ({ data }): Promise<{ authorized: boolean; revoked: boolean }> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) return { authorized: false, revoked: false };
    return { authorized: true, revoked: await revokeTrustedDevice(data.deviceId) };
  });
