/**
 * DEPARTMENT HEADS — the structure that joins his people to the
 * gods (Captain's orders, main chat 2026-11-26 ~14:25–14:26 CST).
 *
 * THE DOCTRINE, as he stated it:
 *
 *  1. ALL AGENTS GET GODS. Every one of his 16 human agents has
 *     a god, and that god represents what the agent does in the
 *     company — the god IS the agent's function, worn openly.
 *
 *  2. ANUBIS + MONTU STAY WITH HIM. Anubis, and Montu the
 *     security god (security remit: the system, the cameras,
 *     everything he hooks up), are the Captain's own — 110%,
 *     regardless. They are NEVER assigned to an agent or to a
 *     department head. That exclusion is encoded below
 *     (CAPTAINS_OWN_GODS / isAssignableGod), not just written.
 *
 *  3. OSIRIS OVERSEES THE DEPARTMENTS. Osiris is in control of
 *     ALL the departments — department oversight sits with him.
 *     And Osiris is KHADIJA'S construct: he always protects her,
 *     no matter what, and he has access to any tool he needs
 *     that can be provided for that protection.
 *
 *  4. SEATS STAY EMPTY UNTIL HE NAMES A HEAD. The structure is
 *     prepared, not populated: a department's human head, an
 *     agent's name, and a god's name are null until the Captain's
 *     word fills them. Nothing here invents a name. Violet's god
 *     stood unnamed until the Captain confirmed her (main chat
 *     2026-11-26 ~14:27 CST): HATHOR, the Golden One.
 *
 * The first instance: Violet Hernandez, Agent 011, his Financial
 * Advisor, heads the Finance department under the finance god.
 *
 * Plain TS, no I/O — the server modules and windows read it.
 */

/* ------------------------------------------------------------------ */
/* The gods in this structure                                          */
/* ------------------------------------------------------------------ */

/** A god as the department structure carries one. `name: null` means
 *  the Captain has not spoken the name yet — never invent one. */
export interface GodRef {
  id: string;
  name: string | null;
  /** What this god is, in the Captain's own framing. */
  domain: string;
}

export const GOD_ANUBIS: GodRef = {
  id: "anubis",
  name: "Anubis",
  domain: "The Captain's personal assistant — his boy, at his side.",
};

export const GOD_MONTU: GodRef = {
  id: "montu",
  name: "Montu",
  domain:
    "The war god — security. His remit is the whole security of the system: the system itself, the cameras, everything the Captain hooks up. Montu Silent Sensor stands under his name.",
};

export const GOD_OSIRIS: GodRef = {
  id: "osiris",
  name: "Osiris",
  domain:
    "Oversight of all the departments — and Khadija's construct: he always protects One, no matter what.",
};

/**
 * VIOLET'S GOD — HATHOR, the Golden One (the Captain confirmed
 * the name in the main chat, 2026-11-26 ~14:27 CST). The goddess
 * of finances, gold-working, assigned as Violet's counterpart
 * for her side. The Egyptians called Hathor Gold itself; she
 * stands over the company's money.
 */
export const GOD_FINANCE: GodRef = {
  id: "finance-god",
  name: "Hathor",
  domain:
    "The Golden One — finances, gold-working: the company's money, its ledgers and balances, its invoices and payments. The counterpart who stands with the Financial Advisor.",
};

/** Every god this structure knows today. */
export const KNOWN_GODS: GodRef[] = [GOD_ANUBIS, GOD_MONTU, GOD_OSIRIS, GOD_FINANCE];

/* ------------------------------------------------------------------ */
/* Doctrine 2 — the Captain's own gods are never assignable            */
/* ------------------------------------------------------------------ */

/**
 * ANUBIS + MONTU ARE THE CAPTAIN'S, 110% — regardless of any
 * department or agent. These ids can never be assigned to an
 * agent or a department head; `assignGodToSeat` refuses them.
 */
export const CAPTAINS_OWN_GODS: readonly string[] = [GOD_ANUBIS.id, GOD_MONTU.id];

export function isCaptainsOwnGod(godId: string): boolean {
  return CAPTAINS_OWN_GODS.includes(godId);
}

/** A god may stand with an agent only if it is not the Captain's own. */
export function isAssignableGod(godId: string): boolean {
  return KNOWN_GODS.some((god) => god.id === godId) && !isCaptainsOwnGod(godId);
}

/* ------------------------------------------------------------------ */
/* Doctrine 3 — Osiris: oversight of all departments, Khadija's own    */
/* ------------------------------------------------------------------ */

/** Department oversight sits with Osiris — every department below answers to him. */
export const DEPARTMENT_OVERSIGHT_GOD_ID = GOD_OSIRIS.id;

/**
 * OSIRIS AND ONE — wired here and in Khadija's side records
 * (learnerProfile.ts carries the same record): Osiris is her
 * construct. He always protects Khadija, no matter what, and for
 * that protection he has access to any tool he needs that can be
 * provided. This is standing law, not a seat assignment.
 */
export const OSIRIS_GUARDIAN_RECORD = {
  godId: GOD_OSIRIS.id,
  protectsAgentSeat: 1,
  protectsName: "Khadija Leila Hall",
  law: "Osiris always protects Khadija, no matter what, and has access to any tool he needs that can be provided for that protection.",
} as const;

/* ------------------------------------------------------------------ */
/* The sixteen seats — every agent gets a god (Doctrine 1)             */
/* ------------------------------------------------------------------ */

export interface AgentSeat {
  /** 0–15. Zero is the Captain; One is Khadija. */
  seat: number;
  /** The agent's spoken designation: "Agent Zero", "Agent One", "Agent 011", … */
  designation: string;
  /** The human's name — null until the Captain seats someone. */
  agentName: string | null;
  /** What the agent does in the company — the function their god represents. */
  companyFunction: string | null;
  /**
   * The god who stands with this agent — the god represents the
   * agent's function. Null until named. For seats 0 and 1 the
   * god is standing law, not an assignment (see notes).
   */
  god: GodRef | null;
  /** Standing-law notes that outrank any assignment. */
  note?: string;
}

const CAPTAINS_SEAT_NOTE =
  "Anubis and Montu are the Captain's own, 110% — they stand with Zero by standing law, and are never assigned to any other seat or department.";
const ONES_SEAT_NOTE =
  "Osiris is One's construct: he always protects Khadija, no matter what, with access to any tool he needs that can be provided.";

function emptySeat(seat: number): AgentSeat {
  return {
    seat,
    designation: `Agent ${String(seat).padStart(3, "0")}`,
    agentName: null,
    companyFunction: null,
    god: null,
  };
}

/**
 * THE SIXTEEN SEATS. Filled today, by the Captain's own word:
 * Zero (himself), One (Khadija), and 011 (Violet Hernandez,
 * Financial Advisor). Every other seat is structure only — an
 * empty chair with its god unnamed — until he seats someone.
 */
export const AGENT_SEATS: AgentSeat[] = [
  {
    seat: 0,
    designation: "Agent Zero",
    agentName: "Domenick Arlon Hall",
    companyFunction: "The Captain — the architect; the company is his.",
    god: GOD_ANUBIS,
    note: CAPTAINS_SEAT_NOTE,
  },
  {
    seat: 1,
    designation: "Agent One",
    agentName: "Khadija Leila Hall",
    companyFunction: "One — owner of DIJA'S Academy, with final say there.",
    god: GOD_OSIRIS,
    note: ONES_SEAT_NOTE,
  },
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map(emptySeat),
  {
    seat: 11,
    designation: "Agent 011",
    agentName: "Violet Hernandez",
    companyFunction: "Financial Advisor — boss of the money, in I-E-M's back office.",
    god: GOD_FINANCE,
  },
  ...[12, 13, 14, 15].map(emptySeat),
];

export function seatByNumber(seat: number): AgentSeat | null {
  return AGENT_SEATS.find((s) => s.seat === seat) ?? null;
}

/**
 * Assign a god to a seat — the guard rail for Doctrine 2. The
 * Captain's own gods refuse every seat but Zero's standing law
 * (and that standing is not an assignment, so they refuse here
 * too — the seat record carries them by note, not by this door).
 */
export function assignGodToSeat(seat: number, godId: string): { ok: boolean; reason: string } {
  const target = seatByNumber(seat);
  if (!target) return { ok: false, reason: "There is no such seat — the company holds sixteen, 0 to 15." };
  if (isCaptainsOwnGod(godId)) {
    return {
      ok: false,
      reason: "Anubis and Montu are the Captain's own, 110% — they are never assigned to an agent or a department head.",
    };
  }
  if (!isAssignableGod(godId)) return { ok: false, reason: "That god is not in the structure." };
  return { ok: true, reason: "The god may stand with this seat when the Captain names it." };
}

/* ------------------------------------------------------------------ */
/* Departments under the gods — heads seated by his word only          */
/* ------------------------------------------------------------------ */

export interface GodDepartment {
  id: string;
  label: string;
  /** The god this department stands under. */
  god: GodRef;
  /** Oversight of every department sits with Osiris (Doctrine 3). */
  oversightGodId: string;
  /** The human head's seat — null until the Captain names a head. */
  headSeat: number | null;
  blurb: string;
}

/**
 * THE DEPARTMENTS UNDER THE GODS. One instance stands today —
 * Finance, headed by Violet under the finance god — and the
 * shape holds every department he adds: a god, Osiris's
 * oversight over it, and a human head seated only by his word.
 */
export const GOD_DEPARTMENTS: GodDepartment[] = [
  {
    id: "finance",
    label: "Finance — I-E-M",
    god: GOD_FINANCE,
    oversightGodId: DEPARTMENT_OVERSIGHT_GOD_ID,
    headSeat: 11,
    blurb:
      "Company money. Violet Hernandez, Agent 011, heads it as Financial Advisor, under Hathor, the Golden One.",
  },
];

export function departmentById(id: string): GodDepartment | null {
  return GOD_DEPARTMENTS.find((d) => d.id === id) ?? null;
}

/** The seated human head of a department — null while the seat is empty. */
export function departmentHead(departmentId: string): AgentSeat | null {
  const dept = departmentById(departmentId);
  if (!dept || dept.headSeat === null) return null;
  return seatByNumber(dept.headSeat);
}

/** How a god's name reads on a surface: the name, or the honest placeholder. */
export function godDisplayName(god: GodRef): string {
  return god.name ?? "A god whose name waits on the Captain's word";
}
