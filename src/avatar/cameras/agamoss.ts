/**
 * AGAMOSS — WAKE, SPOTLIGHT, GESTURES, AND THE ALARM LAW.
 * The pure core of the Agamoss camera package (owner orders
 * 2026-11-26 ~18:07–18:25 CST).
 *
 * Agamoss is the presence in every device the Captain owns; at
 * a camera post he is spoken to by name. What lives here is
 * everything that must be TRUE before any of it touches a wire:
 *
 *   · THE WAKE — a camera session opens ONLY on a full wake
 *     phrase addressed to Agamoss ("Agamoss wake up", "yo
 *     Agamoss wake up", "Agamoss can you hear me", "Agamoss I
 *     need your help"). The bare name alone NEVER opens one —
 *     a name spoken in passing is not a summons. The phrase
 *     list is ONE editable list in the core config (the
 *     presence store); what stands here is its default.
 *   · THE VOICE GATE — commands and activation are accepted
 *     ONLY from the captain-matched voice (the voiceprint's
 *     verdict: "captain"). Another voice is a presence-log
 *     entry and nothing more — no activation, no movement, no
 *     spotlight. No verdict is no activation. (Plain speech
 *     with no verdict still routes onward as before — it is
 *     not a command, and this gate stands on commands.)
 *   · THE SPOTLIGHT IS THE LISTENING PROOF — the light state
 *     DERIVES from the listening state; it is not a separate
 *     toggle. Addressed and listening ⇒ the light should be
 *     on. Where a camera exposes no spotlight door, the light
 *     cannot be driven and the state says so, per camera —
 *     the absence is reported, never papered over.
 *   · THE HEAD CODE — YES is a nod up-down TWICE; NO is a
 *     shake left-right THREE TIMES; a two-digit number is
 *     sent by turning RIGHT and nodding the first digit, then
 *     turning LEFT and nodding the second (right 8, left 6 =
 *     86). A zero digit is one SLOW nod. Gesture answers come
 *     only from real checks (he was heard, a measured person
 *     reading, a live weather feed). A question no check can
 *     answer gets NO gesture — it rides the system's own
 *     channel, where Agamoss's full voice answers.
 *   · THE ALARM LAW — the alarm path fires ONLY at pure
 *     danger: a weapon confirmed by the watch's two looks, or
 *     heard words matching the threat pattern toward Khadija
 *     from a voice that is not the Captain's. Everything else
 *     concerning is recorded and logged — never alarmed. The
 *     escalation is a LOGGED CHAIN, not discretion: Agamoss
 *     flags → Anubis is notified (a SYSTEM inbox entry derived
 *     from the flag's own log line) → the flag stands recorded
 *     as escalated for deity review → action entries are
 *     stamped chain-approved ONLY when they are written after
 *     the chain has run (or after the Captain's own override).
 *     The Captain's direct word never enters this chain — his
 *     commands execute at once, ahead of it, always.
 *
 * Plain TS, no I/O — the server modules do the dialing. This
 * module imports nothing from cameraPresence.ts (its speaker
 * label is structurally the same type) so the presence core
 * can sanitize this state without a cycle.
 */

/* ------------------------------------------------------------------ */
/* The wake — full phrases only, the bare name never                   */
/* ------------------------------------------------------------------ */

/**
 * The default wake phrases, normalized (lowercase, single
 * spaces, no punctuation). The editable list lives in the core
 * config (the presence store's agamoss section); these stand
 * until the Captain edits that list.
 */
export const DEFAULT_WAKE_PHRASES: string[] = [
  "agamoss wake up",
  "yo agamoss wake up",
  "agamoss can you hear me",
  "agamoss i need your help",
];

export const WAKE_PHRASES_MAX = 24;

/**
 * Speech-to-text spells his name more than one way ("Agamoss",
 * "Agamos", "Agamus"). All of them normalize to the one token
 * the wake list is written against — the ear forgives the
 * spelling, never the shape: a full phrase is still required.
 */
const NAME_TOKEN = /^(agamoss|agamos|agamus)$/;

/** Lowercase, punctuation to spaces, his name's spellings unified. */
export function normalizeSpeechText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((tok) => (NAME_TOKEN.test(tok) ? "agamoss" : tok))
    .join(" ");
}

/**
 * The wake test: does this line carry one of the wake phrases,
 * whole and in order? Returns the matched phrase (normalized)
 * or null. The bare name — "agamoss" alone, or his name inside
 * other words with no phrase around it — returns null, always.
 */
export function matchWakePhrase(text: string, phrases: string[]): string | null {
  const line = ` ${normalizeSpeechText(text)} `;
  if (!line.includes(" agamoss ")) return null;
  // LONGEST match wins: "yo agamoss wake up" also contains
  // "agamoss wake up" inside it, and the phrase he actually
  // spoke is the longer one — the matched identity is what
  // the record reports.
  let best: string | null = null;
  for (const phrase of phrases) {
    const p = normalizeSpeechText(phrase);
    if (p && line.includes(` ${p} `) && (best === null || p.length > best.length)) best = p;
  }
  return best;
}

/** Is this line JUST a wake (the phrase and nothing of substance after it)? */
export function isWakeOnlyLine(text: string, phrases: string[]): boolean {
  const matched = matchWakePhrase(text, phrases);
  if (!matched) return false;
  const rest = normalizeSpeechText(text).replace(matched, "").replace(/\bagamoss\b/g, "").trim();
  return rest.length === 0 || /^(please|now|hey|yo)$/.test(rest);
}

/**
 * Sanitize the stored wake list: normalized phrases, each
 * carrying his name, no dupes, capped. An absent or unusable
 * list falls back to the defaults — the wake never silently
 * becomes "any mention of his name".
 */
export function sanitizeWakePhrases(v: unknown): string[] {
  if (!Array.isArray(v)) return [...DEFAULT_WAKE_PHRASES];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const p = normalizeSpeechText(item);
    if (!p || p.length < 8 || p.length > 80) continue;
    if (!p.includes("agamoss")) continue;
    if (p === "agamoss") continue; // the bare name is not a phrase
    if (!out.includes(p)) out.push(p);
    if (out.length >= WAKE_PHRASES_MAX) break;
  }
  return out.length > 0 ? out : [...DEFAULT_WAKE_PHRASES];
}

/* ------------------------------------------------------------------ */
/* The voice gate                                                      */
/* ------------------------------------------------------------------ */

/** The voiceprint's verdict, structurally SpeakerLabel | null. */
export type AgamossSpeaker = "captain" | "another" | null;

/**
 * May this voice command the cameras / open a session? Only
 * the captain-matched voice. Another voice: log only. No
 * verdict: no activation — the gate does not guess at him.
 */
export function voiceMayCommand(speaker: AgamossSpeaker): boolean {
  return speaker === "captain";
}

/* ------------------------------------------------------------------ */
/* The head code — gestures as timed move sequences                    */
/* ------------------------------------------------------------------ */

export type GestureAxis = "pan" | "tilt";

export interface GestureStep {
  axis: GestureAxis;
  /** PTZ velocity −1..1; 0 is a held-still beat. */
  velocity: number;
  ms: number;
}

/** Quick, small swings — a head answering, not a patrol sweep. */
export const GESTURE_SPEED = 0.55;
export const GESTURE_BEAT_MS = 380;
export const GESTURE_TURN_MS = 750;
export const GESTURE_SETTLE_MS = 200;

function nodOnce(slow = false): GestureStep[] {
  const ms = slow ? GESTURE_BEAT_MS * 2 : GESTURE_BEAT_MS;
  return [
    { axis: "tilt", velocity: GESTURE_SPEED, ms },
    { axis: "tilt", velocity: -GESTURE_SPEED, ms },
  ];
}

function nodSteps(count: number): GestureStep[] {
  const out: GestureStep[] = [];
  for (let i = 0; i < count; i++) out.push(...nodOnce());
  return out;
}

function shakeOnce(): GestureStep[] {
  return [
    { axis: "pan", velocity: -GESTURE_SPEED, ms: GESTURE_BEAT_MS },
    { axis: "pan", velocity: GESTURE_SPEED, ms: GESTURE_BEAT_MS },
  ];
}

/** YES — the head nods up and down TWICE. Also the wake confirmation. */
export function yesGesture(): GestureStep[] {
  return nodSteps(2);
}

/** NO — the head shakes left to right THREE TIMES. */
export function noGesture(): GestureStep[] {
  const out: GestureStep[] = [];
  for (let i = 0; i < 3; i++) out.push(...shakeOnce());
  return out;
}

function digitNods(digit: number): GestureStep[] {
  // A zero is one SLOW nod — silence would read as a missed
  // digit, and the code never leaves a gap to guess at.
  if (digit === 0) return nodOnce(true);
  return nodSteps(digit);
}

/**
 * A two-digit number (0–99): turn RIGHT, nod the first digit;
 * turn LEFT, nod the second. Right 8, left 6 = 86. Anything
 * outside two digits returns null — the head does not fake a
 * number it cannot say; the system's own channel answers.
 */
export function numberGesture(value: number): GestureStep[] | null {
  if (!Number.isInteger(value) || value < 0 || value > 99) return null;
  const first = Math.floor(value / 10);
  const second = value % 10;
  return [
    { axis: "pan", velocity: GESTURE_SPEED, ms: GESTURE_TURN_MS },
    { axis: "pan", velocity: 0, ms: GESTURE_SETTLE_MS },
    ...digitNods(first),
    { axis: "pan", velocity: 0, ms: GESTURE_SETTLE_MS },
    { axis: "pan", velocity: -GESTURE_SPEED, ms: GESTURE_TURN_MS },
    { axis: "pan", velocity: 0, ms: GESTURE_SETTLE_MS },
    ...digitNods(second),
  ];
}

/** How many nods (tilt-up swings) a sequence carries — for readers and tests. */
export function countNods(steps: GestureStep[]): number {
  return steps.filter((s) => s.axis === "tilt" && s.velocity > 0).length;
}

/** How many full left-right shakes a sequence carries. */
export function countShakes(steps: GestureStep[]): number {
  return steps.filter((s) => s.axis === "pan" && s.velocity < 0).length;
}

/** Plain words for a gesture — the hearing record says what the head did. */
export function describeGesture(kind: "yes" | "no" | "number", value?: number): string {
  if (kind === "yes") return "nodded yes (up and down, twice)";
  if (kind === "no") return "shook no (left and right, three times)";
  return `signed the number ${value ?? "?"} (right, nod the first digit; left, nod the second)`;
}

/* ------------------------------------------------------------------ */
/* Gesture answers — only from real checks                             */
/* ------------------------------------------------------------------ */

export interface GestureChecks {
  /** He was heard — the only reason a gesture answer is on the table at all. */
  heardCaptain: boolean;
  /**
   * A person stands in the camera's reading right now (the
   * analyzer's person basis), false when the reading says the
   * room is empty of people, null when there is no reading —
   * movement alone is never spent as a person answer.
   */
  personPresent: boolean | null;
  /** Today's rain chance in percent, from a live feed — null = no source. */
  rainChancePercent: number | null;
  /** Current temperature in °F, from a live feed — null = no source. */
  temperatureF: number | null;
}

export type GestureAnswer =
  | { kind: "yes"; reason: string }
  | { kind: "no"; reason: string }
  | { kind: "number"; value: number; reason: string };

/** How close the asked percent must be to the real one for a yes. */
export const PERCENT_TOLERANCE = 5;

/**
 * Answer a heard question with the head — ONLY where a real
 * check carries the answer. Returns null for everything else:
 * no check, no gesture. The question then rides the system's
 * own channel, where Agamoss's full voice can answer in words.
 */
export function answerWithGesture(text: string, checks: GestureChecks): GestureAnswer | null {
  if (!checks.heardCaptain) return null;
  const t = normalizeSpeechText(text);

  if (/\bcan you hear me\b/.test(t) || /\bdo you hear me\b/.test(t)) {
    return { kind: "yes", reason: "he was heard — the question is its own proof" };
  }

  if (/\b(anyone|anybody|someone|somebody)\b/.test(t) && /\b(here|there|in|around|outside|inside)\b/.test(t)) {
    if (checks.personPresent === null) return null;
    return checks.personPresent
      ? { kind: "yes", reason: "the camera's person reading says someone is there" }
      : { kind: "no", reason: "the camera's person reading says no one is there" };
  }

  // The "%" sign does not survive normalization, so it is read
  // off the raw line; the spelled-out "percent" is read off
  // the normalized one.
  const percentAsk =
    /(\d{1,3})\s*%/.exec(text.toLowerCase()) ?? /(\d{1,3})\s*percent/.exec(t);
  if (percentAsk && /\b(weather|rain|chance)\b/.test(t)) {
    if (checks.rainChancePercent === null) return null;
    const asked = Number(percentAsk[1]);
    const real = checks.rainChancePercent;
    return Math.abs(asked - real) <= PERCENT_TOLERANCE
      ? { kind: "yes", reason: `the live feed puts the rain chance at ${real}%` }
      : { kind: "no", reason: `the live feed puts the rain chance at ${real}%, not ${asked}%` };
  }

  if (/\b(degrees|temperature|how (hot|cold|warm))\b/.test(t)) {
    if (checks.temperatureF === null) return null;
    const value = Math.round(checks.temperatureF);
    if (value < 0 || value > 99) return null; // the head signs two digits only
    return { kind: "number", value, reason: `the live feed reads ${value}°F` };
  }

  return null;
}

/** Does this line read as a question at all (for the record's wording)? */
export function readsAsQuestion(text: string): boolean {
  const t = normalizeSpeechText(text);
  return (
    text.includes("?") ||
    /^(is|are|do|does|did|can|could|will|would|what|how|when|where|who|why)\b/.test(t)
  );
}

/* ------------------------------------------------------------------ */
/* The spotlight — derived from the listening state                    */
/* ------------------------------------------------------------------ */

export interface InteractionLight {
  /** The state the light SHOULD be in, given the listening state. */
  shouldBeOn: boolean;
  /** A real door exists to drive it on this camera. */
  canDrive: boolean;
  /** Plain words — on a doorless camera, why the light cannot prove listening. */
  note: string;
}

/**
 * The derivation, whole: listening ⇒ on; not listening ⇒ off.
 * There is no third input — the light is not a separate
 * toggle. On a camera with no spotlight door the DESIRED
 * state still derives (shouldBeOn), but canDrive is false and
 * the note says the proof cannot be shown on this unit.
 */
export function interactionLight(input: {
  listening: boolean;
  spotlightDoor: string | null;
}): InteractionLight {
  const canDrive = input.spotlightDoor !== null;
  if (input.listening) {
    return canDrive
      ? {
          shouldBeOn: true,
          canDrive: true,
          note: "Agamoss is listening at this camera — its spotlight is on for the whole conversation.",
        }
      : {
          shouldBeOn: true,
          canDrive: false,
          note: "Agamoss is listening at this camera, but this unit exposes no spotlight door — the light cannot be lit to prove it. The absence is the camera's, not the listening's.",
        };
  }
  return {
    shouldBeOn: false,
    canDrive,
    note: canDrive
      ? "No conversation stands at this camera — its spotlight rests off."
      : "No conversation stands at this camera, and this unit exposes no spotlight door in the first place.",
  };
}

/* ------------------------------------------------------------------ */
/* The alarm law — pure danger only, and the logged chain              */
/* ------------------------------------------------------------------ */

const HARM_PATTERNS: RegExp[] = [
  /\bkill(ing|ed)?\b/,
  /\bhurt(ing)?\b/,
  /\bshoot(ing)?\b/,
  /\bstab(bing|bed)?\b/,
  /\bbeat (you|her|him|them|up)\b/,
  /\bhit (you|her|him)\b/,
  /\bi'll get you\b/,
  /\bgonna get you\b/,
  /\byou('re| are) dead\b/,
  /\bwatch your back\b/,
  /\btouch(ing)? (you|her|him)\b/,
  /\bgrab (her|him|you)\b/,
];

const KHADIJA_REFS: RegExp[] = [
  /\bkhadija\b/,
  /\bdija\b/,
  /\byour daughter\b/,
  /\bthe (little )?girl\b/,
  /\byour (kid|child)\b/,
  /\bthe child\b/,
];

export interface ThreatAssessment {
  /** Harm words AND a reference to Khadija — the alarm-grade pattern. */
  threatTowardKhadija: boolean;
  /** Harm words heard, without the Khadija reference — recorded, never alarmed. */
  concerning: boolean;
  /** The pattern that matched, in plain words, or null. */
  matched: string | null;
}

/**
 * Read a heard line for the threat pattern. This is a PATTERN
 * over a transcript — the record always says "words matching
 * the threat pattern", never that a threat was proven.
 */
export function assessHeardThreat(text: string): ThreatAssessment {
  const t = normalizeSpeechText(text);
  const harm = HARM_PATTERNS.find((re) => re.test(t));
  if (!harm) return { threatTowardKhadija: false, concerning: false, matched: null };
  const ref = KHADIJA_REFS.find((re) => re.test(t));
  if (ref) {
    return {
      threatTowardKhadija: true,
      concerning: true,
      matched: `harm words (“${harm.source}”) with a reference to Khadija (“${ref.source}”)`,
    };
  }
  return {
    threatTowardKhadija: false,
    concerning: true,
    matched: `harm words (“${harm.source}”) with no reference to Khadija`,
  };
}

export interface DangerSignals {
  /** The watch's two-look weapon verdict — confirmed, never a draft. */
  weaponConfirmed: boolean;
  /** The threat pattern toward Khadija, from a voice that is not the Captain's. */
  threatTowardKhadija: boolean;
}

export type DangerGrade = "pure-danger" | "none";

/** Pure danger is the ONLY grade there is for the alarm — everything else is a record. */
export function gradeDanger(signals: DangerSignals): DangerGrade {
  return signals.weaponConfirmed || signals.threatTowardKhadija ? "pure-danger" : "none";
}

/** The gate the alarm path itself checks: non-danger NEVER fires it. */
export function alarmMayFire(grade: DangerGrade): boolean {
  return grade === "pure-danger";
}

/* ------------------------- the chain ------------------------- */

export type EscalationStage =
  | "flagged"
  | "anubis-notified"
  | "deity-review"
  | "chain-approved"
  | "captain-override";

/** The chain's order — a stage is reached only through the one before it. */
export const CHAIN_ORDER: EscalationStage[] = [
  "flagged",
  "anubis-notified",
  "deity-review",
  "chain-approved",
];

export interface EscalationAction {
  at: number;
  text: string;
  /** True ONLY when written after the chain ran (or the Captain overrode). */
  chainApproved: boolean;
}

export interface AgamossEscalation {
  id: string;
  at: number;
  cameraId: string;
  cameraName: string;
  /** What raised the flag, in plain words — the check that fired, never a guess. */
  reason: string;
  grade: "pure-danger";
  stage: EscalationStage;
  /** Every stage reached, in order — the chain is a log, not a claim. */
  history: { stage: EscalationStage; at: number }[];
  actions: EscalationAction[];
}

export const ESCALATIONS_MAX = 40;

/** A new flag: stage one, history of one. Nothing approved yet, nothing acted. */
export function newEscalation(input: {
  id: string;
  at: number;
  cameraId: string;
  cameraName: string;
  reason: string;
}): AgamossEscalation {
  return {
    id: input.id,
    at: input.at,
    cameraId: input.cameraId,
    cameraName: input.cameraName,
    reason: input.reason,
    grade: "pure-danger",
    stage: "flagged",
    history: [{ stage: "flagged", at: input.at }],
    actions: [],
  };
}

/**
 * Advance one step along the chain. A step that is not the
 * NEXT one (skipping, going back, advancing past the end) is
 * refused — the record comes back unchanged.
 */
export function advanceEscalation(
  rec: AgamossEscalation,
  stage: EscalationStage,
  at: number,
): AgamossEscalation {
  const currentIdx = CHAIN_ORDER.indexOf(rec.stage);
  const nextIdx = CHAIN_ORDER.indexOf(stage);
  if (currentIdx < 0 || nextIdx !== currentIdx + 1) return rec;
  return { ...rec, stage, history: [...rec.history, { stage, at }] };
}

/**
 * The Captain's own override — his word interrupts the chain
 * from any stage, including before it starts moving. His
 * direct commands never pass through here at all; this stamps
 * the RECORD when he takes a standing flag into his own hands.
 */
export function captainOverrideEscalation(
  rec: AgamossEscalation,
  at: number,
): AgamossEscalation {
  if (rec.stage === "captain-override") return rec;
  return {
    ...rec,
    stage: "captain-override",
    history: [...rec.history, { stage: "captain-override", at }],
  };
}

/** Has this flag's chain run its full course (or the Captain taken it over)? */
export function chainComplete(rec: AgamossEscalation): boolean {
  return rec.stage === "chain-approved" || rec.stage === "captain-override";
}

/**
 * Write an action entry onto a flag. The chain-approved stamp
 * is COMPUTED from where the chain stands — an action written
 * before the chain completes is recorded as NOT approved, in
 * the open. There is no parameter that lets a caller claim it.
 */
export function addEscalationAction(
  rec: AgamossEscalation,
  text: string,
  at: number,
): AgamossEscalation {
  const action: EscalationAction = { at, text, chainApproved: chainComplete(rec) };
  return { ...rec, actions: [...rec.actions, action] };
}

/* ------------------------------------------------------------------ */
/* The stored state — wake list + escalation records                   */
/* ------------------------------------------------------------------ */

export interface AgamossState {
  wakePhrases: string[];
  escalations: AgamossEscalation[];
}

export function emptyAgamossState(): AgamossState {
  return { wakePhrases: [...DEFAULT_WAKE_PHRASES], escalations: [] };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function cleanString(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function cleanTime(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

const STAGES: EscalationStage[] = [
  "flagged",
  "anubis-notified",
  "deity-review",
  "chain-approved",
  "captain-override",
];

export function sanitizeEscalation(v: unknown): AgamossEscalation | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 96);
  const cameraId = cleanString(v["cameraId"], 64);
  const reason = cleanString(v["reason"], 400);
  const at = cleanTime(v["at"]);
  if (!id || !cameraId || !reason || at === null) return null;
  const stageRaw = v["stage"];
  const stage: EscalationStage =
    typeof stageRaw === "string" && (STAGES as string[]).includes(stageRaw)
      ? (stageRaw as EscalationStage)
      : "flagged";
  const history = Array.isArray(v["history"])
    ? v["history"]
        .map((h) => {
          if (!isRecord(h)) return null;
          const s = h["stage"];
          const t = cleanTime(h["at"]);
          if (typeof s !== "string" || !(STAGES as string[]).includes(s) || t === null) return null;
          return { stage: s as EscalationStage, at: t };
        })
        .filter((h): h is { stage: EscalationStage; at: number } => h !== null)
        .slice(0, 12)
    : [];
  const actions = Array.isArray(v["actions"])
    ? v["actions"]
        .map((a) => {
          if (!isRecord(a)) return null;
          const text = cleanString(a["text"], 400);
          const t = cleanTime(a["at"]);
          if (!text || t === null) return null;
          return { at: t, text, chainApproved: a["chainApproved"] === true };
        })
        .filter((a): a is EscalationAction => a !== null)
        .slice(0, 20)
    : [];
  return {
    id,
    at,
    cameraId,
    cameraName: cleanString(v["cameraName"], 80) ?? "Camera",
    reason,
    grade: "pure-danger",
    stage,
    history: history.length > 0 ? history : [{ stage: "flagged", at }],
    actions,
  };
}

export function sanitizeAgamossState(v: unknown): AgamossState {
  if (!isRecord(v)) return emptyAgamossState();
  return {
    wakePhrases: sanitizeWakePhrases(v["wakePhrases"]),
    escalations: Array.isArray(v["escalations"])
      ? v["escalations"]
          .map(sanitizeEscalation)
          .filter((e): e is AgamossEscalation => e !== null)
          .slice(0, ESCALATIONS_MAX)
      : [],
  };
}

/** The sector-log id prefix a danger flag's own log line carries. */
export const AGAMOSS_DANGER_ID_PREFIX = "agamoss-danger-";

/** Plain words for the flag's log line — the line the inbox derives from. */
export function dangerLogText(cameraName: string, reason: string): string {
  return `${cameraName}: AGAMOSS DANGER FLAG — ${reason} The alarm chain ran: flagged by Agamoss, notified to Anubis, recorded for deity review, and the alarm action stands chain-approved. The Captain's word overrides it at any point.`;
}
