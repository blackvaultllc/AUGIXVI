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
  god: PresenceGodId;
  /** The placed picture, or null while this god's picture is not placed yet. */
  image: string | null;
  /** The history the picture stands on — sourced, brief, the Hall's ground. */
  historyLine: string;
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
}): PresenceGodId | null {
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

const HELPER_CALL_NAMES: readonly { god: PresenceGodId; name: string }[] = [
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
): PresenceGodId | null {
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
