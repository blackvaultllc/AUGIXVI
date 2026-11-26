/**
 * THE PROPERTY FEED — the pure core of the Bellwood Haven
 * property record (owner order 2026-11-26: what Anubis picks
 * up through the OUTSIDE camera — suspicious activity, people
 * coming and going, deliveries — is logged for Bellwood Haven
 * as "Anubis security" updates, with the pictures, retained
 * for incident reports and property knowledge reports).
 *
 * THE HARD WALL, stated once and enforced in code below:
 * NOTHING from inside the house ever enters this feed. The
 * bedroom camera — and any interior camera — is refused by
 * the feed writer itself (propertyFeedRefusal), by ZONE, not
 * by a toggle someone can flip. The feed takes the property /
 * outside zone ("front") only. A camera joins the feed when
 * the Captain assigns it the front zone — its zone assignment
 * is the door, and there is no other door.
 *
 * What the feed honestly holds today: the derivation maps
 * what Sector Watch actually established on front-zone
 * cameras — confirmed events and judgment pictures — into
 * feed kinds. Person-in / person-out / delivery are real
 * kinds the writer accepts (a future direction-aware source
 * or the Captain's own dictated note can write them), but the
 * automatic derivation never fabricates a direction or a
 * delivery the watch did not establish.
 *
 * Draft discipline travels with every entry: a judgment is
 * below the event line and its entry carries draft: true and
 * says so in its reasoning. The capture is the evidence; the
 * words are an index.
 *
 * Plain TS, no I/O — the store does the writing, through the
 * refusal, every time.
 */
import {
  captureReasoningForEvent,
  judgmentReasoning,
  type SectorWatchFile,
  type SectorZone,
} from "./sectorWatch";

/* ------------------------------------------------------------------ */
/* Entries                                                             */
/* ------------------------------------------------------------------ */

export type PropertyFeedKind = "person-in" | "person-out" | "delivery" | "suspicious" | "vehicle";

export const PROPERTY_FEED_KINDS: PropertyFeedKind[] = [
  "person-in",
  "person-out",
  "delivery",
  "suspicious",
  "vehicle",
];

/** The only zone the feed takes: the property / outside zone. */
export const PROPERTY_FEED_ZONE: SectorZone = "front";

export interface PropertyFeedEntry {
  id: string;
  at: number;
  cameraId: string;
  cameraName: string;
  /** The camera's sector zone — the wall reads this, nothing else. */
  zone: SectorZone;
  kind: PropertyFeedKind;
  /** The kept picture's file name in sector-events/, or null when none was kept. */
  capture: string | null;
  /** Why the moment was kept — the reasoning stamped on the capture. */
  reasoning: string;
  /** The sector record this entry came from. */
  sourceEventId: string;
  /** True when the source is a judgment — below the event line, a draft reading. */
  draft: boolean;
}

export interface PropertyFeedFile {
  entries: PropertyFeedEntry[];
}

export const PROPERTY_FEED_MAX = 300;

export function emptyPropertyFeedFile(): PropertyFeedFile {
  return { entries: [] };
}

/* ------------------------------------------------------------------ */
/* THE WALL — the writer's refusal                                     */
/* ------------------------------------------------------------------ */

/**
 * The feed writer's refusal: the reason this entry may NOT be
 * written, or null when it may. Zone is the whole law — an
 * entry whose camera stands in any zone but the property /
 * outside zone is refused, whoever hands it over: the bedroom
 * camera, the common areas, all of inside the house.
 */
export function propertyFeedRefusal(entry: PropertyFeedEntry): string | null {
  if (!entry.cameraId) return "Refused: the entry names no camera.";
  if (entry.zone !== PROPERTY_FEED_ZONE) {
    return `Refused: ${entry.cameraName || entry.cameraId} stands in the "${entry.zone}" zone. The property feed takes the outside (front) zone only — nothing from inside the house ever enters it, and no setting changes that.`;
  }
  return null;
}

/** Split a batch at the wall: what may be written, and what was refused (with its reason). */
export function partitionFeedEntries(entries: PropertyFeedEntry[]): {
  accepted: PropertyFeedEntry[];
  refused: { entry: PropertyFeedEntry; reason: string }[];
} {
  const accepted: PropertyFeedEntry[] = [];
  const refused: { entry: PropertyFeedEntry; reason: string }[] = [];
  for (const entry of entries) {
    const reason = propertyFeedRefusal(entry);
    if (reason) refused.push({ entry, reason });
    else accepted.push(entry);
  }
  return { accepted, refused };
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

function cleanZone(v: unknown): SectorZone | null {
  return v === "front" || v === "bedroom" || v === "common" ? v : null;
}

function cleanStillName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v.trim().slice(0, 96);
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  return name;
}

export function sanitizePropertyFeedEntry(v: unknown): PropertyFeedEntry | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 96);
  const cameraId = cleanString(v["cameraId"], 64);
  const reasoning = cleanString(v["reasoning"], 900);
  const sourceEventId = cleanString(v["sourceEventId"], 96);
  const at = cleanTime(v["at"]);
  const zone = cleanZone(v["zone"]);
  if (!id || !cameraId || !reasoning || !sourceEventId || at === null || zone === null) return null;
  const kind = v["kind"];
  return {
    id,
    at,
    cameraId,
    cameraName: cleanString(v["cameraName"], 80) ?? "Camera",
    zone,
    kind:
      typeof kind === "string" && (PROPERTY_FEED_KINDS as string[]).includes(kind)
        ? (kind as PropertyFeedKind)
        : "suspicious",
    capture: cleanStillName(v["capture"]),
    reasoning,
    sourceEventId,
    draft: v["draft"] === true,
  };
}

export function sanitizePropertyFeedFile(v: unknown): PropertyFeedFile {
  if (!isRecord(v)) return emptyPropertyFeedFile();
  return {
    entries: Array.isArray(v["entries"])
      ? v["entries"]
          .map(sanitizePropertyFeedEntry)
          .filter((e): e is PropertyFeedEntry => e !== null)
          .slice(0, PROPERTY_FEED_MAX)
      : [],
  };
}

/* ------------------------------------------------------------------ */
/* The derivation — what the watch established, mapped honestly        */
/* ------------------------------------------------------------------ */

/**
 * Derive feed entries from the sector record. Only front-zone
 * records are even derived — and the writer's wall stands
 * behind the derivation regardless, refusing anything else
 * that is ever handed to it.
 */
export function derivePropertyFeed(sector: SectorWatchFile): PropertyFeedEntry[] {
  const out: PropertyFeedEntry[] = [];
  for (const event of sector.events) {
    if (event.zone !== PROPERTY_FEED_ZONE) continue;
    out.push({
      id: `feed-${event.id}`,
      at: event.at,
      cameraId: event.cameraId,
      cameraName: event.cameraName,
      zone: event.zone,
      kind: event.kind === "front-truck" ? "vehicle" : "suspicious",
      capture: event.evidence[0]?.file ?? event.frames[0] ?? null,
      reasoning:
        event.reasoning ||
        `${captureReasoningForEvent(event.kind, event.cameraName)} (Recorded before reasoning was stamped at capture time; built from the event's own record.)`,
      sourceEventId: event.id,
      draft: false,
    });
  }
  for (const judgment of sector.judgments) {
    if (judgment.zone !== PROPERTY_FEED_ZONE) continue;
    out.push({
      id: `feed-${judgment.id}`,
      at: judgment.at,
      cameraId: judgment.cameraId,
      cameraName: judgment.cameraName,
      zone: judgment.zone,
      kind: "suspicious",
      capture: judgment.still || null,
      reasoning:
        judgment.reasoning ||
        `${judgmentReasoning(judgment.cameraName)} (Recorded before reasoning was stamped at capture time; built from the item's own record.)`,
      sourceEventId: judgment.id,
      draft: true,
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

/** Merge derived entries into the stored feed: dedupe by id, newest first, cap holds. */
export function mergeFeedEntries(
  file: PropertyFeedFile,
  accepted: PropertyFeedEntry[],
): PropertyFeedFile {
  const known = new Set(file.entries.map((e) => e.id));
  const fresh = accepted.filter((e) => !known.has(e.id));
  if (fresh.length === 0) return file;
  return {
    entries: [...fresh, ...file.entries].sort((a, b) => b.at - a.at).slice(0, PROPERTY_FEED_MAX),
  };
}

/* ------------------------------------------------------------------ */
/* The export — one file the Captain hands to the Bellwood records     */
/* ------------------------------------------------------------------ */

/**
 * The export text: the whole feed as JSON, with every
 * referenced image listed by file name (the images themselves
 * live on the core in sector-events/ and travel as files, not
 * as text). Draft labels stay on their entries.
 */
export function propertyFeedExportText(file: PropertyFeedFile, exportedAt: number): string {
  const images = [...new Set(file.entries.map((e) => e.capture).filter((c): c is string => !!c))];
  return JSON.stringify(
    {
      source: "Anubis security — property feed for Bellwood Haven",
      exportedAt: new Date(exportedAt).toISOString(),
      note: "Entries are Anubis's watch record for the OUTSIDE of the property only — nothing from inside the house is ever in this feed. Entries marked draft are judgment readings below the event line. The stills are the evidence; the words are an index. Image files live on the core machine in ~/.local/share/augie/sector-events/ and are listed by name under \"images\".",
      entries: file.entries,
      images,
    },
    null,
    2,
  );
}
