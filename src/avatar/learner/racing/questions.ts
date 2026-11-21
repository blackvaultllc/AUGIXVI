/**
 * MULTIPLICATION RACING — question engine (pure logic, no React).
 *
 * Built for a 10-year-old who is still shaky on multiplication, and
 * sequenced the way the strongest elementary curricula sequence fact
 * mastery (operator order + curriculum calibration 2026-11-21):
 *
 * - FACT FAMILIES IN ORDER, never random 1-12: the friendly tables
 *   first (2, 5, 10), then 3-4, then 6-7-8-9, with 11-12 arriving
 *   last and lightly. Lap 1 races the first family group, lap 2 the
 *   next, lap 3 the next — fun first, no frustration wall.
 * - SPIRAL REVIEW (Saxon-style): every lap is roughly 70% current
 *   families and 30% review of the families from earlier laps.
 * - PIT STOPS TEACH THE TRICK: pit problems carry the strategy
 *   behind the fact (7 x 8 = 5 x 8 + 2 x 8, double-double for the
 *   4s, ten-minus-a-group for the 9s...). The first pit stop teaches
 *   the families the NEXT lap will race, so the trick lands right
 *   before he needs it.
 *
 * The generator is shaped so other math kinds can plug in later
 * (MathKind), but multiplication is the only kind that ships.
 */

export type MathKind = "multiplication";

export interface MathQuestion {
  kind: MathKind;
  /** The table (fact family) and the other factor. Prompt reads a x b. */
  a: number;
  b: number;
  answer: number;
  /** Four tappable choices, shuffled, always including the answer. */
  choices: number[];
  prompt: string;
  /** Pit stops only: the strategy trick behind this fact. */
  strategy?: string;
}

export type Rng = () => number;

/** Fact families in mastery order. */
export const FAMILY_STAGES: readonly (readonly number[])[] = [
  [2, 5, 10],
  [3, 4],
  [6, 7, 8, 9],
  [11, 12],
];

/** Chance a race question comes from earlier families (spiral review). */
export const REVIEW_CHANCE = 0.3;

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
}

function intBetween(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Gentle factor ranges: friendly tables get the full 2-10, the
 *  bigger tables start with smaller partners so nothing is a wall. */
function factorRange(table: number): [number, number] {
  if (table <= 5) return [2, 10];
  if (table <= 9) return [2, 9];
  return [2, 9]; // 11 and 12
}

/** Tables the given lap races as its "current" families. Lap 3 also
 *  sprinkles in 11 and 12 lightly (weighted pool: the 6-9 families
 *  appear three times as often). */
export function currentTablesForLap(lap: number): number[] {
  if (lap <= 1) return [...FAMILY_STAGES[0]!];
  if (lap === 2) return [...FAMILY_STAGES[1]!];
  const stage2 = FAMILY_STAGES[2]!;
  const stage3 = FAMILY_STAGES[3]!;
  return [...stage2, ...stage2, ...stage2, ...stage3];
}

/** Tables from every earlier stage — the spiral review pool. */
export function reviewTablesForLap(lap: number): number[] {
  if (lap <= 1) return [];
  if (lap === 2) return [...FAMILY_STAGES[0]!];
  return [...FAMILY_STAGES[0]!, ...FAMILY_STAGES[1]!];
}

function makeChoices(a: number, b: number, answer: number, rng: Rng): number[] {
  const candidates = [
    answer + b,
    answer - b,
    answer + a,
    answer - a,
    answer + 1,
    answer - 1,
    answer + 10,
    answer - 10,
    (a + 1) * b,
    a * (b + 1),
    (a - 1) * b,
    a * (b - 1),
  ];
  const distractors: number[] = [];
  for (const candidate of candidates) {
    if (candidate > 0 && candidate !== answer && !distractors.includes(candidate)) {
      distractors.push(candidate);
    }
    if (distractors.length === 3) break;
  }
  const choices = [answer, ...distractors];
  // Fisher-Yates with the injected rng.
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [choices[i], choices[j]] = [choices[j]!, choices[i]!];
  }
  return choices;
}

function buildQuestion(a: number, b: number, rng: Rng, strategy?: string): MathQuestion {
  const answer = a * b;
  return {
    kind: "multiplication",
    a,
    b,
    answer,
    choices: makeChoices(a, b, answer, rng),
    prompt: `${a} × ${b} = ?`,
    ...(strategy ? { strategy } : {}),
  };
}

function questionFromTables(tables: readonly number[], rng: Rng, avoidKey?: string): MathQuestion {
  let question = buildQuestion(2, 2, rng);
  for (let attempt = 0; attempt < 8; attempt++) {
    const table = pick(tables, rng);
    const [min, max] = factorRange(table);
    const factor = intBetween(min, max, rng);
    question = buildQuestion(table, factor, rng);
    if (`${question.a}x${question.b}` !== avoidKey) break;
  }
  return question;
}

/** One racing question for a lap: ~70% current families, ~30% spiral
 *  review of earlier families (lap 1 has nothing to review yet). */
export function raceQuestion(lap: number, rng: Rng = Math.random, avoidKey?: string): MathQuestion {
  const review = reviewTablesForLap(lap);
  if (review.length > 0 && rng() < REVIEW_CHANCE) {
    return questionFromTables(review, rng, avoidKey);
  }
  return questionFromTables(currentTablesForLap(lap), rng, avoidKey);
}

/** Sprint mode draws from every family, weighted toward the friendly
 *  ones a young racer knows best. */
export function sprintQuestion(rng: Rng = Math.random, avoidKey?: string): MathQuestion {
  const pool = [
    ...FAMILY_STAGES[0]!,
    ...FAMILY_STAGES[0]!,
    ...FAMILY_STAGES[0]!,
    ...FAMILY_STAGES[0]!,
    ...FAMILY_STAGES[1]!,
    ...FAMILY_STAGES[1]!,
    ...FAMILY_STAGES[1]!,
    ...FAMILY_STAGES[2]!,
    ...FAMILY_STAGES[2]!,
    ...FAMILY_STAGES[3]!,
  ];
  return questionFromTables(pool, rng, avoidKey);
}

/**
 * The strategy trick behind a fact, in kid words. The decomposition
 * stops one step short of the final answer — he still gets to land
 * it himself.
 */
export function strategyFor(a: number, b: number): string {
  const t = a;
  const n = b;
  switch (t) {
    case 2:
      return `Double it! 2 × ${n} is just ${n} + ${n}.`;
    case 10:
      return `Add a zero! 10 × ${n} is ${n} with a 0 on the end.`;
    case 5:
      return `Half of the 10s fact: 10 × ${n} = ${10 * n}, and 5 × ${n} is half of that.`;
    case 3:
      return `Double plus one more: 2 × ${n} = ${2 * n}, then add one more ${n}.`;
    case 4:
      return `Double, double! Double ${n} is ${2 * n}. Double that and you have 4 × ${n}.`;
    case 6:
      return `5 groups plus 1 group: 5 × ${n} = ${5 * n}, then add one more ${n}.`;
    case 7:
      return `5 groups plus 2 groups: 5 × ${n} = ${5 * n} and 2 × ${n} = ${2 * n}. Add them together!`;
    case 8:
      return `Double the 4s fact: 4 × ${n} = ${4 * n}, then double that.`;
    case 9:
      return `10 groups minus 1 group: 10 × ${n} = ${10 * n}, then take away one ${n}.`;
    case 11:
      return n <= 9
        ? `The digit repeats! 11 × ${n} writes the ${n} twice.`
        : `10 groups plus 1 group: 10 × ${n} = ${10 * n}, then add one more ${n}.`;
    case 12:
      return `10 groups plus 2 groups: 10 × ${n} = ${10 * n} and 2 × ${n} = ${2 * n}. Add them together!`;
    default:
      return `Count in groups: ${t} groups of ${n}.`;
  }
}

/**
 * Pit stop problems: three per stop, each carrying its strategy.
 * The stop after lap 1 teaches the 3s and 4s (what lap 2 races);
 * the stop after lap 2 teaches the 6-9 families (what lap 3 races).
 * Factors stay small — the trick does the heavy lifting.
 */
export function pitProblems(pitIndex: number, rng: Rng = Math.random): MathQuestion[] {
  const teachStage = pitIndex <= 0 ? FAMILY_STAGES[1]! : FAMILY_STAGES[2]!;
  const problems: MathQuestion[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 3; i++) {
    let question = buildQuestion(3, 3, rng, strategyFor(3, 3));
    for (let attempt = 0; attempt < 8; attempt++) {
      const table = pick(teachStage, rng);
      const factor = intBetween(3, 8, rng);
      question = buildQuestion(table, factor, rng, strategyFor(table, factor));
      const key = `${question.a}x${question.b}`;
      if (!used.has(key)) {
        used.add(key);
        break;
      }
    }
    problems.push(question);
  }
  return problems;
}

export function questionKey(question: MathQuestion): string {
  return `${question.a}x${question.b}`;
}
