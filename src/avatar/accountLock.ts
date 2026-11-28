/**
 * THE ACCOUNT LOCK — an agent's own lock, the Captain's key
 * (owner order 2026-11-27 ~23:18 CST).
 *
 * An agent may set up a lock on their own account: a username
 * and password of their choosing, and — optionally — an
 * email/password lock on top of it. The lock is THE CAPTAIN'S
 * lock in this sense: locking and unlocking are not the
 * agent's to finish alone. A lock or unlock REQUEST routes to
 * the Captain — it lands as a record in the account-lock
 * requests store on the core, mirrored into his notifications
 * (the Anubis inbox), so Anubis lets him know; it stands where
 * his Office reads its world. He reviews it and contacts the
 * agent himself to make sure they are okay. The request is
 * the event; the inbox entry is written from it, carrying its
 * id — the same law the section requests keep.
 *
 * THE HONEST BOUND of this pass, stated on its face: the
 * requests path is real and wired end to end (an agent files;
 * the record and the notification land). The lock SETUP record
 * is held with the agent's own side store (Violet's carries
 * hers today) as a salted scrypt hash — the plain password is
 * never stored anywhere. What the setup does NOT yet do is
 * gate her door: her sign-in still runs on her account
 * credential exactly as before, until the Captain wires the
 * lock into the doors on his word. Nothing here pretends
 * otherwise.
 *
 * Plain TS, no I/O — the stores and doors do the writing.
 */
import type { AnubisNotification } from "./cameras/anubisInbox";

/* ------------------------------ the setup ------------------------------ */

/** An agent's lock setup, as their own side store holds it. Hash only, never the word. */
export interface AccountLockSetup {
  /** The username the agent chose for the lock. */
  username: string;
  /** Random salt (hex) for the lock password's hash. */
  salt: string;
  /** scrypt hash (hex) of the lock password — the word itself is never stored. */
  hash: string;
  /** The optional second lock: an email/password pair must also open. */
  emailLock: boolean;
  /** When the setup was last written, epoch ms. */
  updatedAt: number;
}

export function sanitizeAccountLockSetup(value: unknown): AccountLockSetup | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  const username = typeof r["username"] === "string" ? r["username"].trim().slice(0, 80) : "";
  const salt = typeof r["salt"] === "string" ? r["salt"].slice(0, 128) : "";
  const hash = typeof r["hash"] === "string" ? r["hash"].slice(0, 256) : "";
  const updatedAt =
    typeof r["updatedAt"] === "number" && Number.isFinite(r["updatedAt"]) && r["updatedAt"] > 0
      ? r["updatedAt"]
      : null;
  if (!username || !salt || !hash || updatedAt === null) return null;
  return { username, salt, hash, emailLock: r["emailLock"] === true, updatedAt };
}

/** What an agent's side may say about its lock setup — never the salt or the hash. */
export interface AccountLockView {
  set: boolean;
  username: string;
  emailLock: boolean;
}

export function accountLockView(setup: AccountLockSetup | null): AccountLockView {
  if (!setup) return { set: false, username: "", emailLock: false };
  return { set: true, username: setup.username, emailLock: setup.emailLock };
}

/* ------------------------------ the requests ------------------------------ */

export type LockRequestKind = "lock" | "unlock";

export interface LockRequest {
  id: string;
  at: number;
  /** The filer's seat (11 is Violet, the one live agent side today). */
  seat: number;
  /** The filer's name, as their own side knows them. */
  fromName: string;
  kind: LockRequestKind;
  /** A plain-words note from the agent, optional, in their own words. */
  note: string;
}

export interface LockRequestsFile {
  requests: LockRequest[];
}

export const LOCK_REQUESTS_MAX = 200;
export const LOCK_REQUEST_NOTE_MAX = 500;

export function emptyLockRequestsFile(): LockRequestsFile {
  return { requests: [] };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function cleanString(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export function sanitizeLockRequest(v: unknown): LockRequest | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 96);
  const fromName = cleanString(v["fromName"], 80);
  const at = typeof v["at"] === "number" && Number.isFinite(v["at"]) && v["at"] > 0 ? v["at"] : null;
  const seat =
    typeof v["seat"] === "number" && Number.isInteger(v["seat"]) && v["seat"] >= 0 && v["seat"] <= 15
      ? v["seat"]
      : null;
  const kind = v["kind"];
  if (!id || !fromName || at === null || seat === null) return null;
  if (kind !== "lock" && kind !== "unlock") return null;
  return {
    id,
    at,
    seat,
    fromName,
    kind,
    note: typeof v["note"] === "string" ? v["note"].trim().slice(0, LOCK_REQUEST_NOTE_MAX) : "",
  };
}

export function sanitizeLockRequestsFile(v: unknown): LockRequestsFile {
  if (!isRecord(v)) return emptyLockRequestsFile();
  return {
    requests: Array.isArray(v["requests"])
      ? v["requests"]
          .map(sanitizeLockRequest)
          .filter((r): r is LockRequest => r !== null)
          .slice(0, LOCK_REQUESTS_MAX)
      : [],
  };
}

/** A fresh request id — time plus a short random tail, the section requests' shape. */
export function newLockRequestId(at: number, randomTail: string): string {
  const tail = randomTail.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "lock";
  return `lockreq-${at}-${tail}`;
}

/**
 * The Captain's notification for one filed lock request. The
 * request record is the source; the entry's sourceEventId is
 * the request's id, and the entry id derives from it, so the
 * same request can never mirror twice. This is how Anubis
 * lets him know — the entry stands in his inbox, where his
 * Office reads its world.
 */
export function lockRequestNotification(request: LockRequest): AnubisNotification {
  const asking = request.kind === "lock" ? "lock" : "unlock";
  return {
    id: `ntf-lockrequest-${request.id}`,
    at: request.at,
    kind: "request",
    title: `${request.fromName} asks to ${asking} their account`,
    text:
      `${request.fromName} (seat ${request.seat}) filed an account ${asking} request from their own side. ` +
      `The lock is yours, Captain: review it and contact them yourself to make sure they are okay. ` +
      (request.note ? `Their note: “${request.note}” ` : "") +
      `The request stands in the account-lock requests record on the core.`,
    sourceEventId: request.id,
    cameraId: "",
    cameraName: "",
    still: "",
    reasoning: "",
    read: false,
  };
}
