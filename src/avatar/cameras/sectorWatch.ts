/**
 * SECTOR WATCH — the pure core of the Sector Watch pass (owner
 * order 2026-11-26, voice call: "I want Anubis to not control it
 * on command only but I want Anubis to go through and look
 * through it whenever he wants to. If he sees something wrong,
 * like somebody breaking in a car or somebody getting into my
 * room… Anubis should be able to catch my facial when I go in
 * the house so it knows who I am. I'm the creator.").
 *
 * What lives here is everything that must be TRUE before any of
 * it touches a wire:
 *
 *   · The sector rules as data: each camera carries a ZONE in
 *     the core record — FRONT (watch the vehicles and the doors),
 *     BEDROOM (the Captain's room: the Captain and Khadija only,
 *     anybody else is NO ACCESS), COMMON (people are expected —
 *     Sid's rule: presence is logged, never an alert).
 *   · The watch log and the security events, sanitized on every
 *     read like every core record in this house.
 *   · The decision law, as pure functions over analyzer answers:
 *     a first YES is a DRAFT READING, nothing more. The Second
 *     Look — the same strict question asked again — must also
 *     say yes before a reading may become an EVENT. A second
 *     look that says no, or gives no verdict, leaves the reading
 *     a draft forever: logged as NOT CONFIRMED, never an event,
 *     never spoken of as fact. An analyzer that does not answer
 *     is UNAVAILABLE — labeled, never guessed around.
 *   · The bedroom face law: a confirmed person is checked
 *     against the household enrollment. A match to an enrolled
 *     face is logged and raises nothing. No match — or no
 *     verdict — is a NO ACCESS event. And until at least one
 *     face is enrolled, ANY confirmed person in the bedroom is
 *     a no-access event: the rule never pretends recognition
 *     exists before enrollment.
 *
 * THE LENS TRUTH (learned live 2026-11-26, corrected the same
 * day): ONVIF exposes ONE video source per unit — but whether
 * the pulled stream follows the moving lens is a PER-CAMERA
 * MEASURED property (the stream probe in the presence record):
 * the Bedroom unit's stream swung with a test pan, frame-proven;
 * the Command unit's did not change across three moves. The
 * watch judges the pulled stream's view either way and claims
 * nothing more; where the probe measured "does not follow", that
 * view is the fixed view, and the record says so.
 *
 * Plain TS, no I/O — the server modules do the dialing.
 */

/* ------------------------------------------------------------------ */
/* Zones + per-camera sector config                                    */
/* ------------------------------------------------------------------ */

export type SectorZone = "front" | "bedroom" | "common";

export const SECTOR_ZONES: SectorZone[] = ["front", "bedroom", "common"];

/** Plain words for a zone — the words the window and the log use. */
export function zoneLabel(zone: SectorZone): string {
  switch (zone) {
    case "front":
      return "Front — vehicles and entry; the Captain's truck is his alone";
    case "bedroom":
      return "The Captain's room — Captain and Khadija only";
    case "common":
      return "Common area — people are expected";
  }
}

/**
 * The sector a camera is born into, from the Captain's own
 * layout: the front-window camera watches the front, the
 * bedroom camera watches his room, everything else starts as a
 * common area (the least alarming rule — presence logged, never
 * an alert) until he sets its zone himself.
 */
export function defaultZoneForCamera(cameraId: string): SectorZone {
  if (cameraId === "command-front-window") return "front";
  if (cameraId === "bedroom") return "bedroom";
  return "common";
}

export interface SectorCameraConfig {
  cameraId: string;
  zone: SectorZone;
  /** Anubis watches this camera on his own cycle. */
  watch: boolean;
}

export function defaultSectorConfig(cameraId: string): SectorCameraConfig {
  return { cameraId, zone: defaultZoneForCamera(cameraId), watch: true };
}

export const WATCH_INTERVAL_DEFAULT_SEC = 60;
export const WATCH_INTERVAL_MIN_SEC = 20;
export const WATCH_INTERVAL_MAX_SEC = 900;

export interface SectorWatchSettings {
  /** Seconds between watch cycles, per camera. */
  intervalSec: number;
  cameras: Record<string, SectorCameraConfig>;
}

export function defaultSectorSettings(): SectorWatchSettings {
  return { intervalSec: WATCH_INTERVAL_DEFAULT_SEC, cameras: {} };
}

/** The config for one camera — the stored one, or its honest default. */
export function sectorConfigFor(settings: SectorWatchSettings, cameraId: string): SectorCameraConfig {
  return settings.cameras[cameraId] ?? defaultSectorConfig(cameraId);
}

/* ------------------------------------------------------------------ */
/* The watch log + the security events                                 */
/* ------------------------------------------------------------------ */

export type WatchReadingKind =
  /** The cycle ran; the reading found nothing to act on. */
  | "quiet"
  /** A person where people are fine, or a face this house knows. */
  | "person"
  /** A first look said yes; the second look did not confirm it. NOT an event. */
  | "draft"
  /** A confirmed reading became a security event. */
  | "event"
  /** The camera or the analyzer did not answer. Labeled, never guessed. */
  | "unavailable"
  /** The cross-examination record for an event or a judgment. */
  | "cross-exam";

export interface WatchLogEntry {
  id: string;
  at: number;
  cameraId: string;
  cameraName: string;
  zone: SectorZone;
  kind: WatchReadingKind;
  /** Plain words. Analyzer words are always labeled a draft reading. */
  text: string;
}

export type SectorEventKind = "front-threat" | "front-truck" | "bedroom-no-access" | "weapon";

/**
 * One cross-examination reading (the Captain's authority,
 * 2026-11-26: "Let Anubis use any tools he wants to cross
 * examine things"). When the watch settles an event or a
 * judgment, it consults the system's other analysis tools on
 * what it captured and records EACH tool's reading here —
 * labeled, separate, never merged into a fake certainty.
 * Indicators inform judgment escalations; they never become
 * events by themselves.
 */
export interface CrossExamEntry {
  tool: "picture" | "sound" | "motion";
  /** What that tool returned, in plain words — a labeled reading. */
  reading: string;
}

/**
 * One full-resolution evidence still, captured for a FRONT
 * event (the Captain's evidence-capture order, 2026-11-26: the
 * home setup is his test for the Bellwood pattern). The still
 * is the evidence; the plate reading stored with it is a DRAFT
 * READING — an index for his reports, never the record of
 * truth. No plate readable says so plainly (plate: null).
 */
export interface SectorEvidenceStill {
  /** File name inside the core's sector-events folder. */
  file: string;
  at: number;
  /** The analyzer's plate reading for this still, or null when no plate was readable. */
  plate: string | null;
  /** Plain words: what the plate reading stands on. */
  plateNote: string;
}

export interface SectorEvent {
  id: string;
  at: number;
  cameraId: string;
  cameraName: string;
  zone: SectorZone;
  kind: SectorEventKind;
  /** One line: what the event is. */
  summary: string;
  /**
   * The reading behind it, in plain words — both looks agreed,
   * and it is still a model's reading, labeled as one.
   */
  reading: string;
  /** Still file names inside the core's sector-events folder. */
  frames: string[];
  /**
   * FRONT events only: the full-resolution evidence burst,
   * captured around the event and kept with it. Empty until
   * the capture lands (or where capture could not run).
   */
  evidence: SectorEvidenceStill[];
  /**
   * The analyzer's one-line description of the person in the
   * trigger frame — a DRAFT READING, or "" when it gave none.
   * The stills are the capture; this is only an index.
   */
  personReading: string;
  /**
   * The cross-examination record: which tools were consulted
   * for this event and what each returned (labeled readings).
   */
  crossExam: CrossExamEntry[];
  /** The Captain has seen this event in the Cameras window. */
  acknowledged: boolean;
}

/**
 * A JUDGMENT escalation (the Captain's order, 2026-11-26:
 * "I want Anubis to use his judgment… send me a picture…
 * hey sir, I want you to look at this"). A reading in the
 * notable band — below the event line, worth the Captain's
 * eyes — that Anubis raised on his own, with a kept picture.
 * Not an alert: it never touches the Alert Ring. It stands
 * until the Captain acknowledges it in the Cameras window.
 */
export interface SectorJudgment {
  id: string;
  at: number;
  cameraId: string;
  cameraName: string;
  zone: SectorZone;
  /** One plain line: what caught his eye — his reading, labeled as one. */
  text: string;
  /** The kept picture's file name in sector-events/, or "" when none could be kept. */
  still: string;
  /** The cross-examination record behind this judgment. */
  crossExam: CrossExamEntry[];
  acknowledged: boolean;
}

export interface SectorWatchFile {
  settings: SectorWatchSettings;
  log: WatchLogEntry[];
  events: SectorEvent[];
  judgments: SectorJudgment[];
}

export const WATCH_LOG_MAX = 300;
export const SECTOR_EVENTS_MAX = 60;
export const SECTOR_JUDGMENTS_MAX = 30;
export const EVIDENCE_STILLS_MAX = 6;

export function emptySectorWatchFile(): SectorWatchFile {
  return { settings: defaultSectorSettings(), log: [], events: [], judgments: [] };
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

function cleanZone(v: unknown): SectorZone | null {
  return v === "front" || v === "bedroom" || v === "common" ? v : null;
}

export function sanitizeSectorConfig(v: unknown, cameraId: string): SectorCameraConfig {
  const base = defaultSectorConfig(cameraId);
  if (!isRecord(v)) return base;
  return {
    cameraId,
    zone: cleanZone(v["zone"]) ?? base.zone,
    watch: v["watch"] === false ? false : true,
  };
}

export function sanitizeSectorSettings(v: unknown): SectorWatchSettings {
  const base = defaultSectorSettings();
  if (!isRecord(v)) return base;
  const cameras: Record<string, SectorCameraConfig> = {};
  if (isRecord(v["cameras"])) {
    for (const [id, config] of Object.entries(v["cameras"])) {
      const key = id.slice(0, 64);
      if (key) cameras[key] = sanitizeSectorConfig(config, key);
    }
  }
  const interval = v["intervalSec"];
  return {
    intervalSec:
      typeof interval === "number" && Number.isFinite(interval)
        ? Math.min(WATCH_INTERVAL_MAX_SEC, Math.max(WATCH_INTERVAL_MIN_SEC, Math.round(interval)))
        : base.intervalSec,
    cameras,
  };
}

const READING_KINDS: WatchReadingKind[] = [
  "quiet",
  "person",
  "draft",
  "event",
  "unavailable",
  "cross-exam",
];

export function sanitizeWatchLogEntry(v: unknown): WatchLogEntry | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 64);
  const cameraId = cleanString(v["cameraId"], 64);
  const text = cleanString(v["text"], 500);
  const at = cleanTime(v["at"]);
  const zone = cleanZone(v["zone"]);
  if (!id || !cameraId || !text || at === null || zone === null) return null;
  const kind = v["kind"];
  return {
    id,
    at,
    cameraId,
    cameraName: cleanString(v["cameraName"], 80) ?? "Camera",
    zone,
    kind: typeof kind === "string" && (READING_KINDS as string[]).includes(kind)
      ? (kind as WatchReadingKind)
      : "quiet",
    text,
  };
}

/** A still file name that stays inside its folder — no paths, ever. */
function cleanStillName(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const name = v.trim().slice(0, 96);
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return undefined;
  return name;
}

export function sanitizeCrossExam(v: unknown): CrossExamEntry[] {
  if (!Array.isArray(v)) return [];
  const out: CrossExamEntry[] = [];
  for (const entry of v) {
    if (!isRecord(entry)) continue;
    const tool = entry["tool"];
    const reading = cleanString(entry["reading"], 400);
    if ((tool === "picture" || tool === "sound" || tool === "motion") && reading) {
      out.push({ tool, reading });
    }
    if (out.length >= 4) break;
  }
  return out;
}

export function sanitizeEvidenceStill(v: unknown): SectorEvidenceStill | null {
  if (!isRecord(v)) return null;
  const file = cleanStillName(v["file"]);
  const at = cleanTime(v["at"]);
  if (!file || at === null) return null;
  return {
    file,
    at,
    plate: cleanString(v["plate"], 24) ?? null,
    plateNote: cleanString(v["plateNote"], 300) ?? "No plate reading stands for this still.",
  };
}

export function sanitizeSectorEvent(v: unknown): SectorEvent | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 64);
  const cameraId = cleanString(v["cameraId"], 64);
  const summary = cleanString(v["summary"], 300);
  const at = cleanTime(v["at"]);
  const zone = cleanZone(v["zone"]);
  if (!id || !cameraId || !summary || at === null || zone === null) return null;
  const kind = v["kind"];
  const frames = Array.isArray(v["frames"])
    ? v["frames"].filter((f): f is string => typeof f === "string" && f.length > 0).slice(0, 4)
    : [];
  return {
    id,
    at,
    cameraId,
    cameraName: cleanString(v["cameraName"], 80) ?? "Camera",
    zone,
    kind:
      kind === "bedroom-no-access"
        ? "bedroom-no-access"
        : kind === "front-truck"
          ? "front-truck"
          : kind === "weapon"
            ? "weapon"
            : "front-threat",
    summary,
    reading: cleanString(v["reading"], 600) ?? "",
    frames,
    evidence: Array.isArray(v["evidence"])
      ? v["evidence"]
          .map(sanitizeEvidenceStill)
          .filter((s): s is SectorEvidenceStill => s !== null)
          .slice(0, EVIDENCE_STILLS_MAX)
      : [],
    personReading: cleanString(v["personReading"], 300) ?? "",
    crossExam: sanitizeCrossExam(v["crossExam"]),
    acknowledged: v["acknowledged"] === true,
  };
}

export function sanitizeSectorJudgment(v: unknown): SectorJudgment | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 64);
  const cameraId = cleanString(v["cameraId"], 64);
  const text = cleanString(v["text"], 400);
  const at = cleanTime(v["at"]);
  const zone = cleanZone(v["zone"]);
  if (!id || !cameraId || !text || at === null || zone === null) return null;
  return {
    id,
    at,
    cameraId,
    cameraName: cleanString(v["cameraName"], 80) ?? "Camera",
    zone,
    text,
    still: cleanStillName(v["still"]) ?? "",
    crossExam: sanitizeCrossExam(v["crossExam"]),
    acknowledged: v["acknowledged"] === true,
  };
}

export function sanitizeSectorWatchFile(v: unknown): SectorWatchFile {
  if (!isRecord(v)) return emptySectorWatchFile();
  return {
    settings: sanitizeSectorSettings(v["settings"]),
    log: Array.isArray(v["log"])
      ? v["log"]
          .map(sanitizeWatchLogEntry)
          .filter((e): e is WatchLogEntry => e !== null)
          .slice(0, WATCH_LOG_MAX)
      : [],
    events: Array.isArray(v["events"])
      ? v["events"]
          .map(sanitizeSectorEvent)
          .filter((e): e is SectorEvent => e !== null)
          .slice(0, SECTOR_EVENTS_MAX)
      : [],
    judgments: Array.isArray(v["judgments"])
      ? v["judgments"]
          .map(sanitizeSectorJudgment)
          .filter((j): j is SectorJudgment => j !== null)
          .slice(0, SECTOR_JUDGMENTS_MAX)
      : [],
  };
}

/** Security events the Captain has not acknowledged yet — the Alert Ring's sector input. */
export function unacknowledgedSectorEvents(file: SectorWatchFile): SectorEvent[] {
  return file.events.filter((e) => !e.acknowledged);
}

/** Judgment pictures the Captain has not seen yet — the stage's "look at this" input. */
export function unacknowledgedJudgments(file: SectorWatchFile): SectorJudgment[] {
  return file.judgments.filter((j) => !j.acknowledged);
}

/* ------------------------------------------------------------------ */
/* The analyzer questions — strict yes/no, asked of the pulled view   */
/* ------------------------------------------------------------------ */

export const FRONT_THREAT_PROMPT =
  "Answer only yes or no: is there a person in this image who is touching a vehicle, inside a vehicle, or trying to force a door, window, or lock open? Begin your answer with yes or no and say nothing else.";

export const FRONT_THREAT_SECOND_PROMPT =
  "Look at this image again, carefully. Answer only yes or no: is a person definitely touching a vehicle, inside a vehicle, or forcing entry somewhere in this image? Begin your answer with yes or no and say nothing else.";

export const SECTOR_PERSON_SECOND_PROMPT =
  "Look at this image again, carefully. Answer only yes or no: is there definitely a person in this image? Begin your answer with yes or no and say nothing else.";

export const HOUSEHOLD_SAME_PERSON_PROMPT =
  "The first image shows a member of this household. Answer only yes or no: does the second image show the same person? Begin your answer with yes or no and say nothing else.";

/**
 * The Captain's truck (his addition, 2026-11-26): "the only one
 * that gets in this vehicle is me." The front watch asks this
 * of any frame its threat reading already flagged — a confirmed
 * person at the pickup is checked against the household faces,
 * exactly like the bedroom rule.
 */
export const FRONT_TRUCK_PROMPT =
  "Answer only yes or no: is there a person in this image who is at, touching, or getting into the pickup truck? Begin your answer with yes or no and say nothing else.";

export const FRONT_TRUCK_SECOND_PROMPT =
  "Look at this image again, carefully. Answer only yes or no: is a person definitely at, touching, or getting into the pickup truck in this image? Begin your answer with yes or no and say nothing else.";

/**
 * Evidence capture asks (FRONT events): free-text answers,
 * stored as DRAFT READINGS beside the stills they describe.
 * The still is the evidence; these words are only an index.
 */
export const PLATE_READING_PROMPT =
  "Look for a vehicle license plate in this image. If a plate is clearly readable, reply with only its characters (letters and numbers). If no plate is readable, reply with exactly the word NONE and nothing else.";

export const PERSON_DESCRIPTION_PROMPT =
  "Describe the person in this image in one short sentence: build, clothing, and what they are doing. If no person is visible, reply with exactly the word NONE and nothing else.";

/**
 * The judgment gate: before Anubis sends the Captain a "look at
 * this", the reading that caught his eye is asked once more, in
 * escalation words. Only a YES here sends the picture.
 */
export const JUDGMENT_CONFIRM_PROMPT =
  "Answer only yes or no: is there something in this image that a security guard would want a closer look at — a person, a vehicle, or activity that seems out of place? Begin your answer with yes or no and say nothing else.";

/**
 * THE WEAPON FLAG (the Captain's order, 2026-11-26 — proof of
 * concept of protection): anybody with a gun, or anything like
 * it, in ANY zone. Asked of every watch frame before the zone
 * rules. A first yes goes to its Second Look immediately; two
 * yeses are a TOP-TIER event with full evidence capture. An
 * unconfirmed weapon reading is logged as a draft and NEVER
 * sits in the judgment band.
 */
export const WEAPON_PROMPT =
  "Answer only yes or no: is there a person in this image holding or carrying a gun, a rifle, or anything that looks like a firearm? Begin your answer with yes or no and say nothing else.";

export const WEAPON_SECOND_PROMPT =
  "Look at this image again, carefully. Answer only yes or no: is a person in this image definitely holding or carrying a gun, a rifle, or an object that is clearly a firearm? Begin your answer with yes or no and say nothing else.";

/* ------------------------------------------------------------------ */
/* The decision law — pure functions over the analyzer's answers       */
/*                                                                     */
/* Every analyzer answer is boolean | null: true = its strict yes,     */
/* false = its strict no, null = NO VERDICT (it did not answer, or     */
/* answered without a clean yes/no). A first yes is a DRAFT. Only a    */
/* second yes confirms. Anything else never becomes an event.          */
/* ------------------------------------------------------------------ */

export type SectorDecision =
  | { outcome: "unavailable"; text: string }
  | { outcome: "quiet"; text: string }
  | { outcome: "draft"; text: string }
  | { outcome: "person"; text: string }
  | { outcome: "event"; text: string };

/** FRONT: a person at/inside a vehicle, or forcing entry. */
export function decideFront(first: boolean | null, second: boolean | null, cameraName: string): SectorDecision {
  if (first === null) {
    return {
      outcome: "unavailable",
      text: `${cameraName}: the analyzer gave no verdict on this frame — nothing is claimed about it.`,
    };
  }
  if (first === false) {
    return {
      outcome: "quiet",
      text: `${cameraName}: front watch — no one at a vehicle in this frame (the analyzer's draft reading).`,
    };
  }
  if (second === true) {
    return {
      outcome: "event",
      text: `${cameraName}: the analyzer's reading — confirmed on a second look — says a person is at or inside a vehicle, or forcing entry, at the front. Both looks agreed; it is still a model's reading, and the kept frames are the proof to check.`,
    };
  }
  return {
    outcome: "draft",
    text: `${cameraName}: a first look said someone may be at a vehicle, but the second look did not confirm it — NOT CONFIRMED. A draft reading only, never an event.`,
  };
}

/**
 * THE CAPTAIN'S TRUCK — a confirmed person at the pickup is
 * cleared by the household faces or is an event, the bedroom
 * law on the front sector. Outcomes the runtime acts on:
 *   · "quiet" — the truck is not implicated; the caller falls
 *     through to the general front rule.
 *   · "draft" — a first look implicated the truck but the
 *     second look did not confirm; the caller logs the draft
 *     and still runs the general rule.
 *   · "person" — the face matched the household; the cycle
 *     ends, no event (it is the Captain at his own truck).
 *   · "event" — confirmed at the truck and not cleared.
 *   · "unavailable" — the analyzer gave no truck answer; the
 *     caller falls through to the general rule, whose own
 *     answers decide. Vehicle recognition is never invented:
 *     this stands only on what the analyzer actually returned.
 */
export function decideFrontTruck(
  first: boolean | null,
  second: boolean | null,
  face: FaceCheckOutcome,
  cameraName: string,
): SectorDecision {
  if (first === null) {
    return {
      outcome: "unavailable",
      text: `${cameraName}: the analyzer gave no answer about the Captain's truck on this frame — the truck rule claims nothing.`,
    };
  }
  if (first === false) {
    return {
      outcome: "quiet",
      text: `${cameraName}: no person at the Captain's truck in this reading (the analyzer's draft reading).`,
    };
  }
  if (second !== true) {
    return {
      outcome: "draft",
      text: `${cameraName}: a first look said a person may be at the Captain's truck, but the second look did not confirm it — NOT CONFIRMED. A draft reading only.`,
    };
  }
  switch (face.state) {
    case "match":
      return {
        outcome: "person",
        text: `${cameraName}: a person is at the Captain's truck (confirmed on a second look), and the analyzer's draft reading matches ${face.name} — the truck is the Captain's, and this face is cleared to it. Logged, no alert. A model match is a hint, never proof of identity.`,
      };
    case "no-match":
      return {
        outcome: "event",
        text: `${cameraName}: a person is at the Captain's truck (confirmed on a second look) and the analyzer's reading matches NO enrolled household face — the Captain's rule: the only one who gets in that truck is him. The kept frames are the proof to check.`,
      };
    case "no-verdict":
      return {
        outcome: "event",
        text: `${cameraName}: a person is at the Captain's truck (confirmed on a second look) and the face check gave no verdict — an unclear face at his truck is an event by the Captain's rule. The kept frames are the proof to check.`,
      };
    case "none-enrolled":
      return {
        outcome: "event",
        text: `${cameraName}: a person is at the Captain's truck (confirmed on a second look). No face is enrolled yet, so recognition cannot clear anyone — by the Captain's rule that is an event until he and Khadija are enrolled. The kept frames are the proof to check.`,
      };
  }
}

/** THE WEAPON FLAG — top tier, every zone, Second-Looked like everything else. */
export function decideWeapon(
  first: boolean | null,
  second: boolean | null,
  cameraName: string,
): SectorDecision {
  if (first === null) {
    return {
      outcome: "unavailable",
      text: `${cameraName}: the analyzer gave no answer to the weapon question on this frame — nothing is claimed.`,
    };
  }
  if (first === false) {
    return {
      outcome: "quiet",
      text: `${cameraName}: no weapon in this frame (the analyzer's draft reading).`,
    };
  }
  if (second === true) {
    return {
      outcome: "event",
      text: `${cameraName}: TOP TIER — the analyzer's reading, confirmed on a second look, says a person here is holding or carrying a gun or something like it. It is still a model's draft reading; the kept stills are the evidence to check.`,
    };
  }
  return {
    outcome: "draft",
    text: `${cameraName}: a first look said a weapon may be present, but the second look did not confirm it — NOT CONFIRMED. A weapon draft never becomes a judgment item; it is logged here and nothing more is claimed.`,
  };
}

/** What the bedroom face check concluded, from the runtime's checks. */
export type FaceCheckOutcome =
  /** An enrolled face matched — the member's name is known. */
  | { state: "match"; name: string }
  /** Every enrolled face was asked; none matched. */
  | { state: "no-match" }
  /** At least one check gave no verdict, and none matched. */
  | { state: "no-verdict" }
  /** Nobody is enrolled — recognition does not exist yet. */
  | { state: "none-enrolled" };

/** BEDROOM: a confirmed person is family, or is NO ACCESS. */
export function decideBedroom(
  personFirst: boolean | null,
  personSecond: boolean | null,
  face: FaceCheckOutcome,
  cameraName: string,
): SectorDecision {
  if (personFirst === null) {
    return {
      outcome: "unavailable",
      text: `${cameraName}: the analyzer gave no verdict on this frame — nothing is claimed about it.`,
    };
  }
  if (personFirst === false) {
    return {
      outcome: "quiet",
      text: `${cameraName}: the Captain's room — no person in this frame (the analyzer's draft reading).`,
    };
  }
  if (personSecond !== true) {
    return {
      outcome: "draft",
      text: `${cameraName}: a first look said a person may be in the Captain's room, but the second look did not confirm it — NOT CONFIRMED. A draft reading only, never an event.`,
    };
  }
  switch (face.state) {
    case "match":
      return {
        outcome: "person",
        text: `${cameraName}: a person is in the Captain's room, and the analyzer's draft reading matches ${face.name} — a face this house knows. Logged, no alert. A model match is a hint, never proof of identity.`,
      };
    case "no-match":
      return {
        outcome: "event",
        text: `${cameraName}: a person is in the Captain's room (confirmed on a second look) and the analyzer's reading matches NO enrolled face — by the Captain's rule that is NO ACCESS: the room is his and Khadija's only. The kept frames are the proof to check.`,
      };
    case "no-verdict":
      return {
        outcome: "event",
        text: `${cameraName}: a person is in the Captain's room (confirmed on a second look) and the face check gave no verdict — an unknown face is NO ACCESS by the Captain's rule. The kept frames are the proof to check.`,
      };
    case "none-enrolled":
      return {
        outcome: "event",
        text: `${cameraName}: a person is in the Captain's room (confirmed on a second look). No face is enrolled yet, so recognition cannot clear anyone — by the Captain's rule any person here is NO ACCESS until the Captain and Khadija are enrolled. The kept frames are the proof to check.`,
      };
  }
}

/** COMMON: people are expected (Sid's rule) — presence is logged, never an alert. */
export function decideCommon(person: boolean | null, cameraName: string): SectorDecision {
  if (person === null) {
    return {
      outcome: "unavailable",
      text: `${cameraName}: the analyzer gave no verdict on this frame — nothing is claimed about it.`,
    };
  }
  if (person === true) {
    return {
      outcome: "person",
      text: `${cameraName}: a person is present in a common area (the analyzer's draft reading) — people are expected here, so this is logged and raises nothing.`,
    };
  }
  return {
    outcome: "quiet",
    text: `${cameraName}: common area — no person in this frame (the analyzer's draft reading).`,
  };
}

/* ------------------------------------------------------------------ */
/* Evidence answers — the analyzer's words, cleaned and kept honest    */
/* ------------------------------------------------------------------ */

/**
 * A plate reading from the analyzer's raw answer. NONE, empty,
 * or word-salad is NO reading (null) — characters are never
 * invented. What survives is letters/digits/spaces/dashes,
 * uppercased, 2–12 characters: a plausible plate shape, still
 * only a DRAFT READING beside the still that is the evidence.
 */
export function plateReadingFromAnswer(raw: string | null): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text || /^none\b/i.test(text)) return null;
  const cleaned = text.toUpperCase().replace(/[^A-Z0-9 -]/g, "").replace(/\s+/g, " ").trim();
  if (cleaned.length < 2 || cleaned.length > 12) return null;
  if (!/[0-9]/.test(cleaned) || !/[A-Z]/.test(cleaned)) return null;
  return cleaned;
}

/** The plate note that stands beside a still — evidence first, reading second. */
export function plateNoteFor(plate: string | null): string {
  return plate === null
    ? "No plate readable in this still — the record says so plainly; no characters were invented."
    : `Draft plate reading: ${plate} (the analyzer's reading of this still — an index for the Captain's reports; the still is the evidence, never this text).`;
}

/** A one-line person description from the analyzer's raw answer; "" when it gave none. */
export function descriptionFromAnswer(raw: string | null): string {
  if (!raw) return "";
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text || /^none\b/i.test(text)) return "";
  return text.slice(0, 280);
}

/* ------------------------------------------------------------------ */
/* Anubis's judgment — the notable band                                */
/*                                                                     */
/* The band, in one place: a DRAFT reading on the FRONT or the         */
/* BEDROOM sector — a first look said yes (a person at a vehicle,      */
/* at the truck, or in the Captain's room) and the second look did     */
/* not confirm it. Below the event line, but something caught the      */
/* analyzer's eye once. Common areas are never notable: people are     */
/* expected there (Sid's rule), and a person reading there is logged,  */
/* not escalated. Events are not judgment — they already raise the     */
/* Alert Ring. Quiet, person, and unavailable readings are not         */
/* judgment either. Before any picture is sent, the escalation         */
/* question (JUDGMENT_CONFIRM_PROMPT) must also say yes — the          */
/* judgment is Second-Looked like everything else. And a per-camera    */
/* cooldown keeps judgment from becoming spam.                         */
/* ------------------------------------------------------------------ */

/** At most one judgment picture per camera in this stretch. */
export const JUDGMENT_COOLDOWN_MS = 15 * 60_000;

/** Is this reading in the notable band — worth the Captain's eyes, below the event line? */
export function isNotableReading(zone: SectorZone, decision: SectorDecision): boolean {
  return (zone === "front" || zone === "bedroom") && decision.outcome === "draft";
}

/** Has this camera's judgment cooldown run out? */
export function judgmentDue(lastJudgmentAt: number | null, now: number): boolean {
  return lastJudgmentAt === null || now - lastJudgmentAt >= JUDGMENT_COOLDOWN_MS;
}

/** The one plain line a judgment carries — what caught his eye, labeled his reading. */
export function judgmentText(zone: SectorZone, cameraName: string): string {
  return zone === "bedroom"
    ? `${cameraName}: Anubis wants you to look — a first reading put a person in the Captain's room and the second look could not confirm it. Not an event; his judgment call, and the picture is kept with it.`
    : `${cameraName}: Anubis wants you to look — a first reading put a person at a vehicle out front and the second look could not confirm it. Not an event; his judgment call, and the picture is kept with it.`;
}

/* ------------------------------------------------------------------ */
/* Cross-examination — measurable indicators, honestly labeled         */
/*                                                                     */
/* The Captain's framing governs the semantics: an indicator "can      */
/* mean something stressful — not saying that they are" going to do    */
/* wrong. Indicators are built ONLY from measurable inputs: the        */
/* camera audio's level (RMS against the hearing gate), the scene's    */
/* motion pattern (frame-difference coverage), and the picture         */
/* analyzer's readings. A passerby's HEART RATE is not a measurable    */
/* signal on these cameras and mics — there is no heart-level meter    */
/* here and there never will be one presented as such. Indicators      */
/* inform judgment escalations; they never become events.              */
/* ------------------------------------------------------------------ */

/** The hearing gate's silence floor — the same RMS the listener uses. */
export const AUDIO_QUIET_FLOOR = 0.012;

/** The sound indicator from a measured audio RMS level (null = could not measure). */
export function audioBand(rms: number | null): string {
  if (rms === null || !Number.isFinite(rms)) {
    return "UNAVAILABLE — no audio level could be measured from this camera, so no sound indicator is claimed";
  }
  const level =
    rms < AUDIO_QUIET_FLOOR
      ? "quiet — under the hearing gate's floor"
      : rms < 0.08
        ? "audible activity — voices or ordinary sounds at a normal level"
        : "loud — raised voices, a bang, or heavy noise at this level";
  return `audio level RMS ${rms.toFixed(3)} — ${level} (a stress INDICATOR from a measurable input; it can mean something stressful, it does not say anyone is doing wrong)`;
}

/** The motion indicator from frame-difference coverage (null = could not measure). */
export function motionBand(coverage: number | null): string {
  if (coverage === null || !Number.isFinite(coverage)) {
    return "UNAVAILABLE — no second frame could be compared, so no motion indicator is claimed";
  }
  const pct = Math.round(coverage * 100);
  const pattern =
    coverage < 0.02
      ? "the scene held still between the two frames"
      : coverage < 0.15
        ? "movement in part of the scene — a person crossing, a door, a vehicle easing in"
        : "movement across much of the scene — hurried or large-scale motion";
  return `${pct}% of the picture changed between two frames a beat apart — ${pattern} (a stress INDICATOR from a measurable input; it can mean something stressful, it does not say anyone is doing wrong)`;
}

/** The cross-examination log line: which tools, what each returned — never merged. */
export function crossExamLogText(subject: string, entries: CrossExamEntry[]): string {
  const parts = entries.map((e) => `${e.tool} — ${e.reading}`).join("; ");
  return `Cross-examination for ${subject}: ${parts}. Each is a labeled reading from its own tool; they are recorded side by side, never merged into a certainty.`;
}
