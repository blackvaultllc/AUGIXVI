/**
 * VIOLET'S SIDE + THE LOGIN DISCLAIMER + DEPARTMENT HEADS
 * (Captain's orders 2026-11-26). The doctrine, pinned:
 *  - the disclaimer text lives in ONE constant and says the
 *    four things he ordered it to say;
 *  - Anubis + Montu are the Captain's own and can never be
 *    assigned; Osiris oversees every department and is
 *    Khadija's construct; Violet's god is HATHOR, the Golden One
 *    (the name the Captain confirmed — no other name may stand);
 *  - the calculator is a banker's (200 + 10% = 220), the
 *    ledger counts only landed money against what is owed;
 *  - her welcome draft is a draft — it names her door, her
 *    starting password slot, the email line, and her god by
 *    the confirmed name, Hathor, the Golden One;
 *  - a filed request mirrors into his inbox as a REQUEST
 *    entry standing on the request record itself;
 *  - Khadija's wall opens for the request doorway (out only)
 *    and for nothing else new.
 */
import { describe, expect, it } from "vitest";
import { LOGIN_DISCLAIMER, LOGIN_DISCLAIMER_TEXT } from "@/avatar/loginDisclaimer";
import {
  AGENT_SEATS,
  CAPTAINS_OWN_GODS,
  GOD_DEPARTMENTS,
  GOD_FINANCE,
  OSIRIS_GUARDIAN_RECORD,
  assignGodToSeat,
  departmentHead,
  isAssignableGod,
  isCaptainsOwnGod,
  seatByNumber,
} from "@/avatar/departmentHeads";
import {
  learnerCanAccess,
  LEARNER_GUARDIAN_GOD,
  LEARNER_GUARDIAN_LAW,
} from "@/avatar/learner/learnerProfile";
import {
  buildVioletWelcomeDraft,
  calculateExpression,
  formatMoney,
  ledgerRows,
  ledgerTotals,
  sanitizeFinanceRecord,
  VIOLET_PROFILE,
  VIOLET_TOOLS,
  type FinanceRecord,
} from "@/avatar/violet/violetSide";
import {
  requestNotification,
  sanitizeSectionRequest,
  sanitizeSectionRequestsFile,
} from "@/avatar/sectionRequests";
import { sanitizeNotification } from "@/avatar/cameras/anubisInbox";

describe("the login disclaimer", () => {
  it("stands in one constant and says the four ordered things", () => {
    expect(LOGIN_DISCLAIMER.title).toMatch(/authorized access only/i);
    const text = LOGIN_DISCLAIMER_TEXT.toLowerCase();
    expect(text).toMatch(/camera and microphone/);
    expect(text).toMatch(/photograph of you will be recorded/);
    expect(text).toMatch(/whether you get in or not/);
    expect(text).toMatch(/logged and preserved/);
    expect(text).toMatch(/leave now/);
  });
});

describe("department heads — the doctrine in code", () => {
  it("Anubis and Montu are the Captain's own and refuse assignment", () => {
    expect([...CAPTAINS_OWN_GODS].sort()).toEqual(["anubis", "montu"]);
    expect(isCaptainsOwnGod("anubis")).toBe(true);
    expect(isCaptainsOwnGod("montu")).toBe(true);
    expect(isAssignableGod("anubis")).toBe(false);
    expect(isAssignableGod("montu")).toBe(false);
    expect(assignGodToSeat(5, "anubis").ok).toBe(false);
    expect(assignGodToSeat(5, "montu").ok).toBe(false);
    expect(assignGodToSeat(5, "finance-god").ok).toBe(true);
    expect(assignGodToSeat(16, "finance-god").ok).toBe(false);
  });

  it("sixteen seats — Zero, One, and 011 filled; the rest wait on his word", () => {
    expect(AGENT_SEATS).toHaveLength(16);
    expect(seatByNumber(0)?.agentName).toBe("Domenick Arlon Hall");
    expect(seatByNumber(0)?.god?.id).toBe("anubis");
    expect(seatByNumber(1)?.agentName).toBe("Khadija Leila Hall");
    expect(seatByNumber(11)?.agentName).toBe("Violet Hernandez");
    for (const seat of [2, 5, 9, 15]) {
      expect(seatByNumber(seat)?.agentName).toBeNull();
      expect(seatByNumber(seat)?.god).toBeNull();
    }
  });

  it("Osiris oversees every department and stands as Khadija's construct", () => {
    for (const dept of GOD_DEPARTMENTS) {
      expect(dept.oversightGodId).toBe("osiris");
    }
    expect(seatByNumber(1)?.god?.id).toBe("osiris");
    expect(OSIRIS_GUARDIAN_RECORD.godId).toBe("osiris");
    expect(OSIRIS_GUARDIAN_RECORD.protectsAgentSeat).toBe(1);
    expect(LEARNER_GUARDIAN_GOD).toBe("osiris");
    expect(LEARNER_GUARDIAN_LAW).toMatch(/always protects her, no matter what/);
  });

  it("Violet heads Finance under Hathor, the Golden One — the name the Captain confirmed", () => {
    const head = departmentHead("finance");
    expect(head?.agentName).toBe("Violet Hernandez");
    expect(head?.designation).toBe("Agent 011");
    expect(GOD_FINANCE.name).toBe("Hathor");
    expect(head?.god?.name).toBe("Hathor");
    expect(GOD_FINANCE.domain).toMatch(/Golden One/);
  });
});

describe("Violet's tools and calculator", () => {
  it("her tool set is hers alone: notepad, calculator, finance, email", () => {
    expect(VIOLET_TOOLS.map((t) => t.id)).toEqual(["notepad", "calculator", "finance", "email"]);
    expect(VIOLET_PROFILE.email).toBe("violetmhernandez@gmail.com");
    expect(VIOLET_PROFILE.designation).toBe("Agent 011");
  });

  it("the calculator keys percent the banker's way", () => {
    expect(calculateExpression("200 + 10%")).toEqual({ ok: true, value: 220 });
    expect(calculateExpression("200 - 10%")).toEqual({ ok: true, value: 180 });
    expect(calculateExpression("50%")).toEqual({ ok: true, value: 0.5 });
    expect(calculateExpression("635 * 7 + 40")).toEqual({ ok: true, value: 4485 });
    expect(calculateExpression("(635 + 40) * 2")).toEqual({ ok: true, value: 1350 });
    expect(calculateExpression("100 / 4")).toEqual({ ok: true, value: 25 });
    expect(calculateExpression("10 / 0").ok).toBe(false);
    expect(calculateExpression("abc").ok).toBe(false);
    expect(calculateExpression("").ok).toBe(false);
  });

  it("money formats the banker's way", () => {
    expect(formatMoney(461500)).toBe("$4,615.00");
    expect(formatMoney(63500)).toBe("$635.00");
    expect(formatMoney(-500)).toBe("−$5.00");
  });
});

describe("the finance ledger", () => {
  const records: FinanceRecord[] = [
    { id: "a", date: "2026-11-05", kind: "invoice", label: "INV-2026-015", amountCents: 63500, status: "open" },
    { id: "b", date: "2026-11-12", kind: "invoice", label: "INV-2026-016", amountCents: 63500, status: "open" },
    { id: "c", date: "2026-11-25", kind: "payment", label: "AppFolio — 016", amountCents: 63500, status: "in-transit" },
    { id: "d", date: "2026-11-20", kind: "payment", label: "AppFolio — earlier", amountCents: 63500, status: "landed" },
  ];

  it("counts only landed money against what is owed; in-transit is shown, not counted", () => {
    const totals = ledgerTotals(records);
    expect(totals.invoicedCents).toBe(127000);
    expect(totals.landedCents).toBe(63500);
    expect(totals.inTransitCents).toBe(63500);
    expect(totals.outstandingCents).toBe(63500);
  });

  it("rows run oldest to newest with a running outstanding", () => {
    const rows = ledgerRows(records);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "d", "c"]);
    expect(rows.map((r) => r.runningOutstandingCents)).toEqual([63500, 127000, 63500, 63500]);
  });

  it("the sanitizer refuses a record that is not in its exact shape", () => {
    expect(sanitizeFinanceRecord({ id: "x" })).toBeNull();
    expect(
      sanitizeFinanceRecord({
        id: "x",
        date: "Nov 5",
        kind: "invoice",
        label: "L",
        amountCents: 1,
        status: "open",
      }),
    ).toBeNull();
    expect(sanitizeFinanceRecord(records[0])).toEqual(records[0]);
  });
});

describe("the welcome draft", () => {
  it("is a draft with her door, her starting password, the email line — and Hathor named as her god", () => {
    const draft = buildVioletWelcomeDraft("IEM-test-word-0000");
    expect(draft).toContain(VIOLET_PROFILE.email);
    expect(draft).toContain("IEM-test-word-0000");
    expect(draft).toContain("/violet");
    expect(draft).toMatch(/change it any time/i);
    expect(draft).toMatch(/send email through your god/i);
    expect(draft).toMatch(/Ask for something to be added/);
    // The Captain confirmed her god's name (2026-11-26 ~14:27 CST):
    // the draft speaks it, with her epithet.
    expect(draft).toMatch(/Hathor, the Golden One/);
    expect(draft).not.toMatch(/will speak his name when the Captain gives it/);
  });
});

describe("section requests — the one button, the one path", () => {
  const filed = {
    id: "req-1-abc",
    at: 1_700_000_000_000,
    from: "violet" as const,
    fromName: "Violet Hernandez",
    text: "A way to see each invoice's due date at a glance.",
  };

  it("sanitizes to its exact shape and refuses strangers", () => {
    expect(sanitizeSectionRequest(filed)).toEqual(filed);
    expect(sanitizeSectionRequest({ ...filed, from: "operator" })).toBeNull();
    expect(sanitizeSectionRequestsFile({ requests: [filed, { nope: true }] }).requests).toEqual([
      filed,
    ]);
  });

  it("mirrors into his inbox as a REQUEST entry standing on the request itself", () => {
    const entry = requestNotification(filed);
    expect(entry.kind).toBe("request");
    expect(entry.sourceEventId).toBe(filed.id);
    expect(entry.title).toMatch(/Violet asks/);
    expect(entry.text).toContain(filed.text);
    // And the inbox sanitizer keeps the new kind (no silent remap to "system").
    expect(sanitizeNotification(entry)?.kind).toBe("request");
  });

  it("Khadija's request reads as hers", () => {
    const entry = requestNotification({ ...filed, from: "khadija", fromName: "Khadija Leila Hall" });
    expect(entry.title).toMatch(/Khadija asks/);
  });
});

describe("Khadija's wall — the request doorway opens out, and nothing else new", () => {
  it("allows the request doorway exactly, and no look-alikes", () => {
    expect(learnerCanAccess("/api/learner/request")).toBe(true);
    expect(learnerCanAccess("/api/learner/requests")).toBe(false);
    expect(learnerCanAccess("/api/learner/request/extra")).toBe(false);
  });

  it("still refuses the operator world", () => {
    expect(learnerCanAccess("/avatar")).toBe(false);
    expect(learnerCanAccess("/api/transcribe")).toBe(false);
    expect(learnerCanAccess("/violet")).toBe(false);
  });
});
