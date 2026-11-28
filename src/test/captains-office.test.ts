import { describe, expect, it } from "vitest";
import {
  isCaptainsOfficeExit,
  isCaptainsOfficeRequest,
  officeKnockNotification,
  officeKnocks,
} from "@/avatar/captainsOffice";
import type { AlertRingReading } from "@/avatar/alertRing";

/**
 * CAPTAIN ZERO'S OFFICE — the law (owner order 2026-11-27
 * ~22:28 CST): he is left alone in his office; only an
 * emergency knocks, and a knock only asks. The pins that
 * matter: a knock is derived ONLY from the alert ring's real
 * standing records (Sector Watch security events, Sound
 * Watch alert sounds — nothing invented), it is signed by
 * the god who would sign that report (security signs
 * Montu), Khadija's ringing call is NOT a god knock, and a
 * knock's signature tracks the standing counts so a
 * dismissal holds for the same alert and a grown count
 * knocks again. The command words stay apart from the
 * world office's walk-in, which keeps its phrases.
 */
function reading(partial: Partial<AlertRingReading>): AlertRingReading {
  return {
    active: false,
    soundAlertsWaiting: 0,
    daddyRinging: false,
    sectorAlertsWaiting: 0,
    sourcesLine: "No alert stands.",
    ...partial,
  };
}

describe("the knock — derived from real standing records only", () => {
  it("no standing alert, no knock", () => {
    expect(officeKnocks(reading({}))).toEqual([]);
  });

  it("a Sector Watch security event knocks as Montu, security's signer", () => {
    const knocks = officeKnocks(reading({ active: true, sectorAlertsWaiting: 1 }));
    expect(knocks).toHaveLength(1);
    expect(knocks[0]?.god).toBe("montu");
    expect(knocks[0]?.godName).toBe("Montu");
    expect(knocks[0]?.reason).toContain("Sector Watch");
    expect(knocks[0]?.reason).toContain("one security event");
  });

  it("a Sound Watch alert sound knocks as Montu (its report signs 'sound-watch security')", () => {
    const knocks = officeKnocks(reading({ active: true, soundAlertsWaiting: 2 }));
    expect(knocks).toHaveLength(1);
    expect(knocks[0]?.god).toBe("montu");
    expect(knocks[0]?.reason).toContain("Sound Watch");
    expect(knocks[0]?.reason).toContain("2 alert sounds");
  });

  it("both sources standing arrive as ONE knock with both reasons", () => {
    const knocks = officeKnocks(
      reading({ active: true, sectorAlertsWaiting: 1, soundAlertsWaiting: 1 }),
    );
    expect(knocks).toHaveLength(1);
    expect(knocks[0]?.reason).toContain("Sector Watch");
    expect(knocks[0]?.reason).toContain("Sound Watch");
  });

  it("Khadija's ringing call is not a god knock", () => {
    expect(officeKnocks(reading({ active: true, daddyRinging: true }))).toEqual([]);
  });

  it("the signature tracks the standing counts — a grown count knocks again", () => {
    const one = officeKnocks(reading({ sectorAlertsWaiting: 1 }))[0]?.signature;
    const same = officeKnocks(reading({ sectorAlertsWaiting: 1 }))[0]?.signature;
    const grown = officeKnocks(reading({ sectorAlertsWaiting: 2 }))[0]?.signature;
    expect(one).toBe(same);
    expect(grown).not.toBe(one);
  });
});

describe("the knock arrives as a notification (owner refinement 2026-11-27)", () => {
  it("the line names the god, the ask, and the real reason", () => {
    const knock = officeKnocks(reading({ active: true, sectorAlertsWaiting: 1 }))[0];
    expect(knock).toBeDefined();
    const line = officeKnockNotification(knock!);
    expect(line).toBe(
      "Montu would like to speak with you — emergency: Sector Watch: one security event is waiting, not yet acknowledged.",
    );
  });

  it("a Sound Watch knock carries its own reason, same form", () => {
    const knock = officeKnocks(reading({ active: true, soundAlertsWaiting: 2 }))[0];
    expect(officeKnockNotification(knock!)).toContain("Montu would like to speak with you");
    expect(officeKnockNotification(knock!)).toContain("Sound Watch");
  });
});

describe("his words for his office — apart from the world walk-in", () => {
  it("answers to the possessive forms", () => {
    expect(isCaptainsOfficeRequest("my office")).toBe(true);
    expect(isCaptainsOfficeRequest("take me to my office")).toBe(true);
    expect(isCaptainsOfficeRequest("Captain Zero's office")).toBe(true);
    expect(isCaptainsOfficeRequest("zero's office")).toBe(true);
    expect(isCaptainsOfficeRequest("open my office")).toBe(true);
  });

  it("never claims the world office's phrases", () => {
    expect(isCaptainsOfficeRequest("go to the office")).toBe(false);
    expect(isCaptainsOfficeRequest("take me to the office")).toBe(false);
    expect(isCaptainsOfficeRequest("office")).toBe(false);
    expect(isCaptainsOfficeRequest("enter the office")).toBe(false);
  });

  it("leaving by word", () => {
    expect(isCaptainsOfficeExit("leave the office")).toBe(true);
    expect(isCaptainsOfficeExit("exit office")).toBe(true);
    expect(isCaptainsOfficeExit("leave my office")).toBe(true);
    expect(isCaptainsOfficeExit("/office")).toBe(false);
    expect(isCaptainsOfficeExit("go to the office")).toBe(false);
  });
});
