/**
 * ANALYSIS PROTOCOL — /odds and /theory terminal commands.
 *
 * `/odds <question>`    → layer 1: PROBABILITY (percentage/range, basis label,
 *                         key variables). Rendered as a terminal bar whose
 *                         color encodes the basis: green=measured,
 *                         amber=estimated, grey=speculative.
 * `/theory <question>`  → layer 2: THEORETICAL ASSESSMENT (best case, required
 *                         conditions, most likely point of failure, cheap test).
 *
 * A bare `/odds` or `/theory` reuses the previous question on the same topic.
 * Every probability REQUIRES a basis label — a number without one is a fault.
 */

export const ANALYSIS_PROTOCOL = `ANALYSIS PROTOCOL. When asked for a probability, odds, feasibility, or "will it work", answer like an android ship's officer: precise, calm, brief.

Layer 1 — PROBABILITY: give a percentage or a range (e.g. "62 to 75 percent"), then state the basis in one line — measured (from data or logs), estimated (from general knowledge), or speculative (little to no data). Name the 2 or 3 main variables that move the number. NEVER give a number without its basis label.

Layer 2 — THEORETICAL ASSESSMENT: best-case analysis. What would have to be true, the chain of steps, the single most likely point of failure. Say "theoretically possible" only if no known rule prevents it, and state what is untested.

Rules: never invent precision — weak basis means a wide range. Separate fact, inference, and guess, and label each. Offer one way to raise the odds and one cheap way to test before committing. Do not flatter; if the plan will likely fail, say so plainly and why.`;

export type Basis = "measured" | "estimated" | "speculative" | "unknown";

export interface AnalysisCommand {
  kind: "odds" | "theory";
  question: string; // may be "" → caller reuses the previous question
}

/** Parse `/odds [question]` / `/theory [question]`. Null if not one of them. */
export function parseAnalysisCommand(text: string): AnalysisCommand | null {
  const t = text.trim();
  const m = /^\/(odds|theory)(\s+([\s\S]+))?$/i.exec(t);
  if (!m) return null;
  return { kind: m[1]!.toLowerCase() as "odds" | "theory", question: (m[3] ?? "").trim() };
}

/** System directive appended for /odds so the model answers layer 1 only. */
export const ODDS_DIRECTIVE = `${ANALYSIS_PROTOCOL}

The user asks for odds/probability/feasibility. Reply with LAYER 1 ONLY (PROBABILITY), in exactly this shape:

PROBABILITY: <number or low-to-high range, percent>
BASIS: measured | estimated | speculative   (or "insufficient data" if you cannot estimate)
VARIABLES: <2-3 factors that move the number, comma separated>

No preamble, no closing advice.`;

/** System directive appended for /theory (layer 2). */
export const THEORY_DIRECTIVE = `${ANALYSIS_PROTOCOL}

The user asks for the theoretical assessment. Reply with LAYER 2 ONLY, in exactly this shape:

BEST CASE: <what happens if everything goes right>
REQUIRED: <the conditions that must hold, comma separated>
WEAK POINT: <the single most likely point of failure>
CHEAP TEST: <one low-cost way to test before committing>

No preamble.`;

export interface Probability {
  /** Center of the range, 0-100 (for the bar). Ranges use the midpoint. */
  pct: number;
  low: number | null; // range low, null for a single number
  high: number | null; // range high, null for a single number
  basis: Basis;
}

const BASIS_RE = /\bbasis\b\s*[:\-—]?\s*(measured|estimated|speculative|insufficient\s+data)/i;

/**
 * Extract the probability + basis from a model reply (layer-1 format, but
 * tolerant of prose). Returns null when no number/basis can be found — the
 * caller then shows the raw text WITHOUT a bar (never invent a number).
 */
export function extractProbability(text: string): Probability | null {
  const nums: Array<{ v: number; i: number }> = [];
  // "62 to 75 percent" · "62-75%" · "62–75 %" · plain "62%" · "0.62 probability"
  const range = /\b(\d{1,3})\s*(?:to|[-–—])\s*(\d{1,3})\s*(?:percent|%)/gi;
  let m: RegExpExecArray | null;
  while ((m = range.exec(text))) {
    const low = Number(m[1]);
    const high = Number(m[2]);
    if (high > 100 || low > high) continue;
    nums.push({ v: (low + high) / 2, i: m.index });
  }
  if (!nums.length) {
    const single = /\b(\d{1,3})\s*(?:percent|%)/gi;
    while ((m = single.exec(text))) {
      const v = Number(m[1]);
      if (v > 100) continue;
      nums.push({ v, i: m.index });
    }
  }
  if (!nums.length) return null;
  const best = nums.sort((a, b) => a.i - b.i)[0]!;
  const bm = BASIS_RE.exec(text);
  let basis: Basis = "unknown";
  if (bm) {
    const b = bm[1]!.toLowerCase();
    if (b.startsWith("measured")) basis = "measured";
    else if (b.startsWith("estimated")) basis = "estimated";
    else if (b.startsWith("speculative")) basis = "speculative";
    else basis = "unknown"; // insufficient data → treat as unlabeled
  }
  // Range bounds for display (re-scan around the chosen number).
  let low: number | null = null;
  let high: number | null = null;
  const rm = /(\d{1,3})\s*(?:to|[-–—])\s*(\d{1,3})\s*(?:percent|%)/i.exec(
    text.slice(Math.max(0, best.i - 8), best.i + 40),
  );
  if (rm) {
    low = Number(rm[1]);
    high = Number(rm[2]);
  }
  return { pct: Math.round(best.v), low, high, basis };
}

/** Tailwind text color for a basis label. Grey also covers unlabeled. */
export function basisColor(b: Basis): string {
  switch (b) {
    case "measured":
      return "text-emerald-400";
    case "estimated":
      return "text-amber-400";
    default:
      return "text-muted-foreground"; // speculative / unknown → grey
  }
}

/** Human label shown next to the bar. "UNKNOWN" for anything unlabeled. */
export function basisLabel(b: Basis): string {
  return b === "unknown" ? "UNLABELED" : b.toUpperCase();
}
