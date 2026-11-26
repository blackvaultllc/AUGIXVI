/**
 * PERSONAL VAULT — the pure core of the Personal Vault pass
 * (owner order 2026-11-26: "Make sure we have safeguards and
 * documentation… I'll upload my ID, my driver's license and my
 * passport… and my car documentation, my pink slip — I want to
 * make sure I have all stuff there").
 *
 * What lives here is everything that must be TRUE before any
 * byte touches the store:
 *
 *   · The document types the vault knows. A type outside the
 *     list does not enter the index — the vault is his papers,
 *     not a junk drawer.
 *   · The index entry shape (type, label, file name, added
 *     date, size) — sanitized on every read, so a hand-edited
 *     or half-written index can never invent a document.
 *   · The file-name law: vault files are named by the core,
 *     never by the uploader, and a name that tries to carry a
 *     path is refused outright. Serving checks a file against
 *     the index — the same record-check discipline the sector
 *     stills live under.
 *
 * The vault is OWNER-ONLY and CORE-ONLY: files live in
 * ~/.local/share/augie/personal-vault/ on the core machine,
 * nothing leaves the core, and no code path here (or anywhere)
 * sends a vault file to any external service. Plain TS, no I/O
 * — the server modules do the lifting.
 */

export const VAULT_DOC_TYPES = [
  "drivers-license",
  "passport",
  "vehicle-title",
  "vehicle-registration",
  "insurance-card",
  "other",
] as const;

export type VaultDocType = (typeof VAULT_DOC_TYPES)[number];

export const VAULT_DOC_TYPE_LABELS: Record<VaultDocType, string> = {
  "drivers-license": "Driver's license",
  passport: "Passport",
  "vehicle-title": "Vehicle title (pink slip)",
  "vehicle-registration": "Vehicle registration",
  "insurance-card": "Insurance card",
  other: "Other document",
};

export function isVaultDocType(v: unknown): v is VaultDocType {
  return typeof v === "string" && (VAULT_DOC_TYPES as readonly string[]).includes(v);
}

export interface VaultDocument {
  id: string;
  type: VaultDocType;
  /** His name for it ("My license — front", "Truck title"). */
  label: string;
  /** Bare file name inside the vault folder — never a path. */
  file: string;
  /** The media type the file was stored under. */
  mediaType: string;
  addedAt: number;
  bytes: number;
}

export interface VaultIndexFile {
  documents: VaultDocument[];
}

export const VAULT_MAX_DOCUMENTS = 60;
/** One document may be at most 15 MB — a phone photo of a paper, not a video. */
export const VAULT_MAX_FILE_BYTES = 15 * 1024 * 1024;

export function emptyVaultIndex(): VaultIndexFile {
  return { documents: [] };
}

/* ------------------------------------------------------------------ */
/* Sanitizers — a stored claim survives only in its exact shape        */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function cleanString(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function cleanTime(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * A bare vault file name: no path separators, no parent hops,
 * no leading dot tricks. The core names every file itself; this
 * is the check that keeps a stored name honest on the way back.
 */
export function isBareVaultFileName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= 200 &&
    !name.includes("/") &&
    !name.includes("\\") &&
    !name.includes("..") &&
    !name.startsWith(".")
  );
}

export function sanitizeVaultDocument(v: unknown): VaultDocument | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 64);
  const label = cleanString(v["label"], 120);
  const file = v["file"];
  const addedAt = cleanTime(v["addedAt"]);
  if (!id || !isVaultDocType(v["type"]) || !label || !isBareVaultFileName(file) || addedAt === null) {
    return null;
  }
  return {
    id,
    type: v["type"],
    label,
    file,
    mediaType: cleanString(v["mediaType"], 80) ?? "application/octet-stream",
    addedAt,
    bytes:
      typeof v["bytes"] === "number" && Number.isFinite(v["bytes"]) && v["bytes"] >= 0
        ? Math.floor(v["bytes"])
        : 0,
  };
}

export function sanitizeVaultIndex(v: unknown): VaultIndexFile {
  if (!isRecord(v) || !Array.isArray(v["documents"])) return emptyVaultIndex();
  const documents = v["documents"]
    .map(sanitizeVaultDocument)
    .filter((d): d is VaultDocument => d !== null)
    .slice(0, VAULT_MAX_DOCUMENTS);
  return { documents };
}

/**
 * The name the core gives a stored document: the type, the
 * moment it arrived, and a short random tail — never anything
 * from the uploader's file name, so a crafted name can never
 * reach the filesystem.
 */
export function vaultFileName(type: VaultDocType, at: number, tail: string, ext: string): string {
  const stamp = new Date(at).toISOString().replace(/[:.]/g, "-");
  const cleanTail = tail.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "doc";
  const cleanExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 5);
  return cleanExt
    ? `${type}-${stamp}-${cleanTail}.${cleanExt}`
    : `${type}-${stamp}-${cleanTail}`;
}

/** The extension a media type earns, when it earns one at all. */
export function extensionForMediaType(mediaType: string): string {
  switch (mediaType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "";
  }
}

/** Media types the vault accepts — pictures of papers, and PDFs. */
export function isAcceptedVaultMediaType(mediaType: string): boolean {
  return extensionForMediaType(mediaType) !== "" || mediaType === "image/heic";
}
