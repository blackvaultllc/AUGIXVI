/**
 * ANUBIS'S INBOX — the pure core of the notifications pass
 * (owner orders 2026-11-26: Anubis may speak up on his own
 * judgment — "hey sir, maybe you should do this" — through a
 * notification button in the command base; and every picture
 * he captures carries his REASONING, saved with it, proof of
 * concept, downloadable whenever the Captain needs it).
 *
 * The law of this module, in one breath: NO EVENT, NO ENTRY.
 * Every notification is derived from a real record that
 * already exists in the core — a Sector Watch event, a
 * judgment, a watch-log line, a core events-log line — and
 * every entry stores the id of the record it came from
 * (sourceEventId). The derivation is a pure function over
 * those records: given the same records it returns the same
 * entries, with deterministic ids, so re-deriving never
 * duplicates. Nothing here invents an event, a suggestion, or
 * a system action: a class with no real source simply never
 * appears.
 *
 * Entry kinds:
 *   · CAPTURE — a picture Anubis kept (a confirmed event's
 *     stills, or a judgment picture), with the reasoning that
 *     was stamped on the capture when it was kept.
 *   · SUGGESTION — his judgment, from a small explicit rule
 *     set over real records (below). The text says what he
 *     saw and what he suggests, and is labeled his suggestion.
 *   · SYSTEM — self-healing / update activity from the core
 *     events log (augie-events): update checks, update-apply
 *     requests, repair proposals, test results. The log's
 *     "note" lines are NOT mirrored — notes are annotations,
 *     not system actions, and Sector Watch already raises its
 *     own entries.
 *   · REQUEST — a person with a side of her own (Violet,
 *     Khadija) filed an "Ask for something to be added"
 *     request. These are not derived here: the request record
 *     in section-requests is the event, and the filing door
 *     (sectionRequestsStore.server.ts) writes the mirror entry
 *     at the moment of filing, from the request itself.
 *
 * THE SUGGESTION RULE SET (explicit, and the whole of it):
 *   S1 REPEATED EVENTS — one camera raises 3+ confirmed
 *      events inside 24 hours → suggest a closer look at
 *      what is drawing people there.
 *   S2 REPEATED DRAFTS — one camera logs 4+ NOT CONFIRMED
 *      draft readings inside 24 hours → suggest checking
 *      that camera's view (aim, light) — the second look
 *      keeps failing to settle what the first look sees.
 *   S3 NOBODY ENROLLED — a bedroom no-access event stands
 *      while the household list is empty → suggest enrolling
 *      the Captain and Khadija, so the room rule can clear
 *      the faces it is allowed to clear.
 * A rule fires at most once per camera per day (its id
 * carries the day), and cites the newest record it stands on.
 *
 * Plain TS, no I/O — the server modules do the reading.
 */
import {
  captureReasoningForEvent,
  judgmentReasoning,
  type SectorEvent,
  type SectorJudgment,
  type SectorWatchFile,
} from "./sectorWatch";

/* ------------------------------------------------------------------ */
/* Entries                                                             */
/* ------------------------------------------------------------------ */

export type NotificationKind = "suggestion" | "system" | "capture" | "request";

export interface AnubisNotification {
  id: string;
  at: number;
  kind: NotificationKind;
  /** One line: what this entry is. */
  title: string;
  /** Plain words. A suggestion states what he saw and what he suggests. */
  text: string;
  /** The id of the core record this entry was derived from. No source, no entry. */
  sourceEventId: string;
  cameraId: string;
  cameraName: string;
  /** CAPTURE only: the kept still's file name in sector-events/, else "". */
  still: string;
  /** CAPTURE only: why the picture was kept — the reasoning stamped on the capture. */
  reasoning: string;
  /** The Captain has read this entry in the inbox. */
  read: boolean;
}

export interface AnubisInboxFile {
  entries: AnubisNotification[];
}

export const INBOX_MAX = 120;

export function emptyInboxFile(): AnubisInboxFile {
  return { entries: [] };
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

function cleanStillName(v: unknown): string {
  if (typeof v !== "string") return "";
  const name = v.trim().slice(0, 96);
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return "";
  return name;
}

const NOTIFICATION_KINDS: NotificationKind[] = ["suggestion", "system", "capture", "request"];

export function sanitizeNotification(v: unknown): AnubisNotification | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 96);
  const title = cleanString(v["title"], 160);
  const text = cleanString(v["text"], 900);
  const sourceEventId = cleanString(v["sourceEventId"], 96);
  const at = cleanTime(v["at"]);
  if (!id || !title || !text || !sourceEventId || at === null) return null;
  const kind = v["kind"];
  return {
    id,
    at,
    kind:
      typeof kind === "string" && (NOTIFICATION_KINDS as string[]).includes(kind)
        ? (kind as NotificationKind)
        : "system",
    title,
    text,
    sourceEventId,
    cameraId: cleanString(v["cameraId"], 64) ?? "",
    cameraName: cleanString(v["cameraName"], 80) ?? "",
    still: cleanStillName(v["still"]),
    reasoning: cleanString(v["reasoning"], 900) ?? "",
    read: v["read"] === true,
  };
}

export function sanitizeInboxFile(v: unknown): AnubisInboxFile {
  if (!isRecord(v)) return emptyInboxFile();
  return {
    entries: Array.isArray(v["entries"])
      ? v["entries"]
          .map(sanitizeNotification)
          .filter((e): e is AnubisNotification => e !== null)
          .slice(0, INBOX_MAX)
      : [],
  };
}

/** Unread entries — the stage button's count, straight from the record. */
export function unreadNotifications(file: AnubisInboxFile): AnubisNotification[] {
  return file.entries.filter((e) => !e.read);
}

/* ------------------------------------------------------------------ */
/* The derivation — real records in, notifications out                 */
/* ------------------------------------------------------------------ */

/** One line of the core events log, as the runtime hands it over. */
export interface CoreEventRef {
  /** A stable id derived from the line itself (the log carries no ids). */
  id: string;
  at: number;
  type: string;
  summary: string;
  detail: string;
}

export interface InboxSources {
  sector: SectorWatchFile;
  /** How many household faces are enrolled (the bedroom rule's list). */
  householdCount: number;
  coreEvents: CoreEventRef[];
}

const DAY_MS = 24 * 60 * 60_000;

function dayStamp(at: number): number {
  return Math.floor(at / DAY_MS);
}

/** The reasoning that travels with an event's capture — its own stamp, or one built from its own fields. */
function eventCaptureReasoning(event: SectorEvent): string {
  if (event.reasoning) return event.reasoning;
  return `${captureReasoningForEvent(event.kind, event.cameraName)} (This event was recorded before reasoning was stamped at capture time; the sentence is built from the event's own record — its kind, its camera, and its two looks.)`;
}

function judgmentCaptureReasoning(judgment: SectorJudgment): string {
  if (judgment.reasoning) return judgment.reasoning;
  return `${judgmentReasoning(judgment.cameraName)} (This item was recorded before reasoning was stamped at capture time; the sentence is built from the item's own record.)`;
}

function captureTitle(event: SectorEvent): string {
  switch (event.kind) {
    case "weapon":
      return "Picture kept — a weapon reading, top tier";
    case "bedroom-no-access":
      return "Picture kept — a person in your room";
    case "front-truck":
      return "Picture kept — a person at your truck";
    case "front-threat":
      return "Picture kept — the front of the property";
  }
}

/** CAPTURE entries: every kept picture from a confirmed event or a judgment. No picture, no entry. */
function captureEntries(sector: SectorWatchFile): AnubisNotification[] {
  const out: AnubisNotification[] = [];
  for (const event of sector.events) {
    const still = event.evidence[0]?.file ?? event.frames[0] ?? "";
    if (!still) continue;
    out.push({
      id: `ntf-capture-${event.id}`,
      at: event.at,
      kind: "capture",
      title: captureTitle(event),
      text: event.summary,
      sourceEventId: event.id,
      cameraId: event.cameraId,
      cameraName: event.cameraName,
      still,
      reasoning: eventCaptureReasoning(event),
      read: false,
    });
  }
  for (const judgment of sector.judgments) {
    if (!judgment.still) continue;
    out.push({
      id: `ntf-capture-${judgment.id}`,
      at: judgment.at,
      kind: "capture",
      title: "Picture kept — Anubis's judgment",
      text: judgment.text,
      sourceEventId: judgment.id,
      cameraId: judgment.cameraId,
      cameraName: judgment.cameraName,
      still: judgment.still,
      reasoning: judgmentCaptureReasoning(judgment),
      read: false,
    });
  }
  return out;
}

/** The whole suggestion rule set — S1, S2, S3, nothing else. */
function suggestionEntries(sources: InboxSources): AnubisNotification[] {
  const out: AnubisNotification[] = [];
  const { sector } = sources;

  // S1 — repeated confirmed events at one camera inside 24 hours.
  const eventsByCamera = new Map<string, SectorEvent[]>();
  for (const event of sector.events) {
    const list = eventsByCamera.get(event.cameraId) ?? [];
    list.push(event);
    eventsByCamera.set(event.cameraId, list);
  }
  for (const [cameraId, events] of eventsByCamera) {
    const sorted = [...events].sort((a, b) => b.at - a.at);
    const newest = sorted[0];
    if (!newest) continue;
    const count = sorted.filter((e) => newest.at - e.at <= DAY_MS).length;
    if (count < 3) continue;
    out.push({
      id: `ntf-suggest-repeat-${cameraId}-${dayStamp(newest.at)}`,
      at: newest.at,
      kind: "suggestion",
      title: "Anubis suggests a closer look",
      text: `Sir — ${newest.cameraName} has raised ${count} confirmed events in the last 24 hours. The latest: ${newest.summary} Maybe you should take a closer look at what keeps drawing people there. (His suggestion, from the sector record — the events themselves stand in the Sector Watch card.)`,
      sourceEventId: newest.id,
      cameraId,
      cameraName: newest.cameraName,
      still: "",
      reasoning: "",
      read: false,
    });
  }

  // S2 — repeated NOT CONFIRMED drafts at one camera inside 24 hours.
  const draftsByCamera = new Map<string, { id: string; at: number; cameraName: string }[]>();
  for (const entry of sector.log) {
    if (entry.kind !== "draft") continue;
    const list = draftsByCamera.get(entry.cameraId) ?? [];
    list.push({ id: entry.id, at: entry.at, cameraName: entry.cameraName });
    draftsByCamera.set(entry.cameraId, list);
  }
  for (const [cameraId, drafts] of draftsByCamera) {
    const sorted = [...drafts].sort((a, b) => b.at - a.at);
    const newest = sorted[0];
    if (!newest) continue;
    const count = sorted.filter((d) => newest.at - d.at <= DAY_MS).length;
    if (count < 4) continue;
    out.push({
      id: `ntf-suggest-drafts-${cameraId}-${dayStamp(newest.at)}`,
      at: newest.at,
      kind: "suggestion",
      title: "Anubis suggests checking a camera's view",
      text: `Sir — at ${newest.cameraName}, the second look has failed to confirm ${count} first readings in the last 24 hours. The first look keeps seeing something the second look cannot settle — the view there may be unclear. Maybe check that camera's aim or its light. (His suggestion, from the watch log — every one of those readings stands there as a draft, never an event.)`,
      sourceEventId: newest.id,
      cameraId,
      cameraName: newest.cameraName,
      still: "",
      reasoning: "",
      read: false,
    });
  }

  // S3 — a bedroom no-access event stands while nobody is enrolled.
  if (sources.householdCount === 0) {
    const bedroomEvent = sector.events
      .filter((e) => e.kind === "bedroom-no-access")
      .sort((a, b) => b.at - a.at)[0];
    if (bedroomEvent) {
      out.push({
        id: `ntf-suggest-enroll-${bedroomEvent.id}`,
        at: bedroomEvent.at,
        kind: "suggestion",
        title: "Anubis suggests enrolling the household",
        text: `Sir — a person was confirmed in your room, and nobody is enrolled yet, so the room rule could not clear anyone. Enrolling your face and Khadija's in the Sector Watch card would let the rule know the two people who belong there. (His suggestion, from the event on the record.)`,
        sourceEventId: bedroomEvent.id,
        cameraId: bedroomEvent.cameraId,
        cameraName: bedroomEvent.cameraName,
        still: "",
        reasoning: "",
        read: false,
      });
    }
  }

  return out;
}

/**
 * The core events-log types that are SYSTEM entries: real
 * self-activity of the core (checks it ran, requests the
 * Captain confirmed, repairs proposed, tests recorded). The
 * "note" type is deliberately absent — notes are annotations.
 */
export const SYSTEM_CORE_EVENT_TYPES: string[] = [
  "update-check",
  "update-apply-request",
  "repair-proposal",
  "test-result",
];

function systemTitle(type: string): string {
  switch (type) {
    case "update-check":
      return "System — an update check ran";
    case "update-apply-request":
      return "System — an update was requested";
    case "repair-proposal":
      return "System — a repair was proposed";
    case "test-result":
      return "System — a test result was recorded";
    default:
      return "System — core activity";
  }
}

/** SYSTEM entries: straight from the core events log, one per real line. */
function systemEntries(sources: InboxSources): AnubisNotification[] {
  const out: AnubisNotification[] = [];
  for (const ref of sources.coreEvents) {
    if (!SYSTEM_CORE_EVENT_TYPES.includes(ref.type)) continue;
    out.push({
      id: `ntf-system-${ref.id}`,
      at: ref.at,
      kind: "system",
      title: systemTitle(ref.type),
      text: ref.detail ? `${ref.summary} ${ref.detail}` : ref.summary,
      sourceEventId: ref.id,
      cameraId: "",
      cameraName: "",
      still: "",
      reasoning: "",
      read: false,
    });
  }
  return out;
}

/**
 * Derive every notification the current records support.
 * Deterministic: the same records give the same entries with
 * the same ids, so the store merge dedupes by id and a
 * Captain's read marks survive re-derivation.
 */
export function deriveNotifications(sources: InboxSources): AnubisNotification[] {
  return [
    ...captureEntries(sources.sector),
    ...suggestionEntries(sources),
    ...systemEntries(sources),
  ].sort((a, b) => b.at - a.at);
}

/** Merge derived entries into the stored inbox: new ids land, read marks survive, cap holds. */
export function mergeDerivedEntries(
  file: AnubisInboxFile,
  derived: AnubisNotification[],
): AnubisInboxFile {
  const known = new Map(file.entries.map((e) => [e.id, e]));
  const fresh = derived.filter((e) => !known.has(e.id));
  if (fresh.length === 0) return file;
  return {
    entries: [...fresh, ...file.entries].sort((a, b) => b.at - a.at).slice(0, INBOX_MAX),
  };
}
