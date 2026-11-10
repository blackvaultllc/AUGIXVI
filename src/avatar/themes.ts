export const THEMES = {
  cyan: { a: [0.2, 0.85, 1], b: [0.05, 0.2, 0.9], core: [1, 0.5, 0.1], vein: [1, 0.75, 0.3] },
  gold: { a: [1, 0.78, 0.25], b: [0.45, 0.19, 0.02], core: [1, 0.93, 0.65], vein: [1, 0.58, 0.12] },
  red: { a: [1, 0.24, 0.2], b: [0.42, 0.015, 0.035], core: [1, 0.62, 0.4], vein: [1, 0.35, 0.12] },
  green: {
    a: [0.3, 1, 0.45],
    b: [0.015, 0.32, 0.12],
    core: [0.8, 1, 0.35],
    vein: [0.3, 0.85, 0.18],
  },
  purple: {
    a: [0.73, 0.38, 1],
    b: [0.19, 0.04, 0.48],
    core: [1, 0.58, 0.95],
    vein: [0.52, 0.27, 1],
  },
  white: { a: [0.94, 0.98, 1], b: [0.38, 0.55, 0.72], core: [1, 1, 1], vein: [0.72, 0.88, 1] },
  "black-gold": {
    a: [1, 0.72, 0.14],
    b: [0.12, 0.075, 0.02],
    core: [1, 0.88, 0.38],
    vein: [0.78, 0.49, 0.06],
  },
  rose: { a: [1, 0.4, 0.62], b: [0.45, 0.035, 0.18], core: [1, 0.72, 0.8], vein: [1, 0.22, 0.45] },
  ember: { a: [1, 0.55, 0.2], b: [0.6, 0.08, 0.05], core: [0.4, 0.8, 1], vein: [1, 0.9, 0.6] },
  emerald: { a: [0.3, 1, 0.7], b: [0.02, 0.35, 0.3], core: [1, 0.8, 0.2], vein: [0.9, 1, 0.5] },
} as const;

export type ThemeName = keyof typeof THEMES;
export type ThemeChoice = ThemeName | "custom";
export type ThemePalette = {
  a: readonly number[];
  b: readonly number[];
  core: readonly number[];
  vein: readonly number[];
};
export type ThemePreference = { theme: ThemeChoice; customColor: string };

export const DEFAULT_THEME_PREFERENCE: ThemePreference = { theme: "cyan", customColor: "#22d3ee" };
const STORAGE_KEY = "augi.avatar.theme.v1";

export function getThemePalette(theme: ThemeChoice, customColor: string): ThemePalette {
  if (theme !== "custom") return THEMES[theme];
  const color = /^#[\da-f]{6}$/i.test(customColor)
    ? customColor
    : DEFAULT_THEME_PREFERENCE.customColor;
  const channels = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels as [number, number, number];
  return {
    a: [red, green, blue],
    b: [red * 0.32, green * 0.32, blue * 0.32],
    core: [red, green, blue],
    vein: [red * 0.82, green * 0.82, blue * 0.82],
  };
}

export function getThemeAccent(theme: ThemeChoice, customColor: string): string {
  if (theme === "custom") {
    return /^#[\da-f]{6}$/i.test(customColor) ? customColor : DEFAULT_THEME_PREFERENCE.customColor;
  }
  const [red, green, blue] = THEMES[theme].a;
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function loadThemePreference(): ThemePreference {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_THEME_PREFERENCE;
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== "object") return DEFAULT_THEME_PREFERENCE;
    const preference = value as Partial<ThemePreference>;
    if (preference.theme !== "custom" && !Object.hasOwn(THEMES, preference.theme ?? "")) {
      return DEFAULT_THEME_PREFERENCE;
    }
    const customColor =
      typeof preference.customColor === "string" && /^#[\da-f]{6}$/i.test(preference.customColor)
        ? preference.customColor
        : DEFAULT_THEME_PREFERENCE.customColor;
    return { theme: preference.theme ?? "cyan", customColor };
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch (error) {
    console.warn("Could not save avatar colors on this device.", error);
  }
}
