import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appendExchangeLog,
  canDownload,
  canUpload,
  cleanExchangeFileName,
  cleanExchangeFilePath,
  daemonLogEntry,
  doorStandsOpen,
  emptyExchangeFile,
  exchangeLogEntry,
  grantMayMove,
  resolveExchangeAccess,
  sanitizeExchangeFile,
  uniqueUsername,
  usernameBase,
  validateGrantDraft,
  type ExchangeFile,
  type ExchangeGrant,
} from "@/avatar/exchange";
import {
  FileExchangeStore,
  ed25519Fingerprint,
  ed25519OpenSshPrivateKey,
  ed25519PublicBlob,
  generateExchangeKey,
} from "@/avatar/exchangeStore.server";

/**
 * THE GRID-DOWN EXCHANGE (owner order 2026-11-26) — his secure
 * file door for when the network is down: SFTP, the secure form
 * of his FTP idea. These pins hold its laws:
 *
 *   · NO SECRET IN THE STORE — a grant's private key is made on
 *     the core, shown once, and never written; the store file
 *     holds public keys and fingerprints only, and its text
 *     never contains the private key.
 *   · THE DOOR IS CLOSED BY DEFAULT — and the ALL-STOP closes
 *     it over the switch. Expired and revoked grants resolve
 *     to nothing.
 *   · FOLDER LAW IS PER PERSON — upload-only cannot download
 *     (cannot read the Outbox); download-only cannot upload.
 *   · NO RECORD, NO ENTRY — the log forms from recorded events
 *     only; a daemon line becomes an entry only when it names
 *     a login this store issued.
 */

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60_000;

function grant(overrides: Partial<ExchangeGrant> = {}): ExchangeGrant {
  return {
    id: "xgrant-test",
    name: "Sam",
    username: "sam-ab12cd",
    access: "both",
    createdAt: NOW - DAY,
    expiresAt: NOW + DAY,
    revokedAt: 0,
    publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest sam-ab12cd@augie-exchange",
    keyFingerprint: "SHA256:test",
    ...overrides,
  };
}

function door(overrides: Partial<ExchangeFile> = {}): ExchangeFile {
  return { ...emptyExchangeFile(), enabled: true, grants: [grant()], ...overrides };
}

describe("the door's law — resolution", () => {
  it("is closed by default: an empty record resolves nobody", () => {
    const file = emptyExchangeFile();
    expect(file.enabled).toBe(false);
    expect(doorStandsOpen(file, false)).toBe(false);
    expect(resolveExchangeAccess(file, "sam-ab12cd", NOW, false)).toEqual({
      allowed: false,
      reason: "door-closed",
    });
  });

  it("the ALL-STOP closes the door over the switch", () => {
    const file = door();
    expect(doorStandsOpen(file, true)).toBe(false);
    expect(resolveExchangeAccess(file, "sam-ab12cd", NOW, true)).toEqual({
      allowed: false,
      reason: "all-stop",
    });
  });

  it("a live grant resolves; an unknown login does not", () => {
    const file = door();
    const ok = resolveExchangeAccess(file, "sam-ab12cd", NOW, false);
    expect(ok.allowed).toBe(true);
    expect(resolveExchangeAccess(file, "nobody-000000", NOW, false)).toEqual({
      allowed: false,
      reason: "no-such-login",
    });
  });

  it("an expired grant resolves to nothing", () => {
    const file = door({ grants: [grant({ expiresAt: NOW - 1 })] });
    expect(resolveExchangeAccess(file, "sam-ab12cd", NOW, false)).toEqual({
      allowed: false,
      reason: "expired",
    });
  });

  it("a revoked grant resolves to nothing", () => {
    const file = door({ grants: [grant({ revokedAt: NOW - 1000 })] });
    expect(resolveExchangeAccess(file, "sam-ab12cd", NOW, false)).toEqual({
      allowed: false,
      reason: "revoked",
    });
  });
});

describe("folder law — per person", () => {
  it("upload-only cannot download; download-only cannot upload; both can do both", () => {
    const up = door({ grants: [grant({ access: "upload" })] });
    expect(grantMayMove(up, "sam-ab12cd", "download", NOW, false)).toBe(false);
    expect(grantMayMove(up, "sam-ab12cd", "upload", NOW, false)).toBe(true);
    const down = door({ grants: [grant({ access: "download" })] });
    expect(grantMayMove(down, "sam-ab12cd", "download", NOW, false)).toBe(true);
    expect(grantMayMove(down, "sam-ab12cd", "upload", NOW, false)).toBe(false);
    const both = door();
    expect(grantMayMove(both, "sam-ab12cd", "download", NOW, false)).toBe(true);
    expect(grantMayMove(both, "sam-ab12cd", "upload", NOW, false)).toBe(true);
    expect(canDownload("upload")).toBe(false);
    expect(canUpload("download")).toBe(false);
  });

  it("nobody moves anything while the door is closed or the ALL-STOP is on", () => {
    expect(grantMayMove(door({ enabled: false }), "sam-ab12cd", "download", NOW, false)).toBe(false);
    expect(grantMayMove(door(), "sam-ab12cd", "upload", NOW, true)).toBe(false);
  });
});

describe("grant drafts and login names", () => {
  it("a draft needs a name and 1–365 days", () => {
    expect(validateGrantDraft({ name: "Sam", access: "both", daysValid: 7 })).toEqual({
      name: "Sam",
      access: "both",
      daysValid: 7,
    });
    expect(validateGrantDraft({ name: "", access: "both", daysValid: 7 })).toBeNull();
    expect(validateGrantDraft({ name: "Sam", access: "both", daysValid: 0 })).toBeNull();
    expect(validateGrantDraft({ name: "Sam", access: "both", daysValid: 366 })).toBeNull();
    expect(validateGrantDraft({ name: "Sam", access: "sideways", daysValid: 7 })?.access).toBe("download");
  });

  it("login names are plain and unique", () => {
    expect(usernameBase("Sam Carter!")).toBe("sam-carter");
    expect(usernameBase("!!!")).toBe("guest");
    const file = door();
    expect(uniqueUsername(file, "Sam", "ab12cd")).not.toBe("sam-ab12cd");
    expect(uniqueUsername(emptyExchangeFile(), "Sam", "ab12cd")).toBe("sam-ab12cd");
  });
});

describe("the store — no secret is ever kept", () => {
  it("grant creation writes public material only: the file text never holds the private key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "augie-exchange-test-"));
    try {
      const store = new FileExchangeStore(fsp, dir);
      const key = generateExchangeKey("sam-ab12cd");
      await store.update((file) => ({
        ...file,
        grants: [
          {
            id: "xgrant-1",
            name: "Sam",
            username: "sam-ab12cd",
            access: "both" as const,
            createdAt: NOW,
            expiresAt: NOW + DAY,
            revokedAt: 0,
            publicKey: key.publicKeyLine,
            keyFingerprint: key.fingerprint,
          },
        ],
      }));
      const text = await readFile(join(dir, "exchange.json"), "utf8");
      expect(text).toContain("ssh-ed25519 ");
      expect(text).toContain(key.fingerprint);
      expect(text).not.toContain("OPENSSH PRIVATE KEY");
      expect(text).not.toContain(key.privateKeyPem.split("\n")[1]);
      // And the private key itself never appears under any slicing of it.
      for (const line of key.privateKeyPem.split("\n")) {
        if (line.length > 12) expect(text).not.toContain(line);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("a malformed record sanitizes to a CLOSED door", () => {
    expect(sanitizeExchangeFile(null).enabled).toBe(false);
    expect(sanitizeExchangeFile({ enabled: "yes" }).enabled).toBe(false);
    expect(sanitizeExchangeFile({ enabled: true, port: 99999 }).port).toBe(2222);
    expect(sanitizeExchangeFile({ enabled: true, grants: [{ id: "x" }] }).grants).toEqual([]);
  });
});

describe("keys — the OpenSSH shapes are real", () => {
  it("the fingerprint is the standard SHA256 of the public blob", () => {
    const key = generateExchangeKey("sam-ab12cd");
    const blob = Buffer.from(key.publicKeyLine.split(" ")[1] ?? "", "base64");
    const raw = blob.subarray(blob.length - 32);
    expect(key.fingerprint).toBe(ed25519Fingerprint(raw));
    expect(ed25519PublicBlob(raw).equals(blob)).toBe(true);
    expect(key.fingerprint.startsWith("SHA256:")).toBe(true);
    expect(key.fingerprint).not.toContain("=");
  });

  it("the private key file parses back: magic, check numbers, key type, padding", () => {
    const key = generateExchangeKey("sam-ab12cd");
    expect(key.privateKeyPem.startsWith("-----BEGIN OPENSSH PRIVATE KEY-----")).toBe(true);
    const body = Buffer.from(
      key.privateKeyPem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""),
      "base64",
    );
    expect(body.subarray(0, 15).toString("utf8")).toBe("openssh-key-v1\0");
    // Walk the fields: cipher "none", kdf "none", empty kdfoptions, one key.
    let off = 15;
    const readStr = (): Buffer => {
      const len = body.readUInt32BE(off);
      off += 4;
      const out = body.subarray(off, off + len);
      off += len;
      return out;
    };
    expect(readStr().toString("utf8")).toBe("none");
    expect(readStr().toString("utf8")).toBe("none");
    expect(readStr().length).toBe(0);
    expect(body.readUInt32BE(off)).toBe(1);
    off += 4;
    readStr(); // public blob
    const priv = readStr();
    const check1 = priv.readUInt32BE(0);
    const check2 = priv.readUInt32BE(4);
    expect(check1).toBe(check2);
    let poff = 8;
    const readPrivStr = (): Buffer => {
      const len = priv.readUInt32BE(poff);
      poff += 4;
      const out = priv.subarray(poff, poff + len);
      poff += len;
      return out;
    };
    expect(readPrivStr().toString("utf8")).toBe("ssh-ed25519");
    expect(readPrivStr().length).toBe(32);
    expect(readPrivStr().length).toBe(64);
    readPrivStr(); // comment
    const pad = priv.subarray(poff);
    pad.forEach((byte, i) => expect(byte).toBe(i + 1));
    expect(priv.length % 8).toBe(0);
  });

  it("two grants never share a key", () => {
    const a = generateExchangeKey("sam-ab12cd");
    const b = generateExchangeKey("sam-ab12cd");
    expect(a.publicKeyLine).not.toBe(b.publicKeyLine);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("the encoder round-trips a known seed", () => {
    const seed = Buffer.alloc(32, 7);
    const raw = Buffer.alloc(32, 9);
    const pem = ed25519OpenSshPrivateKey(seed, raw, "x@augie-exchange");
    expect(pem).toContain("BEGIN OPENSSH PRIVATE KEY");
    const body = Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64");
    expect(body.includes(seed)).toBe(true);
    expect(body.includes(raw)).toBe(true);
  });
});

describe("the log — entries form from recorded events only", () => {
  it("system movements append; nothing appears from nowhere", () => {
    const start = emptyExchangeFile();
    expect(start.log).toEqual([]);
    const next = appendExchangeLog(
      start,
      exchangeLogEntry("door-opened", NOW, "", "The Captain opened the exchange door."),
    );
    expect(next.log).toHaveLength(1);
    expect(next.log[0]?.kind).toBe("door-opened");
  });

  it("a daemon line becomes an entry only for a login this store issued", () => {
    const known = new Set(["sam-ab12cd"]);
    const stamp = 1_800_000_000_000;
    const accepted = daemonLogEntry(
      `${stamp} augie sshd[1]: Accepted publickey for sam-ab12cd from 10.0.0.9 port 51000 ssh2: ED25519 SHA256:x`,
      known,
      0,
    );
    expect(accepted?.kind).toBe("connect");
    expect(accepted?.at).toBe(stamp);
    const stranger = daemonLogEntry(
      `${stamp} augie sshd[1]: Accepted publickey for mallory from 10.0.0.9 port 51000 ssh2`,
      known,
      0,
    );
    expect(stranger).toBeNull();
    const noise = daemonLogEntry(`${stamp} augie sshd[1]: Server listening on 0.0.0.0 port 2222.`, known, 0);
    expect(noise).toBeNull();
    const gone = daemonLogEntry(
      `${stamp} augie sshd[1]: Disconnected from user sam-ab12cd 10.0.0.9 port 51000`,
      known,
      0,
    );
    expect(gone?.kind).toBe("disconnect");
  });
});

describe("file names — no paths, no tricks", () => {
  it("plain names pass; paths and dotfiles do not", () => {
    expect(cleanExchangeFileName("setup-tool.zip")).toBe("setup-tool.zip");
    expect(cleanExchangeFileName("../secret")).toBeNull();
    expect(cleanExchangeFileName("a/b")).toBeNull();
    expect(cleanExchangeFileName(".hidden")).toBeNull();
    expect(cleanExchangeFilePath("sam-ab12cd/report.pdf")).toBe("sam-ab12cd/report.pdf");
    expect(cleanExchangeFilePath("a/b/c")).toBeNull();
    expect(cleanExchangeFilePath("sam-ab12cd/../x")).toBeNull();
  });
});

describe("the wiring — stage, manual, and the wall", () => {
  it("the stage carries the Exchange action and mounts the window", () => {
    const stage = readFileSync(resolve(process.cwd(), "src/avatar/AvatarStage.tsx"), "utf8");
    expect(stage).toContain("Grid-Down Exchange");
    expect(stage).toContain("ExchangeWindow");
    expect(stage).toContain("setExchangeOpen(true)");
  });

  it("the manual carries the exchange entry with the honest SFTP line", () => {
    const manual = readFileSync(resolve(process.cwd(), "src/avatar/manualContent.ts"), "utf8");
    expect(manual).toContain('"exchange-how"');
    expect(manual).toContain("the secure form of FTP");
  });

  it("the window names SFTP honestly and never offers plain FTP", () => {
    const windowSrc = readFileSync(resolve(process.cwd(), "src/avatar/ExchangeWindow.tsx"), "utf8");
    expect(windowSrc).toContain("SFTP — the secure form of FTP");
    // No BARE ftp:// anywhere (sftp:// is the door's real shape and is fine).
    expect(/(?<!s)ftp:\/\//.test(windowSrc)).toBe(false);
  });

  it("the daemon script reads the same store the app writes", () => {
    const sync = readFileSync(resolve(process.cwd(), "scripts/parrot-exchange-sync.py"), "utf8");
    expect(sync).toContain("exchange.json");
    expect(sync).toContain("devices-core.json");
    expect(sync).toContain("PasswordAuthentication no");
    const setup = readFileSync(resolve(process.cwd(), "scripts/parrot-exchange-setup.sh"), "utf8");
    expect(setup).toContain("augie-exchange-sync.timer");
  });
});
