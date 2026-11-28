/**
 * THE FRONT DOOR — the god-name key (owner order 2026-11-27
 * ~23:18 CST).
 *
 * The landing page is the Matrix Wall and nothing else: black
 * and gold rain, no words, no personal or company information
 * anywhere in the front. Click the screen and a plain box
 * appears — no label, just a box. The visitor types THE NAME
 * OF THE GOD THEY HAVE CONTROL OF. That name is the key:
 *
 *   · Wrong name → nothing opens. The screen stays the
 *     black-and-gold matrix. No error text, no hint — a silent
 *     stay, and the woven binary is the only answer.
 *   · Right name → the secure screen opens, and THEN the
 *     verification machinery stands there exactly as it stood
 *     (the three-path gate check, the credentials behind it,
 *     the owner never locked out). The name is a door cover,
 *     not a credential: credentials still decide the entry.
 *
 * WHOSE NAME OPENS WHAT is resolved through the company's own
 * records — the sixteen seats in departmentHeads.ts. A name is
 * a key only when it is the god of a SEATED person:
 *
 *   · "Anubis" — the Captain's own key (his word, this order).
 *     Opens the operator door: the gate check and the sign-in.
 *   · "Hathor" — Violet's god (seat 011). Her secure screen is
 *     her own door at /violet; the name routes her there, the
 *     same full-page crossing the heart door makes, so no
 *     operator state rides along.
 *   · "Osiris" — Khadija's construct (seat 1). Her secure
 *     screen is her own side at /learner; the name routes her
 *     there the same way.
 *
 * A god with no seated person is NOT a key: Montu stands in
 * the structure as the Captain's own and guards the gate, but
 * no seat carries him as its god, so his name opens nothing
 * here — the Captain's key is Anubis, as he ordered. Seats
 * whose god he has not named (the empty chairs, and the sons,
 * whose gods are HELD by his order) have no key at all: nothing
 * is invented for them, and their names open nothing until he
 * speaks them.
 *
 * Plain TS, no I/O — the gate renders it, the tests pin it.
 */
import { AGENT_SEATS } from "./departmentHeads";

/** The door a right name opens. */
export type GodKeyDoor = "operator" | "violet" | "learner";

export interface GodKeyMatch {
  /** The seat whose god was named (0 the Captain, 1 Khadija, 11 Violet). */
  seat: number;
  /** The seated person's name, from the company's own record. */
  personName: string;
  /** The god's name as the record carries it — the key that was typed. */
  godName: string;
  /** The door this key opens. */
  door: GodKeyDoor;
}

/** The Captain's own key name — his word (owner order 2026-11-27 ~23:18 CST). */
export const CAPTAIN_KEY_GOD_NAME = "Anubis";

/** Seat → the door its key opens. A seated person not listed here has no door yet. */
const DOOR_BY_SEAT: Readonly<Record<number, GodKeyDoor>> = {
  0: "operator",
  1: "learner",
  11: "violet",
};

/** Comparable form of a typed name: trimmed, single-spaced, case-folded. */
export function normalizeGodKey(typed: string): string {
  return typed.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Resolve a typed name to its key, or null. Null is the whole
 * answer for a wrong name: nothing opens, nothing is said.
 * Only a seated person with a named god has a key — the seats
 * are the record, and the record is the only source.
 */
export function resolveGodKey(typed: string): GodKeyMatch | null {
  const wanted = normalizeGodKey(typed);
  if (!wanted) return null;
  for (const seat of AGENT_SEATS) {
    if (!seat.agentName || !seat.god || !seat.god.name) continue;
    const door = DOOR_BY_SEAT[seat.seat];
    if (!door) continue;
    if (normalizeGodKey(seat.god.name) === wanted) {
      return { seat: seat.seat, personName: seat.agentName, godName: seat.god.name, door };
    }
  }
  return null;
}

/** The path a routed door stands at — a full-page crossing, like the heart door. */
export function godKeyDoorPath(door: GodKeyDoor): string | null {
  switch (door) {
    case "violet":
      return "/violet";
    case "learner":
      return "/learner";
    case "operator":
      return null; // the operator door is this very gate — it opens in place
  }
}
