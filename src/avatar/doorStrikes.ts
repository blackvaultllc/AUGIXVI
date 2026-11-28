/**
 * DOOR STRIKES — the cube is the security (owner order
 * 2026-11-28 ~00:50 CST: "make sure the cube is the security").
 *
 * The god-name door counts WRONG names per visitor address:
 *
 *   · Strikes one and two are met with the same silence as
 *     ever — the box closes, the rain stands, nothing is said.
 *     Counting must never teach an attacker anything: no
 *     counter, no warning, no difference in what the screen
 *     shows. The only place a strike is ever visible is the
 *     Captain's own record, inside.
 *   · The THIRD wrong name from one address: the cube takes
 *     the screen — it spins faster and faster, then turns all
 *     black, and black is all that visitor sees.
 *   · A struck-out address is RESTRICTED: when it comes back
 *     it gets the black/cube state, never the door again,
 *     until the Captain releases it from inside.
 *
 * A name is wrong when it opens nothing — resolveGodKey in
 * loginDoor.ts is the only judge: god names registered to
 * nobody (Montu among them — a god, but no seated person's
 * key), names of gods whose seats are held, and anything else
 * typed into the box. A right name is never a strike.
 *
 * An address we cannot name ("unknown") is never struck and
 * never restricted: a restriction we cannot tie to an address
 * would fall on strangers who share the fog. On the deployed
 * site the address is the one Cloudflare saw; on the core it
 * is the socket's own address (clientIpFromRequest).
 *
 * Strikes do not decay and a right name does not clear them —
 * the record stands until the Captain releases the address,
 * or a session from that address verifies all the way through
 * the operator gate (registry + MFA): the house does not lock
 * its own verified keeper out. The store itself lives in the
 * operator registry (doorSecurity.server.ts) — the same record
 * online (Durable Object) and on the core (the local file).
 *
 * Plain TS, no I/O — the registry runs it, the tests pin it.
 */

/** Wrong names one address may give before the cube answers. */
export const DOOR_STRIKE_LIMIT = 3;

export interface DoorStrikeRecord {
  /** Wrong names counted from this address. */
  strikes: number;
  /** ISO time of the first counted wrong name. */
  firstStrikeAt: string;
  /** ISO time of the most recent counted wrong name. */
  lastStrikeAt: string;
  /** ISO time the address was restricted (the third strike), or null. */
  restrictedAt: string | null;
}

export type DoorStrikesMap = Record<string, DoorStrikeRecord>;

/** One restricted address, as the Captain's release list shows it. */
export interface DoorRestrictionView {
  ip: string;
  strikes: number;
  firstStrikeAt: string;
  lastStrikeAt: string;
  restrictedAt: string;
}

const IP_MAX_LENGTH = 64;
const TIME_MAX_LENGTH = 64;
const MAP_MAX_ENTRIES = 512;

/**
 * An address the door can keep a record under: a real string,
 * no whitespace, never the fog word. Anything else is not an
 * address the law will strike or restrict.
 */
export function isDoorIpUsable(ip: unknown): ip is string {
  return (
    typeof ip === "string" &&
    ip.length > 0 &&
    ip.length <= IP_MAX_LENGTH &&
    ip.toLowerCase() !== "unknown" &&
    !/\s/.test(ip)
  );
}

function isTimeString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= TIME_MAX_LENGTH;
}

function sanitizeRecord(value: unknown): DoorStrikeRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Partial<DoorStrikeRecord>;
  if (
    typeof record.strikes !== "number" ||
    !Number.isInteger(record.strikes) ||
    record.strikes < 1 ||
    record.strikes > 1000 ||
    !isTimeString(record.firstStrikeAt) ||
    !isTimeString(record.lastStrikeAt) ||
    (record.restrictedAt !== null && !isTimeString(record.restrictedAt))
  ) {
    return null;
  }
  return {
    strikes: record.strikes,
    firstStrikeAt: record.firstStrikeAt,
    lastStrikeAt: record.lastStrikeAt,
    restrictedAt: record.restrictedAt,
  };
}

/** The stored map, cleaned: unusable addresses and malformed records dropped. */
export function sanitizeDoorStrikes(value: unknown): DoorStrikesMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const map: DoorStrikesMap = {};
  for (const [ip, raw] of Object.entries(value)) {
    if (Object.keys(map).length >= MAP_MAX_ENTRIES) break;
    if (!isDoorIpUsable(ip)) continue;
    const record = sanitizeRecord(raw);
    if (record) map[ip] = record;
  }
  return map;
}

/** True when this record has reached the limit and stands restricted. */
export function isDoorRecordRestricted(record: DoorStrikeRecord | undefined): boolean {
  return record !== undefined && record.restrictedAt !== null;
}

/**
 * Count one wrong name from an address. Returns the new map
 * and the address's standing. The result carries counts only —
 * nothing in it is ever shown at the door.
 */
export function applyDoorStrike(
  map: DoorStrikesMap,
  ip: string,
  nowIso: string,
): { map: DoorStrikesMap; strikes: number; restricted: boolean } {
  const existing = map[ip];
  const strikes = (existing?.strikes ?? 0) + 1;
  const restricted = strikes >= DOOR_STRIKE_LIMIT;
  const record: DoorStrikeRecord = {
    strikes,
    firstStrikeAt: existing?.firstStrikeAt ?? nowIso,
    lastStrikeAt: nowIso,
    restrictedAt: restricted ? (existing?.restrictedAt ?? nowIso) : null,
  };
  return { map: { ...map, [ip]: record }, strikes, restricted };
}

/** The Captain's release: the address's record is struck from the book. */
export function releaseDoorIp(
  map: DoorStrikesMap,
  ip: string,
): { map: DoorStrikesMap; released: boolean } {
  if (!(ip in map)) return { map, released: false };
  const next = { ...map };
  delete next[ip];
  return { map: next, released: true };
}

/** The restricted addresses only, most recently restricted first. */
export function doorRestrictionsList(map: DoorStrikesMap): DoorRestrictionView[] {
  return Object.entries(map)
    .filter(([, record]) => record.restrictedAt !== null)
    .map(([ip, record]) => ({
      ip,
      strikes: record.strikes,
      firstStrikeAt: record.firstStrikeAt,
      lastStrikeAt: record.lastStrikeAt,
      restrictedAt: record.restrictedAt as string,
    }))
    .sort((a, b) => b.restrictedAt.localeCompare(a.restrictedAt));
}
