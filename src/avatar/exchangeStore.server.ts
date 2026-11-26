/**
 * GRID-DOWN EXCHANGE STORE — node-only, server-side.
 *
 * The durable half of the exchange door: one JSON file in the
 * exchange folder on the core (~/.local/share/augie/exchange/
 * exchange.json), owner-only (0600, folder 0700), with the
 * Outbox and Inbox folders beside it. The daemon setup script
 * (scripts/parrot-exchange-setup.sh) reads THIS SAME FILE on
 * the core machine and builds the real sshd door from it —
 * that is where the two halves meet.
 *
 * SECRETS LAW: the store holds public keys and fingerprints
 * only. A grant's private key is generated here, returned to
 * the Captain ONCE by the server function that made the grant,
 * and never written anywhere. There is no plaintext password
 * in this system at all — the door takes keys, not passwords.
 *
 * Where there is no node filesystem (the Cloudflare Worker)
 * the store is unavailable and says so — the exchange is a
 * capability of the core machine, like the cameras.
 */
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import {
  sanitizeExchangeFile,
  type ExchangeFile,
} from "./exchange";

type ExchangeFs = typeof import("node:fs/promises");

const STORE_FILE = "exchange.json";

export interface ExchangeStore {
  read(): Promise<ExchangeFile>;
  /** Serialized read-modify-write; the mutator returns the next file. */
  update(mutator: (file: ExchangeFile) => ExchangeFile): Promise<ExchangeFile>;
  /** The exchange folder itself (~/.local/share/augie/exchange). */
  readonly directory: string;
  /** Files he offers for download live here. */
  readonly outboxDirectory: string;
  /** Files people leave for him live here. */
  readonly inboxDirectory: string;
  /** Make sure the exchange folders exist (0700). */
  ensureFolders(): Promise<void>;
}

export class FileExchangeStore implements ExchangeStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: ExchangeFs,
    private readonly directoryPath: string,
  ) {}

  private get filePath(): string {
    return `${this.directoryPath}/${STORE_FILE}`;
  }

  get directory(): string {
    return this.directoryPath;
  }

  get outboxDirectory(): string {
    return `${this.directoryPath}/outbox`;
  }

  get inboxDirectory(): string {
    return `${this.directoryPath}/inbox`;
  }

  async ensureFolders(): Promise<void> {
    await this.fs.mkdir(this.outboxDirectory, { recursive: true, mode: 0o700 });
    await this.fs.mkdir(this.inboxDirectory, { recursive: true, mode: 0o700 });
  }

  async read(): Promise<ExchangeFile> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      return sanitizeExchangeFile(parsed);
    } catch {
      return sanitizeExchangeFile(null);
    }
  }

  private async writeAll(file: ExchangeFile): Promise<void> {
    await this.fs.mkdir(this.directoryPath, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.filePath, JSON.stringify(file, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  update(mutator: (file: ExchangeFile) => ExchangeFile): Promise<ExchangeFile> {
    const job = async () => {
      const current = await this.read();
      const next = sanitizeExchangeFile(mutator(current));
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

let storePromise: Promise<FileExchangeStore | null> | null = null;

export function getExchangeStore(): Promise<FileExchangeStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FileExchangeStore(fs, `${home}/.local/share/augie/exchange`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}

/* ------------------------------------------------------------------ */
/* Keys — made on the core, at grant time                              */
/* ------------------------------------------------------------------ */

function sshString(bytes: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(bytes.length, 0);
  return Buffer.concat([len, bytes]);
}

function sshUint32(value: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(value >>> 0, 0);
  return b;
}

/** The OpenSSH public blob for an Ed25519 key: string "ssh-ed25519" + string key. */
export function ed25519PublicBlob(rawPublicKey: Buffer): Buffer {
  return Buffer.concat([sshString(Buffer.from("ssh-ed25519", "utf8")), sshString(rawPublicKey)]);
}

/** The standard fingerprint: "SHA256:" + base64(sha256(blob)), padding stripped. */
export function ed25519Fingerprint(rawPublicKey: Buffer): string {
  const digest = createHash("sha256").update(ed25519PublicBlob(rawPublicKey)).digest("base64");
  return `SHA256:${digest.replace(/=+$/, "")}`;
}

export interface GeneratedExchangeKey {
  /** "ssh-ed25519 AAAA… username@augie-exchange" — the only half the store keeps. */
  publicKeyLine: string;
  fingerprint: string;
  /** The OpenSSH private key file text. Shown ONCE; never stored. */
  privateKeyPem: string;
}

/**
 * The OpenSSH private key format ("openssh-key-v1", no
 * passphrase) — the file every SFTP client reads natively.
 * Layout per PROTOCOL.key: magic, cipher/kdf "none", the
 * public blob, then the private section with its doubled
 * check number, the seed||public private bytes, and 1,2,3…
 * padding to the 8-byte block.
 */
export function ed25519OpenSshPrivateKey(
  seed: Buffer,
  rawPublicKey: Buffer,
  comment: string,
): string {
  const check = randomBytes(4).readUInt32BE(0);
  const privateSection = Buffer.concat([
    sshUint32(check),
    sshUint32(check),
    sshString(Buffer.from("ssh-ed25519", "utf8")),
    sshString(rawPublicKey),
    sshString(Buffer.concat([seed, rawPublicKey])),
    sshString(Buffer.from(comment, "utf8")),
  ]);
  const blockSize = 8;
  const padLen = blockSize - (privateSection.length % blockSize);
  const padding = Buffer.from(Array.from({ length: padLen }, (_, i) => i + 1));
  const body = Buffer.concat([
    Buffer.from("openssh-key-v1\0", "utf8"),
    sshString(Buffer.from("none", "utf8")),
    sshString(Buffer.from("none", "utf8")),
    sshString(Buffer.alloc(0)),
    sshUint32(1),
    sshString(ed25519PublicBlob(rawPublicKey)),
    sshString(Buffer.concat([privateSection, padding])),
  ]);
  const b64 = body.toString("base64");
  const lines = b64.match(/.{1,70}/g) ?? [];
  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${lines.join("\n")}\n-----END OPENSSH PRIVATE KEY-----\n`;
}

/** Make a fresh keypair for one grant. The private half leaves with the caller. */
export function generateExchangeKey(username: string): GeneratedExchangeKey {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pubJwk = publicKey.export({ format: "jwk" }) as { x?: string };
  const privJwk = privateKey.export({ format: "jwk" }) as { d?: string };
  if (!pubJwk.x || !privJwk.d) throw new Error("The core could not make a key.");
  const rawPublicKey = Buffer.from(pubJwk.x, "base64url");
  const seed = Buffer.from(privJwk.d, "base64url");
  const comment = `${username}@augie-exchange`;
  return {
    publicKeyLine: `ssh-ed25519 ${ed25519PublicBlob(rawPublicKey).toString("base64")} ${comment}`,
    fingerprint: ed25519Fingerprint(rawPublicKey),
    privateKeyPem: ed25519OpenSshPrivateKey(seed, rawPublicKey, comment),
  };
}

/** A short random suffix for grant ids and login names. */
export function exchangeSuffix(): string {
  return randomBytes(3).toString("hex");
}
