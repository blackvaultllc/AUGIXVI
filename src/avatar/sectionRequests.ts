/**
 * SECTION REQUESTS — "Ask for something to be added" (Captain's
 * order, main chat 2026-11-26 ~14:25 CST).
 *
 * One button, one path, in two areas: VIOLET'S side and
 * KHADIJA'S side. She clicks, types what she needs built into
 * her section, and it lands as a request to the Captain — a
 * record in the core's section-requests store, mirrored into
 * his notifications (the Anubis inbox) as a REQUEST entry.
 *
 * The inbox law holds: NO EVENT, NO ENTRY. The request record
 * itself is the event — the mirror entry carries the request's
 * own id as its sourceEventId, and it is written at the moment
 * the request is filed, from the request itself. Nothing is
 * derived, guessed, or dressed up.
 *
 * The path runs OUT only: filing a request opens no content,
 * no tool, and no surface to the person filing it. Khadija's
 * allowlist wall is unchanged in every other respect — her
 * request doorway sends words to her father, like her daddy
 * doorway, and brings nothing back but a thank-you.
 *
 * Plain TS, no I/O — the stores and doors do the writing.
 */
import type { AnubisNotification } from "./cameras/anubisInbox";

export type SectionRequestSource = "violet" | "khadija";

export interface SectionRequest {
  id: string;
  at: number;
  from: SectionRequestSource;
  /** The filer's name, as her own side knows her. */
  fromName: string;
  /** What she asked to have added, in her own words. */
  text: string;
}

export interface SectionRequestsFile {
  requests: SectionRequest[];
}

export const SECTION_REQUESTS_MAX = 200;
export const SECTION_REQUEST_TEXT_MAX = 900;

export function emptySectionRequestsFile(): SectionRequestsFile {
  return { requests: [] };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function cleanString(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

export function sanitizeSectionRequest(v: unknown): SectionRequest | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 96);
  const text = cleanString(v["text"], SECTION_REQUEST_TEXT_MAX);
  const fromName = cleanString(v["fromName"], 80);
  const at = typeof v["at"] === "number" && Number.isFinite(v["at"]) && v["at"] > 0 ? v["at"] : null;
  const from = v["from"];
  if (!id || !text || !fromName || at === null) return null;
  if (from !== "violet" && from !== "khadija") return null;
  return { id, at, from, fromName, text };
}

export function sanitizeSectionRequestsFile(v: unknown): SectionRequestsFile {
  if (!isRecord(v)) return emptySectionRequestsFile();
  return {
    requests: Array.isArray(v["requests"])
      ? v["requests"]
          .map(sanitizeSectionRequest)
          .filter((r): r is SectionRequest => r !== null)
          .slice(0, SECTION_REQUESTS_MAX)
      : [],
  };
}

/** A fresh request id — time plus a short random tail, unique enough for a family record. */
export function newSectionRequestId(at: number, randomTail: string): string {
  const tail = randomTail.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "req";
  return `req-${at}-${tail}`;
}

/**
 * The Captain's notification for one filed request. The request
 * record is the source; the entry's sourceEventId is the
 * request's id, and the entry id derives from it, so the same
 * request can never mirror twice.
 */
export function requestNotification(request: SectionRequest): AnubisNotification {
  const who =
    request.from === "violet"
      ? `${request.fromName} — from her side of the system`
      : `${request.fromName} — from her side of the Academy`;
  return {
    id: `ntf-request-${request.id}`,
    at: request.at,
    kind: "request",
    title:
      request.from === "violet"
        ? "Violet asks for something to be added"
        : "Khadija asks for something to be added",
    text: `${who}: “${request.text}” — filed with the “Ask for something to be added” button in her area. It stands in the section-requests record on the core.`,
    sourceEventId: request.id,
    cameraId: "",
    cameraName: "",
    still: "",
    reasoning: "",
    read: false,
  };
}
