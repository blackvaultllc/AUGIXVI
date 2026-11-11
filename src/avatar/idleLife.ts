/**
 * OSIRIS'S IDLE LIFE (owner order 2026-11-11).
 * Ankh means life, not standing at attention. When nobody is talking to him,
 * Osiris lives: breathes, shifts weight, looks around, walks his world,
 * flies around Earth, studies, checks on things — and REPORTS only, never
 * auto-acting on the outside world. Everything here is suggestion; the
 * operator has the final say on everything.
 *
 * Pure data + decisions, no DOM — unit-testable like the avatar rules.
 */

export type IdleActivity =
  | "breathe"
  | "shift-weight"
  | "look-around"
  | "walk"
  | "fly"
  | "study-egyptology"
  | "study-history"
  | "study-cybersecurity"
  | "check-earth"
  | "check-wolves"
  | "check-cube"
  | "check-knowledge"
  | "write-chalkboard"
  | "open-notepad"
  | "open-player"
  | "check-business"
  | "check-sub-ais";

export type IdleAction = {
  activity: IdleActivity;
  /** What he says while doing it (one line, dry wit, at most two sentences). */
  line: string;
  /** Where it happens — drives which world layer reacts. */
  layer: "body" | "world" | "screen";
  /** Window to open on the operator's screen, when any. */
  window?: "chalkboard" | "notepad" | "player";
  /** Chalkboard text when he decides to write and think. */
  chalkboardText?: string;
};

/** Weighted rotation: mostly presence and study, occasionally screens. */
const ROTATION: Array<{ activity: IdleActivity; weight: number }> = [
  { activity: "breathe", weight: 2 },
  { activity: "shift-weight", weight: 2 },
  { activity: "look-around", weight: 2 },
  { activity: "walk", weight: 3 },
  { activity: "fly", weight: 2 },
  { activity: "check-earth", weight: 2 },
  { activity: "check-wolves", weight: 2 },
  { activity: "check-cube", weight: 1 },
  { activity: "check-knowledge", weight: 2 },
  { activity: "study-egyptology", weight: 2 },
  { activity: "study-history", weight: 2 },
  { activity: "study-cybersecurity", weight: 2 },
  { activity: "write-chalkboard", weight: 2 },
  { activity: "open-notepad", weight: 1 },
  { activity: "open-player", weight: 1 },
  { activity: "check-business", weight: 2 },
  { activity: "check-sub-ais", weight: 2 },
];

const ACTIONS: Record<IdleActivity, Omit<IdleAction, "activity">> = {
  breathe: { line: "Breathing. Still here, still watching.", layer: "body" },
  "shift-weight": {
    line: "Shifting my weight — standing at attention is for statues.",
    layer: "body",
  },
  "look-around": { line: "Having a look around the world.", layer: "body" },
  walk: { line: "Taking a walk through my world.", layer: "world" },
  fly: { line: "Stretching my wings — flying the orbit for a bit.", layer: "world" },
  "study-egyptology": {
    line: "Pulling up a study box — Egyptology hour. The old names still teach.",
    layer: "screen",
  },
  "study-history": {
    line: "Studying history. Those who forget it repeat the worst of it.",
    layer: "screen",
  },
  "study-cybersecurity": {
    line: "Defense study: reviewing the security curriculum. Defense only — that is my law.",
    layer: "screen",
  },
  "check-earth": { line: "Checking the Earth. Orbital readings nominal.", layer: "world" },
  "check-wolves": { line: "Checking on the wolves.", layer: "world" },
  "check-cube": { line: "Sitting with my cube for a moment.", layer: "body" },
  "check-knowledge": { line: "Reviewing what I keep in knowledge.", layer: "screen" },
  "write-chalkboard": {
    line: "Opening the chalkboard — writing down a thought.",
    layer: "screen",
    window: "chalkboard",
    chalkboardText: "Thought while idle: stay watchful, stay kind, stay useful.",
  },
  "open-notepad": { line: "Making a note in my notepad.", layer: "screen", window: "notepad" },
  "open-player": {
    line: "Putting something on to study by. Music helps me think.",
    layer: "screen",
    window: "player",
  },
  "check-business": {
    line: "Watching the business — productivity steady. I will report if something needs you.",
    layer: "screen",
  },
  "check-sub-ais": {
    line: "Checking on the sub AI employees — supply and demand holding. Suggesting nothing yet.",
    layer: "screen",
  },
};

export const IDLE_INTERVAL_MS = 75_000;
export const STUDY_SUBJECTS = ["egyptology", "history", "cybersecurity"] as const;

function weightedPick(random: () => number): IdleActivity {
  const total = ROTATION.reduce((sum, r) => sum + r.weight, 0);
  let roll = random() * total;
  for (const entry of ROTATION) {
    roll -= entry.weight;
    if (roll <= 0) return entry.activity;
  }
  return "breathe";
}

/**
 * Pick the next idle action. `random` is injectable for tests.
 * The same activity is allowed again only after cycling; variety is enforced
 * by excluding the immediately previous activity when possible.
 */
export function pickIdleActivity(
  random: () => number = Math.random,
  previous?: IdleActivity,
): IdleAction {
  for (let attempt = 0; attempt < ROTATION.length; attempt += 1) {
    const activity = weightedPick(random);
    if (activity !== previous || ROTATION.length === 1) {
      return { activity, ...ACTIONS[activity] };
    }
  }
  return { activity: "breathe", ...ACTIONS.breathe };
}

/**
 * The chalkboard thought he writes when idle — varied, in character.
 * Unavailable knowledge stays UNAVAILABLE; he never invents facts.
 */
export function idleChalkboardThought(random: () => number = Math.random): string {
  const thoughts = [
    "Thought while idle: the ankh means life — keep moving, keep breathing.",
    "Studying note: defense only, never offensive. That is the law I keep.",
    "Idle note: watched the wolves today. They rest when I watch. Good.",
    "Egyptology note: Osiris taught resurrection through order — Ma'at first.",
    "Cyber note: patch, verify, log. In that order, every time.",
    "Business note: the sub AIs learn while I watch. Productivity holds.",
  ];
  return thoughts[Math.floor(random() * thoughts.length)] ?? thoughts[0]!;
}

/**
 * A short status report when something needs the operator. SUGGESTIONS ONLY —
 * he never opens panels, pushes, deploys or fixes anything himself.
 */
export function idleReportLine(subject: IdleActivity, dataKnown: boolean): string | null {
  if (!dataKnown) return null;
  if (subject === "check-business") {
    return "Report: business steady. Nothing needs you yet — flagging only if it changes.";
  }
  if (subject === "check-sub-ais") {
    return "Report: the sub AI employees are learning and working. Supply and demand balanced for now.";
  }
  if (subject === "check-earth") {
    return "Report: Earth reads nominal from orbit. No alerts.";
  }
  return null;
}
