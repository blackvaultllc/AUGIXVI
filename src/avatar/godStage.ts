/**
 * THE STAGE'S RESTING LAW (owner order 2026-11-24 ~16:57 EST —
 * the Captain's refinement of the gods-on-the-sides round of the
 * same morning, given over his own screenshot of the deployed
 * build: "this is so wrong… Definitely not at all").
 *
 * WHAT DIED: the side rails. The gods-on-the-sides build stood
 * Anubis and Montu as tall figures in narrow strips down the
 * stage's left and right edges, and the stage rested on its
 * wallpaper with NO god at the center. His verdict killed both
 * halves: nothing stands on the left/right edges — no strips,
 * no figures — and the resting stage is NOT an empty wallpaper.
 *
 * THE RESTING STATE IS ANUBIS AT THE CENTER. At rest Anubis
 * holds the FRONT — the middle of the stage, a circular
 * medallion at his regular front size, the way he stood before
 * the gods-on-the-sides change. He is first among the gods and
 * the conversation's default addressee, home at the center
 * until a summon moves the front.
 *
 * THE OTHER GODS REST AS SMALL CIRCLES. Every other god rests
 * as a SMALL CIRCULAR medallion on the stage — round like
 * Osiris's picture, just smaller than Anubis: the face centered
 * inside the circle, his aspect kept, never stretched, squeezed
 * or cropped into a strip. The circles sit in the stage's
 * lower-right field, clear of the edges. Each is alive in his
 * circle — his own motion (godMotion.ts), blinking, looking
 * around the room.
 *
 * CLICK TO FRONT: clicking a god's resting circle brings him
 * FRONT — center, big — and on arrival he shows allegiance and
 * asks what the Captain needs (GOD_GREETINGS: spoken in his
 * voice and shown on the stage), and his chat opens (the
 * per-god chat law of the clean-screen round — selectGod routes
 * the conversation to him). One god holds the front at a time.
 *
 * DISMISSAL RETURNS ANUBIS TO THE CENTER. Sending the front
 * god back — a tap on his face, "Return to his place" in his
 * menu, or the dismissal words with their bow — does not empty
 * the stage: ANUBIS returns to the center, the default. Anubis
 * himself is never dismissed from the center: he is home there
 * (the presence doctrine's resident rule, unchanged).
 *
 * OSIRIS HOLDS NO CIRCLE AND NO FRONT. He stands alone at the
 * top-left, bare — no box, no panel, no chat attached — with
 * his own keys in his three-lines menu (OsirisMedallion.tsx).
 * Amun-Ra holds no circle either: his seat is over the whole
 * stage (stagePerspective.ts, TOP_SEAT).
 *
 * RESPECT HOLDS: no god is dragged by his face — the resting
 * circles are fixed by this layout, and the front is reached
 * by click, not by grabbing.
 *
 * Plain data + rules, no rendering — unit-testable per the
 * repo's avatar rules. AvatarStage.tsx holds the state;
 * GodMedallions.tsx renders the resting circles.
 */
import type { GodPerspective } from "./stagePerspective";

/**
 * Every god who can hold the front and rest as a circle:
 * Anubis first — the center's holder — then Montu.
 */
export const MEDALLION_GODS: readonly GodPerspective[] = ["anubis", "montu"];

/** The god holding the front (center, big). At rest this is
 *  Anubis; it is null only while the Owner seat stands (the
 *  Black Hatter brought back from put-away). */
export type FrontGod = GodPerspective | null;

/** The stage's resting state at load: ANUBIS AT THE CENTER —
 *  his regular front seat, as he stood before the
 *  gods-on-the-sides change (owner order 2026-11-24 ~16:57 EST,
 *  superseding the wallpaper-rest of the same morning). */
export const RESTING_FRONT: FrontGod = "anubis";

/** The default the front returns to when a summoned god is
 *  sent back: Anubis, at the center. */
export const DEFAULT_FRONT: GodPerspective = "anubis";

/** The gods resting as small circles while `front` holds the
 *  center — every medallion god except the one at front. At
 *  rest that is Montu alone; while Montu holds the front,
 *  Anubis's circle stands in the row; while the Owner seat
 *  stands (front null), both circles stand. */
export function restingMedallionGods(front: FrontGod): GodPerspective[] {
  return MEDALLION_GODS.filter((god) => god !== front);
}

/** A summon: the called god takes the front, whoever held it
 *  steps back to his resting circle. */
export function frontAfterSummon(_current: FrontGod, god: GodPerspective): FrontGod {
  return god;
}

/** A dismissal — a tap on the front god, his menu's Return, or
 *  the dismissal words: the dismissed god steps back to his
 *  resting circle and ANUBIS RETURNS TO THE CENTER, the
 *  default. Dismissing Anubis himself changes nothing: he is
 *  home at the center and is never dismissed from it.
 *  Dismissing a god who is not at front changes nothing. */
export function frontAfterDismiss(current: FrontGod, god: GodPerspective): FrontGod {
  if (god === DEFAULT_FRONT) return current;
  return current === god ? DEFAULT_FRONT : current;
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
