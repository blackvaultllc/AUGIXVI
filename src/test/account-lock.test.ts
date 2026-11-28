import { describe, expect, it } from "vitest";
import {
  accountLockView,
  emptyLockRequestsFile,
  lockRequestNotification,
  newLockRequestId,
  sanitizeAccountLockSetup,
  sanitizeLockRequest,
  sanitizeLockRequestsFile,
  type LockRequest,
} from "@/avatar/accountLock";

/**
 * THE ACCOUNT LOCK (owner order 2026-11-27 ~23:18 CST): the
 * setup record an agent's side may hold (hash only), and the
 * lock/unlock requests that route to the Captain — the
 * request is the event, the notification is written from it.
 */
describe("the lock setup record", () => {
  const setup = {
    username: "violet.h",
    salt: "a1b2c3",
    hash: "deadbeef",
    emailLock: true,
    updatedAt: 1_700_000_000_000,
  };

  it("sanitizes a real setup and refuses partial ones", () => {
    expect(sanitizeAccountLockSetup(setup)).toEqual(setup);
    expect(sanitizeAccountLockSetup({ ...setup, emailLock: "yes" })?.emailLock).toBe(false);
    expect(sanitizeAccountLockSetup({ ...setup, hash: "" })).toBeNull();
    expect(sanitizeAccountLockSetup({ ...setup, username: "  " })).toBeNull();
    expect(sanitizeAccountLockSetup({ ...setup, updatedAt: 0 })).toBeNull();
    expect(sanitizeAccountLockSetup(null)).toBeNull();
  });

  it("the view that may cross the wire never carries the salt or the hash", () => {
    const view = accountLockView(sanitizeAccountLockSetup(setup));
    expect(view).toEqual({ set: true, username: "violet.h", emailLock: true });
    expect(JSON.stringify(view)).not.toContain("deadbeef");
    expect(JSON.stringify(view)).not.toContain("a1b2c3");
    expect(accountLockView(null)).toEqual({ set: false, username: "", emailLock: false });
  });
});

describe("the lock requests", () => {
  const request: LockRequest = {
    id: newLockRequestId(1_700_000_000_000, "abcd1234wxyz"),
    at: 1_700_000_000_000,
    seat: 11,
    fromName: "Violet Hernandez",
    kind: "lock",
    note: "Traveling next week.",
  };

  it("ids carry the lockreq mark and a cleaned tail", () => {
    expect(request.id).toBe("lockreq-1700000000000-abcd1234");
    expect(newLockRequestId(5, "!!!")).toBe("lockreq-5-lock");
  });

  it("sanitizes requests strictly — kind, seat, and name are law", () => {
    expect(sanitizeLockRequest(request)).toEqual(request);
    expect(sanitizeLockRequest({ ...request, kind: "maybe" })).toBeNull();
    expect(sanitizeLockRequest({ ...request, seat: 16 })).toBeNull();
    expect(sanitizeLockRequest({ ...request, seat: -1 })).toBeNull();
    expect(sanitizeLockRequest({ ...request, fromName: "" })).toBeNull();
    expect(sanitizeLockRequestsFile({ requests: [request, { junk: true }] }).requests).toEqual([
      request,
    ]);
    expect(sanitizeLockRequestsFile(null)).toEqual(emptyLockRequestsFile());
  });

  it("the Captain's notification is written from the request itself", () => {
    const entry = lockRequestNotification(request);
    expect(entry.id).toBe(`ntf-lockrequest-${request.id}`);
    expect(entry.sourceEventId).toBe(request.id);
    expect(entry.kind).toBe("request");
    expect(entry.at).toBe(request.at);
    expect(entry.title).toContain("Violet Hernandez");
    expect(entry.title).toContain("lock");
    expect(entry.text).toContain("Traveling next week.");
    expect(entry.text).toContain("contact them yourself");
    // One request, one entry: the same request mirrors to the
    // same id every time, so it can never land twice.
    expect(lockRequestNotification(request).id).toBe(entry.id);
  });

  it("an unlock request reads as an unlock, and a bare note stays bare", () => {
    const entry = lockRequestNotification({ ...request, kind: "unlock", note: "" });
    expect(entry.title).toContain("unlock");
    expect(entry.text).not.toContain("Their note");
  });
});
