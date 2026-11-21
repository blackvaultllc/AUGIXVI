/**
 * KHADIJA'S DIARY — encryption that makes "only she can read it"
 * literally true (operator order 2026-11-21: "I can't even see in
 * there").
 *
 * Design:
 *  - Her unlock is a picture she picks + a secret word she chooses.
 *    The unlock string itself is NEVER stored anywhere.
 *  - A key is derived from the unlock with PBKDF2 (SHA-256, 210k
 *    rounds, random 16-byte salt) and used as an AES-GCM 256 key.
 *    The CryptoKey is non-extractable and lives only in page memory
 *    while her diary is open; locking the diary drops it.
 *  - What IS stored (localStorage, this device only): the salt, a
 *    verifier (AES-GCM encryption of a known constant — an unlock
 *    attempt is right only if the verifier decrypts), and each entry
 *    as AES-GCM ciphertext with its own random IV. Entry text never
 *    touches storage in plaintext — there is no operator UI, endpoint,
 *    or storage path that can read it, because no key exists anywhere
 *    except in her unlock and in memory while she has it open.
 */

export const DIARY_STORAGE_KEY = "augi.learner.diary.v1";

const VERIFIER_PLAINTEXT = "augi-diary-ok";
const PBKDF2_ITERATIONS = 210_000;

export type DiaryEntryRecord = {
  id: string;
  createdAt: string;
  iv: string;
  ciphertext: string;
};

export type DiaryVault = {
  version: 1;
  salt: string;
  verifier: { iv: string; ciphertext: string };
  entries: DiaryEntryRecord[];
};

export type DiaryEntry = {
  id: string;
  createdAt: string;
  text: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function store(override?: StorageLike): StorageLike {
  return override ?? globalThis.localStorage;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function subtle(): SubtleCrypto {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) throw new Error("Encryption is not available on this device.");
  return cryptoObj.subtle;
}

async function deriveKey(unlock: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await subtle().importKey(
    "raw",
    new TextEncoder().encode(unlock),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle().deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptText(
  key: CryptoKey,
  text: string,
): Promise<{ iv: string; ciphertext: string }> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const cipher = await subtle().encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(text),
  );
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(cipher)) };
}

async function decryptText(
  key: CryptoKey,
  record: { iv: string; ciphertext: string },
): Promise<string> {
  const plain = await subtle().decrypt(
    { name: "AES-GCM", iv: fromBase64(record.iv) as BufferSource },
    key,
    fromBase64(record.ciphertext) as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

export function loadDiaryVault(storageOverride?: StorageLike): DiaryVault | null {
  try {
    const raw = store(storageOverride).getItem(DIARY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DiaryVault;
    if (parsed.version !== 1 || typeof parsed.salt !== "string" || !parsed.verifier) return null;
    if (!Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDiaryVault(vault: DiaryVault, storageOverride?: StorageLike): void {
  store(storageOverride).setItem(DIARY_STORAGE_KEY, JSON.stringify(vault));
}

export function isDiarySetUp(storageOverride?: StorageLike): boolean {
  return loadDiaryVault(storageOverride) !== null;
}

/**
 * First time: she chooses her unlock. Stores only the salt + verifier
 * + an empty entry list, and returns the in-memory key for this visit.
 */
export async function setupDiary(
  unlock: string,
  storageOverride?: StorageLike,
): Promise<CryptoKey> {
  if (!unlock.trim()) throw new TypeError("A diary secret is required.");
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(unlock, salt);
  const verifier = await encryptText(key, VERIFIER_PLAINTEXT);
  saveDiaryVault({ version: 1, salt: toBase64(salt), verifier, entries: [] }, storageOverride);
  return key;
}

/**
 * Unlock attempt. Returns the in-memory key when the unlock is hers,
 * and null when it is not — the verifier either decrypts or it does
 * not, and nothing about the entries is touched on a wrong attempt.
 */
export async function unlockDiary(
  unlock: string,
  storageOverride?: StorageLike,
): Promise<CryptoKey | null> {
  const vault = loadDiaryVault(storageOverride);
  if (!vault) return null;
  try {
    const key = await deriveKey(unlock, fromBase64(vault.salt));
    const check = await decryptText(key, vault.verifier);
    return check === VERIFIER_PLAINTEXT ? key : null;
  } catch {
    return null;
  }
}

export async function addDiaryEntry(
  key: CryptoKey,
  text: string,
  storageOverride?: StorageLike,
  now: Date = new Date(),
): Promise<DiaryEntry> {
  const vault = loadDiaryVault(storageOverride);
  if (!vault) throw new Error("The diary has not been set up yet.");
  const trimmed = text.trim();
  if (!trimmed) throw new TypeError("Write something first.");
  const encrypted = await encryptText(key, trimmed);
  const entry: DiaryEntryRecord = {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `diary-${now.getTime()}-${Math.random().toString(36).slice(2)}`,
    createdAt: now.toISOString(),
    ...encrypted,
  };
  vault.entries = [...vault.entries, entry];
  saveDiaryVault(vault, storageOverride);
  return { id: entry.id, createdAt: entry.createdAt, text: trimmed };
}

export async function readDiaryEntries(
  key: CryptoKey,
  storageOverride?: StorageLike,
): Promise<DiaryEntry[]> {
  const vault = loadDiaryVault(storageOverride);
  if (!vault) return [];
  const entries: DiaryEntry[] = [];
  for (const record of vault.entries) {
    entries.push({
      id: record.id,
      createdAt: record.createdAt,
      text: await decryptText(key, record),
    });
  }
  return entries;
}
