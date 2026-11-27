import type { RenderSettings } from "./AvatarRenderer";
import { backdropById } from "./builder/backdrops";
import type { BackdropFit } from "./builder/room";
import type { ThemeChoice } from "./themes";

export type AvatarSettings = RenderSettings & {
  sensitivity: number;
  cooldownMs: number;
  /**
   * THE BACKDROP SYNC (owner decision 2026-11-23 ~07:27 EST):
   * the backdrop picture + fit ride the account settings so every
   * device — phone, tablet, PC — shows the same background. The
   * picture is a registry asset id (or null for no picture); the
   * room's own layout keeps the device's cached copy, so the
   * offline Parrot still shows the last-synced picture with no
   * network. A null here means "no synced pick yet" — the room's
   * stored backdrop stands until he picks one anywhere.
   */
  backdropImage: string | null;
  backdropFit: BackdropFit;
  /**
   * True once a backdrop pick has actually been made and saved by
   * a build that carries the sync (a pick, a fit change, or a
   * clear). Until then the fields are inert: a legacy settings
   * copy must never wipe a room's stored backdrop on load.
   */
  backdropSynced: boolean;
};

export const SETTINGS_STORAGE_KEY = "augi.avatar.settings.v1";

/** Companion key: when the settings on THIS device were last saved (ms since epoch). */
export const SETTINGS_META_KEY = "augi.avatar.settings.meta.v1";

const LIMITS = {
  maxParticles: [5_000, 200_000] as const,
  bloom: [0, 2.5] as const,
  glitch: [0, 1] as const,
  sensitivity: [0.1, 2] as const,
  cooldownMs: [0, 5_000] as const,
};

export function defaultSettings(): AvatarSettings {
  return {
    maxParticles: 120_000,
    // Bloom defaults OFF for a fresh profile — the operator finds it too
    // much, and a saved choice (any value he picked) always outranks this.
    bloom: 0,
    glitch: 0.4,
    theme: "gold" as ThemeChoice,
    customColor: "#d4af37",
    sensitivity: 0.8,
    cooldownMs: 800,
    backdropImage: null,
    backdropFit: "contain",
    backdropSynced: false,
  };
}

function isThemeChoice(value: unknown): value is ThemeChoice {
  return (
    typeof value === "string" &&
    [
      "cyan",
      "gold",
      "red",
      "green",
      "purple",
      "white",
      "black-gold",
      "rose",
      "ember",
      "emerald",
      "custom",
    ].includes(value)
  );
}

function clampNumber(
  value: unknown,
  [min, max]: readonly [number, number],
  fallback: number,
): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numeric));
}

/**
 * Validate and clamp an unknown value into real settings. Anything invalid
 * falls back to the default for that field — never crashes, never invents
 * a value outside the knobs' limits. Used by the local loader AND by the
 * account-sync server, so a stored copy (local or account) can never smuggle
 * an out-of-range setting back in.
 */
export function sanitizeAvatarSettings(parsed: unknown): AvatarSettings {
  const base = defaultSettings();
  if (typeof parsed !== "object" || parsed === null) return base;
  const s = parsed as Record<string, unknown>;
  return {
    maxParticles: clampNumber(s["maxParticles"], LIMITS.maxParticles, base.maxParticles),
    bloom: clampNumber(s["bloom"], LIMITS.bloom, base.bloom),
    glitch: clampNumber(s["glitch"], LIMITS.glitch, base.glitch),
    theme: isThemeChoice(s["theme"]) ? s["theme"] : base.theme,
    customColor:
      typeof s["customColor"] === "string" && /^#[\da-f]{6}$/i.test(s["customColor"])
        ? s["customColor"]
        : base.customColor,
    sensitivity: clampNumber(s["sensitivity"], LIMITS.sensitivity, base.sensitivity),
    cooldownMs: clampNumber(s["cooldownMs"], LIMITS.cooldownMs, base.cooldownMs),
    // The synced backdrop pick: only a picture from his own theme
    // registry may ride the account copy — an unknown id reads as
    // no pick, never as a broken image. The fit is Whole picture
    // unless Fill screen was explicitly chosen.
    backdropImage:
      backdropById(typeof s["backdropImage"] === "string" ? s["backdropImage"] : null)?.id ??
      null,
    backdropFit: s["backdropFit"] === "cover" ? "cover" : "contain",
    // A stored copy only speaks for the backdrop when it carries
    // the pick as made (older copies predate the sync and read
    // false — their rooms keep their own stored backdrops).
    backdropSynced: s["backdropSynced"] === true,
  };
}

/** One store for EVERYTHING: save on every change, load on start. */
export function loadAvatarSettings(storage?: Pick<Storage, "getItem">): AvatarSettings {
  const raw = (() => {
    try {
      return (storage ?? globalThis.localStorage)?.getItem(SETTINGS_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  })();
  if (!raw) return defaultSettings();
  try {
    const parsed: unknown = JSON.parse(raw);
    return sanitizeAvatarSettings(parsed);
  } catch {
    return defaultSettings();
  }
}

export function saveAvatarSettings(
  settings: AvatarSettings,
  storage?: Pick<Storage, "setItem">,
): boolean {
  try {
    (storage ?? globalThis.localStorage)?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    saveAvatarSettingsUpdatedAt(Date.now(), storage);
    return true;
  } catch {
    return false;
  }
}

/** True when this device has ever saved settings (vs. running on defaults). */
export function hasSavedAvatarSettings(storage?: Pick<Storage, "getItem">): boolean {
  try {
    return (storage ?? globalThis.localStorage)?.getItem(SETTINGS_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/** When the settings on this device were last saved, or null if unknown. */
export function loadAvatarSettingsUpdatedAt(storage?: Pick<Storage, "getItem">): number | null {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(SETTINGS_META_KEY) ?? null;
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "updatedAt" in parsed &&
      typeof parsed.updatedAt === "number" &&
      Number.isFinite(parsed.updatedAt)
    ) {
      return parsed.updatedAt;
    }
    return null;
  } catch {
    return null;
  }
}

/** Stamp the saved-settings time — used after applying a newer account copy. */
export function saveAvatarSettingsUpdatedAt(
  updatedAt: number,
  storage?: Pick<Storage, "setItem">,
): void {
  try {
    (storage ?? globalThis.localStorage)?.setItem(SETTINGS_META_KEY, JSON.stringify({ updatedAt }));
  } catch {
    // A failed stamp never blocks the settings themselves.
  }
}
