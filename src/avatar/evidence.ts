/**
 * EVIDENCE + STOP RECORDS — the pure shapes of the stop-mode
 * record (owner order 2026-11-26: "if I ever have that
 * interaction and Anubis knows it's a legal one, Anubis
 * listening will automatically record the conversation so that
 * way Anubis has the evidence for me").
 *
 * A stop record holds: when the stop began and how it was
 * triggered, which camera/source Anubis was hearing through,
 * the recording it produced, every claim that was checked
 * against the law base (with the base's verdict — or its
 * honest "not in the base"), every guidance line spoken (each
 * standing on a base entry's id), and how the stop ended.
 *
 * The audio itself lives in the evidence folder on the core
 * (~/.local/share/augie/evidence/, 0600) — this module is the
 * index shape only, sanitized on every read like every record
 * in this house. Plain TS, no I/O.
 */
import type { ClaimVerdict, GuidanceLine } from "./lawBase";

export interface EvidenceRecording {
  id: string;
  /** Bare file name inside the evidence folder — never a path. */
  file: string;
  cameraId: string;
  cameraName: string;
  startedAt: number;
  stoppedAt: number | null;
  bytes: number | null;
}

export interface StopClaimRecord {
  at: number;
  /** The heard (or typed) claim, as recorded. */
  claim: string;
  verdict: ClaimVerdict;
  /** The base entry the verdict stands on — null when the base had none. */
  entryId: string | null;
  /** The checker's own plain-words note, with its citation. */
  note: string;
  /** Which camera heard it — "panel" when he typed it into the claim check. */
  source: string;
}

export type StopTriggerKind = "declaration" | "officer" | "panel";
export type StopEndKind = "his-word" | "silence" | "all-stop" | "panel" | "still-open";

export interface StopSession {
  id: string;
  startedAt: number;
  endedAt: number | null;
  trigger: StopTriggerKind;
  /** The line that triggered it (his declaration or the officer's words), as heard. */
  triggerText: string;
  cameraId: string;
  cameraName: string;
  /** The evidence recording for this stop, once it exists. */
  recording: EvidenceRecording | null;
  claims: StopClaimRecord[];
  guidance: GuidanceLine[];
  endKind: StopEndKind;
  /** When the last line was heard on the stop's camera — the silence window reads this. */
  lastHeardAt: number;
}

export interface EvidenceFile {
  /** The stop in progress, if one is on. At most one — a man is in one stop at a time. */
  active: StopSession | null;
  /** Finished stops, newest first. */
  stops: StopSession[];
}

export const EVIDENCE_STOPS_MAX = 50;
export const STOP_CLAIMS_MAX = 120;
export const STOP_GUIDANCE_MAX = 60;

export function emptyEvidenceFile(): EvidenceFile {
  return { active: null, stops: [] };
}

/* ------------------------------------------------------------------ */
/* Sanitizers                                                          */
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

export function isBareEvidenceFileName(name: unknown): name is string {
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

export function sanitizeEvidenceRecording(v: unknown): EvidenceRecording | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 64);
  const cameraId = cleanString(v["cameraId"], 64);
  const startedAt = cleanTime(v["startedAt"]);
  if (!id || !isBareEvidenceFileName(v["file"]) || !cameraId || startedAt === null) return null;
  return {
    id,
    file: v["file"],
    cameraId,
    cameraName: cleanString(v["cameraName"], 80) ?? "Camera",
    startedAt,
    stoppedAt: cleanTime(v["stoppedAt"]),
    bytes:
      typeof v["bytes"] === "number" && Number.isFinite(v["bytes"]) && v["bytes"] >= 0
        ? Math.floor(v["bytes"])
        : null,
  };
}

function sanitizeStopClaim(v: unknown): StopClaimRecord | null {
  if (!isRecord(v)) return null;
  const at = cleanTime(v["at"]);
  const claim = cleanString(v["claim"], 500);
  const note = cleanString(v["note"], 1200);
  if (at === null || !claim || !note) return null;
  const verdict = v["verdict"];
  if (verdict !== "matches" && verdict !== "contradicts" && verdict !== "not-in-base") return null;
  return {
    at,
    claim,
    verdict,
    entryId: cleanString(v["entryId"], 64) ?? null,
    note,
    source: cleanString(v["source"], 80) ?? "camera",
  };
}

function sanitizeGuidanceLine(v: unknown): GuidanceLine | null {
  if (!isRecord(v)) return null;
  const text = cleanString(v["text"], 400);
  const entryId = cleanString(v["entryId"], 64);
  const citation = cleanString(v["citation"], 200);
  if (!text || !entryId || !citation) return null;
  return { text, entryId, citation };
}

export function sanitizeStopSession(v: unknown): StopSession | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 64);
  const startedAt = cleanTime(v["startedAt"]);
  const cameraId = cleanString(v["cameraId"], 64);
  if (!id || startedAt === null || !cameraId) return null;
  const trigger = v["trigger"];
  const endKind = v["endKind"];
  return {
    id,
    startedAt,
    endedAt: cleanTime(v["endedAt"]),
    trigger: trigger === "officer" || trigger === "panel" ? trigger : "declaration",
    triggerText: cleanString(v["triggerText"], 500) ?? "",
    cameraId,
    cameraName: cleanString(v["cameraName"], 80) ?? "Camera",
    recording: sanitizeEvidenceRecording(v["recording"]),
    claims: Array.isArray(v["claims"])
      ? v["claims"].map(sanitizeStopClaim).filter((c): c is StopClaimRecord => c !== null).slice(0, STOP_CLAIMS_MAX)
      : [],
    guidance: Array.isArray(v["guidance"])
      ? v["guidance"].map(sanitizeGuidanceLine).filter((g): g is GuidanceLine => g !== null).slice(0, STOP_GUIDANCE_MAX)
      : [],
    endKind:
      endKind === "his-word" || endKind === "silence" || endKind === "all-stop" || endKind === "panel"
        ? endKind
        : "still-open",
    lastHeardAt: cleanTime(v["lastHeardAt"]) ?? startedAt,
  };
}

export function sanitizeEvidenceFile(v: unknown): EvidenceFile {
  if (!isRecord(v)) return emptyEvidenceFile();
  const stops = Array.isArray(v["stops"])
    ? v["stops"].map(sanitizeStopSession).filter((s): s is StopSession => s !== null).slice(0, EVIDENCE_STOPS_MAX)
    : [];
  return { active: sanitizeStopSession(v["active"]), stops };
}
