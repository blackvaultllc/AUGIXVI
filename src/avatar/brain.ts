/**
 * Where AUGI's brain lives: the Ollama address the avatar talks to.
 *
 * On the PC itself that is the same machine (the default). On a phone,
 * it is the computer's address on the home network or Tailscale — the
 * phone is a face for the one Augie on the PC, never a second copy.
 * The founder types the address once in Settings; it is remembered on
 * that device only (localStorage). Plain module, unit-testable, per
 * the repo's avatar rules.
 */

export const DEFAULT_BRAIN_URL = "http://localhost:11434";
export const BRAIN_STORAGE_KEY = "augi.brain.address.v1";

const HOST_RE =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;

/**
 * Turn what a person types into a base URL, or null when it cannot be
 * one. Accepts "192.168.1.50", "192.168.1.50:11434",
 * "http://192.168.1.50:11434", a Tailscale address or name, or a plain
 * hostname. A missing port means Ollama's 11434. An empty string means
 * "this device" — the default. Paths are rejected: the brain address
 * is a host, not a page.
 */
export function normalizeBrainAddress(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_BRAIN_URL;
  const noTrailingSlash = trimmed.replace(/\/+$/, "");
  const withScheme = /^https?:\/\//i.test(noTrailingSlash)
    ? noTrailingSlash
    : `http://${noTrailingSlash}`;
  const m = withScheme.match(/^(https?):\/\/([^/:?#]+)(?::(\d{1,5}))?$/i);
  if (!m) return null;
  const scheme = (m[1] ?? "http").toLowerCase();
  const host = m[2] ?? "";
  if (!HOST_RE.test(host)) return null;
  const port = m[3] ? Number(m[3]) : 11434;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return `${scheme}://${host}:${port}`;
}

type StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void };

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * The brain address for a surface that has saved nothing: when the app
 * itself was served from another machine (the phone loading Augie from
 * the Parrot over Tailscale/LAN), the brain lives on THAT machine —
 * never on localhost, which on a phone means the phone itself (the
 * Part 30 defect). On the core machine itself the page host IS
 * localhost, and the default stands.
 */
export function defaultBrainForPageHost(pageHost: string | null | undefined): string {
  if (!pageHost) return DEFAULT_BRAIN_URL;
  const host = pageHost.split(":")[0]?.trim().toLowerCase() ?? "";
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
    return DEFAULT_BRAIN_URL;
  }
  return `http://${host}:11434`;
}

function currentPageHost(): string | null {
  try {
    return typeof window !== "undefined" ? window.location.hostname : null;
  } catch {
    return null;
  }
}

/** The saved brain address for this device, or the default. Never throws. */
export function loadBrainAddress(
  storage: StorageLike | null = defaultStorage(),
  pageHost: string | null = currentPageHost(),
): string {
  try {
    const saved = storage?.getItem(BRAIN_STORAGE_KEY);
    const normalized = saved ? normalizeBrainAddress(saved) : null;
    return normalized ?? defaultBrainForPageHost(pageHost);
  } catch {
    return DEFAULT_BRAIN_URL;
  }
}

/** Remember a brain address on this device. Returns the normalized URL, or null when invalid. */
export function saveBrainAddress(
  raw: string,
  storage: StorageLike | null = defaultStorage(),
): string | null {
  const normalized = normalizeBrainAddress(raw);
  if (!normalized) return null;
  try {
    storage?.setItem(BRAIN_STORAGE_KEY, normalized);
  } catch {
    // Storage can be unavailable (private mode); the address still applies to this session.
  }
  return normalized;
}
