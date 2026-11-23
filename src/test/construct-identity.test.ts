import { describe, expect, it } from "vitest";
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
