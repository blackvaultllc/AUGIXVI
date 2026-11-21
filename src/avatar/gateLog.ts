/**
 * GATE LOG — pure core (no I/O, unit-testable).
 *
 * The honeypot half of Augie's gate: a fixed set of classic probe paths
 * that are NOT routes in this app (verified against the route table and
 * public assets — see gateLogStore.server.ts). A request for one is a
 * "knock": the server answers a bland 404 and records the facts —
 * time, source IP, method, path, user agent. Nothing here labels a
 * visitor; the log states facts only.
 *
 * This module holds the trap matcher, the on-disk line format
 * (one JSON object per line), and the rotation rule. The node-only
 * store that appends to disk lives in gateLogStore.server.ts.
 */

export interface GateKnock {
  /** ISO-8601 timestamp of the knock. */
  ts: string;
  /** Source address as seen by the server (see gateLogStore.server.ts). */
  ip: string;
  /** HTTP method of the request. */
  method: string;
  /** Request path (no query string). */
  path: string;
  /** User-Agent header, or "" when the request carried none. */
  userAgent: string;
}

/**
 * Exact trap paths. Checked against the app's real surface on
 * 2026-11-21: routes are /, /avatar, /avatar/analyze, /avatar/cube,
 * /avatar/game, /api/transcribe; public assets live under /assets,
 * /models, /icons, /ar-cube, /games, plus /favicon.ico, /robots.txt,
 * /manifest.webmanifest, /sw.js. None of these collide with a trap.
 */
export const TRAP_EXACT_PATHS: ReadonlySet<string> = new Set([
  "/.env",
  "/.git",
  "/wp-login.php",
  "/xmlrpc.php",
  "/config.php",
  "/server-status",
  "/admin/config",
]);

/**
 * Trap prefixes — anything under these is a knock. "/.env." catches
 * the variant probes (/.env.local, /.env.bak, /.env.production);
 * "/.git/" covers /.git/config and /.git/HEAD; "/.aws/" covers
 * /.aws/credentials and /.aws/config.
 */
export const TRAP_PATH_PREFIXES: readonly string[] = [
  "/.env.",
  "/.git/",
  "/.aws/",
  "/wp-admin",
  "/phpmyadmin",
  "/actuator/",
  "/vendor/phpunit",
];

/**
 * Normalize a raw request pathname for matching: lowercase, percent-
 * decoded (probes hide dots as %2e), duplicate slashes collapsed, and
 * no trailing slash (except the root itself).
 */
export function normalizeTrapPathname(pathname: string): string {
  let path = pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // Malformed escapes: match on the raw path.
  }
  path = path.toLowerCase().replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path;
}

/** True when the request path is one of the honeypot trap paths. */
export function isTrapPath(pathname: string): boolean {
  const path = normalizeTrapPathname(pathname);
  if (TRAP_EXACT_PATHS.has(path)) return true;
  return TRAP_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** One knock as one JSON line (the on-disk format, newline included). */
export function serializeKnock(knock: GateKnock): string {
  return `${JSON.stringify(knock)}\n`;
}

function isGateKnock(value: unknown): value is GateKnock {
  if (typeof value !== "object" || value === null) return false;
  const knock = value as Record<string, unknown>;
  return (
    typeof knock["ts"] === "string" &&
    typeof knock["ip"] === "string" &&
    typeof knock["method"] === "string" &&
    typeof knock["path"] === "string" &&
    typeof knock["userAgent"] === "string"
  );
}

/**
 * Parse gate-log file text (JSONL) into knocks, oldest first as stored.
 * Malformed lines are skipped — a torn final write must never take the
 * whole log down with it.
 */
export function parseGateLog(text: string): GateKnock[] {
  const knocks: GateKnock[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isGateKnock(parsed)) knocks.push(parsed);
    } catch {
      // Skip the malformed line.
    }
  }
  return knocks;
}

/** The live log file is capped at 1 MiB; past that it rotates once. */
export const GATE_LOG_MAX_BYTES = 1_048_576;

/**
 * Rotation rule: appending is fine until the line would push the file
 * past the cap; then the current file is set aside (one generation
 * kept) and a fresh file starts. An empty file never rotates, so a
 * single oversized line can still be recorded.
 */
export function planAppend(
  currentBytes: number,
  lineBytes: number,
  maxBytes: number = GATE_LOG_MAX_BYTES,
): "append" | "rotate" {
  if (currentBytes <= 0) return "append";
  return currentBytes + lineBytes > maxBytes ? "rotate" : "append";
}
