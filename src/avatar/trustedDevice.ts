/**
 * The operator's device token — client half of the trusted-device
 * layer (Part 8). A random token kept in this browser's localStorage
 * identifies the DEVICE; the server stores only its hash, paired
 * with the IP a fully verified sign-in came from. The token alone
 * opens nothing: it is a name tag the sign-in screen can ask about,
 * never a key.
 */
import {
  confirmTrustedDevice,
  getTrustedDeviceStatus,
  getTrustedDevices,
  revokeTrustedDeviceFn,
  type TrustedDeviceView,
} from "./trustedDevices.server";

export const DEVICE_TOKEN_KEY = "augi.operator.device-token.v1";

const AUTH_CLIENT_SLOT = "__augixviOperatorAuthClient";

/** The current operator session's access token, from the auth client
 *  the gate stashed on the window. Used by every operator-verified
 *  panel (trusted devices, office analytics, the law desk). */
export async function getOperatorAccessToken(): Promise<string | null> {
  try {
    const client = (
      window as unknown as Record<
        string,
        { auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null } }> } } | null | undefined
      >
    )[AUTH_CLIENT_SLOT];
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export function getOrCreateDeviceToken(): string {
  try {
    const existing = globalThis.localStorage?.getItem(DEVICE_TOKEN_KEY);
    if (existing && existing.length >= 16) return existing;
    const token =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `device-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    globalThis.localStorage?.setItem(DEVICE_TOKEN_KEY, token);
    return token;
  } catch {
    return "";
  }
}

export async function fetchDeviceStatus(): Promise<{ trusted: boolean; ip: string } | null> {
  const token = getOrCreateDeviceToken();
  if (!token) return null;
  try {
    return await getTrustedDeviceStatus({ data: { token } });
  } catch {
    return null;
  }
}

/** Best-effort: called by the gate right after a fully verified
 *  sign-in so this device is confirmed for next time. */
export async function confirmThisDevice(accessToken: string): Promise<void> {
  const token = getOrCreateDeviceToken();
  if (!token || !accessToken) return;
  try {
    await confirmTrustedDevice({ data: { token, accessToken } });
  } catch {
    // Confirmation is a convenience layer; a failure here never
    // blocks or changes the sign-in itself.
  }
}

export async function fetchTrustedDevices(
  accessToken: string,
): Promise<{ authorized: boolean; devices: TrustedDeviceView[] }> {
  try {
    return await getTrustedDevices({ data: { accessToken } });
  } catch {
    return { authorized: false, devices: [] };
  }
}

export async function revokeDevice(
  accessToken: string,
  deviceId: string,
): Promise<{ authorized: boolean; revoked: boolean }> {
  try {
    return await revokeTrustedDeviceFn({ data: { accessToken, deviceId } });
  } catch {
    return { authorized: false, revoked: false };
  }
}
