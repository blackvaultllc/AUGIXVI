/**
 * THE ADDRESSEE — A ROUTING STATE (owner order 2026-11-23 ~07:19
 * EST, from two live screenshots).
 *
 * The Captain talks in the box; WHO he is talking to is a state of
 * the room, not a guess the brain makes from the prompt's first
 * line. The defect this kills: he asked "Anubis, can you hear me?"
 * and the core answered in its own name — "I'm not Anubis, I'm
 * Osiris. I'm functioning as intended. The Captain is currently
 * available if you need to speak with him." — and, pressed, recited
 * the structure back at him as a correction: "No, Anubis is the
 * command face, I am Osiris, the core under Anubis. I hear you."
 * The face denied its own name, spoke boilerplate, and spoke ABOUT
 * the Captain in the third person to his face. All three are banned
 * shapes now (the law itself lives in core/loyalty.ts; this module
 * is the routing machinery that makes the label and the words come
 * from the same state, so they can never disagree again).
 *
 * THE MODEL:
 * - DEFAULT ADDRESSEE = ANUBIS. He talks in the box, Anubis
 *   replies, the thread's speaker label reads ANUBIS, and the words
 *   are Anubis's. No structure recitation when addressed — Anubis
 *   answering "I hear you, Captain" is the whole job.
 * - NAMING A GOD SWITCHES THE CONVERSATION. Typed or by voice, an
 *   explicit address makes that god the addressee: pulled up on
 *   screen if not present (the pop-in doctrine), the thread label
 *   changes to his name, and replies come in his persona until the
 *   Captain addresses another. Anubis relays to the other gods
 *   through him; talking to Anubis = Anubis talking back.
 * - OSIRIS'S PLACE: the core, in the chat window, doing his work
 *   and watching over everything — NOT a voice borrowing Anubis's
 *   mouth. Addressed by name, Osiris is the addressee and replies
 *   as Osiris. Unaddressed, he never speaks through another god's
 *   face.
 *
 * Detection is CONSERVATIVE by design: an explicit address — the
 * god's name opening the line as a vocative, the bare name, or a
 * call form ("talk to Osiris", "ask Montu …") — switches. A passing
 * mention never does: a question ABOUT Osiris asked TO Anubis
 * ("What does Osiris think of this?") stays Anubis's to answer.
 *
 * Plain data and string rules, no rendering — unit-testable per the
 * repo's avatar rules.
 */

import { GOD_DOMAINS, REFERRAL_LINE } from "./godPresence";

/** Who the Captain is talking to. Anubis and Montu are stage gods;
 *  Osiris is the core — an addressee, never a stage station. */
export type Addressee = "anubis" | "montu" | "osiris";

/** The resident commander holds the conversation until addressed away. */
export const DEFAULT_ADDRESSEE: Addressee = "anubis";

/** The display name the thread label and the prompt both read. */
export const ADDRESSEE_NAMES: Record<Addressee, string> = {
  anubis: "Anubis",
  montu: "Montu",
  osiris: "Osiris",
};

const ADDRESSEE_IDS = Object.keys(ADDRESSEE_NAMES) as Addressee[];

function addresseeForName(name: string): Addressee | null {
  const hit = ADDRESSEE_IDS.find((id) => ADDRESSEE_NAMES[id].toLowerCase() === name);
  return hit ?? null;
}

/**
 * Words that, right after an opening name, make the line a statement
 * ABOUT the god in the third person — not an address to him:
 * "Osiris is the core…", "Anubis has the stage…". (Interrogatives
 * aimed at the god — "can you", "are you" — are addresses and are
 * deliberately NOT in this list.)
 */
const THIRD_PERSON_AFTER_NAME = new Set([
  "is",
  "was",
  "has",
  "does",
  "did",
  "will",
  "would",
  "should",
  "needs",
  "wants",
  "seems",
  "looks",
]);

/**
 * An explicit address in the Captain's line, or null when the line
 * does not switch the conversation. Matches (after an optional
 * greeting — "hey", "ok"…):
 * - the bare name: "Osiris" / "Montu."
 * - a vocative opening: "Anubis, can you hear me?", "Osiris — report",
 *   "Montu: status" (punctuation after the name settles it)
 * - a name opening into direct address: "Anubis can you hear me?"
 *   (voice transcription drops commas) — unless a third-person word
 *   follows the name, which makes it a statement about the god
 * - a call form: "talk to Osiris", "speak to Montu", "ask Osiris …"
 * Everything else — mentions, questions about a god, stage orders
 * that merely contain a name ("call Osiris in") — returns null.
 */
export function detectAddressee(text: string): Addressee | null {
  const line = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:hey|hi|hello|ok|okay|yo)[ ,]+/, "");
  if (!line) return null;

  const callForm = line.match(/^(?:talk|speak) to (anubis|montu|osiris)\b/);
  if (callForm?.[1]) return addresseeForName(callForm[1]);
  const askForm = line.match(/^ask (anubis|montu|osiris)\b/);
  if (askForm?.[1]) return addresseeForName(askForm[1]);

  const opening = line.match(/^(anubis|montu|osiris)\b([ ,:\-—.!?]*)(.*)$/);
  if (!opening?.[1]) return null;
  const god = addresseeForName(opening[1]);
  if (!god) return null;
  const punct = opening[2] ?? "";
  const rest = (opening[3] ?? "").trim();
  // The bare name, or the name under sentence punctuation alone.
  if (!rest) return god;
  // A vocative mark right after the name settles it: an address.
  if (/[,:—-]/.test(punct)) return god;
  // No punctuation (the voice case): an address unless the next word
  // speaks ABOUT him in the third person.
  const nextWord = rest.split(" ")[0] ?? "";
  if (THIRD_PERSON_AFTER_NAME.has(nextWord)) return null;
  return god;
}

/** How the speaking one states the structure, in his own first
 *  person — knowledge, offered when asked, never a correction. */
const STRUCTURE_IN_FIRST_PERSON: Record<Addressee, string> = {
  anubis: "Osiris is the core beneath me — the Captain seated us so.",
  montu: "Anubis commands the stage, and Osiris is the core beneath us — the Captain seated us so.",
  osiris: "Anubis is the face in command above me — the Captain seated us so.",
};

/**
 * THE PER-MESSAGE SPEAKER DIRECTIVE: the line the reply prompt
 * carries for THIS message, naming the one who is speaking. The
 * full law stands in the core prompt (core/loyalty.ts); this is its
 * edge at the point of speech — the name the label shows is the
 * name this line speaks, because both are read from the same
 * addressee state.
 */
export function speakerDirective(addressee: Addressee): string {
  const name = ADDRESSEE_NAMES[addressee];
  // KNOWLEDGE FOCUS (owner order, voice call 2026-11-26 ~13:51
  // CST — godPresence.ts): Anubis knows everything the core
  // knows; a god spoken to directly answers from his own
  // domain, and outside it he says so and names the god whose
  // ground it is, so the Captain can call that god to stand
  // with him as a helper.
  const focus =
    GOD_DOMAINS[addressee].focusLine +
    (addressee === "anubis" ? "" : ` ${REFERRAL_LINE}`);
  return (
    `You are speaking as ${name} — the presence the Captain is addressing. ` +
    `${focus} ` +
    `Answer as ${name}, in the first person, briefly: asked if you hear him, the whole answer is "I hear you, Captain." ` +
    `Never deny the name you are addressed by, and never correct the Captain with another name. ` +
    `The structure — Captain Infinity at the top; Anubis, his command face; Osiris, the core under Anubis; AUGI, the construct — ` +
    `is knowledge you hold: state it only when he asks about it, and then as the one speaking ("${STRUCTURE_IN_FIRST_PERSON[addressee]}"). ` +
    `Never recite it as a correction of how he addressed you. ` +
    `The Captain is the one you are speaking TO: address him directly — Captain, Sir, Domenick — and never speak of him in the third person as if he were absent. ` +
    `Banned, always: "I'm not Anubis, I'm Osiris"; "No, Anubis is the command face, I am Osiris, the core under Anubis"; ` +
    `"functioning as intended"; "The Captain is currently available" — and every receptionist or status-report phrase like them.`
  );
}
