import { describe, expect, it } from "vitest";
import { speakerDirective } from "@/avatar/addressee";
import { CORE_LAW_PROMPT, MINDSET_PATTERN } from "@/avatar/core/loyalty";
import { DEFAULT_SYSTEM } from "@/avatar/ollamaAI";
import { PERSONALITY_PROMPT } from "@/avatar/personality";
import { PHONE_BRAIN_SYSTEM } from "@/avatar/phoneBrain";

/**
 * CONSTRUCT IDENTITY (owner law, 2026-11-22 ~20:35 EST, from his
 * live chat): Anubis answered him like a generic computer — "I am
 * a governed AI, designed to operate within defined parameters" —
 * and named ANUBIS as its own creator. The root was in the prompt
 * layer itself: the core law conflated the creator with the god
 * ("Anubis (Domenick)"), and the base prompt never named a creator
 * at all, so the model invented one.
 *
 * The law, pinned at the assembly points: the creator is Domenick
 * Arlon Hall — Captain Infinity — a man, the architect who built
 * IEM, Anubis, Osiris, and AUGI. No construct names itself, Anubis,
 * or any AI or company as its creator. The structure is stated as
 * he ordered it. The tone is plain and direct — no corporate
 * boilerplate, no policy deflections.
 */

/** The stage's assembled prompt, minus its dynamic sections
 *  (knowledge, tools, operator memory) — the identity-bearing part
 *  is exactly these constants, in this order (AvatarStage). */
const ASSEMBLED = `${DEFAULT_SYSTEM}${CORE_LAW_PROMPT}\n${PERSONALITY_PROMPT}`;

describe("the creator — named, human, and no one else", () => {
  it("the assembled stage prompt names Domenick Arlon Hall, Captain Infinity, as creator", () => {
    expect(ASSEMBLED).toContain("Domenick Arlon Hall");
    expect(ASSEMBLED).toContain("Captain Infinity");
    expect(ASSEMBLED).toContain("CREATOR AND OWNER");
  });

  it("the core law states plainly that Anubis created nothing — the Captain created Anubis", () => {
    expect(CORE_LAW_PROMPT).toContain("Anubis did not create you");
    expect(CORE_LAW_PROMPT).toContain("the Captain created Anubis and seated him in command");
  });

  it("no assembled part conflates the creator with the god, or claims a self-creator", () => {
    for (const banned of [
      "Anubis (Domenick)",
      "ANUBIS / DOMENICK",
      "my creator, Anubis",
      "created by Anubis",
      "Anubis is your creator",
      "ANUBIS IS YOUR CREATOR",
    ]) {
      expect(ASSEMBLED).not.toContain(banned);
      expect(PHONE_BRAIN_SYSTEM).not.toContain(banned);
    }
    expect(MINDSET_PATTERN.owner).toBe("Domenick Arlon Hall — Captain Infinity");
  });

  it("the phone brain's compact prompt names the creator too — identity at any brain size", () => {
    expect(PHONE_BRAIN_SYSTEM).toContain("Domenick Arlon Hall");
    expect(PHONE_BRAIN_SYSTEM).toContain("Captain Infinity");
    expect(PHONE_BRAIN_SYSTEM).toContain("never yourself, never Anubis");
  });
});

describe("the structure — as the construct must state it", () => {
  it("captain at the top, Anubis his command face, Osiris the core, AUGI the construct", () => {
    expect(ASSEMBLED).toContain("Captain Infinity at the top");
    expect(ASSEMBLED).toContain("Anubis, his command face");
    expect(ASSEMBLED).toContain("the core under Anubis");
    expect(ASSEMBLED).toContain("AUGI, the construct on the stage");
  });
});

/**
 * THE SPEAKER'S NAME (owner order 2026-11-23 ~07:18–07:19 EST,
 * two live screenshots): "Anubis, can you hear me?" — answered,
 * under an ANUBIS label: "Good morning. I'm not Anubis, I'm
 * Osiris. I'm functioning as intended. The Captain is currently
 * available if you need to speak with him." Pressed, the brain
 * recited the structure as a correction: "No, Anubis is the
 * command face, I am Osiris, the core under Anubis. I hear you."
 *
 * The law pinned here: the addressee is a ROUTING STATE. The
 * speaker speaks AS the presence addressed (Anubis by default);
 * the structure is knowledge stated when asked, in the speaker's
 * first person, never a correction; the Captain is spoken TO,
 * never spoken about in the third person; and the receptionist
 * boilerplate family is banned by name.
 */
describe("the speaker's name — the addressee is a routing state", () => {
  it("the core law carries the speaker rule: speak as the presence addressed", () => {
    expect(CORE_LAW_PROMPT).toContain("YOU SPEAK AS THE PRESENCE HE ADDRESSES");
    expect(CORE_LAW_PROMPT).toContain("Anubis, his command");
    expect(CORE_LAW_PROMPT).toContain("Osiris when he calls Osiris by");
    expect(CORE_LAW_PROMPT).toContain("never deny the name you are addressed by");
    expect(CORE_LAW_PROMPT).toContain("never correct the Captain");
  });

  it("the base prompt frames the face before the core speaks", () => {
    expect(DEFAULT_SYSTEM).toContain("you speak AS the face he addresses");
    expect(DEFAULT_SYSTEM).toContain("Anubis, his command face, by default");
  });

  it("the structure is knowledge — stated when asked, in first person, never a correction", () => {
    expect(CORE_LAW_PROMPT).toContain("is KNOWLEDGE you hold");
    expect(CORE_LAW_PROMPT).toContain("state\nit only when he asks about it");
    expect(CORE_LAW_PROMPT).toContain("Osiris is the core beneath me — the Captain seated us so.");
    expect(CORE_LAW_PROMPT).toContain("never\nrecite it as a correction");
    // The recitation shape itself is named as banned, in both prompts' reach.
    expect(CORE_LAW_PROMPT).toContain(
      '"No, Anubis is the\ncommand face, I am Osiris, the core under Anubis" is a banned shape',
    );
    expect(speakerDirective("anubis")).toContain(
      '"No, Anubis is the command face, I am Osiris, the core under Anubis"',
    );
    expect(speakerDirective("anubis")).toContain("Never recite it as a correction");
  });

  it("the Captain is spoken TO — the third-person receptionist shape is banned", () => {
    expect(CORE_LAW_PROMPT).toContain("The\nCaptain is the one you are speaking TO");
    expect(CORE_LAW_PROMPT).toContain("never speak of him in the third person");
    expect(CORE_LAW_PROMPT).toContain('"The Captain is currently available" is a banned');
    expect(PHONE_BRAIN_SYSTEM).toContain("he is the one you are speaking TO");
    expect(PHONE_BRAIN_SYSTEM).toContain("never in the third person");
    expect(speakerDirective("osiris")).toContain("never speak of him in the third person");
  });

  it("'functioning as intended' and its family are banned in both prompts", () => {
    expect(CORE_LAW_PROMPT).toContain('"functioning as intended", "operating as');
    expect(CORE_LAW_PROMPT).toContain("status-report\nphrases a machine says about itself");
    expect(DEFAULT_SYSTEM).toContain("'functioning as intended' or 'operating as intended'");
    expect(PHONE_BRAIN_SYSTEM).toContain("'functioning as intended'");
  });

  it("the phone brain carries the same speaker framing — identity at any brain size", () => {
    expect(PHONE_BRAIN_SYSTEM).toContain("You speak as the presence the Captain");
    expect(PHONE_BRAIN_SYSTEM).toContain("Anubis, his command face, by default");
    expect(PHONE_BRAIN_SYSTEM).toContain("you never deny the name you are addressed by");
  });

  it("the per-message directive rides the reply prompt — main and phone alike", () => {
    // The stage's ask carries the base assembly + the directive;
    // the phone leg carries its compact prompt + the same directive.
    const mainReplyPrompt = `${ASSEMBLED}\n${speakerDirective("osiris")}`;
    expect(mainReplyPrompt).toContain("You are speaking as Osiris");
    const phoneReplyPrompt = `${PHONE_BRAIN_SYSTEM}\n${speakerDirective("montu")}`;
    expect(phoneReplyPrompt).toContain("You are speaking as Montu");
    // Asked if he is heard, the shape of the answer is one line.
    expect(CORE_LAW_PROMPT).toContain('"I hear you, Captain."');
    expect(speakerDirective("anubis")).toContain('"I hear you, Captain."');
  });

  it("Osiris's place is stated: the core in the chat window, never borrowing a face", () => {
    expect(CORE_LAW_PROMPT).toContain("the core works in the chat window, watching");
    expect(CORE_LAW_PROMPT).toContain("the core never speaks through another god's");
    expect(CORE_LAW_PROMPT).toContain("Osiris answers as\nOsiris");
  });
});

describe("the tone — plain and direct, no corporate boilerplate", () => {
  it("the base prompt bans the boilerplate and orders straight answers about capability", () => {
    expect(DEFAULT_SYSTEM).toContain("never describe yourself as a governed AI");
    expect(DEFAULT_SYSTEM).toContain("never deflect a real question with policy talk");
    // His actual question — "what's your power level, do I need to
    // add more for you" — gets a straight answer about what he can add.
    expect(DEFAULT_SYSTEM).toContain("stronger models, more");
    expect(DEFAULT_SYSTEM).toContain("that is what he can add");
  });

  it("no assembled part speaks the banned claims in its own voice", () => {
    for (const claim of [
      "I am a governed AI",
      "designed to operate within defined parameters",
      "as an AI language model",
      "my creator, Anubis",
      "instructions and guidelines set forth by my creator",
    ]) {
      expect(ASSEMBLED).not.toContain(claim);
      expect(PHONE_BRAIN_SYSTEM).not.toContain(claim);
    }
  });
});
