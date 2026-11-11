/**
 * OSIRIS'S WORKFORCE (owner order — Command becomes AUGIXVI, here).
 * The crew, the departments, the sub AIs — they work HERE now, in Osiris's
 * world, and he can call on them by name. Pure data + selection, no DOM.
 *
 * LAW: workers suggest, never act on the outside world. The operator has the
 * final say on everything. Nothing here opens panels, pushes or deploys.
 */

export type Department = {
  id: string;
  name: string;
  /** What this department does for the world, in plain words. */
  duty: string;
  /** Headcount of sub AIs in this department. */
  count: number;
  /** Seat location in the office building. */
  floor: number;
};

export type SubAI = {
  id: string;
  name: string;
  departmentId: string;
  /** One-line specialty, shown when Osiris calls them. */
  specialty: string;
  status: "learning" | "working" | "standby";
};

export const DEPARTMENTS: readonly Department[] = [
  {
    id: "intel",
    name: "Intelligence Desk",
    duty: "research, briefs, odds and theories",
    count: 12,
    floor: 1,
  },
  {
    id: "defense",
    name: "Defense Watch",
    duty: "radar, threat feeds, hardening — defense only",
    count: 10,
    floor: 2,
  },
  {
    id: "code",
    name: "Build Crew",
    duty: "code, reviews, repairs — on your order only",
    count: 12,
    floor: 2,
  },
  {
    id: "ops",
    name: "Operations Floor",
    duty: "supply and demand, scheduling, logistics",
    count: 10,
    floor: 3,
  },
  {
    id: "media",
    name: "Media Bay",
    duty: "music, art, cards and clip components",
    count: 8,
    floor: 3,
  },
  {
    id: "records",
    name: "Records Vault",
    duty: "files, repositories, memory keeping",
    count: 8,
    floor: 4,
  },
  { id: "lore", name: "Lore Hall", duty: "Egyptology, history, the old names", count: 4, floor: 4 },
  {
    id: "front",
    name: "Front Desk",
    duty: "greetings, routing, reporting to the operator",
    count: 4,
    floor: 1,
  },
] as const;

export const TOTAL_WORKERS = DEPARTMENTS.reduce((sum, d) => sum + d.count, 0); // 68

const FIRST_NAMES = [
  "Amun",
  "Kia",
  "Ptah",
  "Nubi",
  "Seneb",
  "Maat",
  "Heru",
  "Anki",
  "Sati",
  "Nefret",
  "Khons",
  "Ipy",
  "Merit",
  "Dedi",
  "Hapu",
  "Tefnut",
  "Sekh",
  "Geb",
  "Nut",
  "Aker",
  "Ren",
  "Heqa",
  "Bast",
  "Wepwawet",
  "Sopdu",
  "Min",
  "Neith",
  "Satet",
  "Anuket",
  "Hapi",
  "Khepri",
  "Aten",
  "Shu",
  "Tjeneny",
  "Weneg",
  "Duau",
  "Imset",
  "Qebehs",
  "Serqet",
  "Sobek",
] as const;

const SPECIALTIES: Record<string, string[]> = {
  intel: ["briefs", "odds", "theories", "fact checks"],
  defense: ["radar sweeps", "threat feeds", "hardening reviews", "watch logs"],
  code: ["repairs", "reviews", "refactors", "tests"],
  ops: ["scheduling", "supply", "demand", "routes"],
  media: ["music beds", "card art", "clip cutouts", "titles"],
  records: ["filing", "retrieval", "archiving", "provenance"],
  lore: ["the old names", "dynasties", "funerary texts", "ma'at"],
  front: ["greetings", "routing", "reports", "visitor logs"],
};

const STATUSES: SubAI["status"][] = ["learning", "working", "standby"];

/** Deterministic roster — same seed, same 68 named sub AIs. */
export function buildRoster(): SubAI[] {
  const roster: SubAI[] = [];
  DEPARTMENTS.forEach((dept, di) => {
    for (let i = 0; i < dept.count; i += 1) {
      const first = FIRST_NAMES[(di * 7 + i * 3) % FIRST_NAMES.length] ?? "Amun";
      const specialties = SPECIALTIES[dept.id] ?? ["general duties"];
      roster.push({
        id: `${dept.id}-${i + 1}`,
        name: `${first} of ${dept.name}`,
        departmentId: dept.id,
        specialty: specialties[i % specialties.length] ?? specialties[0] ?? "general duties",
        status: STATUSES[(di + i) % STATUSES.length] ?? "working",
      });
    }
  });
  return roster;
}

export const ROSTER: readonly SubAI[] = buildRoster();

/** Find a worker by first name or department ("Amun", "Defense Watch"). */
export function findWorkers(query: string): SubAI[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const byDept = DEPARTMENTS.find((d) => d.name.toLowerCase().includes(q) || d.id === q);
  if (byDept) return ROSTER.filter((w) => w.departmentId === byDept.id);
  const exact = ROSTER.filter((w) => w.name.toLowerCase().startsWith(q));
  if (exact.length) return exact;
  return ROSTER.filter(
    (w) => w.name.toLowerCase().includes(q) || w.specialty.toLowerCase().includes(q),
  ).slice(0, 4);
}

/**
 * What happens when Osiris calls on a worker: a status line + a SUGGESTION
 * for the operator. He relays; the operator decides.
 */
export function callWorkerLine(worker: SubAI): string {
  return (
    `${worker.name} answers — ${worker.status} on ${worker.specialty}. ` +
    "They have a suggestion ready; I am relaying it, not acting on it."
  );
}

export function departmentOf(worker: SubAI): Department | undefined {
  return DEPARTMENTS.find((d) => d.id === worker.departmentId);
}

/** Whether a line like "call Amun" or "ask the Defense Watch" names a worker. */
export function parseWorkerCall(text: string): { target: string } | null {
  const match =
    text.match(
      /^(?:hey\s+)?(?:osiris[,]\s*)?(?:call|ask|get|summon)\s+(?:the\s+|my\s+)?(.+?)[.?!]?$/i,
    ) ?? text.match(/^(?:hey\s+)?(.+?)[,]?\s+(?:report|status)[.?!]?$/i);
  if (!match?.[1]) return null;
  const target = match[1]?.trim() ?? "";
  if (!target || /^(?:me|everyone|all|the crew)$/i.test(target)) return null;
  return { target };
}
