import { describe, expect, it } from "vitest";
import {
  EMPTY_RESIDENCY,
  constructStandsOnStage,
  dismissalTarget,
  godOnStage,
  isDismissal,
  summonTarget,
  type StageResidency,
} from "@/avatar/presenceDoctrine";

/**
 * PRESENCE DOCTRINE (owner order 2026-11-22): Anubis resident
 * alone at center; the Black Hatter put away until the Owner seat
 * brings him back; every other god on the stage only by report,
 * by summon, or bowing out under dismissal. These tests pin the
 * rules in presenceDoctrine.ts.
 */
describe("who stands on the stage", () => {
  it("by default: Anubis alone — the owner is away, no god is up", () => {
    expect(godOnStage(EMPTY_RESIDENCY, "anubis")).toBe(true);
    expect(godOnStage(EMPTY_RESIDENCY, "montu")).toBe(false);
    expect(EMPTY_RESIDENCY.ownerPresent).toBe(false);
  });

  it("a summoned god stands, and stays, until dismissed", () => {
    const residency: StageResidency = { ...EMPTY_RESIDENCY, summoned: ["montu"] };
    expect(godOnStage(residency, "montu")).toBe(true);
  });

  it("a reporting god stands for his report; a bowing god stands for his bow", () => {
    expect(godOnStage({ ...EMPTY_RESIDENCY, reportGod: "montu" }, "montu")).toBe(true);
    expect(godOnStage({ ...EMPTY_RESIDENCY, bowingGod: "montu" }, "montu")).toBe(true);
    expect(godOnStage({ ...EMPTY_RESIDENCY, reportGod: "montu" }, "anubis")).toBe(true);
  });
});

describe("summon by name", () => {
  it("answers his name, bare or under a call", () => {
    for (const line of [
      "Montu",
      "montu",
      "summon Montu",
      "call montu",
      "bring Montu in",
      "bring in montu",
      "Montu, come here",
      "montu report",
    ]) {
      expect(summonTarget(line)).toBe("montu");
    }
  });

  it("ordinary lines are not summons", () => {
    for (const line of ["bring Augie in", "open the library", "what is montu doing", ""]) {
      expect(summonTarget(line)).toBeNull();
    }
  });
});

describe("dismissal", () => {
  it("recognizes the Captain's words — and only as whole lines", () => {
    for (const line of [
      "good work",
      "Good work.",
      "you can leave",
      "leave",
      "that'll be all",
      "that will be all",
      "dismissed",
      "back to work",
    ]) {
      expect(isDismissal(line)).toBe(true);
    }
    for (const line of ["leave it alone", "good work on the report yesterday", "stay", ""]) {
      expect(isDismissal(line)).toBe(false);
    }
  });

  it("sends off the addressed summoned god first", () => {
    const residency: StageResidency = { ...EMPTY_RESIDENCY, summoned: ["montu"] };
    expect(dismissalTarget(residency, "montu")).toBe("montu");
    // Addressed but not summoned: nobody to send.
    expect(dismissalTarget(EMPTY_RESIDENCY, "montu")).toBeNull();
  });

  it("falls back to the summoned god when the address is elsewhere — never the resident", () => {
    const residency: StageResidency = { ...EMPTY_RESIDENCY, summoned: ["montu"] };
    expect(dismissalTarget(residency, "anubis")).toBe("montu");
    expect(dismissalTarget(residency, null)).toBe("montu");
    // Anubis himself is never a dismissal target.
    expect(dismissalTarget(EMPTY_RESIDENCY, "anubis")).toBeNull();
    // A report pop-in is not dismissed — it leaves on its own.
    expect(dismissalTarget({ ...EMPTY_RESIDENCY, reportGod: "montu" }, null)).toBeNull();
  });
});

describe("the construct in edit mode (item 2)", () => {
  const base = {
    worldScreen: "live",
    constructOnStage: false,
    builderOpen: false,
    constructOpen: false,
    constructDocked: false,
  };

  it("in the live Room, closed and unbrought, he is off stage", () => {
    expect(constructStandsOnStage(base)).toBe(false);
  });

  it("EDIT MODE: with the builder open he stands in the environment — not exiled to his sandbox", () => {
    expect(constructStandsOnStage({ ...base, builderOpen: true })).toBe(true);
  });

  it("brought on, or docked in his open box, he stands", () => {
    expect(constructStandsOnStage({ ...base, constructOnStage: true })).toBe(true);
    expect(constructStandsOnStage({ ...base, constructOpen: true, constructDocked: true })).toBe(
      true,
    );
    expect(constructStandsOnStage({ ...base, constructOpen: true, constructDocked: false })).toBe(
      false,
    );
  });

  it("off the live Room he stands as he always has", () => {
    expect(constructStandsOnStage({ ...base, worldScreen: "space" })).toBe(true);
  });
});
