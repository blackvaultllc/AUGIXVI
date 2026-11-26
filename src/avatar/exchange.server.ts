/**
 * GRID-DOWN EXCHANGE — the server functions (owner order
 * 2026-11-26). Operator-only, like every window in this house:
 * every function re-verifies the operator session.
 *
 * What crosses the wire: door STATE, grant records WITHOUT any
 * secret (there is none to send — the store holds public keys
 * and fingerprints), folder listings, log entries, and file
 * contents the Captain himself asks for. A grant's PRIVATE key
 * crosses exactly once — in the answer to the create call that
 * made it — and is never stored or sent again.
 *
 * The door's law is enforced here, not just drawn: the door
 * cannot be opened while the ALL-STOP is in force, and the
 * state view resolves the door through the same pure law the
 * tests pin (exchange.ts).
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { allStopInForce } from "./cameraPresenceRuntime.server";
import { getExchangeStore } from "./exchangeStore.server";
import { generateExchangeKey, exchangeSuffix } from "./exchangeStore.server";
import {
  exchangeServiceListening,
  listExchangeFolder,
  listExchangeInbox,
  machineExchangeAddresses,
  readDaemonLogEntries,
  type ExchangeAddress,
  type ExchangeFolderFile,
} from "./exchangeRuntime.server";
import {
  appendExchangeLog,
  cleanExchangeFileName,
  cleanExchangeFilePath,
  doorStandsOpen,
  exchangeLogEntry,
  grantIsLive,
  uniqueUsername,
  validateGrantDraft,
  type ExchangeAccess,
  type ExchangeFile,
  type ExchangeLogEntry,
} from "./exchange";

type TokenInput = { accessToken: string };

function isTokenInput(input: unknown): input is TokenInput {
  return (
    typeof input === "object" &&
    input !== null &&
    typeof (input as TokenInput).accessToken === "string" &&
    (input as TokenInput).accessToken.length > 0 &&
    (input as TokenInput).accessToken.length <= 16_384
  );
}

async function authorized(accessToken: string): Promise<boolean> {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return verification.authorized;
}

/* ------------------------------------------------------------------ */
/* The state view                                                      */
/* ------------------------------------------------------------------ */

export interface ExchangeGrantView {
  id: string;
  name: string;
  username: string;
  access: ExchangeAccess;
  createdAt: number;
  expiresAt: number;
  revokedAt: number;
  keyFingerprint: string;
  live: boolean;
}

export interface ExchangeView {
  authorized: boolean;
  storageAvailable: boolean;
  /** The Captain's switch, as recorded. */
  enabled: boolean;
  /** Switch on AND no ALL-STOP — the door as the law resolves it. */
  doorOpen: boolean;
  allStop: boolean;
  /** The exchange service is really listening on this machine right now. */
  serviceListening: boolean;
  port: number;
  addresses: ExchangeAddress[];
  grants: ExchangeGrantView[];
  outbox: ExchangeFolderFile[];
  inbox: ExchangeFolderFile[];
  /** The system's own log plus the service's connection entries, oldest first. */
  log: ExchangeLogEntry[];
  /** False when the service has never run here — no connections.log exists. */
  daemonLogAvailable: boolean;
}

const emptyView: ExchangeView = {
  authorized: false,
  storageAvailable: false,
  enabled: false,
  doorOpen: false,
  allStop: false,
  serviceListening: false,
  port: 0,
  addresses: [],
  grants: [],
  outbox: [],
  inbox: [],
  log: [],
  daemonLogAvailable: false,
};

export const getExchangeState = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid exchange request.");
    return input;
  })
  .handler(async ({ data }): Promise<ExchangeView> => {
    if (!(await authorized(data.accessToken))) return emptyView;
    const store = await getExchangeStore();
    if (!store) return { ...emptyView, authorized: true };
    await store.ensureFolders().catch(() => undefined);
    const file = await store.read();
    const allStop = await allStopInForce();
    const now = Date.now();
    const known = new Set(file.grants.map((g) => g.username));
    const [listening, outbox, inbox, daemonEntries] = await Promise.all([
      exchangeServiceListening(file.port),
      listExchangeFolder(store.outboxDirectory),
      listExchangeInbox(store.inboxDirectory),
      readDaemonLogEntries(store.directory, known),
    ]);
    const log = [...file.log, ...(daemonEntries ?? [])].sort((a, b) => a.at - b.at);
    return {
      authorized: true,
      storageAvailable: true,
      enabled: file.enabled,
      doorOpen: doorStandsOpen(file, allStop),
      allStop,
      serviceListening: listening,
      port: file.port,
      addresses: machineExchangeAddresses(),
      grants: file.grants.map((g) => ({
        id: g.id,
        name: g.name,
        username: g.username,
        access: g.access,
        createdAt: g.createdAt,
        expiresAt: g.expiresAt,
        revokedAt: g.revokedAt,
        keyFingerprint: g.keyFingerprint,
        live: grantIsLive(g, now),
      })),
      outbox,
      inbox,
      log,
      daemonLogAvailable: daemonEntries !== null,
    };
  });

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export type ExchangeNote = { authorized: boolean; ok: boolean; note: string };

type EnabledInput = TokenInput & { enabled: boolean };

export const setExchangeEnabled = createServerFn({ method: "POST" })
  .validator((input: unknown): EnabledInput => {
    if (!isTokenInput(input) || typeof (input as EnabledInput).enabled !== "boolean") {
      throw new Error("Invalid door request.");
    }
    return input as EnabledInput;
  })
  .handler(async ({ data }): Promise<ExchangeNote> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const store = await getExchangeStore();
    if (!store) {
      return { authorized: true, ok: false, note: "The exchange lives on the core machine — no local store here." };
    }
    if (data.enabled && (await allStopInForce())) {
      return {
        authorized: true,
        ok: false,
        note: "Refused — the ALL-STOP is in force. The door stays closed until you release the All-Stop.",
      };
    }
    const now = Date.now();
    await store.update((file) =>
      appendExchangeLog(
        { ...file, enabled: data.enabled },
        exchangeLogEntry(
          data.enabled ? "door-opened" : "door-closed",
          now,
          "",
          data.enabled
            ? "The Captain opened the exchange door."
            : "The Captain closed the exchange door.",
        ),
      ),
    );
    return {
      authorized: true,
      ok: true,
      note: data.enabled
        ? "The door is open in the record. The exchange service on the Parrot takes it from there — if the service is not running yet, the window says so."
        : "The door is closed. Nobody can use it, key or no key.",
    };
  });

export type CreateGrantInput = TokenInput & { name: string; access: ExchangeAccess; daysValid: number };

export type CreateGrantResult = ExchangeNote & {
  username: string;
  /** The private key file text — returned ONCE, never stored, never sent again. */
  privateKeyPem: string;
  keyFingerprint: string;
  expiresAt: number;
};

export const createExchangeGrant = createServerFn({ method: "POST" })
  .validator((input: unknown): CreateGrantInput => {
    if (!isTokenInput(input) || !validateGrantDraft(input)) {
      throw new Error("Invalid grant request.");
    }
    return input as CreateGrantInput;
  })
  .handler(async ({ data }): Promise<CreateGrantResult> => {
    const refused: CreateGrantResult = {
      authorized: true,
      ok: false,
      note: "",
      username: "",
      privateKeyPem: "",
      keyFingerprint: "",
      expiresAt: 0,
    };
    if (!(await authorized(data.accessToken))) {
      return { ...refused, authorized: false, note: "The operator session is gone — sign in again." };
    }
    const store = await getExchangeStore();
    if (!store) {
      return { ...refused, note: "The exchange lives on the core machine — no local store here." };
    }
    const draft = validateGrantDraft(data);
    if (!draft) return { ...refused, note: "The grant needs a name and a number of days between 1 and 365." };
    const now = Date.now();
    const expiresAt = now + draft.daysValid * 24 * 60 * 60_000;
    let created: CreateGrantResult | null = null;
    await store.update((file) => {
      const username = uniqueUsername(file, draft.name, exchangeSuffix());
      const key = generateExchangeKey(username);
      const grant = {
        id: `xgrant-${now}-${exchangeSuffix()}`,
        name: draft.name,
        username,
        access: draft.access,
        createdAt: now,
        expiresAt,
        revokedAt: 0,
        publicKey: key.publicKeyLine,
        keyFingerprint: key.fingerprint,
      };
      created = {
        authorized: true,
        ok: true,
        note: `Access made for ${draft.name}. Their key is shown once, below — save it now and hand it over. It is not kept anywhere.`,
        username,
        privateKeyPem: key.privateKeyPem,
        keyFingerprint: key.fingerprint,
        expiresAt,
      };
      return appendExchangeLog(
        { ...file, grants: [...file.grants, grant] },
        exchangeLogEntry(
          "grant-created",
          now,
          username,
          `The Captain gave ${draft.name} access (${username}) until ${new Date(expiresAt).toLocaleDateString()}.`,
        ),
      );
    });
    return created ?? { ...refused, note: "The grant could not be made." };
  });

type GrantIdInput = TokenInput & { grantId: string };

export const revokeExchangeGrant = createServerFn({ method: "POST" })
  .validator((input: unknown): GrantIdInput => {
    if (!isTokenInput(input) || typeof (input as GrantIdInput).grantId !== "string") {
      throw new Error("Invalid revoke request.");
    }
    return input as GrantIdInput;
  })
  .handler(async ({ data }): Promise<ExchangeNote> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const store = await getExchangeStore();
    if (!store) {
      return { authorized: true, ok: false, note: "The exchange lives on the core machine — no local store here." };
    }
    const now = Date.now();
    let found: ExchangeFile["grants"][number] | undefined;
    await store.update((file) => {
      const grants = file.grants.map((g) => {
        if (g.id !== data.grantId || g.revokedAt > 0) return g;
        found = { ...g, revokedAt: now };
        return found;
      });
      if (!found) return file;
      return appendExchangeLog(
        { ...file, grants },
        exchangeLogEntry("grant-revoked", now, found.username, `The Captain revoked ${found.name}'s access (${found.username}).`),
      );
    });
    return found
      ? { authorized: true, ok: true, note: "Revoked. That key opens nothing from now on." }
      : { authorized: true, ok: false, note: "That grant is not on the record (or was already revoked)." };
  });

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

/** ~25 MB of file, carried as base64 through the window. Bigger files ride the folders directly. */
const MAX_CARRIED_BYTES = 25 * 1024 * 1024;

type UploadInput = TokenInput & { name: string; base64: string };

export const uploadOutboxFile = createServerFn({ method: "POST" })
  .validator((input: unknown): UploadInput => {
    const u = input as UploadInput;
    if (!isTokenInput(input) || typeof u?.name !== "string" || typeof u?.base64 !== "string") {
      throw new Error("Invalid upload request.");
    }
    return u;
  })
  .handler(async ({ data }): Promise<ExchangeNote> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const name = cleanExchangeFileName(data.name);
    if (!name) return { authorized: true, ok: false, note: "That file name cannot ride the exchange." };
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length === 0) return { authorized: true, ok: false, note: "That file is empty — nothing was put in the Outbox." };
    if (bytes.length > MAX_CARRIED_BYTES) {
      return {
        authorized: true,
        ok: false,
        note: "That file is bigger than the window carries (25 MB). Put it in the Outbox folder on the Parrot directly: ~/.local/share/augie/exchange/outbox/",
      };
    }
    const store = await getExchangeStore();
    if (!store) {
      return { authorized: true, ok: false, note: "The exchange lives on the core machine — no local store here." };
    }
    await store.ensureFolders();
    const fs = await import("node:fs/promises");
    await fs.writeFile(`${store.outboxDirectory}/${name}`, bytes, { mode: 0o600 });
    const now = Date.now();
    await store.update((file) =>
      appendExchangeLog(file, exchangeLogEntry("file-out", now, "", `The Captain put ${name} in the Outbox.`)),
    );
    return { authorized: true, ok: true, note: `${name} is in the Outbox, ready for anyone with download access.` };
  });

type FileInput = TokenInput & { folder: "outbox" | "inbox"; path: string };

function isFileInput(input: unknown): input is FileInput {
  const f = input as FileInput;
  return (
    isTokenInput(input) &&
    (f?.folder === "outbox" || f?.folder === "inbox") &&
    typeof f?.path === "string"
  );
}

export type DownloadResult = ExchangeNote & { base64: string };

export const downloadExchangeFile = createServerFn({ method: "POST" })
  .validator((input: unknown): FileInput => {
    if (!isFileInput(input)) throw new Error("Invalid download request.");
    return input;
  })
  .handler(async ({ data }): Promise<DownloadResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again.", base64: "" };
    }
    const path = cleanExchangeFilePath(data.path);
    if (!path) return { authorized: true, ok: false, note: "That file name cannot ride the exchange.", base64: "" };
    const name = path.split("/").pop() ?? path;
    const store = await getExchangeStore();
    if (!store) {
      return { authorized: true, ok: false, note: "The exchange lives on the core machine — no local store here.", base64: "" };
    }
    const dir = data.folder === "outbox" ? store.outboxDirectory : store.inboxDirectory;
    try {
      const fs = await import("node:fs/promises");
      const stat = await fs.stat(`${dir}/${path}`);
      if (stat.size > MAX_CARRIED_BYTES) {
        return {
          authorized: true,
          ok: false,
          note: "That file is bigger than the window carries (25 MB). Copy it from the folder on the Parrot directly.",
          base64: "",
        };
      }
      const bytes = await fs.readFile(`${dir}/${path}`);
      return { authorized: true, ok: true, note: `Here is ${name}.`, base64: bytes.toString("base64") };
    } catch {
      return { authorized: true, ok: false, note: "That file is not in the folder anymore.", base64: "" };
    }
  });

export const deleteExchangeFile = createServerFn({ method: "POST" })
  .validator((input: unknown): FileInput => {
    if (!isFileInput(input)) throw new Error("Invalid delete request.");
    return input;
  })
  .handler(async ({ data }): Promise<ExchangeNote> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const path = cleanExchangeFilePath(data.path);
    if (!path) return { authorized: true, ok: false, note: "That file name cannot ride the exchange." };
    const name = path.split("/").pop() ?? path;
    const store = await getExchangeStore();
    if (!store) {
      return { authorized: true, ok: false, note: "The exchange lives on the core machine — no local store here." };
    }
    const dir = data.folder === "outbox" ? store.outboxDirectory : store.inboxDirectory;
    try {
      const fs = await import("node:fs/promises");
      await fs.unlink(`${dir}/${path}`);
    } catch {
      return { authorized: true, ok: false, note: "That file is not in the folder anymore." };
    }
    const now = Date.now();
    await store.update((file) =>
      appendExchangeLog(
        file,
        exchangeLogEntry(
          data.folder === "outbox" ? "file-out" : "file-in",
          now,
          "",
          data.folder === "outbox"
            ? `The Captain took ${name} out of the Outbox.`
            : `The Captain removed ${name} from the Inbox.`,
        ),
      ),
    );
    return { authorized: true, ok: true, note: `${name} is removed.` };
  });
