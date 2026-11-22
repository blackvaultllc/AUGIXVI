/**
 * STAGE BACKDROPS — the Captain's own theme pictures (owner order
 * 2026-11-22): the Egyptian set and the world-map set he sent, as
 * selectable backgrounds for the Room, switchable like every other
 * surface choice and saved with the layout.
 *
 * THE FIT RULE (his binding words): a backdrop must FIT correctly
 * and must NOT overpower the color of the interface. So a backdrop
 * is cover-fit — scaled to cover the stage's back wall with no
 * distortion, cropping overflow, never stretched — and it sits
 * behind everything under a quieting veil, so the interface's own
 * colors, the medallions, and every line of text stay fully
 * readable at his bifocal standard. The art serves the interface,
 * never the other way around.
 *
 * Plain data + the cover-fit math; the renderer and the panel both
 * read this registry. Asset files live in public/stage-backdrops
 * and public/world-maps — his pictures, shipped with his app.
 */

export type BackdropSet = "egyptian" | "maps";

export type BackdropAsset = {
  id: string;
  name: string;
  set: BackdropSet;
  /** Public path the app serves the picture from. */
  src: string;
  /** Pixel size of the shipped file — the cover-fit math reads the aspect. */
  width: number;
  height: number;
};

const bd = (
  id: string,
  name: string,
  set: BackdropSet,
  file: string,
  width: number,
  height: number,
): BackdropAsset => ({
  id,
  name,
  set,
  src: set === "egyptian" ? `/stage-backdrops/${file}` : `/world-maps/${file}`,
  width,
  height,
});

export const BACKDROPS: readonly BackdropAsset[] = [
  /* The Egyptian set — his stage themes. */
  bd("egypt-pyramids-planets", "Pyramids under the planets", "egyptian", "egypt-pyramids-planets.jpg", 1600, 1200),
  bd("egypt-pyramids-energy", "Pyramids of light", "egyptian", "egypt-pyramids-energy.jpg", 474, 270),
  bd("egypt-sphinx-sunset", "The Sphinx at sunset", "egyptian", "egypt-sphinx-sunset.jpg", 474, 197),
  bd("egypt-eye-of-horus", "Eye of Horus", "egyptian", "egypt-eye-of-horus.jpg", 474, 270),
  bd("egypt-pharaoh-hologram", "The Pharaoh hologram", "egyptian", "egypt-pharaoh-hologram.jpg", 474, 265),
  bd("egypt-neon-pharaoh", "Neon Pharaoh", "egyptian", "egypt-neon-pharaoh.jpg", 672, 384),
  bd("egypt-throne", "The throne in the stars", "egyptian", "egypt-throne.jpg", 474, 474),
  bd("egypt-queen", "The Queen and the panther", "egyptian", "egypt-queen.jpg", 474, 474),
  bd("egypt-future-city", "The future city", "egyptian", "egypt-future-city.jpg", 474, 632),
  bd("egypt-pharaoh-figure", "The Pharaoh", "egyptian", "egypt-pharaoh-figure.jpg", 474, 474),
  bd("egypt-tech-portal", "The portal", "egyptian", "egypt-tech-portal.jpg", 474, 265),
  bd("egypt-pharaoh-mask", "The golden mask", "egyptian", "egypt-pharaoh-mask.jpg", 474, 474),
  /* The map set — his, also choosable as backdrops where he likes. */
  bd("map-political", "World map — countries", "maps", "map-political.jpg", 474, 345),
  bd("map-pastel", "World map — pastel", "maps", "map-pastel.jpg", 474, 270),
  bd("map-blue-grid", "World map — blue grid", "maps", "map-blue-grid.jpg", 474, 357),
  bd("map-satellite", "World map — satellite", "maps", "map-satellite.jpg", 474, 283),
  bd("map-dark-digital", "World map — dark digital", "maps", "map-dark-digital.jpg", 474, 266),
  bd("map-matrix", "World map — matrix green", "maps", "map-matrix.jpg", 474, 296),
  bd("map-wall-flags", "Wall map with flags", "maps", "map-wall-flags.jpg", 474, 292),
  bd("map-oval", "World map — oval", "maps", "map-oval.jpg", 474, 266),
  bd("map-vintage", "World map — vintage", "maps", "map-vintage.jpg", 474, 474),
  bd("map-network-globe", "Network globe", "maps", "map-network-globe.jpg", 474, 338),
];

export function backdropById(id: string | null | undefined): BackdropAsset | null {
  if (!id) return null;
  return BACKDROPS.find((asset) => asset.id === id) ?? null;
}

/**
 * COVER FIT: the plane size that covers a view of (viewW × viewH)
 * with a picture of the given pixel size — scaled up until both
 * dimensions are covered, aspect never distorted, overflow cropped
 * by the frame itself. This is the math behind "the background
 * must FIT correctly."
 */
export function backdropPlaneSize(
  image: { width: number; height: number },
  viewW: number,
  viewH: number,
): { w: number; h: number } {
  const imageAspect = image.width / Math.max(1, image.height);
  const viewAspect = viewW / Math.max(1, viewH);
  if (viewAspect > imageAspect) {
    // The view is wider than the picture: width rules, height overflows.
    return { w: viewW, h: viewW / imageAspect };
  }
  return { w: viewH * imageAspect, h: viewH };
}

/** How strongly the veil quiets a backdrop (0–1): art present, interface first. */
export const BACKDROP_VEIL_OPACITY = 0.42;
/** The backdrop picture's own opacity under the veil. */
export const BACKDROP_IMAGE_OPACITY = 0.9;
