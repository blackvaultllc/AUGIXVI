/**
 * PRESENCE DOCTRINE (owner order 2026-11-22): who stands on the
 * stage at all — the rules, in plain data (repo rule: rules stay in
 * plain TS modules, unit-testable). AvatarStage.tsx holds the state
 * and the timers; this module decides.
 *
 * - ANUBIS IS RESIDENT: alone on the stage by default, at center —
 *   the commander the Captain talks to. He is never summoned and
 *   never dismissed; he is simply there.
 * - THE BLACK HATTER IS PUT AWAY by default: his medallion does not
 *   stand on the stage until the Captain brings him back (the Owner
 *   seat). Nothing of his is deleted — his saved placement and size
 *   persist, and his speaker-of-record role in the Command box is
 *   untouched; this doctrine governs stage presence only.
 * - EVERY OTHER GOD IS NOT RESIDENT. Montu (and any god seated
 *   after him) comes onto the stage three ways only:
 *   (a) REPORT — he has something to report: he pops in briefly,
 *       portrait up like a message appearing, delivers it, and goes
 *       away on his own when the report's life ends.
 *   (b) SUMMON — the Captain calls him: a tap on his name where the
 *       gods are listed, his name typed, or his name spoken. He
 *       comes on and STAYS for the conversation.
 *   (c) DISMISSAL — the Captain's word ("good work", "you can
 *       leave", "that'll be all", …) sends him off: he shows his
 *       allegiance — the bow, with the blessing — and leaves back
 *       to his work.
 * - THE NO-OVERLAP LAW stands over all of it: a god who comes on
 *   takes a spot that overlaps nobody — not Anubis, not the owner,
 *   not another god (the spot itself is computed in
 *   medallionAnchor.ts, clearMedallionSpot).
 *
 * Amun-Ra is untouched by this doctrine: his top seat is bound, not
 * rendered as a station (stagePerspective.ts, TOP_SEAT). The mummy
 * guardians stay on the gate-denial surface only.
 */
import type { GodPerspective } from "./stagePerspective";

/** Who is on the stage, beyond the resident commander. */
export interface StageResidency {
  /** The Black Hatter's medallion stands on the stage. */
  ownerPresent: boolean;
  /** Gods summoned for a conversation — they stay until dismissed. */
  summoned: readonly GodPerspective[];
  /** A god popped in to deliver a report — he leaves on his own. */
  reportGod: GodPerspective | null;
  /** A god mid-bow, showing allegiance on his way out. */
  bowingGod: GodPerspective | null;
}

export const EMPTY_RESIDENCY: StageResidency = {
  ownerPresent: false,
  summoned: [],
  reportGod: null,
  bowingGod: null,
};

/** Anubis is resident — always on the stage. Any other god is on
 * the stage only while summoned, reporting, or bowing out. */
export function godOnStage(residency: StageResidency, god: GodPerspective): boolean {
  if (god === "anubis") return true;
  return (
    residency.summoned.includes(god) ||
    residency.reportGod === god ||
    residency.bowingGod === god
  );
}

/**
 * The gods whose names the Captain can speak to summon. Today that
 * is Montu — the one god seated besides the resident. Anubis needs
 * no summon (he is resident), and no other god is seated yet.
 */
export const SUMMONABLE_GODS: readonly { god: GodPerspective; name: string }[] = [
  { god: "montu", name: "Montu" },
];

/**
 * A typed or spoken summon: the god's name, bare or under a call —
 * "Montu", "summon Montu", "call Montu", "bring Montu in",
 * "Montu, come here". Returns the god, or null when the line is not
 * a summon. (Voice lines reach the same matcher — the command path
 * is shared.)
 */
export function summonTarget(text: string): GodPerspective | null {
  const line = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/,/g, "")
    .trim()
    .replace(/[.!]+$/, "");
  for (const { god, name } of SUMMONABLE_GODS) {
    const n = name.toLowerCase();
    if (
      line === n ||
      line === `summon ${n}` ||
      line === `call ${n}` ||
      line === `bring ${n} in` ||
      line === `bring in ${n}` ||
      line === `get ${n}` ||
      line === `${n} come here` ||
      line === `${n} report` ||
      line === `come here ${n}`
    ) {
      return god;
    }
  }
  return null;
}

/**
 * The dismissal words (owner order 2026-11-22): "good work",
 * "you can leave", "leave", "that'll be all" — and their close
 * kin. Matched against the whole line, so conversation that merely
 * contains the words is not a dismissal.
 */
const DISMISSAL_PATTERNS: readonly RegExp[] = [
  /^good work[.!]?$/,
  /^well done[.!]?$/,
  /^nice work[.!]?$/,
  /^you can leave( now)?[.!]?$/,
  /^leave[.!]?$/,
  /^that'?ll be all[.!]?$/,
  /^that will be all[.!]?$/,
  /^dismissed[.!]?$/,
  /^go back to work[.!]?$/,
  /^back to work[.!]?$/,
  /^return to your (post|work|station)[.!]?$/,
];

export function isDismissal(text: string): boolean {
  const line = text.toLowerCase().replace(/\s+/g, " ").trim();
  return DISMISSAL_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Who a dismissal sends off: the god being addressed, when he is a
 * summoned god; otherwise the most recently summoned god still on
 * the stage. The resident is never dismissed, and a report pop-in
 * is not dismissed — it leaves on its own. Null when nobody can be
 * sent off (the line then falls through to ordinary conversation).
 */
export function dismissalTarget(
  residency: StageResidency,
  addressed: GodPerspective | null,
): GodPerspective | null {
  if (addressed && residency.summoned.includes(addressed)) return addressed;
  for (let i = residency.summoned.length - 1; i >= 0; i -= 1) {
    const god = residency.summoned[i]!;
    if (god !== residency.bowingGod) return god;
  }
  return null;
}

/**
 * THE CONSTRUCT IN EDIT MODE (owner order 2026-11-22): the
 * construct stands on the stage — visible, movable, workable —
 * whenever he has been brought on, whenever his box is open and
 * docked, and whenever the Captain is EDITING the environment (the
 * builder is open): edit mode must not exile him to his sandbox
 * only. Off the live Room (the space view) he stands as he always
 * has. In the live Room with none of those true, center stage
 * belongs to the resident commander and the construct is off stage.
 */
export function constructStandsOnStage(input: {
  worldScreen: string;
  constructOnStage: boolean;
  builderOpen: boolean;
  constructOpen: boolean;
  constructDocked: boolean;
}): boolean {
  return (
    input.worldScreen !== "live" ||
    input.constructOnStage ||
    input.builderOpen ||
    (input.constructOpen && input.constructDocked)
  );
}
