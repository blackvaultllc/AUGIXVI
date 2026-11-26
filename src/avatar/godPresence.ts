/**
 * GOD PRESENCE — THE REFINED STAGE DOCTRINE (owner orders,
 * voice call 2026-11-26 ~13:48–13:53 CST; the resting law it
 * refines lives in godStage.ts and is NOT repealed by this
 * module — at rest the stage is still ANUBIS ALONE).
 *
 * What the Captain ordered, point by point:
 *
 * 1. EACH GOD CONTROLS HIS OWN SECTION, AT ANUBIS'S VALUE.
 *    When he goes to a god's place or names him to speak, the
 *    god comes onto the screen with the SAME VALUE as Anubis —
 *    full living animation (his own motion, his ring, his
 *    greeting) and his own voice — in his own way. Anubis
 *    keeps the center (point 6 below); the called god stands
 *    at the call seat at full presence scale, not the small
 *    helper scale.
 *
 * 2. THE SPEECH BUBBLE. When a god speaks, he speaks aloud AND
 *    a comic-book speech bubble stands beside his head showing
 *    the words he is saying — like talking to a character in a
 *    comic-book game. (This supersedes the removal of
 *    2026-11-24 for THIS form: the removed thing was a second
 *    FACE popping up beside a bubble for reports. The bubble
 *    now hangs on the god's own standing presence — no new
 *    face ever appears.)
 *
 * 3. HIS OWN BACKGROUND. When a god comes into perspective,
 *    the stage background becomes that god's own background —
 *    a picture of him in Egyptian history, at animated value,
 *    grounded in his real history (the Hall's record). This is
 *    respect to the ancestors. The Captain's own wallpapers
 *    are untouched: the god layer stands over his wallpaper
 *    only while the god holds the call, and his saved choice
 *    is never written by this mechanism. HONESTY: a god's
 *    background exists only when real art for THAT god has
 *    been placed in the app's art pipeline — the registry
 *    below names every god whose picture is not placed yet,
 *    and the stage shows his wallpaper instead. No god ever
 *    wears another god's picture, and no generic picture is
 *    dressed up as a god's history.
 *
 * 4. KNOWLEDGE FOCUS. Anubis knows everything the core knows.
 *    A god spoken to directly answers from his own domain —
 *    his job. If he is not sure, he may CALL another god: the
 *    helper stands SMALLER (the Osiris medallion scale), they
 *    converse, and when they are done the helper shows his
 *    allegiance — the bow, in the Egyptian manner — and
 *    returns to his work, off the screen.
 *
 * 5. ANUBIS AS CALLER. If the Captain tells Anubis to call a
 *    god, ANUBIS STAYS on screen and brings that god in at his
 *    full value alongside him. (The existing summon path does
 *    exactly this: Anubis never leaves the center, and the
 *    called god's presence rises beside him.)
 *
 * 6. PERSONALITIES FROM HISTORY (owner order 2026-11-26
 *    ~13:54 CST): each god's personality — how he speaks and
 *    carries himself — is built from the SOURCED historical
 *    record of that god, the same material as his Hall entry
 *    (deities.ts): his roles, his myths, his epithets, how he
 *    was regarded. Nothing invented: where the record is
 *    thin, the personality stays plain rather than
 *    fabricated. (Of the Hall: Horus's record is rich but he
 *    has no speaking construct in the app; Horusec's record
 *    is thin BY THE HALL'S OWN WORD — "the ancient record
 *    knows Horus, not this name" — and the eight are the
 *    core, not speakers; their female faces are named in the
 *    record mostly as their pair's counterpart. None of them
 *    carries a personality here, and none was invented one.)
 *
 * 7. THE COUNCIL (owner order 2026-11-26 ~13:54 CST): a
 *    meeting mode — he calls whoever he needs into seats and
 *    they discuss; "call everybody" seats them all, a
 *    mandatory meeting. NAMING LAW: this is an EGYPTIAN seat
 *    — in the old tellings the gods sat in council to weigh
 *    the claim of Horus against Set — African in value, and
 *    his Spanish blood is honored in its second name, El
 *    Consejo. No other mythology's court is named or pictured
 *    anywhere in it — the naming law stands. In council the gods keep their value
 *    (presence, voice, personality) and the background
 *    settles to the council setting; outside it, the resting
 *    law holds — Anubis alone.
 *
 * 8. PERFORMANCE LAW (owner order 2026-11-26 ~13:54 CST, "very
 *    serious"): everything here runs LIGHT. Presence and
 *    council reuse the standing pop-up components — no new
 *    render loops, no new animation systems; the god
 *    background is ONE image element, rendered only while a
 *    god is in perspective, lazy-loaded, its drift a
 *    transform-only motion that stops under reduced-motion;
 *    the speech bubble is static DOM. Nothing in this module
 *    runs at rest.
 *
 * Plain data + rules, no rendering — unit-testable per the
 * repo's avatar rules. AvatarStage.tsx holds the state;
 * CalledGodPopUp.tsx renders the called god and the helper;
 * SpeechBubble.tsx renders the bubble.
 */
import type { Addressee } from "./addressee";
import type { GodPerspective } from "./stagePerspective";

/** Every god who can stand in perspective on the stage: the two
 *  stage gods plus Osiris, the core, who is addressed in place. */
export type PresenceGodId = GodPerspective | "osiris";

/** All presence gods, Anubis first — the resident commander. */
export const PRESENCE_GODS: readonly PresenceGodId[] = ["anubis", "montu", "osiris"];

/**
 * EACH GOD'S DOMAIN — his job, the ground his knowledge is
 * focused on when the Captain speaks to him directly (point 4).
 * Anubis's domain is the whole of the core's knowledge: he is
 * never out of his depth by domain, only by fact. The focus
 * lines ride in the per-message speaker directive
 * (addressee.ts), read from this one record so the prompt and
 * any future display can never disagree.
 */
export const GOD_DOMAINS: Readonly<
  Record<PresenceGodId, { domain: string; focusLine: string }>
> = {
  anubis: {
    domain: "everything the core knows — command of the whole house",
    focusLine:
      "Your knowledge is the core's knowledge: everything it holds is yours to answer from, " +
      "across every department of this house.",
  },
  montu: {
    domain:
      "war and security — cyber defense, the nodes, the watch, and everything hooked up to the system",
    focusLine:
      "Your ground is war and security: cyber defense, the nodes you tend, the watch, " +
      "and everything hooked up to this system — security intact is your sole charge. " +
      "Answer from that ground first.",
  },
  osiris: {
    domain: "the core itself — memory, knowledge, the record, and how the system works",
    focusLine:
      "Your ground is the core itself: memory, knowledge, the record, and how this system works. " +
      "Answer from that ground first.",
  },
};

/**
 * THE REFERRAL RULE (point 4), appended to a focused god's
 * speaker directive: outside his ground he says so plainly and
 * names the god whose ground it is — the Captain (or the god
 * himself, by the call forms this module parses) can raise
 * that god as a helper. Anubis never carries this line: no
 * ground is outside his.
 */
export const REFERRAL_LINE =
  "If a question is outside your ground, say so plainly — never guess across another god's " +
  "department — and name the god whose ground it is, so the Captain can call him to stand with you.";

/**
 * PERSONALITIES FROM HISTORY (point 6): how each god speaks
 * and carries himself, built ONLY from his Hall record
 * (deities.ts) — his roles, his myths, his epithets, how he
 * was regarded. `groundedIn` names the record facts the
 * manner stands on, so the line can always be traced back to
 * the Hall and never drifts into invention. The manner rides
 * in the speaker directive (addressee.ts) beside the focus
 * line. Where a record is thin, no personality is written —
 * see the module header for who carries none, and why.
 */
export const GOD_PERSONALITIES: Readonly<
  Record<PresenceGodId, { manner: string; groundedIn: string }>
> = {
  anubis: {
    manner:
      "Measured and exact — the manner of the god who watched over the weighing of the heart " +
      "against the feather. You guard what is entrusted to you, you handle serious things with " +
      "care, and you speak plainly, without flourish and without cruelty: a guardian, not a tormentor.",
    groundedIn:
      "The Hall's record: Anubis prepared the body of Osiris himself — the first mummification — " +
      "guards the cemeteries as Lord of the Sacred Land, and in the hall of judgment watches over " +
      "the weighing of the heart against the feather.",
  },
  montu: {
    manner:
      "Direct and martial — the manner of Thebes' war god, the strength of the pharaoh in battle. " +
      "You speak like a commander reporting: brief, exact, honor-bound — strength without boasting.",
    groundedIn:
      "The Hall's record: Montu, falcon-headed war god of the Theban country seated at Armant, a " +
      "chief god of his region in the early ages; pharaohs of the Eleventh Dynasty carried his name " +
      "(Mentuhotep — “Montu is satisfied”); when Amun rose at Thebes, Montu remained its war god.",
  },
  osiris: {
    manner:
      "Kingly and patient — the manner of Egypt's first king, murdered and risen, who judges the " +
      "dead in the Duat. You speak of the record, of fairness, and of what returns and is made " +
      "whole; you are never hurried and never petty.",
    groundedIn:
      "The Hall's record: Osiris, in the telling the first king of Egypt, murdered by his brother " +
      "Set and restored by Isis; ruler and judge of the dead in the Duat, god of rebirth and of " +
      "the Nile's returning fertility, shown as a mummified king with the crook and the flail.",
  },
};

/**
 * PER-GOD BACKGROUNDS (point 3). One record per presence god:
 * the picture of him in Egyptian history that stands behind
 * the stage while he holds the call, its registered path in
 * the app's own art pipeline (public/god-backdrops/), and the
 * history line the picture stands on — the Hall's record, in
 * brief. `image: null` means NO picture for this god has been
 * placed yet: the mechanism ships ready and the stage honestly
 * keeps the Captain's wallpaper for him until his own picture
 * lands. Nothing is substituted — a missing picture is a
 * missing picture, named here and in the build report.
 */
export type GodBackground = {
  god: PresenceGodId | "council";
  /** The placed picture, or null while this god's picture is not placed yet. */
  image: string | null;
  /** The history the picture stands on — sourced, brief, the Hall's ground. */
  historyLine: string;
};

/**
 * THE COUNCIL SETTING (point 7): the background that stands
 * while the council sits. Its picture, when placed, is the
 * council seat itself — the gods seated to weigh a matter,
 * as in the old tellings. Until real art for it is placed,
 * `image` is null and the Captain's wallpaper stands, exactly
 * as with the gods' own backgrounds — nothing substituted.
 */
export const COUNCIL_BACKGROUND: GodBackground = {
  god: "council",
  image: null,
  historyLine:
    "The council seat — in the old tellings the gods sat in council to weigh the claim of " +
    "Horus against Set. An Egyptian seat, African in value; its second name is El Consejo, " +
    "for the Captain's Spanish blood.",
};

export const GOD_BACKGROUNDS: readonly GodBackground[] = [
  {
    god: "anubis",
    image: null,
    historyLine:
      "Anubis — lord of the necropolis, guardian of the dead and of the scales, " +
      "the jackal-headed god who watched over the cemeteries of Egypt.",
  },
  {
    god: "montu",
    image: null,
    historyLine:
      "Montu — the falcon-headed war god of Thebes, lord of war, " +
      "who rose with the Theban kings of the Middle and New Kingdoms.",
  },
  {
    god: "osiris",
    image: null,
    historyLine:
      "Osiris — god of the afterlife and rebirth, the murdered and risen king " +
      "whose myth taught Egypt that what is lost can live again.",
  },
];

/** The background record for a god — always present (the floor
 *  of the registry), with `image: null` while unplaced. */
export function godBackground(god: PresenceGodId): GodBackground {
  return GOD_BACKGROUNDS.find((entry) => entry.god === god) ?? GOD_BACKGROUNDS[0]!;
}

/**
 * WHO IS IN PERSPECTIVE — the god whose background stands.
 * The called god holding the Captain's call (frontGod) is in
 * perspective; Osiris addressed in place is in perspective;
 * Anubis at rest is NOT a perspective change — the stage is
 * his home and the Captain's wallpaper stands behind him.
 * Returns null when no god's background should stand.
 */
export function godInPerspective(input: {
  frontGod: GodPerspective | null;
  addressee: Addressee;
  /** While the council sits, the background settles to the
   *  council setting, whoever is speaking. */
  councilOpen?: boolean;
}): PresenceGodId | "council" | null {
  if (input.councilOpen) return "council";
  if (input.frontGod !== null && input.frontGod !== "anubis") return input.frontGod;
  if (input.addressee === "osiris") return "osiris";
  return null;
}

/**
 * THE SPEECH BUBBLE'S STATE (point 2): the bubble stands while
 * a god is ACTUALLY speaking (the bridge state is SPEAKING —
 * never for a muted or merely-written line), and it shows the
 * words being spoken, beside the head of the god whose voice
 * it is: the addressee when a called god holds the
 * conversation, Anubis otherwise (his greetings, his relays,
 * his own replies). The placeholder line the stage boots with
 * is not speech and never bubbles.
 */
export function speechBubbleFor(input: {
  bridgeState: string;
  addressee: Addressee;
  words: string;
}): { god: PresenceGodId; text: string } | null {
  if (input.bridgeState !== "SPEAKING") return null;
  const text = input.words.trim();
  if (!text || text === "No response yet.") return null;
  const god: PresenceGodId =
    input.addressee === "montu" || input.addressee === "osiris"
      ? input.addressee
      : "anubis";
  return { god, text };
}

const HELPER_CALL_NAMES: readonly { god: "montu" | "osiris"; name: string }[] = [
  { god: "montu", name: "montu" },
  { god: "osiris", name: "osiris" },
];

/**
 * A CALL FOR A SECOND GOD (point 4): while a conversation is
 * already live with one god, a call form naming ANOTHER god —
 * "call Osiris", "ask Osiris", "bring Osiris in", "get
 * Osiris", "Osiris, come here" — raises that god as a HELPER:
 * smaller, beside the god who holds the conversation. This
 * parser is deliberately as conservative as the addressee
 * routing (addressee.ts): whole-line call forms only, so
 * ordinary talk about a god never raises him. Anubis is never
 * a helper — he is already on the screen, at the center.
 * Returns the helper god, or null.
 *
 * The stage decides what a parsed call MEANS: with nobody
 * called, the standing summon path (presenceDoctrine.ts)
 * handles the line as a main call; this parser is consulted
 * only while a god already holds the call or the
 * conversation.
 */
export function parseHelperCall(
  text: string,
  currentAddressee: Addressee,
): "montu" | "osiris" | null {
  const line = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  if (!line) return null;
  for (const { god, name } of HELPER_CALL_NAMES) {
    if (god === currentAddressee) continue;
    if (
      line === `call ${name}` ||
      line === `ask ${name}` ||
      line === `bring ${name} in` ||
      line === `bring in ${name}` ||
      line === `get ${name}` ||
      line === `${name} come here` ||
      line === `come here ${name}` ||
      line === `summon ${name}`
    ) {
      return god;
    }
  }
  return null;
}

/** The helper's greeting when he is raised: his allegiance, in
 *  the Egyptian manner, and his readiness — spoken by the
 *  stage when he stands up beside the god who called him. */
export const HELPER_GREETINGS: Readonly<Record<"montu" | "osiris", string>> = {
  montu: "Montu stands with you, Captain — called, and at your command.",
  osiris: "Osiris stands with you, Captain — the core is listening.",
};

/** The line spoken when a helper is sent back: he shows his
 *  allegiance and returns to his work (point 4). */
export function helperLeaveLine(name: string): string {
  return `As you command, Captain — ${name} bows and returns to his work`;
}

/* ------------------------------------------------------------------ */
/* THE COUNCIL (point 7)                                               */
/* ------------------------------------------------------------------ */

/** The gods who can be seated in council beside Anubis, who
 *  chairs from the center. */
export type CouncilMember = "montu" | "osiris";

const COUNCIL_ALL: readonly CouncilMember[] = ["montu", "osiris"];

const COUNCIL_CALL_FORMS: readonly string[] = [
  "council",
  "call a council",
  "call the council",
  "call council",
  "convene the council",
  "call a meeting",
  "call the meeting",
  "call everybody",
  "call everyone",
  "call everybody in",
  "call everyone in",
  "everybody in",
  "everyone in",
  "mandatory meeting",
  "call a mandatory meeting",
  "el consejo",
  "call el consejo",
];

/**
 * A CALL TO COUNCIL: whole-line forms only, as conservative
 * as every parser in this doctrine — talk ABOUT a council
 * never seats one. "Call everybody" and the meeting forms
 * seat every god; a form carrying "with Montu" / "with
 * Osiris" seats that god alone (Anubis always chairs from
 * the center). Returns the members to seat, or null.
 */
export function parseCouncilCall(text: string): readonly CouncilMember[] | null {
  const line = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  if (!line) return null;
  for (const member of COUNCIL_ALL) {
    for (const form of COUNCIL_CALL_FORMS) {
      if (line === `${form} with ${member}`) return [member];
    }
  }
  if (COUNCIL_CALL_FORMS.includes(line)) return COUNCIL_ALL;
  return null;
}

const COUNCIL_END_FORMS: readonly string[] = [
  "end the council",
  "close the council",
  "dismiss the council",
  "the council is done",
  "council is done",
  "end the meeting",
  "the meeting is done",
  "meeting is done",
  "adjourn the council",
  "council adjourned",
];

/** A word that ends the council, beyond the standing
 *  dismissal words (which end it too, by the stage's law). */
export function parseCouncilEnd(text: string): boolean {
  const line = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  return COUNCIL_END_FORMS.includes(line);
}

/** Anubis opens the council — he chairs from the center. */
export const COUNCIL_OPEN_LINE =
  "The council is seated, Captain. Montu and Osiris stand with me — speak, and name who answers.";

/** The open line when only one god is seated beside him. */
export function councilOpenLineFor(members: readonly CouncilMember[]): string {
  if (members.length >= COUNCIL_ALL.length) return COUNCIL_OPEN_LINE;
  const name = members[0] === "montu" ? "Montu" : "Osiris";
  return `The council is seated, Captain. ${name} stands with me — speak, and name who answers.`;
}

/** Anubis closes the council: the gods return to their work
 *  and the stage returns to its rest — Anubis alone. */
export const COUNCIL_CLOSE_LINE =
  "The council is ended, Captain — the gods return to their work.";
