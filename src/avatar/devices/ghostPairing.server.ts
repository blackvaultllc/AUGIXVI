/**
 * GHOST PROTOCOL ONE — PAIRING (Part 23, node-only, server-side).
 *
 * The phone app is the owner's own embedded companion, not a browser,
 * and it reports what ITS radio sees. The core must only believe the
 * owner's phone — so a phone sightings report is accepted only when
 * BOTH hold:
 *
 * 1. The request comes from a private network address — the LAN or
 *    the Tailscale tailnet (100.64.0.0/10). Nothing from the public
 *    internet can tell Augie what the air looks like.
 * 2. It carries the pairing token in the `x-ghost-token` header. The
 *    token lives in exactly one place on the core machine:
 *    ~/.local/share/augie/ghost-token.txt (or the AUGIE_GHOST_TOKEN
 *    env var where a service sets it). The operator creates it once
 *    with `openssl rand -hex 16` and types it into the app once.
 *
 * The phone is never trusted to rewrite the Parrot watcher's own
 * report — its sightings land in the separate phoneSightings slot and
 * only merge into scan-state (see wifiWatch.ts).
 */
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const MIN_TOKEN_LENGTH = 8;

/** True for loopback, RFC-1918, and the Tailscale CGNAT range. */
export function isPrivateOrTailnetIp(ip: string): boolean {
  const v = ip.trim();
  if (!v) return false;
  if (v === "127.0.0.1" || v === "::1" || v === "localhost") return true;
  const parts = v.split(".");
  if (parts.length !== 4 || parts.some((p) => !/^\d+$/.test(p))) return false;
  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  // Tailscale tailnet: 100.64.0.0/10 (100.64–100.127).
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

async function readTokenFromFile(): Promise<string | null> {
  try {
    const raw = await fs.readFile(join(homedir(), ".local", "share", "augie", "ghost-token.txt"), "utf8");
    const token = raw.trim();
    return token.length >= MIN_TOKEN_LENGTH ? token : null;
  } catch {
    return null;
  }
}

/** The pairing token the core expects, or null when none is set. */
export async function loadGhostPairingToken(): Promise<string | null> {
  const env = (process.env["AUGIE_GHOST_TOKEN"] ?? "").trim();
  if (env.length >= MIN_TOKEN_LENGTH) return env;
  return readTokenFromFile();
}

/**
 * Constant-ish comparison so a token cannot be probed byte-by-byte
 * through timing. Short or missing tokens never match.
 */
export function ghostTokensMatch(expected: string, presented: string | null | undefined): boolean {
  if (!presented) return false;
  if (expected.length < MIN_TOKEN_LENGTH || presented.length < MIN_TOKEN_LENGTH) return false;
  if (expected.length !== presented.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ presented.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Authorize one phone-sightings request. Returns an error string
 * when it must be refused, null when it is allowed in.
 */
export async function authorizePhoneSightings(
  request: Request,
  clientIp: string,
): Promise<string | null> {
  if (!isPrivateOrTailnetIp(clientIp)) {
    return "phone sightings are accepted only from the owner's own network";
  }
  const token = await loadGhostPairingToken();
  if (!token) {
    return "no Ghost Protocol One pairing token is set on the core";
  }
  const presented = request.headers.get("x-ghost-token");
  if (!ghostTokensMatch(token, presented)) {
    return "bad or missing pairing token";
  }
  return null;
}
