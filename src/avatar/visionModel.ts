/**
 * THE vision model — one name for every vision surface in the app
 * (owner decision 2026-11-21, Part 26: "llava:7b — finish it, verify,
 * unify all surfaces").
 *
 * Camera description (vision.ts), the Picture Analysis room and the
 * room analyzer all resolve through here, so the app can never drift
 * into two surfaces quietly using two different models again. A build
 * may override the name with VITE_OLLAMA_VISION_MODEL, but the shipped
 * default is the canonical model everywhere.
 */
export const CANONICAL_VISION_MODEL = "llava:7b";

export function resolveVisionModel(): string {
  const override = import.meta.env["VITE_OLLAMA_VISION_MODEL"] as string | undefined;
  const trimmed = override?.trim();
  return trimmed ? trimmed : CANONICAL_VISION_MODEL;
}
