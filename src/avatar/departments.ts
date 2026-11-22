/**
 * DEPARTMENTS — the operator's real workstreams, one model shared by
 * the Office Analytics window (Part 10) and the Office scene's desks
 * (Part 9). Every department's status comes from a REAL source inside
 * this app or is honestly labeled:
 *
 *  - "working"     — a real source answered and shows real work.
 *  - "problem"     — the source answered and shows NO work (a
 *                    department with no work is a problem state —
 *                    Domenick's rule), or a known-bad state.
 *  - "unavailable" — no source inside Augie can answer for this
 *                    department right now. Never faked, never
 *                    dressed up as activity.
 */

export type DepartmentStatus = "working" | "problem" | "unavailable";

export interface DepartmentSignal {
  id: string;
  label: string;
  status: DepartmentStatus;
  /** One honest sentence about what the source actually shows. */
  detail: string;
  stats: { label: string; value: string }[];
}

export interface DepartmentDef {
  id: string;
  label: string;
  /** What this department is in Domenick's operation. */
  blurb: string;
}

export const DEPARTMENTS: DepartmentDef[] = [
  {
    id: "security",
    label: "Security — Bellwood Patrol",
    blurb: "Gate watch and patrol support for the Bellwood Haven contract.",
  },
  {
    id: "knowledge",
    label: "Knowledge — the Library",
    blurb: "The offline Kiwix library on this machine (law, medicine, the Academy shelf, all of it).",
  },
  {
    id: "brain",
    label: "Brain — Local Models",
    blurb: "Ollama and the local models on this machine — Augie's offline mind.",
  },
  {
    id: "academy",
    label: "DIJA'S Academy — Khadija's World",
    blurb: "Her learning side: Squishy Maker saves, her Flower, her games.",
  },
  {
    id: "systems",
    label: "Systems — Devices & Access",
    blurb: "Trusted devices and access state for this installation.",
  },
  {
    id: "finance",
    label: "Finance — I-E-M",
    blurb: "Company money, watched by Violet as Financial Advisor in I-E-M's back office.",
  },
  {
    id: "social",
    label: "Social Media",
    blurb: "His public channels (Facebook, TikTok, Instagram) and their posting work.",
  },
];

export function departmentDef(id: string): DepartmentDef {
  return DEPARTMENTS.find((dept) => dept.id === id) ?? DEPARTMENTS[0]!;
}
