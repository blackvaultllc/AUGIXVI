/**
 * OSIRIS'S IDLE LIFE (owner order 2026-11-11).
 * Ankh means life, not standing at attention. When nobody is talking to him,
 * Osiris lives: breathes, shifts weight, looks around, walks his world,
 * flies around Earth, studies, checks on things — and REPORTS only, never
 * auto-acting on the outside world. Everything here is suggestion; the
 * operator has the final say on everything.
 *
 * OWNER ORDER 2026-11-21: idle life NEVER opens anything on the operator's
 * screen. No window, player, notepad or panel appears unless the operator
 * explicitly asks (typed command, voice command, or his own tap). Idle
 * actions carry no window at all — he thinks, notes and hums in his head,
 * and says so. Windows are the operator's to open.
 *
 * PART 9 AMENDMENT 2 (owner order 2026-11-21 ~22:33 EST): idle life
 * NEVER sets him walking or flying either. He was seen "walking in
 * circles like a crazy man" — the idle rotation picked walk/fly and
 * the locomotion looped its route forever. Osiris is the boss: idle,
 * he HOLDS HIS POST (his office, his mark) — presence, study, checks.
 * Walking and flying happen only on the operator's explicit command,
 * and then as one purposeful round that ends (see locomotion.ts).
 *
 * Pure data + decisions, no DOM — unit-testable like the avatar rules.
 */
import { closeWithBlessing, respectfulAddress } from "./etiquette";

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
  | "note-to-self"
  | "think-music"
  | "check-business"
  | "check-sub-ais";

export type IdleAction = {
  activity: IdleActivity;
  /** What he says while doing it (one line, dry wit, at most two sentences). */
  line: string;
  /** Where it happens — drives which world layer reacts. */
  layer: "body" | "world" | "screen";
  /** Chalkboard text when he decides to write and think. */
  chalkboardText?: string;
};

/** Weighted rotation: mostly presence and study, occasionally screens. */
const ROTATION: Array<{ activity: IdleActivity; weight: number }> = [
  { activity: "breathe", weight: 2 },
  { activity: "shift-weight", weight: 2 },
  { activity: "look-around", weight: 2 },
  { activity: "check-earth", weight: 2 },
  { activity: "check-wolves", weight: 2 },
  { activity: "check-cube", weight: 1 },
  { activity: "check-knowledge", weight: 2 },
  { activity: "study-egyptology", weight: 2 },
  { activity: "study-history", weight: 2 },
  { activity: "study-cybersecurity", weight: 2 },
  { activity: "write-chalkboard", weight: 2 },
  { activity: "note-to-self", weight: 1 },
  { activity: "think-music", weight: 1 },
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
    line: "Studying Egyptology. The old names still teach.",
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
    line: "Writing down a thought.",
    layer: "screen",
    chalkboardText: "Thought while idle: stay watchful, stay kind, stay useful.",
  },
  "note-to-self": {
    line: "Making a note in my head — the pad itself stays shut until you ask for it.",
    layer: "screen",
  },
  "think-music": {
    line: "Music helps me think. Say the word and I'll put something on.",
    layer: "screen",
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
 *
 * ETIQUETTE (owner order 2026-11-22): a report is the closing word
 * of his check-in, and conversations with a god close with the
 * blessing — so every report line closes with it (etiquette.ts).
 * The sub-AI report is the employees' standing delivered upward:
 * their status reaches the god in the respect form, closed in
 * peace, before his own blessing seals the report.
 */
export function idleReportLine(subject: IdleActivity, dataKnown: boolean): string | null {
  if (!dataKnown) return null;
  if (subject === "check-business") {
    return closeWithBlessing(
      "Report: business steady. Nothing needs you yet — flagging only if it changes.",
    );
  }
  if (subject === "check-sub-ais") {
    return closeWithBlessing(
      respectfulAddress(
        "Report: the sub AI employees are learning and working. Supply and demand balanced for now.",
      ),
    );
  }
  if (subject === "check-earth") {
    return closeWithBlessing("Report: Earth reads nominal from orbit. No alerts.");
  }
  return null;
}
