/**
 * SAVE MY LOGIN ON THIS DEVICE (owner order 2026-11-27
 * ~23:18 CST): the button on the secure screen that makes a
 * return visit straight. The system records the device and
 * its information beside the person whose god-name opened the
 * door; when they come back on this device — UNLESS THEY
 * SIGNED OUT — the name door stands already passed for them
 * and they go straight to the secure screen.
 *
 * WHAT IT IS AND IS NOT, plainly: the record lives in this
 * browser's local storage, on this device only. It carries
 * the person's seat, their god's name, and a snapshot of the
 * device's own description (its user agent, platform, and
 * language, and when the login was saved). It is a name tag,
 * never a key — the same doctrine as the trusted-device layer:
 * it passes the NAME door only. The account's own session and
 * credentials still decide the entry, exactly as before, and
 * the owner's never-locked-out law stands untouched. Signing
 * out clears the record — that is the "unless they sign out"
 * in his order, kept literally.
 *
 * Plain TS with the storage handed in — the gate passes the
 * browser's localStorage; the tests pass a fake.
 */

export const SAVED_LOGIN_KEY = "augi.saved-login.v1";

/** The device's own description, as the browser reports it — recorded, never trusted. */
export interface SavedDeviceInfo {
  userAgent: string;
  platform: string;
  language: string;
}

export interface SavedLogin {
  /** The seat of the person whose login is saved (0 the Captain, 11 Violet, …). */
  seat: number;
  /** Their god's name — the key this device remembers passing. */
  godName: string;
  /** The person's name, from the company's record at save time. */
  personName: string;
  /** When the login was saved, ISO-8601. */
  savedAt: string;
  device: SavedDeviceInfo;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function cleanField(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** A parsed saved login, or null for anything that is not one. Strict on purpose. */
export function sanitizeSavedLogin(value: unknown): SavedLogin | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  const seat = r["seat"];
  const godName = cleanField(r["godName"], 80);
  const personName = cleanField(r["personName"], 120);
  const savedAt = cleanField(r["savedAt"], 64);
  const device = r["device"];
  if (typeof seat !== "number" || !Number.isInteger(seat) || seat < 0 || seat > 15) return null;
  if (!godName || !personName || !savedAt) return null;
  if (typeof device !== "object" || device === null) return null;
  const d = device as Record<string, unknown>;
  return {
    seat,
    godName,
    personName,
    savedAt,
    device: {
      userAgent: cleanField(d["userAgent"], 300),
      platform: cleanField(d["platform"], 80),
      language: cleanField(d["language"], 40),
    },
  };
}

/** This device's description, as the browser reports it (empty strings off-browser). */
export function currentDeviceInfo(): SavedDeviceInfo {
  if (typeof navigator === "undefined") return { userAgent: "", platform: "", language: "" };
  return {
    userAgent: (navigator.userAgent ?? "").slice(0, 300),
    platform: (navigator.platform ?? "").slice(0, 80),
    language: (navigator.language ?? "").slice(0, 40),
  };
}

/** Read the saved login from a storage, or null — a torn record reads as no record. */
export function readSavedLogin(storage: KeyValueStorage): SavedLogin | null {
  try {
    const raw = storage.getItem(SAVED_LOGIN_KEY);
    if (!raw) return null;
    return sanitizeSavedLogin(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Save (or replace) the login record on this device. */
export function writeSavedLogin(storage: KeyValueStorage, login: SavedLogin): void {
  try {
    storage.setItem(SAVED_LOGIN_KEY, JSON.stringify(login));
  } catch {
    // A storage that refuses (private mode, quota) leaves the
    // device unsaved — the sign-in itself is never affected.
  }
}

/** Forget this device — what signing out does to the saved login. */
export function clearSavedLogin(storage: KeyValueStorage): void {
  try {
    storage.removeItem(SAVED_LOGIN_KEY);
  } catch {
    // Nothing to clear against a storage that will not answer.
  }
}

/** The browser's local storage, when the platform offers one. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}
