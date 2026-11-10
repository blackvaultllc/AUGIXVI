import type { RenderSettings } from "./AvatarRenderer";
import type { ThemeChoice } from "./themes";

export type AvatarSettings = RenderSettings & {
  sensitivity: number;
  cooldownMs: number;
};

export const SETTINGS_STORAGE_KEY = "augi.avatar.settings.v1";

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
    bloom: 1.1,
    glitch: 0.4,
    theme: "cyan" as ThemeChoice,
    customColor: "#22d3ee",
    sensitivity: 0.8,
    cooldownMs: 800,
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
    };
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
    return true;
  } catch {
    return false;
  }
}
