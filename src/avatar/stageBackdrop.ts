/**
 * STAGE BACKDROPS (owner order 2026-11-22): the stage's backdrop is
 * a saved, switchable choice in his layout — the environment rule
 * he set: the background/backdrop is his to set, and the choice
 * persists like every other part of his arrangement.
 *
 * Three kinds stand today:
 * - "matrix-wall": THE MATRIX WALL (owner order 2026-11-27,
 *   "always and forever"): his gold binary rain, live and
 *   moving, boxed in 3D — the construct's permanent background,
 *   superseding the picture backgrounds on the stage. It is
 *   the DEFAULT: a stage with no saved pick stands on the
 *   wall. (The model is matrixWall.ts; the painter is
 *   MatrixWall.tsx.)
 * - "world": the living particle world itself (the world scenes —
 *   the Room, the Office, the Desert of particles, and the rest).
 * - "desert-photo": THE DESERT — a high-quality photograph the
 *   Captain supplies himself (desert with pyramids), dropped in as
 *   an image backdrop. The slot is registered NOW so the photo
 *   lands with no code change: put the file at DESERT_BACKDROP_SRC
 *   and the "Desert" backdrop shows it. Until the file is in the
 *   repo the stage falls back to the living world — never a broken
 *   image, never a substitute picture.
 *
 * A saved pick still stands where he left it — the wall is the
 * default and the foundation, not a cage: he can set the Desert
 * or the World from the Scene tab like always, and the pick
 * persists. What changed is only where a fresh stage starts.
 *
 * Asset convention, the same as every presence: one registered
 * path under public/, replaceable in place.
 */
export type StageBackdropId = "matrix-wall" | "world" | "desert-photo";

/** Where the Captain's desert photograph drops in. */
export const DESERT_BACKDROP_SRC = "/backdrops/desert.webp";

export const STAGE_BACKDROPS: readonly {
  id: StageBackdropId;
  name: string;
  blurb: string;
  /** The image asset for a photo backdrop; null for the living world. */
  image: string | null;
}[] = [
  {
    id: "matrix-wall",
    name: "The Matrix Wall",
    blurb: "His gold binary rain — live, moving, boxed in 3D. The foundation, always and forever.",
    image: null,
  },
  {
    id: "world",
    name: "The Living World",
    blurb: "The particle world scenes — the stage as it has always been.",
    image: null,
  },
  {
    id: "desert-photo",
    name: "Desert",
    blurb: "His photograph — desert and pyramids, supplied by the Captain himself.",
    image: DESERT_BACKDROP_SRC,
  },
];

const STORAGE_KEY = "augi.avatar.backdrop.v1";

export function loadStageBackdrop(): StageBackdropId {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (saved === "desert-photo") return "desert-photo";
    if (saved === "world") return "world";
    // No pick on record: the stage stands on the Matrix Wall —
    // his standing order of 2026-11-27, "always and forever."
    return "matrix-wall";
  } catch {
    return "matrix-wall";
  }
}

export function saveStageBackdrop(id: StageBackdropId) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, id);
  } catch {
    // best effort only
  }
}

export function backdropById(id: StageBackdropId) {
  const found = STAGE_BACKDROPS.find((backdrop) => backdrop.id === id);
  if (found) return found;
  // The living world is the floor of the registry — always present.
  return STAGE_BACKDROPS.find((backdrop) => backdrop.id === "world") ?? STAGE_BACKDROPS[0]!;
}
