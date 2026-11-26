/**
 * GRID-DOWN EXCHANGE — the pure core (owner order 2026-11-26:
 * "add FTP protocol for grid-down — a secure address I can give
 * somebody so they can download software from me; in and out").
 *
 * THE HONEST PROTOCOL: this door is SFTP — SSH file transfer.
 * Plain FTP sends passwords and files in the open for anyone
 * listening to read; SFTP is the same idea (an address, a login,
 * folders in and out) with everything encrypted. The door never
 * speaks plain FTP, and its labels never call it FTP.
 *
 * THE SHAPE OF THE DOOR:
 *   · Default CLOSED. The Captain opens it; the Captain closes
 *     it; the ALL-STOP closes it too.
 *   · Nobody has "the password". Each person HE names gets
 *     their own login name and their own KEY — a keypair made on
 *     the core at grant time. The core keeps only the PUBLIC
 *     key and its fingerprint; the private key is shown to the
 *     Captain ONCE, to hand over, and is never stored anywhere
 *     in the system. No plaintext secret exists in this store.
 *   · Every grant has an expiry. Revoked or expired, the login
 *     resolves to nothing.
 *   · Access is per person: download-only (take from the
 *     Outbox), upload-only (leave in the Inbox — they cannot
 *     read the Outbox), or both.
 *   · Every door movement the system itself makes (opened,
 *     closed, grant made, grant revoked) is written in the log
 *     at the moment it happens. Connection lines come from the
 *     exchange service's own log on the core machine, parsed by
 *     the runtime — a line becomes an entry only if it names a
 *     login this store issued. No record, no entry.
 *
 * Plain TS, no I/O — the server modules do the reading, the
 * daemon setup script (scripts/parrot-exchange-setup.sh) reads
 * this same store file on the core machine and builds the real
 * sshd door from it.
 */

/* ------------------------------------------------------------------ */
/* Grants                                                              */
/* ------------------------------------------------------------------ */

export type ExchangeAccess = "download" | "upload" | "both";

export interface ExchangeGrant {
  id: string;
  /** The person's name, in the Captain's words. */
  name: string;
  /** Their login name at the door — unique, generated at grant time. */
  username: string;
  access: ExchangeAccess;
  createdAt: number;
  /** The grant dies at this time, ready or not. Always set. */
  expiresAt: number;
  /** 0 while live; the moment the Captain revoked it, once revoked. */
  revokedAt: number;
  /** The OpenSSH public key line ("ssh-ed25519 AAAA… name@augie-exchange"). */
  publicKey: string;
  /** The standard SSH fingerprint of that key ("SHA256:…"). */
  keyFingerprint: string;
}

/* ------------------------------------------------------------------ */
/* The store file                                                      */
/* ------------------------------------------------------------------ */

export type ExchangeLogKind =
  | "door-opened"
  | "door-closed"
  | "grant-created"
  | "grant-revoked"
  | "file-out"
  | "file-in"
  | "connect"
  | "disconnect";

export interface ExchangeLogEntry {
  id: string;
  at: number;
  kind: ExchangeLogKind;
  /** The login name the entry concerns, or "" when it is the door itself. */
  username: string;
  /** One plain line: what happened. */
  text: string;
}

export interface ExchangeFile {
  version: 1;
  /** The door switch. Default FALSE — closed until he opens it. */
  enabled: boolean;
  /** The port the exchange service listens on. */
  port: number;
  grants: ExchangeGrant[];
  log: ExchangeLogEntry[];
}

export const EXCHANGE_DEFAULT_PORT = 2222;
export const EXCHANGE_LOG_MAX = 200;

export function emptyExchangeFile(): ExchangeFile {
  return {
    version: 1,
    enabled: false,
    port: EXCHANGE_DEFAULT_PORT,
    grants: [],
    log: [],
  };
}

/* ------------------------------------------------------------------ */
/* Sanitizing — every read passes through here                         */
/* ------------------------------------------------------------------ */

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanTime(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function cleanAccess(value: unknown): ExchangeAccess {
  return value === "download" || value === "upload" || value === "both" ? value : "download";
}

const LOG_KINDS: readonly ExchangeLogKind[] = [
  "door-opened",
  "door-closed",
  "grant-created",
  "grant-revoked",
  "file-out",
  "file-in",
  "connect",
  "disconnect",
];

export function sanitizeGrant(raw: unknown): ExchangeGrant | null {
  if (typeof raw !== "object" || raw === null) return null;
  const g = raw as Record<string, unknown>;
  const id = cleanText(g["id"], 80);
  const username = cleanText(g["username"], 64);
  const publicKey = cleanText(g["publicKey"], 800);
  if (!id || !username || !publicKey.startsWith("ssh-ed25519 ")) return null;
  return {
    id,
    name: cleanText(g["name"], 120) || username,
    username,
    access: cleanAccess(g["access"]),
    createdAt: cleanTime(g["createdAt"]),
    expiresAt: cleanTime(g["expiresAt"]),
    revokedAt: cleanTime(g["revokedAt"]),
    publicKey,
    keyFingerprint: cleanText(g["keyFingerprint"], 120),
  };
}

export function sanitizeLogEntry(raw: unknown): ExchangeLogEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Record<string, unknown>;
  const id = cleanText(e["id"], 120);
  const kind = e["kind"];
  if (!id || typeof kind !== "string" || !LOG_KINDS.includes(kind as ExchangeLogKind)) return null;
  return {
    id,
    at: cleanTime(e["at"]),
    kind: kind as ExchangeLogKind,
    username: cleanText(e["username"], 64),
    text: cleanText(e["text"], 400),
  };
}

export function sanitizeExchangeFile(raw: unknown): ExchangeFile {
  if (typeof raw !== "object" || raw === null) return emptyExchangeFile();
  const f = raw as Record<string, unknown>;
  const grants = Array.isArray(f["grants"])
    ? f["grants"].map(sanitizeGrant).filter((g): g is ExchangeGrant => g !== null)
    : [];
  const log = Array.isArray(f["log"])
    ? f["log"].map(sanitizeLogEntry).filter((e): e is ExchangeLogEntry => e !== null)
    : [];
  const port =
    typeof f["port"] === "number" && Number.isInteger(f["port"]) && f["port"] >= 1 && f["port"] <= 65535
      ? f["port"]
      : EXCHANGE_DEFAULT_PORT;
  return {
    version: 1,
    // The door is open only when the record plainly says so.
    enabled: f["enabled"] === true,
    port,
    grants,
    log: log.slice(-EXCHANGE_LOG_MAX),
  };
}

/* ------------------------------------------------------------------ */
/* Resolution — the one door every access question walks through       */
/* ------------------------------------------------------------------ */

export type ExchangeDenyReason =
  | "door-closed"
  | "all-stop"
  | "no-such-login"
  | "revoked"
  | "expired";

export type ExchangeResolution =
  | { allowed: true; grant: ExchangeGrant }
  | { allowed: false; reason: ExchangeDenyReason };

/**
 * May this login use the door right now? The ALL-STOP outranks
 * the door switch; the door switch outranks any grant; a grant
 * must be live — present, unrevoked, unexpired.
 */
export function resolveExchangeAccess(
  file: ExchangeFile,
  username: string,
  now: number,
  allStop: boolean,
): ExchangeResolution {
  if (allStop) return { allowed: false, reason: "all-stop" };
  if (!file.enabled) return { allowed: false, reason: "door-closed" };
  const grant = file.grants.find((g) => g.username === username);
  if (!grant) return { allowed: false, reason: "no-such-login" };
  if (grant.revokedAt > 0) return { allowed: false, reason: "revoked" };
  if (grant.expiresAt > 0 && now >= grant.expiresAt) return { allowed: false, reason: "expired" };
  return { allowed: true, grant };
}

/** The door stands open for nobody while the ALL-STOP is in force. */
export function doorStandsOpen(file: ExchangeFile, allStop: boolean): boolean {
  return file.enabled && !allStop;
}

export function grantIsLive(grant: ExchangeGrant, now: number): boolean {
  return grant.revokedAt === 0 && (grant.expiresAt === 0 || now < grant.expiresAt);
}

export function canDownload(access: ExchangeAccess): boolean {
  return access === "download" || access === "both";
}

export function canUpload(access: ExchangeAccess): boolean {
  return access === "upload" || access === "both";
}

/** May this grant move a file this way? Folder law, per person. */
export function grantMayMove(
  file: ExchangeFile,
  username: string,
  direction: "download" | "upload",
  now: number,
  allStop: boolean,
): boolean {
  const resolved = resolveExchangeAccess(file, username, now, allStop);
  if (!resolved.allowed) return false;
  return direction === "download"
    ? canDownload(resolved.grant.access)
    : canUpload(resolved.grant.access);
}

export function accessWords(access: ExchangeAccess): string {
  switch (access) {
    case "download":
      return "Download only — they can take files from the Outbox";
    case "upload":
      return "Upload only — they can leave files in the Inbox; they cannot read the Outbox";
    case "both":
      return "Both ways — download from the Outbox and upload to the Inbox";
  }
}

/* ------------------------------------------------------------------ */
/* Grant drafts                                                        */
/* ------------------------------------------------------------------ */

export interface ExchangeGrantDraft {
  name: string;
  access: ExchangeAccess;
  daysValid: number;
}

export function validateGrantDraft(raw: unknown): ExchangeGrantDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const d = raw as Record<string, unknown>;
  const name = cleanText(d["name"], 120);
  if (!name) return null;
  const days =
    typeof d["daysValid"] === "number" && Number.isFinite(d["daysValid"])
      ? Math.floor(d["daysValid"])
      : 0;
  if (days < 1 || days > 365) return null;
  return { name, access: cleanAccess(d["access"]), daysValid: days };
}

/** A login name from a person's name: lowercase, plain letters, unique-ified by the caller. */
export function usernameBase(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return base || "guest";
}

export function uniqueUsername(file: ExchangeFile, name: string, suffix: string): string {
  const base = usernameBase(name);
  const taken = new Set(file.grants.map((g) => g.username));
  const first = `${base}-${suffix}`.slice(0, 32);
  if (!taken.has(first)) return first;
  let n = 2;
  while (taken.has(`${first}-${n}`)) n += 1;
  return `${first}-${n}`;
}

/* ------------------------------------------------------------------ */
/* The log — entries form from recorded events only                    */
/* ------------------------------------------------------------------ */

let logCounter = 0;

export function exchangeLogEntry(
  kind: ExchangeLogKind,
  at: number,
  username: string,
  text: string,
): ExchangeLogEntry {
  logCounter += 1;
  return {
    id: `xlog-${at}-${logCounter}-${kind}`,
    at,
    kind,
    username: username.slice(0, 64),
    text: text.slice(0, 400),
  };
}

export function appendExchangeLog(file: ExchangeFile, entry: ExchangeLogEntry): ExchangeFile {
  return { ...file, log: [...file.log, entry].slice(-EXCHANGE_LOG_MAX) };
}

/**
 * One line of the exchange service's own log → an entry, or
 * nothing. A line becomes an entry ONLY when it reports an
 * accepted publickey login or a disconnect for a login this
 * store issued — other people's noise and other services'
 * lines form nothing here.
 */
export function daemonLogEntry(
  line: string,
  knownUsernames: ReadonlySet<string>,
  fallbackAt: number,
): ExchangeLogEntry | null {
  // The sync script prefixes each line with its epoch-ms time.
  const stamp = /^(\d{10,13})\s+/.exec(line);
  const at = stamp ? Number(stamp[1]) : fallbackAt;
  const body = stamp ? line.slice(stamp[0].length) : line;
  const accepted = /Accepted publickey for (\S+) from /.exec(body);
  const closed = /Disconnected from user (\S+) /.exec(body) ?? /Disconnecting from user (\S+) /.exec(body);
  const match = accepted ?? closed;
  if (!match) return null;
  const username = match[1] ?? "";
  if (!knownUsernames.has(username)) return null;
  const kind: ExchangeLogKind = accepted ? "connect" : "disconnect";
  return {
    id: `xdaemon-${kind}-${username}-${at}`,
    at,
    kind,
    username,
    text: accepted
      ? `${username} connected with their key.`
      : `${username} disconnected.`,
  };
}

/** File names that may never ride the exchange: no paths, no tricks. */
export function cleanExchangeFileName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (!name || name.length > 180) return null;
  if (name.includes("/") || name.includes("\\") || name.includes("\0")) return null;
  if (name === "." || name === ".." || name.startsWith(".")) return null;
  return name;
}

/**
 * A file's path inside an exchange folder: a plain name, or
 * one subfolder + a plain name (the Inbox keeps each person's
 * arrivals in a subfolder named by their login). Anything
 * deeper, or with a dirty segment, is refused.
 */
export function cleanExchangeFilePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const parts = raw.trim().split("/");
  if (parts.length < 1 || parts.length > 2) return null;
  const cleaned = parts.map((p) => cleanExchangeFileName(p));
  if (cleaned.some((p) => p === null)) return null;
  return cleaned.join("/");
}
