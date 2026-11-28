/**
 * VIOLET'S STORE — node-only, server-side. Everything on her
 * side of the system lives in one file on the core
 * (~/.local/share/augie/violet-side.json), owner-only (0600):
 * her credential, her sessions, her notepad, the finance
 * records she reads, her mailbox connection, her outbox, her
 * welcome draft, and her door's own login log.
 *
 * THE CREDENTIAL: her account is created with a DEFAULT
 * PASSWORD, generated here on first seed — never printed in
 * code, never written to any log. The store keeps its scrypt
 * hash for verification. The generated word itself is kept in
 * this same locked file ONLY while it is still her password,
 * so the Captain's review packet can show him the exact
 * welcome draft; the moment she changes her password, the
 * stored word is wiped and only the hash remains. Her first
 * sign-in tells her plainly she can change it at any time,
 * one tap away — and `usingDefault` is how her side knows to
 * tell her.
 *
 * SESSIONS: a session token is 32 random bytes; the store
 * keeps only its SHA-256. Her session is hers alone — it is
 * never read by an operator surface, and it opens nothing
 * outside her side.
 *
 * Where there is no node filesystem (the Cloudflare Worker)
 * the store is unavailable and says so — her side lives on
 * the core machine, like every other door in this house.
 */
import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  sanitizeFinanceRecord,
  sanitizeVioletMail,
  buildVioletWelcomeDraft,
  VIOLET_PROFILE,
  type FinanceRecord,
  type VioletMail,
  type VioletMailbox,
} from "./violetSide";
import { sanitizeAccountLockSetup, type AccountLockSetup } from "../accountLock";

type VioletFs = typeof import("node:fs/promises");

const STORE_FILE = "violet-side.json";
const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;

export interface VioletCredential {
  email: string;
  salt: string;
  hash: string;
  /** The generated starting word — kept ONLY until she changes it. */
  defaultPassword: string | null;
  usingDefault: boolean;
  createdAt: number;
  changedAt: number | null;
}

export interface VioletSession {
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
}

export interface VioletLoginLogEntry {
  at: number;
  ok: boolean;
}

/** Her mailbox's wire, when one stands: implicit-TLS SMTP. Set by
 *  the wiring door (operator side) when her mailbox is connected
 *  on her side; null until then, and her sends wait as drafts. */
export interface VioletMailboxTransport {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface VioletStoreFile {
  credential: VioletCredential;
  sessions: VioletSession[];
  notepad: string;
  financeRecords: FinanceRecord[];
  mailbox: VioletMailbox;
  mailboxTransport: VioletMailboxTransport | null;
  outbox: VioletMail[];
  welcomeDraft: string;
  loginLog: VioletLoginLogEntry[];
  /** Her account-lock setup (owner order 2026-11-27) — hash only, never the word. */
  accountLock: AccountLockSetup | null;
}

/* ------------------------- password machinery ------------------------ */

const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A starting word she can read over the phone without a spelling bee: IEM-xxxx-xxxx-xxxx. */
export function generateDefaultPassword(): string {
  const group = () =>
    Array.from({ length: 4 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join("");
  return `IEM-${group()}-${group()}-${group()}`;
}

function hashPassword(password: string, saltHex: string): string {
  return scryptSync(password, Buffer.from(saltHex, "hex"), 64).toString("hex");
}

function passwordMatches(password: string, credential: VioletCredential): boolean {
  const candidate = Buffer.from(hashPassword(password, credential.salt), "hex");
  const stored = Buffer.from(credential.hash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* ------------------------------ seeding ------------------------------ */

function seedFile(now: number): VioletStoreFile {
  const defaultPassword = generateDefaultPassword();
  const salt = randomBytes(16).toString("hex");
  return {
    credential: {
      email: VIOLET_PROFILE.email,
      salt,
      hash: hashPassword(defaultPassword, salt),
      defaultPassword,
      usingDefault: true,
      createdAt: now,
      changedAt: null,
    },
    sessions: [],
    notepad: "",
    financeRecords: [],
    mailbox: {
      address: VIOLET_PROFILE.email,
      connected: false,
      note: "Her mailbox is not connected on her side yet — messages she writes are kept here as ready drafts, and nothing is sent until the connection stands.",
    },
    mailboxTransport: null,
    outbox: [],
    welcomeDraft: buildVioletWelcomeDraft(defaultPassword),
    loginLog: [],
    accountLock: null,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function sanitizeStoreFile(v: unknown): VioletStoreFile | null {
  if (!isRecord(v) || !isRecord(v["credential"])) return null;
  const c = v["credential"];
  if (
    typeof c["email"] !== "string" ||
    typeof c["salt"] !== "string" ||
    typeof c["hash"] !== "string"
  ) {
    return null;
  }
  const sessions: VioletSession[] = Array.isArray(v["sessions"])
    ? v["sessions"].flatMap((s) => {
        if (!isRecord(s)) return [];
        if (
          typeof s["tokenHash"] !== "string" ||
          typeof s["createdAt"] !== "number" ||
          typeof s["expiresAt"] !== "number"
        ) {
          return [];
        }
        return [{ tokenHash: s["tokenHash"], createdAt: s["createdAt"], expiresAt: s["expiresAt"] }];
      })
    : [];
  return {
    credential: {
      email: c["email"],
      salt: c["salt"],
      hash: c["hash"],
      defaultPassword: typeof c["defaultPassword"] === "string" ? c["defaultPassword"] : null,
      usingDefault: c["usingDefault"] === true,
      createdAt: typeof c["createdAt"] === "number" ? c["createdAt"] : 0,
      changedAt: typeof c["changedAt"] === "number" ? c["changedAt"] : null,
    },
    sessions,
    notepad: typeof v["notepad"] === "string" ? v["notepad"].slice(0, 20_000) : "",
    financeRecords: Array.isArray(v["financeRecords"])
      ? v["financeRecords"]
          .map(sanitizeFinanceRecord)
          .filter((r): r is FinanceRecord => r !== null)
          .slice(0, 500)
      : [],
    mailbox:
      isRecord(v["mailbox"]) &&
      typeof v["mailbox"]["address"] === "string" &&
      typeof v["mailbox"]["note"] === "string"
        ? {
            address: v["mailbox"]["address"],
            connected: v["mailbox"]["connected"] === true,
            note: v["mailbox"]["note"],
          }
        : seedFile(Date.now()).mailbox,
    mailboxTransport:
      isRecord(v["mailboxTransport"]) &&
      typeof v["mailboxTransport"]["host"] === "string" &&
      typeof v["mailboxTransport"]["user"] === "string" &&
      typeof v["mailboxTransport"]["pass"] === "string"
        ? {
            host: v["mailboxTransport"]["host"],
            port:
              typeof v["mailboxTransport"]["port"] === "number"
                ? v["mailboxTransport"]["port"]
                : 465,
            user: v["mailboxTransport"]["user"],
            pass: v["mailboxTransport"]["pass"],
          }
        : null,
    outbox: Array.isArray(v["outbox"])
      ? v["outbox"]
          .map(sanitizeVioletMail)
          .filter((m): m is VioletMail => m !== null)
          .slice(0, 200)
      : [],
    welcomeDraft: typeof v["welcomeDraft"] === "string" ? v["welcomeDraft"] : "",
    loginLog: Array.isArray(v["loginLog"])
      ? v["loginLog"].flatMap((e) => {
          if (!isRecord(e) || typeof e["at"] !== "number") return [];
          return [{ at: e["at"], ok: e["ok"] === true }];
        }).slice(0, 200)
      : [],
    accountLock: sanitizeAccountLockSetup(v["accountLock"]),
  };
}

/* ------------------------------- store ------------------------------- */

export class FileVioletStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: VioletFs,
    private readonly directory: string,
  ) {}

  private get filePath(): string {
    return `${this.directory}/${STORE_FILE}`;
  }

  async read(): Promise<VioletStoreFile> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      const clean = sanitizeStoreFile(parsed);
      if (clean) return clean;
    } catch {
      // fall through to the seed
    }
    const seeded = seedFile(Date.now());
    await this.writeAll(seeded);
    return seeded;
  }

  private async writeAll(file: VioletStoreFile): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.filePath, JSON.stringify(file, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  update(mutator: (file: VioletStoreFile) => VioletStoreFile): Promise<VioletStoreFile> {
    const job = async () => {
      const current = await this.read();
      const next = mutator(current);
      await this.writeAll(next);
      return next;
    };
    const result = this.tail.then(job, job);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

let storePromise: Promise<FileVioletStore | null> | null = null;

export function getVioletStore(): Promise<FileVioletStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FileVioletStore(fs, `${home}/.local/share/augie`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}

/* ---------------------------- door actions ---------------------------- */

/** Verify her email + password. Returns the fresh session token, or null. */
export async function violetSignIn(email: string, password: string): Promise<string | null> {
  const store = await getVioletStore();
  if (!store) return null;
  const now = Date.now();
  let token: string | null = null;
  await store.update((file) => {
    const ok =
      email.trim().toLowerCase() === file.credential.email.toLowerCase() &&
      passwordMatches(password, file.credential);
    const loginLog = [{ at: now, ok }, ...file.loginLog].slice(0, 200);
    if (!ok) return { ...file, loginLog };
    token = randomBytes(32).toString("hex");
    const sessions = [
      { tokenHash: tokenHash(token), createdAt: now, expiresAt: now + SESSION_TTL_MS },
      ...file.sessions.filter((s) => s.expiresAt > now),
    ].slice(0, 8);
    return { ...file, loginLog, sessions };
  });
  return token;
}

/** Is this token a live session on her side right now? */
export async function violetSessionValid(token: string): Promise<boolean> {
  if (!token || token.length > 128) return false;
  const store = await getVioletStore();
  if (!store) return false;
  const file = await store.read();
  const hash = tokenHash(token);
  return file.sessions.some((s) => s.tokenHash === hash && s.expiresAt > Date.now());
}

export async function violetSignOut(token: string): Promise<void> {
  const store = await getVioletStore();
  if (!store) return;
  const hash = tokenHash(token);
  await store.update((file) => ({
    ...file,
    sessions: file.sessions.filter((s) => s.tokenHash !== hash),
  }));
}

/**
 * Change her password: the current word must prove itself, the
 * new word replaces the hash, and the stored starting word is
 * wiped in the same write — from then on, only the hash stands.
 */
export async function violetChangePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; reason: string }> {
  if (!(await violetSessionValid(token))) {
    return { ok: false, reason: "Your session has ended — sign in again." };
  }
  if (newPassword.length < 10) {
    return { ok: false, reason: "A new password needs at least 10 characters." };
  }
  const store = await getVioletStore();
  if (!store) return { ok: false, reason: "Your side lives on the core machine — it is not here." };
  let result = { ok: false, reason: "The current password did not match." };
  await store.update((file) => {
    if (!passwordMatches(currentPassword, file.credential)) return file;
    const salt = randomBytes(16).toString("hex");
    result = { ok: true, reason: "Your password is changed. The starting password no longer works." };
    return {
      ...file,
      credential: {
        ...file.credential,
        salt,
        hash: hashPassword(newPassword, salt),
        defaultPassword: null,
        usingDefault: false,
        changedAt: Date.now(),
      },
    };
  });
  return result;
}

/**
 * Save her account-lock setup (owner order 2026-11-27 ~23:18
 * CST): a username and password of her choosing, and the
 * optional email lock on top. Only the salted scrypt hash is
 * kept — the word itself is never stored, here or anywhere.
 * The setup is a record today; her door still opens on her
 * account credential until the Captain wires the lock into
 * the doors on his word (accountLock.ts states the bound).
 */
export async function violetSaveAccountLock(
  token: string,
  input: { username: string; password: string; emailLock: boolean },
): Promise<{ ok: boolean; reason: string }> {
  if (!(await violetSessionValid(token))) {
    return { ok: false, reason: "Your session has ended — sign in again." };
  }
  const username = input.username.trim().slice(0, 80);
  if (!username) return { ok: false, reason: "The lock needs a username." };
  if (input.password.length < 10) {
    return { ok: false, reason: "The lock password needs at least 10 characters." };
  }
  const store = await getVioletStore();
  if (!store) return { ok: false, reason: "Your side lives on the core machine — it is not here." };
  const salt = randomBytes(16).toString("hex");
  await store.update((file) => ({
    ...file,
    accountLock: {
      username,
      salt,
      hash: hashPassword(input.password, salt),
      emailLock: input.emailLock === true,
      updatedAt: Date.now(),
    },
  }));
  return { ok: true, reason: "Your lock is set. The Captain holds the key to it." };
}

/** A fresh id for her records and mail. */
export function violetNewId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}
