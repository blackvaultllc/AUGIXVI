/**
 * THE STAGE'S LAW — ONE GOD ON THE SCREEN (owner order
 * 2026-11-26 ~04:32 CST, superseding the resting law of
 * 2026-11-24 ~16:57 EST below in this file's history).
 *
 * His words: "You don't have to show anybody else in the
 * window. Not even Osiris. Let Anubis be the number one — get
 * rid of any other AI, put them until they're called, and when
 * they're called they can pop up in a small way like how
 * Osiris looks right now. They pop up right there if Anubis
 * calls. That way we don't clutter the screen — only have
 * Anubis on the screen, working within that, because we're
 * trying to make it like a phone app."
 *
 * THE RESTING STAGE IS ANUBIS ALONE. At rest the ONLY god on
 * the stage is Anubis — center, big, a true circular medallion
 * at his regular front size, the circuit ring around him. No
 * Osiris at the top-left, no Montu circle at the lower-right,
 * no other presence of any kind. The stage rests on him, the
 * way a phone app rests on its one home face.
 *
 * HIDDEN, NOT DELETED. Every other construct stays fully in
 * the system — his registry seat, his chat, his capabilities,
 * Osiris's menu and message screen, all of it (the owner's
 * standing law: no AI is ever deleted). They are simply not
 * RENDERED until called. What the 2026-11-24 law seated as
 * resting circles and a standing Osiris, this law un-renders;
 * nothing else about them changes.
 *
 * THE CALL POP-UP. A construct is called the ways he has
 * always been called: the Captain addresses him by name or
 * slash — typed or spoken (the addressee routing, addressee.ts)
 * — or summons him by name, or Anubis relays to him through
 * the Captain. While he holds the call he stands on the stage
 * as a SMALL medallion pop-up — the size and feel of Osiris's
 * medallion as it stood: Osiris at the top-left, carrying his
 * three-lines menu (his four keys + Message) and his message
 * screen exactly as before; Montu as a small living circle in
 * the stage's lower-right field, where his resting circle
 * stood. The called god's chat is the main chat, addressed to
 * him — a tap on his pop-up face opens it.
 *
 * THE POP-UP GOES AWAY WHEN THE CALL ENDS. The Captain
 * returns to Anubis — addresses him, taps his face, seats him
 * from the Scene tab — or dismisses the called god with the
 * dismissal words (he bows on his pop-up, then he is gone),
 * and the stage is Anubis-only again. Anubis himself never
 * leaves the center: he is home there (the presence doctrine's
 * resident rule, unchanged), and he has no pop-up — the center
 * IS his place.
 *
 * THE GOD PRESENCE REFINEMENT (owner orders, voice call
 * 2026-11-26 ~13:48–13:53 CST — the machinery lives in
 * godPresence.ts): the resting law above is NOT repealed — at
 * rest, Anubis alone. What the refinement settles is the VALUE
 * of a called god and what stands around him:
 * - A god who holds the call stands at PRESENCE scale — full
 *   living value, his ring around him — the same value as
 *   Anubis, in his own way. Only a HELPER (a god called by a
 *   god, mid-conversation) stands at the smaller medallion
 *   scale, and he bows out when he is done.
 * - While a god speaks, a comic-book speech bubble stands
 *   beside HIS head with his words (the bubble alone — the
 *   second-face pop-up removed in 2026-11-24 stays removed).
 * - While a god is in perspective, his own background — his
 *   picture in Egyptian history, from the app's art pipeline —
 *   stands over the Captain's wallpaper; the wallpaper choice
 *   itself is never written by the call. A god whose picture
 *   is not placed yet keeps the wallpaper, named plainly in
 *   godPresence.ts — no substitutes.
 * - PERSONALITIES FROM HISTORY (owner order 2026-11-26
 *   ~13:54 CST): each god's manner — how he speaks and
 *   carries himself — is built from his Hall record
 *   (deities.ts), nothing invented; a thin record stays
 *   plain. The manners live in godPresence.ts
 *   (GOD_PERSONALITIES) and ride in the speaker directive.
 * - THE COUNCIL (same order): a meeting mode — he seats who
 *   he needs, or everybody, and they discuss; Anubis chairs
 *   from the center, the background settles to the council
 *   setting, and ending it returns the stage to its rest.
 *   An EGYPTIAN seat — the gods in council over the claim of
 *   Horus — with El Consejo as its second name for his
 *   Spanish blood. No other mythology's court is named
 *   or pictured anywhere in it.
 * - PERFORMANCE LAW (same order, "very serious"): all of it
 *   runs LIGHT — the standing components reused, backgrounds
 *   a single lazy-loaded image rendered only while a god is
 *   in perspective, motion transform-only and stilled under
 *   reduced motion, nothing running at rest. A presence
 *   effect that cannot run light ships reduced.
 *
 * THE STATE'S NAME: the stage's `frontGod` state is the CALL
 * state now — it names the god who holds the Captain's call
 * beside Anubis ("anubis" = nobody called, the rest state;
 * "montu" = Montu called, his pop-up up; null = the Owner seat
 * stands). A called god no longer takes the center from
 * Anubis; the front seat is Anubis's alone.
 *
 * OSIRIS HOLDS NO STANDING PLACE ANYMORE. His pop-up is his
 * only stage presence, raised by the call and lowered by its
 * end. Amun-Ra is untouched: his seat is over the whole stage
 * (stagePerspective.ts, TOP_SEAT), never a rendered station.
 *
 * RESPECT HOLDS: no god is dragged by his face — the pop-ups
 * are fixed by this layout, and a god is reached by the call,
 * not by grabbing.
 *
 * HISTORY (superseded, kept for the record): the law of
 * 2026-11-24 ~16:57 EST rested Anubis at the center with the
 * other gods as small resting circles at the lower-right and
 * Osiris standing bare at the top-left, a click bringing a god
 * big to the front. The Captain's 2026-11-26 order above
 * replaces the resting half of that law whole.
 *
 * Plain data + rules, no rendering — unit-testable per the
 * repo's avatar rules. AvatarStage.tsx holds the state;
 * CalledGodPopUp.tsx renders Montu's pop-up circle and
 * OsirisMedallion.tsx renders Osiris's pop-up.
 */
import type { GodPerspective } from "./stagePerspective";

/**
 * Every god who can hold the Captain's call: Anubis first —
 * the center's holder and the call's default — then Montu.
 * (Osiris holds no call state here: his pop-up follows the
 * addressee state directly — addressee.ts — the way he has
 * always been addressed in place.)
 */
export const MEDALLION_GODS: readonly GodPerspective[] = ["anubis", "montu"];

/** The god holding the Captain's call. At rest this is Anubis
 *  (nobody called — he alone is on the stage); it is null only
 *  while the Owner seat stands (the Black Hatter brought back
 *  from put-away). */
export type FrontGod = GodPerspective | null;

/** The stage's resting state at load: ANUBIS ALONE AT THE
 *  CENTER — his regular front seat, and no other god rendered
 *  (owner order 2026-11-26, superseding the resting circles of
 *  2026-11-24). */
export const RESTING_FRONT: FrontGod = "anubis";

/** The default the call returns to when a called god is sent
 *  back: Anubis — which is to say, nobody called, Anubis alone
 *  on the stage again. */
export const DEFAULT_FRONT: GodPerspective = "anubis";

/** The god whose small pop-up stands while he holds the call —
 *  the called god, when the called god is not Anubis. At rest
 *  (and while the Owner seat stands) NO pop-up stands: the
 *  stage is Anubis alone. Anubis never pops up — the center is
 *  his place, not a pop-up. */
export function calledPopUpGod(front: FrontGod): GodPerspective | null {
  return front !== null && front !== DEFAULT_FRONT ? front : null;
}

/** A summon: the called god takes the call. Anubis does not
 *  move — the called god's pop-up rises beside him, and
 *  whoever held the call before steps down. */
export function frontAfterSummon(_current: FrontGod, god: GodPerspective): FrontGod {
  return god;
}

/** A dismissal — the dismissal words with their bow, or the
 *  Captain's return to Anubis: the called god's pop-up goes
 *  away and the call returns to ANUBIS, the default — the
 *  stage Anubis-only again. Dismissing Anubis himself changes
 *  nothing: he is home at the center and is never dismissed
 *  from it. Dismissing a god who does not hold the call
 *  changes nothing. */
export function frontAfterDismiss(current: FrontGod, god: GodPerspective): FrontGod {
  if (god === DEFAULT_FRONT) return current;
  return current === god ? DEFAULT_FRONT : current;
}

/**
 * THE ALLEGIANCE GREETING — spoken and shown when a god is
 * called: he states his name, shows allegiance to the Captain
 * as king of this house, and asks what he needs. Then his chat
 * is open for orders.
 */
export const GOD_GREETINGS: Readonly<Record<GodPerspective, string>> = {
  anubis: "Anubis, at your command, Captain. What do you need?",
  montu: "Montu, on watch and at your command, Captain. What do you need?",
};

/** The face size written for a summoned god's medallion seat:
 *  big — the call scale of the stage — fitted by the caller's
 *  clamp to the stage he stands on. Anubis's front seat is his
 *  locked factory home (medallionAnchor.ts) and never passes
 *  through here. (Since the one-god order of 2026-11-26 the
 *  called god renders as a small pop-up, not at this seat; the
 *  seat record stands in his medallion system, untouched —
 *  hidden, not deleted, like the god himself.) */
export const FRONT_FACE_SIZE = 400;
