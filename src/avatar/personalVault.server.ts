/**
 * PERSONAL VAULT — the server functions (personal-safety pass,
 * owner order 2026-11-26). Operator-only: every function
 * re-verifies the operator session, like every door in this
 * house. What crosses the wire is the index (types, labels,
 * dates) and — on his tap, after the record check — one
 * document's bytes as a data URL. Nothing is published, nothing
 * is sent anywhere else, and no vault file ever rides an
 * external call.
 *
 * The same door serves the stop-mode evidence recordings into
 * the vault window's "Interaction recordings" list — again
 * only by a name that stands on the evidence record.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { getPersonalVaultStore } from "./personalVaultStore.server";
import { getEvidenceStore } from "./evidenceStore.server";
import {
  extensionForMediaType,
  isAcceptedVaultMediaType,
  isBareVaultFileName,
  isVaultDocType,
  vaultFileName,
  VAULT_MAX_DOCUMENTS,
  VAULT_MAX_FILE_BYTES,
  type VaultDocument,
} from "./personalVault";
import { isBareEvidenceFileName, type StopSession } from "./evidence";

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

export type VaultNoteResult = { authorized: boolean; ok: boolean; note: string };

export interface VaultView {
  authorized: boolean;
  storageAvailable: boolean;
  documents: VaultDocument[];
  /** Finished stop-mode sessions, newest first — their recordings are his evidence. */
  stops: StopSession[];
  /** The stop in progress right now, if one is on. */
  activeStop: StopSession | null;
}

const emptyView: VaultView = {
  authorized: false,
  storageAvailable: false,
  documents: [],
  stops: [],
  activeStop: null,
};

export const getPersonalVault = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid vault request.");
    return input;
  })
  .handler(async ({ data }): Promise<VaultView> => {
    if (!(await authorized(data.accessToken))) return emptyView;
    const vaultStore = await getPersonalVaultStore();
    const evidenceStore = await getEvidenceStore();
    if (!vaultStore) return { ...emptyView, authorized: true };
    const index = await vaultStore.read();
    const evidence = evidenceStore ? await evidenceStore.read() : null;
    return {
      authorized: true,
      storageAvailable: true,
      documents: index.documents,
      stops: evidence?.stops ?? [],
      activeStop: evidence?.active ?? null,
    };
  });

/* ------------------------------ add ------------------------------ */

export type AddVaultDocumentInput = TokenInput & {
  type: string;
  label: string;
  mediaType: string;
  /** The file's bytes, base64 — the only road in. */
  dataBase64: string;
};

export const addVaultDocument = createServerFn({ method: "POST" })
  .validator((input: unknown): AddVaultDocumentInput => {
    const v = input as AddVaultDocumentInput;
    if (
      !isTokenInput(input) ||
      typeof v.type !== "string" ||
      typeof v.label !== "string" ||
      typeof v.mediaType !== "string" ||
      typeof v.dataBase64 !== "string"
    ) {
      throw new Error("Invalid vault document.");
    }
    return v;
  })
  .handler(async ({ data }): Promise<VaultNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    if (!isVaultDocType(data.type)) {
      return { authorized: true, ok: false, note: "That is not a document type the vault keeps." };
    }
    const label = data.label.trim().slice(0, 120);
    if (!label) return { authorized: true, ok: false, note: "Give the document a name first." };
    if (!isAcceptedVaultMediaType(data.mediaType)) {
      return {
        authorized: true,
        ok: false,
        note: "The vault takes pictures of papers (JPEG, PNG, WebP, HEIC) and PDFs — nothing else.",
      };
    }
    let bytes: Buffer;
    try {
      bytes = Buffer.from(data.dataBase64, "base64");
    } catch {
      return { authorized: true, ok: false, note: "Those bytes did not read — nothing was stored." };
    }
    if (bytes.length === 0) return { authorized: true, ok: false, note: "That file is empty — nothing was stored." };
    if (bytes.length > VAULT_MAX_FILE_BYTES) {
      return { authorized: true, ok: false, note: "That file is over the vault's 15 MB limit — nothing was stored." };
    }
    const vaultStore = await getPersonalVaultStore();
    if (!vaultStore) {
      return { authorized: true, ok: false, note: "The vault lives on the core machine — no local vault store here." };
    }
    const index = await vaultStore.read();
    if (index.documents.length >= VAULT_MAX_DOCUMENTS) {
      return { authorized: true, ok: false, note: `The vault already holds ${VAULT_MAX_DOCUMENTS} documents — its set limit.` };
    }
    const now = Date.now();
    const tail = Math.random().toString(36).slice(2, 10);
    const file = vaultFileName(data.type, now, tail, extensionForMediaType(data.mediaType));
    await vaultStore.writeDocument(file, bytes);
    const doc: VaultDocument = {
      id: `vault-${now}-${tail}`,
      type: data.type,
      label,
      file,
      mediaType: data.mediaType,
      addedAt: now,
      bytes: bytes.length,
    };
    await vaultStore.update((f) => ({ documents: [doc, ...f.documents] }));
    return { authorized: true, ok: true, note: `“${label}” is in the vault — stored on this machine only.` };
  });

/* ------------------------------ serve ------------------------------ */

export type VaultDocumentInput = TokenInput & { id: string };
export type VaultDocumentResult = {
  authorized: boolean;
  dataUrl: string | null;
  mediaType: string | null;
  fileName: string | null;
  note: string;
};

/**
 * One document, served to his own signed-in window as a data
 * URL. The id must stand on the index and the stored name must
 * still be a bare name — the record check the sector stills
 * live under, kept here too.
 */
export const getVaultDocument = createServerFn({ method: "POST" })
  .validator((input: unknown): VaultDocumentInput => {
    if (!isTokenInput(input) || typeof (input as VaultDocumentInput).id !== "string") {
      throw new Error("Invalid vault document request.");
    }
    return input as VaultDocumentInput;
  })
  .handler(async ({ data }): Promise<VaultDocumentResult> => {
    const denied: VaultDocumentResult = {
      authorized: false,
      dataUrl: null,
      mediaType: null,
      fileName: null,
      note: "The operator session is gone — sign in again.",
    };
    if (!(await authorized(data.accessToken))) return denied;
    const vaultStore = await getPersonalVaultStore();
    if (!vaultStore) return { ...denied, authorized: true, note: "No local vault store here." };
    const index = await vaultStore.read();
    const doc = index.documents.find((d) => d.id === data.id);
    if (!doc || !isBareVaultFileName(doc.file)) {
      return { ...denied, authorized: true, note: "That document is not on the vault's index." };
    }
    const bytes = await vaultStore.readDocument(doc.file);
    if (!bytes) {
      return { ...denied, authorized: true, note: "The document is on the index but its file did not read." };
    }
    return {
      authorized: true,
      dataUrl: `data:${doc.mediaType};base64,${Buffer.from(bytes).toString("base64")}`,
      mediaType: doc.mediaType,
      fileName: doc.file,
      note: "The document, from the core.",
    };
  });

/* ------------------------------ remove ------------------------------ */

export const removeVaultDocument = createServerFn({ method: "POST" })
  .validator((input: unknown): VaultDocumentInput => {
    if (!isTokenInput(input) || typeof (input as VaultDocumentInput).id !== "string") {
      throw new Error("Invalid vault removal request.");
    }
    return input as VaultDocumentInput;
  })
  .handler(async ({ data }): Promise<VaultNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "The operator session is gone — sign in again." };
    }
    const vaultStore = await getPersonalVaultStore();
    if (!vaultStore) {
      return { authorized: true, ok: false, note: "The vault lives on the core machine — no local vault store here." };
    }
    const index = await vaultStore.read();
    const doc = index.documents.find((d) => d.id === data.id);
    if (!doc) return { authorized: true, ok: false, note: "That document is not on the vault's index." };
    await vaultStore.removeDocument(doc.file);
    await vaultStore.update((f) => ({ documents: f.documents.filter((d) => d.id !== data.id) }));
    return { authorized: true, ok: true, note: `“${doc.label}” is out of the vault — file and index entry both removed.` };
  });

/* ------------------------------ evidence ------------------------------ */

export type EvidenceRecordingInput = TokenInput & { stopId: string };
export type EvidenceRecordingResult = {
  authorized: boolean;
  dataUrl: string | null;
  fileName: string | null;
  note: string;
};

/**
 * One stop's recording, served the same way: the stop must
 * stand on the evidence record and carry a recording whose
 * name is bare. The file is a video/audio container — it
 * crosses as a data URL for his own window's player/download,
 * nowhere else.
 */
export const getEvidenceRecording = createServerFn({ method: "POST" })
  .validator((input: unknown): EvidenceRecordingInput => {
    if (!isTokenInput(input) || typeof (input as EvidenceRecordingInput).stopId !== "string") {
      throw new Error("Invalid evidence request.");
    }
    return input as EvidenceRecordingInput;
  })
  .handler(async ({ data }): Promise<EvidenceRecordingResult> => {
    const denied: EvidenceRecordingResult = {
      authorized: false,
      dataUrl: null,
      fileName: null,
      note: "The operator session is gone — sign in again.",
    };
    if (!(await authorized(data.accessToken))) return denied;
    const evidenceStore = await getEvidenceStore();
    if (!evidenceStore) return { ...denied, authorized: true, note: "No local evidence store here." };
    const file = await evidenceStore.read();
    const stop =
      file.stops.find((s) => s.id === data.stopId) ??
      (file.active && file.active.id === data.stopId ? file.active : null);
    if (!stop || !stop.recording || !isBareEvidenceFileName(stop.recording.file)) {
      return { ...denied, authorized: true, note: "That stop has no recording on the evidence record." };
    }
    const bytes = await evidenceStore.readRecording(stop.recording.file);
    if (!bytes) {
      return { ...denied, authorized: true, note: "The recording is on the record but its file did not read." };
    }
    return {
      authorized: true,
      dataUrl: `data:video/x-matroska;base64,${Buffer.from(bytes).toString("base64")}`,
      fileName: stop.recording.file,
      note: "The stop's recording, from the core.",
    };
  });
