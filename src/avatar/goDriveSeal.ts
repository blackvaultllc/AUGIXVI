/**
 * THE SEAL CHECK (cybernetic pass, 2026-11-26 — the survey's
 * Tron row): a Go Drive proves it is itself. When a drive is
 * created or refreshed, a seal manifest is written onto the
 * stick — every file the drive carries, with its SHA-256 and
 * size. The checker (tools/go-drive/go-drive-seal-check, staged
 * to ~/augie-tools/ on the Parrot) re-reads the stick and
 * reports, per file, MATCH / MISSING / CHANGED, with one
 * verdict line.
 *
 * THE SEAL'S HONESTY RULES:
 *   · A stick with no manifest reports NO SEAL ON THIS DRIVE —
 *     never a pass, never a fail dressed as either.
 *   · A file whose bytes differ is CHANGED; a file that is not
 *     there is MISSING; only a byte-for-byte hash match is a
 *     MATCH. Size alone never passes a file.
 *   · Files on the stick that the seal does not name are
 *     counted and said aloud — a seal judges what it names,
 *     and hides nothing about the rest.
 *
 * This module is the seal's SPEC — the manifest shape and the
 * verdict logic, in plain TS so the tests pin them. The Parrot-
 * side checker implements the same rules against the real
 * filesystem; if the two ever disagree, this file is the law.
 */

export const SEAL_MANIFEST_NAME = "seal-manifest.json";

export interface SealFileEntry {
  /** Path relative to the drive root, forward slashes. */
  path: string;
  /** SHA-256 of the file's bytes, lowercase hex. */
  sha256: string;
  /** The file's size in bytes. */
  size: number;
}

export interface SealManifest {
  version: 1;
  /** When the seal was written (ISO). */
  createdAt: string;
  files: SealFileEntry[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function sanitizeSealEntry(v: unknown): SealFileEntry | null {
  if (!isRecord(v)) return null;
  const path = v["path"];
  const sha256 = v["sha256"];
  const size = v["size"];
  if (typeof path !== "string" || !path || path.includes("..")) return null;
  if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) return null;
  if (typeof size !== "number" || size < 0) return null;
  return { path, sha256, size };
}

/** Read a seal manifest's text; null when it is not a seal. */
export function parseSealManifest(text: string): SealManifest | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed) || parsed["version"] !== 1) return null;
    if (!Array.isArray(parsed["files"])) return null;
    const files = parsed["files"]
      .map(sanitizeSealEntry)
      .filter((e): e is SealFileEntry => e !== null);
    return {
      version: 1,
      createdAt: typeof parsed["createdAt"] === "string" ? parsed["createdAt"] : "",
      files,
    };
  } catch {
    return null;
  }
}

export type SealFileVerdict = "match" | "missing" | "changed";

export interface SealCheckResult {
  /** False when the drive carries no seal — NO SEAL verdict. */
  sealed: boolean;
  verdicts: { path: string; verdict: SealFileVerdict }[];
  /** Files on the drive the seal does not name. */
  unsealedFiles: number;
  /** The one verdict line, in plain words. */
  verdictLine: string;
}

/**
 * Judge a drive against its seal: the manifest (null = no seal
 * on this drive) and the drive's measured files (what a checker
 * actually found and hashed).
 */
export function checkSeal(
  manifest: SealManifest | null,
  measured: SealFileEntry[],
): SealCheckResult {
  if (!manifest) {
    return {
      sealed: false,
      verdicts: [],
      unsealedFiles: measured.length,
      verdictLine:
        "NO SEAL ON THIS DRIVE — it carries no seal-manifest.json, so nothing about it is proven. Seal it at creation (see the Go Drive steps) before trusting it.",
    };
  }
  const measuredByPath = new Map(measured.map((m) => [m.path, m]));
  const verdicts = manifest.files.map((entry) => {
    const found = measuredByPath.get(entry.path);
    if (!found) return { path: entry.path, verdict: "missing" as const };
    if (found.sha256 !== entry.sha256 || found.size !== entry.size) {
      return { path: entry.path, verdict: "changed" as const };
    }
    return { path: entry.path, verdict: "match" as const };
  });
  const sealedPaths = new Set(manifest.files.map((f) => f.path));
  const unsealedFiles = measured.filter((m) => !sealedPaths.has(m.path)).length;
  const missing = verdicts.filter((v) => v.verdict === "missing").length;
  const changed = verdicts.filter((v) => v.verdict === "changed").length;
  const matched = verdicts.length - missing - changed;
  const verdictLine =
    missing === 0 && changed === 0
      ? `THE SEAL HOLDS — all ${verdicts.length} file${verdicts.length === 1 ? "" : "s"} the seal names are present and unchanged` +
        (unsealedFiles > 0
          ? `, and ${unsealedFiles} file${unsealedFiles === 1 ? "" : "s"} on the drive are not in the seal.`
          : ".")
      : `THE SEAL DOES NOT HOLD — ${matched} match, ${missing} missing, ${changed} changed. Do not trust this drive until it is rebuilt and re-sealed.`;
  return { sealed: true, verdicts, unsealedFiles, verdictLine };
}
