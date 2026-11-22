/**
 * NOTIFICATION CONTROL BY HIS WORD (owner order 2026-11-22): the
 * operator's spoken/typed instruction sets the standing rules for
 * every report the system sends him, and the rules hold until his
 * next instruction changes them.
 *
 * - "hold notifications for X hours" — nothing surfaces until the
 *   hold expires (a hold-until timestamp).
 * - "hold notifications" — held until he releases them.
 * - "resume notifications" / "unhold notifications" — hold lifted.
 * - "don't tell me about X" — the topic is muted.
 * - "tell me about Y" — the topic is wanted: it is un-muted, and
 *   once he names wanted topics, ONLY wanted topics surface
 *   ("don't tell me about that, tell me about this" is one order).
 *
 * Plain data + parsing, persisted on this device, unit-testable
 * per the repo's rules. shouldNotify() is the single gate every
 * report surface honors.
 */
export interface NotificationPrefs {
  /** Epoch ms until which all notifications are held; null = no timed hold. */
  holdUntil: number | null;
  /** Held with no expiry, until he releases them. */
  held: boolean;
  /** Topics he has muted, normalized phrases. */
  mutedTopics: string[];
  /** Topics he has named as wanted; non-empty = only these surface. */
  allowedTopics: string[];
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  holdUntil: null,
  held: false,
  mutedTopics: [],
  allowedTopics: [],
};

const STORAGE_KEY = "augi.avatar.notification-prefs.v1";

export function loadNotificationPrefs(): NotificationPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      holdUntil: typeof parsed.holdUntil === "number" ? parsed.holdUntil : null,
      held: parsed.held === true,
      mutedTopics: Array.isArray(parsed.mutedTopics)
        ? parsed.mutedTopics.filter((t): t is string => typeof t === "string")
        : [],
      allowedTopics: Array.isArray(parsed.allowedTopics)
        ? parsed.allowedTopics.filter((t): t is string => typeof t === "string")
        : [],
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // best effort only
  }
}

/** A parsed instruction: a patch to the standing prefs. */
export type NotificationInstruction =
  | { kind: "hold-hours"; hours: number }
  | { kind: "hold" }
  | { kind: "resume" }
  | { kind: "mute"; topic: string }
  | { kind: "allow"; topic: string };

function cleanTopic(raw: string): string {
  return raw
    .trim()
    .replace(/[.!?…]+$/, "")
    .replace(/\s+(anymore|any more|right now)$/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Parse one line of the operator's words into a notification
 * instruction, or null when the line is not one. Deliberately
 * narrow: notification instructions name themselves.
 */
export function parseNotificationInstruction(text: string): NotificationInstruction | null {
  const line = text.trim();
  const holdHours = line.match(/^hold notifications? for (\d+(?:\.\d+)?) hours?$/i);
  if (holdHours?.[1]) return { kind: "hold-hours", hours: Number(holdHours[1]) };
  if (/^hold notifications?$/i.test(line)) return { kind: "hold" };
  if (/^(?:resume|unhold|release) notifications?$/i.test(line)) return { kind: "resume" };
  const mute = line.match(
    /^(?:don'?t|do not|stop) (?:tell|telling) me about (.+)$/i,
  );
  if (mute?.[1]) {
    const topic = cleanTopic(mute[1]);
    if (topic) return { kind: "mute", topic };
  }
  const allow = line.match(/^(?:tell|keep telling) me about (.+)$/i);
  if (allow?.[1]) {
    const topic = cleanTopic(allow[1]);
    if (topic) return { kind: "allow", topic };
  }
  return null;
}

/** Apply an instruction to the standing prefs (pure; `now` injected). */
export function applyNotificationInstruction(
  prefs: NotificationPrefs,
  instruction: NotificationInstruction,
  now: number,
): NotificationPrefs {
  switch (instruction.kind) {
    case "hold-hours":
      return { ...prefs, holdUntil: now + instruction.hours * 3_600_000, held: false };
    case "hold":
      return { ...prefs, held: true, holdUntil: null };
    case "resume":
      return { ...prefs, held: false, holdUntil: null };
    case "mute":
      return {
        ...prefs,
        mutedTopics: prefs.mutedTopics.includes(instruction.topic)
          ? prefs.mutedTopics
          : [...prefs.mutedTopics, instruction.topic],
        allowedTopics: prefs.allowedTopics.filter((t) => t !== instruction.topic),
      };
    case "allow":
      return {
        ...prefs,
        mutedTopics: prefs.mutedTopics.filter((t) => t !== instruction.topic),
        allowedTopics: prefs.allowedTopics.includes(instruction.topic)
          ? prefs.allowedTopics
          : [...prefs.allowedTopics, instruction.topic],
      };
  }
}

/** The confirmation line spoken back when an instruction lands. */
export function describeNotificationInstruction(instruction: NotificationInstruction): string {
  switch (instruction.kind) {
    case "hold-hours":
      return `Notifications held for ${instruction.hours} hour${instruction.hours === 1 ? "" : "s"}. Reports wait until then.`;
    case "hold":
      return "Notifications held. Reports wait until you release them.";
    case "resume":
      return "Notifications released. Reports will surface as they land.";
    case "mute":
      return `Held. I won't report on ${instruction.topic}.`;
    case "allow":
      return `Set. I'll report on ${instruction.topic}.`;
  }
}

/** Words a topic answers to, beyond its own key. */
const TOPIC_WORDS: Record<string, string[]> = {
  business: ["business", "money", "sales", "invoices"],
  employees: ["employees", "workers", "staff", "sub ai", "sub ais", "crew"],
  earth: ["earth", "orbit", "world"],
  security: ["security", "gate", "intruders"],
  construct: ["construct", "augi", "avatar"],
};

/** Does a standing phrase (muted/allowed) name this topic? */
function phraseMatchesTopic(phrase: string, topic: string): boolean {
  const words = TOPIC_WORDS[topic] ?? [topic];
  return words.some((word) => phrase.includes(word) || word.includes(phrase));
}

/**
 * THE GATE every report honors: held → silent; muted topic →
 * silent; once he has named wanted topics, only those surface.
 */
export function shouldNotify(prefs: NotificationPrefs, topic: string, now: number): boolean {
  if (prefs.held) return false;
  if (prefs.holdUntil !== null && now < prefs.holdUntil) return false;
  if (prefs.mutedTopics.some((phrase) => phraseMatchesTopic(phrase, topic))) return false;
  if (
    prefs.allowedTopics.length > 0 &&
    !prefs.allowedTopics.some((phrase) => phraseMatchesTopic(phrase, topic))
  ) {
    return false;
  }
  return true;
}
