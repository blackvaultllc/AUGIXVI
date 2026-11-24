/**
 * GODS ON THE SIDES — THE STAGE'S RESTING LAW (owner order
 * 2026-11-24 ~11:27–11:31 EST, settled after he rejected a
 * "hall of the gods" idea himself on the same call).
 *
 * THE RESTING STATE IS THE WALLPAPER. His words: "when Anubis
 * pops up I can't see the wallpaper in the background... I want
 * to put the two wallpapers, make the screen look nice, and have
 * my constructs around." So the stage at rest shows the
 * wallpaper, and EVERY god — Anubis included — rests SMALL in a
 * side slot, in the small medallion format of Osiris's corner
 * console: Anubis down the left side, Montu down the right
 * (screen conservation — small when not needed). This supersedes
 * the resident-center resting state of 2026-11-22/23 for the
 * RESTING stage only: Anubis remains first among the gods and
 * the conversation's default addressee — he simply no longer
 * sits big on the wallpaper un-summoned.
 *
 * CLICK TO FRONT: clicking a god's slot medallion brings him
 * FRONT — center, big — and on arrival he shows allegiance and
 * asks what the Captain needs (GOD_GREETINGS: spoken in his
 * voice and shown on the stage), and his chat opens (the
 * per-god chat law of the clean-screen round — selectGod routes
 * the conversation to him). Clicking the front god again — his
 * face, or "Return to his place" in his menu — sends him back
 * to his slot, and the stage returns to the wallpaper.
 * Summoning ANOTHER god sends the first back to his slot: one
 * god holds the front at a time (this supersedes the
 * tap-two-gods council seating of 2026-11-22 for taps; the
 * dismissal-by-words bow of the presence doctrine is untouched).
 *
 * THE SLOT IS NOT A SUMMON. The side slot is a god's
 * place-marker and his door — it stands whether or not he is
 * "on the stage" in the presence doctrine's sense, because it
 * is how the Captain calls him. The doctrine (presenceDoctrine
 * .ts) still governs the FRONT presence: who stands big, who
 * bows out under dismissal. Amun-Ra holds no slot: his seat is
 * over the whole stage (stagePerspective.ts, TOP_SEAT), never
 * a station in it. Osiris holds no slot either: his console at
 * the top-left is his seat, unchanged, anchor and all.
 *
 * RESPECT HOLDS: no god is dragged by his face — slots are
 * fixed by this layout, and the front is reached by click, not
 * by grabbing. (The Osiris console keeps its own anchor/move
 * behavior, as built in the clean-screen round.)
 *
 * Plain data + rules, no rendering — unit-testable per the
 * repo's avatar rules. AvatarStage.tsx holds the state;
 * GodSideRail.tsx renders the slots.
 */
import type { GodPerspective } from "./stagePerspective";

export type GodSlotSide = "left" | "right";

export interface GodSlot {
  god: GodPerspective;
  side: GodSlotSide;
  /** Order down his side, first at the top. */
  order: number;
}

/**
 * THE LINEUP. Anubis takes the left — first among the side
 * gods, on the reading side, under Osiris's console corner.
 * Montu takes the right — the flank that has always been his
 * station (medallionAnchor.ts: the right flank is the seat of
 * the commander who is sent out).
 */
export const GOD_SLOTS: readonly GodSlot[] = [
  { god: "anubis", side: "left", order: 0 },
  { god: "montu", side: "right", order: 0 },
];

/** Every god who holds a side slot, in lineup order. */
export const SLOT_GODS: readonly GodPerspective[] = GOD_SLOTS.map((slot) => slot.god);

/** The god holding the front (center, big) — or none: the
 *  stage is resting on its wallpaper. */
export type FrontGod = GodPerspective | null;

/** The stage's resting state at load: nobody at front. */
export const RESTING_FRONT: FrontGod = null;

/** The slot a god rests in. */
export function slotFor(god: GodPerspective): GodSlot {
  return GOD_SLOTS.find((slot) => slot.god === god) ?? GOD_SLOTS[0]!;
}

/** The gods standing in slots on one side, in order — the god
 *  at front has left his slot, so he is not among them. */
export function slotGodsOnSide(front: FrontGod, side: GodSlotSide): GodPerspective[] {
  return GOD_SLOTS.filter((slot) => slot.side === side && slot.god !== front).map(
    (slot) => slot.god,
  );
}

/** A summon: the called god takes the front, whoever held it
 *  returns to his slot. */
export function frontAfterSummon(_current: FrontGod, god: GodPerspective): FrontGod {
  return god;
}

/** A dismissal — a tap on the front god, his menu's Return, or
 *  the dismissal words: he returns to his slot. Dismissing a
 *  god who is not at front changes nothing. */
export function frontAfterDismiss(current: FrontGod, god: GodPerspective): FrontGod {
  return current === god ? null : current;
}

/**
 * THE ALLEGIANCE GREETING — spoken and shown when a god comes
 * to the front: he states his name, shows allegiance to the
 * Captain as king of this house, and asks what he needs. Then
 * his chat is open for orders.
 */
export const GOD_GREETINGS: Readonly<Record<GodPerspective, string>> = {
  anubis: "Anubis, at your command, Captain. What do you need?",
  montu: "Montu, on watch and at your command, Captain. What do you need?",
};

/** The front seat's face size for a summoned god: big — the
 *  call scale of the stage — fitted by the caller's clamp to
 *  the stage he stands on. Anubis's front seat is his locked
 *  factory home (medallionAnchor.ts) and never passes through
 *  here; this is the seat a free medallion (Montu) is written
 *  when he comes to the front. */
export const FRONT_FACE_SIZE = 400;
