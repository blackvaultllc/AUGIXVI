/**
 * THE WALLPAPER PICKER (owner order 2026-11-24 ~17:26 EST).
 *
 * The Captain went looking in the menu for where to change the
 * wallpaper and could not find it — the pick lived buried in the
 * builder. Now the stage's own menu carries a plainly labeled
 * "Change wallpaper" entry (AvatarStage's Scene tab), and this
 * picker is what it opens: his existing stage pictures — the
 * cascade set (builder/backdrops.ts: the Egyptian set and the
 * world-map set he sent) — as tappable tiles, plus "No picture".
 * Tapping a tile sets the wallpaper IMMEDIATELY (the stage
 * applies the pick and syncs it to his account the same way the
 * builder's pick always did); there is no Apply button to hunt
 * for. The picture itself still renders whole and centered by
 * the backdrop fit law — this picker only chooses WHICH picture.
 */
import { BACKDROPS } from "./builder/backdrops";

export function WallpaperPicker({
  picked,
  onPick,
}: {
  /** The current wallpaper's asset id, or null for no picture. */
  picked: string | null;
  /** A tap picks — and the stage applies it at once. */
  onPick: (image: string | null) => void;
}) {
  return (
    <div className="wallpaper-picker" role="group" aria-label="Choose the wallpaper">
      {BACKDROPS.map((asset) => (
        <button
          key={asset.id}
          type="button"
          className={`wallpaper-picker__tile${picked === asset.id ? " is-picked" : ""}`}
          aria-pressed={picked === asset.id}
          onClick={() => onPick(asset.id)}
        >
          <img
            className="wallpaper-picker__img"
            src={asset.src}
            alt=""
            width={asset.width}
            height={asset.height}
            loading="lazy"
          />
          <span className="wallpaper-picker__name">
            {asset.name}
            {picked === asset.id ? " · set" : ""}
          </span>
        </button>
      ))}
      <button
        type="button"
        className={`wallpaper-picker__tile wallpaper-picker__tile--none${picked === null ? " is-picked" : ""}`}
        aria-pressed={picked === null}
        onClick={() => onPick(null)}
      >
        <span className="wallpaper-picker__name">
          No picture{picked === null ? " · set" : ""}
        </span>
        <span className="wallpaper-picker__blurb">The plain stage, no wallpaper.</span>
      </button>
    </div>
  );
}
