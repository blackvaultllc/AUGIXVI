/**
 * IMAGE ORIENTATION — a picture must stand the way it was taken
 * (owner defect, 2026-11-23: an uploaded photo reached the analyzer
 * sideways — the model itself reported the frame "rotated" — because
 * the raw file bytes carry the camera's EXIF orientation mark while
 * the pixels themselves are stored unrotated).
 *
 * The rule: uploads are turned upright ONCE, here, from the photo's
 * own EXIF orientation mark, before the picture is shown OR sent to
 * the vision model — so the operator and the model look at the same
 * upright picture. A picture with no mark (or mark 1) passes through
 * untouched. Camera snapshots need no help: the bridge's frames
 * carry no EXIF segment at all (verified against archived frames
 * 2026-11-23) — their pixels already ARE the camera's true
 * orientation, so they are never re-turned.
 *
 * The parser and the transform plan are pure functions over bytes
 * and numbers, unit-testable without a browser; the canvas turning
 * is a thin shell over them and falls back to the original picture
 * on any failure — a picture is never lost to an orientation fix.
 */

/** EXIF orientation values run 1–8; anything else is not a mark. */
export function readExifOrientation(bytes: Uint8Array): number | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let off = 2;
  while (off + 4 <= bytes.length) {
    if (bytes[off] !== 0xff) return null;
    const marker = bytes[off + 1]!;
    if (marker === 0xda || marker === 0xd9) return null; // scan data / end
    const len = (bytes[off + 2]! << 8) | bytes[off + 3]!;
    if (len < 2) return null;
    if (
      marker === 0xe1 &&
      off + 10 <= bytes.length &&
      bytes[off + 4] === 0x45 && // E
      bytes[off + 5] === 0x78 && // x
      bytes[off + 6] === 0x69 && // i
      bytes[off + 7] === 0x66 // f
    ) {
      return orientationFromTiff(bytes, off + 10);
    }
    off += 2 + len;
  }
  return null;
}

function orientationFromTiff(bytes: Uint8Array, tiff: number): number | null {
  if (tiff + 8 > bytes.length) return null;
  const le = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  const be = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
  if (!le && !be) return null;
  const u16 = (o: number) =>
    le ? bytes[o]! | (bytes[o + 1]! << 8) : (bytes[o]! << 8) | bytes[o + 1]!;
  const u32 = (o: number) =>
    le
      ? (bytes[o]! | (bytes[o + 1]! << 8) | (bytes[o + 2]! << 16) | (bytes[o + 3]! << 24)) >>> 0
      : ((bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!) >>> 0;
  if (u16(tiff + 2) !== 42) return null;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > bytes.length) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > bytes.length) return null;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

export type OrientationPlan = {
  /** Clockwise rotation to apply, degrees. */
  rotateDeg: 0 | 90 | 180 | 270;
  /** Mirror horizontally after rotating. */
  flipHorizontal: boolean;
  /** True when the turned picture swaps width and height. */
  swapsAxes: boolean;
};

/**
 * The standard EXIF orientation table. 1 is the identity; values
 * 5–8 turn the picture a quarter turn, so the canvas swaps axes.
 */
export function orientationPlan(orientation: number): OrientationPlan {
  switch (orientation) {
    case 2:
      return { rotateDeg: 0, flipHorizontal: true, swapsAxes: false };
    case 3:
      return { rotateDeg: 180, flipHorizontal: false, swapsAxes: false };
    case 4:
      return { rotateDeg: 180, flipHorizontal: true, swapsAxes: false };
    case 5:
      return { rotateDeg: 90, flipHorizontal: true, swapsAxes: true };
    case 6:
      return { rotateDeg: 90, flipHorizontal: false, swapsAxes: true };
    case 7:
      return { rotateDeg: 270, flipHorizontal: true, swapsAxes: true };
    case 8:
      return { rotateDeg: 270, flipHorizontal: false, swapsAxes: true };
    default:
      return { rotateDeg: 0, flipHorizontal: false, swapsAxes: false };
  }
}

/** The turned picture's dimensions for a stored width × height. */
export function orientedSize(
  plan: OrientationPlan,
  width: number,
  height: number,
): { width: number; height: number } {
  return plan.swapsAxes ? { width: height, height: width } : { width, height };
}

/** Base64 (no data: prefix) → bytes, chunked like the camera path. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type NormalizedImage = {
  /** Full data URL of the picture to show AND analyze. */
  dataUrl: string;
  /** Base64 payload (no prefix) of the same picture. */
  base64: string;
  /** True when an EXIF mark actually turned the picture. */
  corrected: boolean;
  /** The EXIF orientation that was honored, when one was found. */
  orientation: number | null;
};

/**
 * Turn an uploaded picture upright from its own EXIF mark. The
 * decode is pinned with `image-orientation: none` so the browser
 * does not ALSO turn it (double-turning is the classic failure);
 * the turn itself is this module's plan, drawn on a canvas. Any
 * failure — unreadable mark, decode error, no canvas — returns the
 * original picture unchanged: the fix never eats the photo.
 */
export async function normalizeImageOrientation(args: {
  base64: string;
  mime?: string;
}): Promise<NormalizedImage> {
  const mime = args.mime ?? "image/jpeg";
  const original: NormalizedImage = {
    dataUrl: `data:${mime};base64,${args.base64}`,
    base64: args.base64,
    corrected: false,
    orientation: null,
  };
  let orientation: number | null = null;
  try {
    orientation = readExifOrientation(base64ToBytes(args.base64));
  } catch {
    return original;
  }
  original.orientation = orientation;
  if (orientation === null || orientation === 1) return original;
  const plan = orientationPlan(orientation);
  if (plan.rotateDeg === 0 && !plan.flipHorizontal) return original;
  try {
    const img = await loadImageNoAutoOrient(original.dataUrl);
    const size = orientedSize(plan, img.naturalWidth, img.naturalHeight);
    if (size.width <= 0 || size.height <= 0) return original;
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.translate(size.width / 2, size.height / 2);
    ctx.rotate((plan.rotateDeg * Math.PI) / 180);
    if (plan.flipHorizontal) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    return {
      dataUrl,
      base64: dataUrl.split(",")[1] ?? args.base64,
      corrected: true,
      orientation,
    };
  } catch {
    return original;
  }
}

function loadImageNoAutoOrient(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // The browser must NOT apply the EXIF mark itself — this module
    // applies it, once, by plan. Without this the picture turns twice.
    img.style.imageOrientation = "none";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("the picture could not be decoded"));
    img.src = src;
  });
}
