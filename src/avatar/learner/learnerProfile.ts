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

/**
 * OSIRIS IS HER CONSTRUCT (Captain's order 2026-11-26): Osiris
 * always protects Khadija, no matter what, and he has access to
 * any tool he needs that can be provided for that protection.
 * The same record stands in departmentHeads.ts
 * (OSIRIS_GUARDIAN_RECORD) — one law, written in both places it
 * governs, so neither side of the wall can drift from it.
 */
export const LEARNER_GUARDIAN_GOD = "osiris";
export const LEARNER_GUARDIAN_LAW =
  "Osiris is Khadija's construct. He always protects her, no matter what, and has access to any tool he needs that can be provided for that protection.";

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
 * REMEMBERED DEVICE — her fast way back in (Part 8, Domenick's order
 * 2026-11-21). Her name + birth-year sign-in is the ENROLLMENT: the
 * first time she signs in on a device, the device remembers her in
 * localStorage. After that, on THIS device, she taps one big button
 * and is straight back in her world — no re-typing every visit.
 *
 * The fast path changes only how fast SHE gets in. It is the same
 * learner session, the same allowlist wall below, the same reach —
 * nothing operator-side, ever. "Forget this device" (on her sign-in
 * screen) erases the memory and the full sign-in is required again.
 */
export const LEARNER_DEVICE_KEY = "augi.learner.device.v1";

type LocalStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function localStore(override?: LocalStorageLike): LocalStorageLike | null {
  if (override) return override;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function rememberLearnerDevice(
  now: Date = new Date(),
  storageOverride?: LocalStorageLike,
): void {
  localStore(storageOverride)?.setItem(
    LEARNER_DEVICE_KEY,
    JSON.stringify({ name: LEARNER_FULL_NAME, savedAt: now.toISOString() }),
  );
}

export function hasRememberedLearnerDevice(storageOverride?: LocalStorageLike): boolean {
  const store = localStore(storageOverride);
  if (!store) return false;
  try {
    const raw = store.getItem(LEARNER_DEVICE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { name?: unknown };
    return parsed.name === LEARNER_FULL_NAME;
  } catch {
    return false;
  }
}

/** One-tap re-entry on a remembered device. Returns false (and starts
 *  nothing) when this device was never enrolled or was forgotten. */
export function enterWithRememberedDevice(
  localOverride?: LocalStorageLike,
  sessionOverride?: SessionStorageLike,
): boolean {
  if (!hasRememberedLearnerDevice(localOverride)) return false;
  startLearnerSession(new Date(), sessionOverride);
  return true;
}

export function forgetLearnerDevice(storageOverride?: LocalStorageLike): void {
  localStore(storageOverride)?.removeItem(LEARNER_DEVICE_KEY);
}

/**
 * The learner route space — the ONLY places a learner session may go.
 * Everything else in the app (every /avatar route, the transcribe API,
 * every operator room and tool) is outside the wall for her session.
 *
 * The exact paths: her page, her two game rooms, the two game files,
 * her Squishy Maker's action doorway (the game's own saves, nothing
 * else), Augie the Flower's ask doorway (school questions, answered
 * from the library), the Flower's say doorway (her voice, spoken by
 * the core), and the daddy doorway — her line to her father, the one
 * contact the wall opens for by his order (2026-11-24); it reaches
 * Domenick Arlon Hall and nobody else — plus the request doorway
 * (2026-11-26), which sends her "ask for something to be added"
 * words out to her father the same way and brings nothing back.
 * The prefixes cover only static files
 * that belong to her: the Squishy Maker bundle's assets and her art
 * pictures. No prefix reaches an operator route or an operator API —
 * /api/learner/ask is an exact path, so /api/transcribe and the rest
 * of /api/* stay outside.
 */
export const LEARNER_ALLOWED_PATHS = [
  "/learner",
  "/learner/game",
  "/learner/racing",
  "/learner/squishy",
  "/games/legend-of-logic.html",
  "/games/squishy-maker/index.html",
  "/games/squishy-maker/actions",
  "/api/learner/ask",
  // The Flower's real voice (Piper on the core) — her speech doorway.
  "/api/learner/say",
  // Her line to Daddy — the one contact the wall always opens for
  // (owner order 2026-11-24). It reaches her father and nobody else.
  "/api/learner/daddy",
  // Her "Ask for something to be added" doorway (owner order
  // 2026-11-26): sends her words OUT to her father — a request
  // record on the core, mirrored into his notifications — and
  // brings nothing back but a thank-you. It opens no content,
  // no tool, and no surface to her.
  "/api/learner/request",
];

export const LEARNER_ALLOWED_PREFIXES = ["/games/squishy-maker/assets/", "/learner-art/"];

export function learnerCanAccess(rawPath: string): boolean {
  const path = rawPath.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
  // A ".." segment is never hers to use — refuse it before any matching,
  // so no prefix can be ridden out of her space.
  if (path.split("/").includes("..")) return false;
  if (LEARNER_ALLOWED_PATHS.includes(path)) return true;
  const withSlash = `${path}/`;
  return LEARNER_ALLOWED_PREFIXES.some((prefix) => withSlash.startsWith(prefix));
}

/** Operator route space — used by tests to prove the wall's other side. */
export function isOperatorPath(rawPath: string): boolean {
  const path = rawPath.split(/[?#]/)[0]!;
  return path === "/avatar" || path.startsWith("/avatar/") || path.startsWith("/api/");
}
