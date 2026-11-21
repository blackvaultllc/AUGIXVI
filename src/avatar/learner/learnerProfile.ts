/**
 * KHADIJA'S LEARNER PROFILE — her own sign-in, completely separate from
 * the operator's (operator order 2026-11-21, scope confirmed "correct").
 *
 * Identity: her name "Khadija Leila Hall" + 2019 (her birth year).
 * Her session is a distinct mode kept in sessionStorage under its own
 * key. It is NOT a Supabase session, it is never read by any operator
 * surface, and it grants nothing operator-side: the operator gate and
 * the room gates verify the operator through Supabase + the operator
 * registry exactly as before and never consult this module.
 *
 * The wall runs both ways by construction:
 *  - Operator surfaces never look at the learner session.
 *  - Learner surfaces render only inside the learner route space
 *    (the allowlist below) and never import operator components.
 */

export const LEARNER_FULL_NAME = "Khadija Leila Hall";
export const LEARNER_FIRST_NAME = "Khadija";
export const LEARNER_BIRTH_YEAR = 2019;

export const LEARNER_SESSION_KEY = "augi.learner.session.v1";

export type LearnerSession = {
  mode: "learner";
  name: string;
  startedAt: string;
};

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/**
 * Her sign-in check: the full name (any casing, extra spaces forgiven)
 * and the birth year 2019. Anything else is "that's not it" — the
 * caller shows a friendly message and nothing about her side renders.
 */
export function validateLearnerSignIn(name: string, birthYear: string | number): boolean {
  const year = typeof birthYear === "number" ? birthYear : Number(String(birthYear).trim());
  return normalizeName(name) === normalizeName(LEARNER_FULL_NAME) && year === LEARNER_BIRTH_YEAR;
}

type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sessionStore(override?: SessionStorageLike): SessionStorageLike | null {
  if (override) return override;
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function startLearnerSession(
  now: Date = new Date(),
  storageOverride?: SessionStorageLike,
): LearnerSession {
  const session: LearnerSession = {
    mode: "learner",
    name: LEARNER_FULL_NAME,
    startedAt: now.toISOString(),
  };
  sessionStore(storageOverride)?.setItem(LEARNER_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function loadLearnerSession(storageOverride?: SessionStorageLike): LearnerSession | null {
  const store = sessionStore(storageOverride);
  if (!store) return null;
  try {
    const raw = store.getItem(LEARNER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LearnerSession>;
    if (parsed.mode !== "learner" || parsed.name !== LEARNER_FULL_NAME) return null;
    return parsed as LearnerSession;
  } catch {
    return null;
  }
}

export function isLearnerSessionActive(storageOverride?: SessionStorageLike): boolean {
  return loadLearnerSession(storageOverride) !== null;
}

export function endLearnerSession(storageOverride?: SessionStorageLike): void {
  sessionStore(storageOverride)?.removeItem(LEARNER_SESSION_KEY);
}

/**
 * The learner route space — the ONLY places a learner session may go.
 * Everything else in the app (every /avatar route, the transcribe API,
 * every operator room and tool) is outside the wall for her session.
 */
export const LEARNER_ALLOWED_PATHS = ["/learner", "/learner/game", "/games/legend-of-logic.html"];

export function learnerCanAccess(rawPath: string): boolean {
  const path = rawPath.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
  return LEARNER_ALLOWED_PATHS.includes(path);
}

/** Operator route space — used by tests to prove the wall's other side. */
export function isOperatorPath(rawPath: string): boolean {
  const path = rawPath.split(/[?#]/)[0]!;
  return path === "/avatar" || path.startsWith("/avatar/") || path.startsWith("/api/");
}
