/**
 * DEVICE BRIDGE — the generalized Parrot bridge (owner order
 * 2026-11-24: Anubis's full device-setup ability, plan item D).
 *
 * The dog's bridge door (/api/devices/wepwawet) proved the shape;
 * this is the same door for EVERY broadcast device: the caller
 * names a device id, the core looks up that device's registered
 * sender, and the sender airs the frame. A browser cannot
 * advertise; the core machine fires — this module is the contract
 * both sides validate against.
 *
 * THE SAFETY SHAPE, carried over from the dog's door verbatim:
 *   · The sender path comes from the device's PROFILE in the core
 *     registry — never from the request — and it must resolve
 *     UNDER ~/augie-tools/. Anything outside that directory is
 *     refused before anything runs.
 *   · The sender runs as an argv array, never a shell string: the
 *     hex is data, never code.
 *   · --live rides ONLY when the request is live; without it the
 *     sender cannot transmit (practice prints the frame).
 *   · One burst at a time per device (the server half enforces).
 *   · Kill switches in the server environment close the door.
 *
 * This module is pure (no node, no DOM) so the client channel, the
 * server route, and the tests validate the same rules.
 */
import { resolveStateProfile, type DeviceCoreState } from "./deviceStoreCore";
import type { DeviceCommandProfile } from "./commandProfiles";

export const DEVICE_BRIDGE_ROUTE = "/api/devices/bridge";

/** One frame on the wire for this sender family: 23 bytes = 46 hex. */
export const DEVICE_FRAME_HEX_LENGTH = 46;
export const DEVICE_BRIDGE_MIN_HOLD_MS = 50;
export const DEVICE_BRIDGE_MAX_HOLD_MS = 10_000;

export type DeviceBridgeRequest = {
  /** The registry id of the device the frame is for. */
  deviceId: string;
  /** Compact lowercase hex, exactly 46 characters. */
  hex: string;
  holdMs: number;
  live: boolean;
};

/** Validate an untrusted bridge body. Anything off-shape reads as
 *  null and the caller refuses — the bridge never guesses a frame. */
export function sanitizeDeviceBridgeRequest(body: unknown): DeviceBridgeRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const deviceId = record["deviceId"];
  if (typeof deviceId !== "string" || !deviceId.trim() || deviceId.length > 80) return null;
  const rawHex = record["hex"];
  if (typeof rawHex !== "string") return null;
  const hex = rawHex.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  if (hex.length !== DEVICE_FRAME_HEX_LENGTH) return null;
  const rawHold = record["holdMs"];
  const holdMs =
    typeof rawHold === "number" && Number.isFinite(rawHold)
      ? Math.min(
          DEVICE_BRIDGE_MAX_HOLD_MS,
          Math.max(DEVICE_BRIDGE_MIN_HOLD_MS, Math.round(rawHold)),
        )
      : 500;
  return { deviceId: deviceId.trim(), hex, holdMs, live: record["live"] === true };
}

/**
 * Resolve a profile's sender path against the core machine's home.
 * THE ALLOWLIST: the result must live under ~/augie-tools/ —
 * absolute paths, ".." escapes, and anything resolving outside
 * that directory read as null and the bridge refuses. A staged
 * sender is a program the bridge executes; its home is the fence.
 */
export function resolveSenderPath(home: string, senderPath: string): string | null {
  const cleanHome = home.replace(/\/+$/, "");
  if (!cleanHome) return null;
  const raw = senderPath.trim();
  if (!raw) return null;
  const segments = raw.replace(/\\/g, "/").split("/").filter((s) => s !== "" && s !== ".");
  if (segments.some((s) => s === "..")) return null;
  if (!segments.length) return null;
  const toolsRoot = `${cleanHome}/augie-tools`;
  // A relative path is read as relative to ~/augie-tools/ itself
  // (the profile's form: "wepwawet/wepwawet-send.py"). An absolute
  // path is accepted only when it already lives under the root.
  const absolute = raw.startsWith("/")
    ? `/${segments.join("/")}`
    : `${toolsRoot}/${segments.join("/")}`;
  if (absolute !== toolsRoot && !absolute.startsWith(`${toolsRoot}/`)) return null;
  return absolute;
}

/** What the bridge needs to fire for a device, resolved from the
 *  core state: the device, its profile, and the sender's absolute
 *  path — or the refusal, in words. */
export type DeviceSenderResolution =
  | {
      ok: true;
      deviceName: string;
      profile: DeviceCommandProfile;
      senderPath: string;
    }
  | { ok: false; status: number; error: string };

export function resolveDeviceSender(
  state: DeviceCoreState,
  deviceId: string,
  home: string,
): DeviceSenderResolution {
  const device = state.registry.find((d) => d.id === deviceId);
  if (!device) {
    return {
      ok: false,
      status: 404,
      error: `No device with id "${deviceId}" is registered in the core. Nothing was sent.`,
    };
  }
  const resolved = resolveStateProfile(state, device);
  if (!resolved) {
    return {
      ok: false,
      status: 409,
      error: `${device.displayName} has no command profile in the core — there is no sender to fire. Nothing was sent.`,
    };
  }
  const { profile } = resolved;
  if (profile.transport !== "bluetooth-broadcast" || !profile.senderPath) {
    return {
      ok: false,
      status: 409,
      error: `${device.displayName}'s command set (${profile.name}) has no staged broadcast sender — the bridge fires only broadcast profiles with a sender under ~/augie-tools/. Nothing was sent.`,
    };
  }
  const senderPath = resolveSenderPath(home, profile.senderPath);
  if (!senderPath) {
    return {
      ok: false,
      status: 500,
      error: `The sender path on ${device.displayName}'s profile ("${profile.senderPath}") does not resolve under ~/augie-tools/ — the bridge refuses to run anything outside that directory. Nothing was sent.`,
    };
  }
  return { ok: true, deviceName: device.displayName, profile, senderPath };
}

/**
 * The sender invocation for one bridge frame — an argv array, never
 * a shell string. --live rides ONLY when the request is live;
 * without it the sender cannot transmit.
 */
export function senderArgsForDeviceFrame(
  senderPath: string,
  req: Omit<DeviceBridgeRequest, "deviceId">,
): string[] {
  return [
    senderPath,
    "--air-frame",
    req.hex,
    "--hold",
    String(req.holdMs),
    ...(req.live ? ["--live"] : []),
  ];
}
