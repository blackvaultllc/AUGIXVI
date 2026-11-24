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

describe("the construct on the stage — the layering law (2026-11-24)", () => {
  const base = {
    constructOnStage: false,
    constructOpen: false,
    constructDocked: false,
  };

  it("uncalled, he renders NOWHERE on the main stage — behind Anubis is wallpaper only", () => {
    expect(constructStandsOnStage(base)).toBe(false);
  });

  it("brought on (called onto the stage), he stands", () => {
    expect(constructStandsOnStage({ ...base, constructOnStage: true })).toBe(true);
  });

  it("in his own box — open and docked — he stands in his container, not on the stage", () => {
    expect(constructStandsOnStage({ ...base, constructOpen: true, constructDocked: true })).toBe(
      true,
    );
    expect(constructStandsOnStage({ ...base, constructOpen: true, constructDocked: false })).toBe(
      false,
    );
  });

  it("the old raisers are gone: no worldScreen and no builderOpen input can raise him", () => {
    // The 2026-11-22 clauses (space view visible-by-default, edit
    // mode summons him) are superseded — the function's own shape
    // is the pin: extra inputs change nothing.
    const withExtras = {
      ...base,
      worldScreen: "space",
      builderOpen: true,
    } as Parameters<typeof constructStandsOnStage>[0] & Record<string, unknown>;
    expect(constructStandsOnStage(withExtras)).toBe(false);
  });
});
