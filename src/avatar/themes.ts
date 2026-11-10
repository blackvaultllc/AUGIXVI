export const THEMES = {
  cyan: { a: [0.2, 0.85, 1.0], b: [0.05, 0.2, 0.9], core: [1.0, 0.5, 0.1], vein: [1.0, 0.75, 0.3] },
  ember: {
    a: [1.0, 0.55, 0.2],
    b: [0.6, 0.08, 0.05],
    core: [0.4, 0.8, 1.0],
    vein: [1.0, 0.9, 0.6],
  },
  emerald: {
    a: [0.3, 1.0, 0.7],
    b: [0.02, 0.35, 0.3],
    core: [1.0, 0.8, 0.2],
    vein: [0.9, 1.0, 0.5],
  },
} as const;
export type ThemeName = keyof typeof THEMES;
