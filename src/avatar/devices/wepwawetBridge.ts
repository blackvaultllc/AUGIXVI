/**
 * WEPWAWET BRIDGE — the road between the Devices panel and the
 * Parrot's staged sender (operator order 2026-11-24: the Captain
 * runs the dog from inside Augie, without the assistant in the
 * middle).
 *
 * The shape: the panel's broadcast channel POSTs ONE frame at a
 * time to /api/devices/wepwawet on Augie's own server. The server
 * (wepwawetBridge.server.ts) hands the frame to the staged sender
 * script (~/augie-tools/wepwawet/wepwawet-send.py --air-frame),
 * which puts it on air from the Parrot's Bluetooth. A browser
 * cannot advertise; the Parrot fires — this module is the contract
 * both sides validate against.
 *
 * Two modes, the Captain's own switch on the dog's card:
 *   · practice (live=false) — the sender runs WITHOUT --live: it
 *     prints the exact frame it would air and transmits NOTHING.
 *   · live (live=true) — the frame goes on air for real.
 *
 * This module is pure (no node, no DOM) so both the client channel
 * and the server route validate the same rules, and tests pin them.
 */

export const WEPWAWET_BRIDGE_ROUTE = "/api/devices/wepwawet";

/** One frame on the wire: 23 bytes = 46 hex characters. */
export const WEPWAWET_FRAME_HEX_LENGTH = 46;

export const WEPWAWET_BRIDGE_MIN_HOLD_MS = 50;
export const WEPWAWET_BRIDGE_MAX_HOLD_MS = 10_000;

export type WepwawetBridgeRequest = {
  /** Compact lowercase hex, exactly 46 characters. */
  hex: string;
  holdMs: number;
  live: boolean;
};

/**
 * Validate an untrusted bridge body. Anything off-shape reads as
 * null and the caller refuses — the bridge never guesses a frame.
 */
export function sanitizeBridgeRequest(body: unknown): WepwawetBridgeRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const rawHex = record["hex"];
  if (typeof rawHex !== "string") return null;
  const hex = rawHex.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  if (hex.length !== WEPWAWET_FRAME_HEX_LENGTH) return null;
  const rawHold = record["holdMs"];
  const holdMs =
    typeof rawHold === "number" && Number.isFinite(rawHold)
      ? Math.min(
          WEPWAWET_BRIDGE_MAX_HOLD_MS,
          Math.max(WEPWAWET_BRIDGE_MIN_HOLD_MS, Math.round(rawHold)),
        )
      : 500;
  return { hex, holdMs, live: record["live"] === true };
}

/**
 * Who may knock on the bridge door: this machine itself, the
 * tailnet (100.64.0.0/10 — the Captain's own devices), and private
 * LAN ranges. A public address is never a bridge client: the door
 * executes a local program, so it stays on his own networks.
 */
export function bridgeClientAllowed(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const addr = ip.trim().toLowerCase().replace(/^::ffff:/, "");
  if (addr === "127.0.0.1" || addr === "::1" || addr === "localhost") return true;
  if (addr.startsWith("fe80:") || addr.startsWith("fc") || addr.startsWith("fd")) {
    return true; // IPv6 link-local / unique-local
  }
  const parts = addr.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums as [number, number, number, number];
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // tailnet CGNAT
  return false;
}

/**
 * The sender invocation for one bridge frame — an argv array, never
 * a shell string: the hex is data, never code. --live rides ONLY
 * when the request is live; without it the sender cannot transmit.
 */
export function senderArgsForFrame(
  senderPath: string,
  req: WepwawetBridgeRequest,
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
