import { useMemo, useState } from "react";
import { Anchor, Home, Lock, LockOpen, Plus, RotateCcw, Trash2 } from "lucide-react";
import { describeOffset } from "./worldMap";
import {
  ITEM_SIZES,
  LIBRARY,
  colorHex,
  libraryItem,
  variantCount,
  variantCountLine,
  type ItemSizeId,
} from "./library";
import {
  type BackdropFit,
  type FloorStyle,
  type LayoutStore,
  type PlacedItem,
  type RoomContent,
  type RoomSurfaces,
} from "./room";
import { BACKDROPS, backdropById, type BackdropAsset } from "./backdrops";

/**
 * THE SKY CHOICES (owner order 2026-11-23): the pictures of his
 * that are skies — stars, planets, sunset over the land. The
 * world-sky slot itself accepts ANY picture in the registry
 * (room.ts sanitizes by id), so a sky he uploads later joins this
 * list the moment it is registered.
 */
const SKY_CHOICES: BackdropAsset[] = [
  "egypt-pyramids-planets",
  "egypt-throne",
  "egypt-sphinx-sunset",
  "egypt-pyramids-energy",
]
  .map((id) => backdropById(id))
  .filter((asset): asset is BackdropAsset => asset !== null);
import { STAGE_FRAMES, frameOffset, type FrameId, type FrameStore } from "./frames";
import { CategorySection, SubCategory } from "../CategorySection";

/**
 * THE ENVIRONMENT BUILDER PANEL (owner order 2026-11-22): the
 * Captain designs his own Room here. The library with its honest
 * variant math; click a piece (or drag it onto the stage) to place
 * it; click a placed piece on the stage to select it, drag it to
 * move it; anchor it to lock it; dress the room itself — backdrop
 * color, his theme pictures at full strength, and a floor that is
 * the grid, a solid color, or a picture (a chosen color/picture
 * covers — no grid bleeds through); keep named layouts that save
 * as you go; carry a finished room away as a data-only package for
 * his other sites.
 *
 * ORGANIZATION (owner order 2026-11-22): categories with
 * subcategories, consolidated — each thing lives in exactly one
 * obvious place, no long undifferentiated scroll. The panel is a
 * dumb surface: AvatarStage owns the room state and every callback
 * lands there, so the same panel can be lifted onto another page
 * with its own state behind it (portability order).
 */
export type BuilderPanelProps = {
  room: RoomContent;
  layouts: LayoutStore;
  selectedId: string | null;
  onPlace: (baseId: string) => void;
  onSelectItem: (id: string | null) => void;
  onVariant: (id: string, patch: Partial<Pick<PlacedItem, "form" | "size" | "color">>) => void;
  onRotate: (id: string, rotation: number) => void;
  onToggleAnchor: (id: string, anchored: boolean) => void;
  onRemove: (id: string) => void;
  onSurfaces: (surfaces: RoomSurfaces) => void;
  onSwitchLayout: (id: string) => void;
  onNewLayout: () => void;
  onRenameLayout: (id: string, name: string) => void;
  onDeleteLayout: (id: string) => void;
  onResetDefaultLayout: () => void;
  onExport: () => string;
  onImport: (text: string) => string;
  frames: FrameStore;
  framesArmed: boolean;
  onToggleFramesArmed: () => void;
  onResetFrame: (id: FrameId) => void;
  onResetAllFrames: () => void;
  /** THE WIDER WORLD (owner order 2026-11-23): where the stage
   * view stands, the trip home, and the ground-laying hand. */
  worldView?: { x: number; z: number };
  onGoHome?: () => void;
  layGroundArmed?: boolean;
  onToggleLayGround?: () => void;
};

const CATEGORIES = ["buildings", "nature", "park & street"] as const;

const CATEGORY_TITLES: Record<(typeof CATEGORIES)[number], string> = {
  buildings: "Buildings",
  nature: "Nature",
  "park & street": "Park & street",
};

const FLOOR_STYLES: readonly { id: FloorStyle; label: string }[] = [
  { id: "color", label: "Solid color" },
  { id: "picture", label: "Picture floor" },
];

/** THE FIT CHOICE (owner order 2026-11-23): Whole picture or Fill screen. */
const BACKDROP_FITS: readonly { id: BackdropFit; label: string }[] = [
  { id: "contain", label: "Whole picture" },
  { id: "cover", label: "Fill screen" },
];

export function BuilderPanel(props: BuilderPanelProps) {
  const { room, layouts, selectedId } = props;
  const selected = room.items.find((item) => item.id === selectedId) ?? null;
  const selectedBase = selected ? libraryItem(selected.baseId) : null;
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const active = layouts.layouts.find((layout) => layout.id === layouts.activeId) ?? layouts.layouts[0]!;
  const egyptian = useMemo(() => BACKDROPS.filter((asset) => asset.set === "egyptian"), []);
  const maps = useMemo(() => BACKDROPS.filter((asset) => asset.set === "maps"), []);

  const surface = (patch: Partial<RoomSurfaces>) =>
    props.onSurfaces({ ...room.surfaces, ...patch });

  return (
    <div className="builder-panel">
      <p className="builder-panel__count">{variantCountLine()}</p>
      <p className="builder-panel__hint">
        Tap a piece to place it; tap a placed piece to move or delete it.
      </p>
      <p className="builder-panel__hint">
        Everything lives in one category below. Anchored pieces are locked in place until you
        unanchor them.
      </p>

      {/* ------------------------- pieces for the room ------------------------ */}
      <CategorySection title="Pieces for the room">
        {CATEGORIES.map((category) => (
          <SubCategory key={category} title={CATEGORY_TITLES[category]}>
            <div className="builder-panel__library">
              {LIBRARY.filter((item) => item.category === category).map((item) => (
                <div key={item.id} className="builder-panel__piece">
                  <div className="builder-panel__piece-head">
                    <span className="builder-panel__piece-name">{item.name}</span>
                    <span className="builder-panel__piece-count">{variantCount(item)} variants</span>
                  </div>
                  <p className="builder-panel__piece-blurb">{item.blurb}</p>
                  <button
                    type="button"
                    className="builder-panel__add"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("augi-builder-base", item.id);
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => props.onPlace(item.id)}
                    aria-label={`Add a ${item.name} to the room`}
                    title={`Add a ${item.name} — or drag it onto the stage`}
                  >
                    <Plus aria-hidden="true" /> Add
                  </button>
                </div>
              ))}
            </div>
          </SubCategory>
        ))}
      </CategorySection>

      {/* --------------------------- the piece picked -------------------------- */}
      <CategorySection title="The piece you picked">
        {!selected || !selectedBase ? (
          <p className="builder-panel__empty">
            Nothing selected. Click a piece standing in the room and its controls land here.
          </p>
        ) : (
          <div className="builder-panel__selected">
            <p className="builder-panel__selected-name">
              {selectedBase.name}
              {selected.anchored ? " — anchored (locked)" : ""}
            </p>
            <label className="builder-panel__field">
              <span>Form</span>
              <select
                value={selected.form}
                onChange={(event) => props.onVariant(selected.id, { form: event.target.value })}
                aria-label="Form"
              >
                {selectedBase.forms.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="builder-panel__field">
              <span>Size</span>
              <select
                value={selected.size}
                onChange={(event) =>
                  props.onVariant(selected.id, { size: event.target.value as ItemSizeId })
                }
                aria-label="Size"
              >
                {ITEM_SIZES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="builder-panel__field">
              <span>Color</span>
              <div className="builder-panel__swatches" role="group" aria-label="Color">
                {selectedBase.colors.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`builder-panel__swatch${selected.color === entry.id ? " is-picked" : ""}`}
                    style={{ background: entry.hex }}
                    onClick={() => props.onVariant(selected.id, { color: entry.id })}
                    aria-label={`Color ${entry.label}`}
                    aria-pressed={selected.color === entry.id}
                    title={entry.label}
                  />
                ))}
              </div>
            </div>
            <div className="builder-panel__row">
              <button
                type="button"
                className="builder-panel__button"
                onClick={() => props.onRotate(selected.id, selected.rotation - 45)}
                aria-label="Turn left"
              >
                ⟲ Turn
              </button>
              <span className="builder-panel__rotation" aria-label="Facing">
                {selected.rotation}°
              </span>
              <button
                type="button"
                className="builder-panel__button"
                onClick={() => props.onRotate(selected.id, selected.rotation + 45)}
                aria-label="Turn right"
              >
                Turn ⟳
              </button>
            </div>
            <div className="builder-panel__row">
              <button
                type="button"
                className="builder-panel__button"
                onClick={() => props.onToggleAnchor(selected.id, !selected.anchored)}
                aria-pressed={selected.anchored}
              >
                {selected.anchored ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}
                {selected.anchored ? " Unanchor" : " Anchor"}
              </button>
              <button
                type="button"
                className="builder-panel__button builder-panel__button--danger"
                onClick={() => props.onRemove(selected.id)}
              >
                <Trash2 aria-hidden="true" /> Remove
              </button>
            </div>
            <p className="builder-panel__hint">
              Standing at x {selected.x.toFixed(1)}, z {selected.z.toFixed(1)} — painted{" "}
              {colorHex(selectedBase, selected.color)}.
            </p>
          </div>
        )}
      </CategorySection>

      {/* ------------------------------ the room ------------------------------ */}
      <CategorySection title="The room itself">
        <SubCategory title="Backdrop">
          <label className="builder-panel__field">
            <span>Backdrop color</span>
            <input
              type="color"
              value={room.surfaces.backdrop}
              onChange={(event) => surface({ backdrop: event.target.value })}
              aria-label="Backdrop color"
            />
          </label>
          <p className="builder-panel__hint">
            A backdrop picture hangs on the back wall — never stretched — and shows as the
            picture itself, full strength. Fit it Whole picture (all of it visible) or Fill
            screen (edge to edge, edges trimmed) — your pick follows you to every device.
            The panels stay solid, so the words always read first.
          </p>
          <BackdropPicker
            label="Egyptian themes"
            assets={egyptian}
            picked={room.surfaces.backdropImage}
            onPick={(id) => surface({ backdropImage: id })}
          />
          <BackdropPicker
            label="World maps"
            assets={maps}
            picked={room.surfaces.backdropImage}
            onPick={(id) => surface({ backdropImage: id })}
          />
          {room.surfaces.backdropImage && (
            <>
              <div className="builder-panel__row" role="group" aria-label="Backdrop fit">
                {BACKDROP_FITS.map((fit) => (
                  <button
                    key={fit.id}
                    type="button"
                    className="builder-panel__button"
                    aria-pressed={room.surfaces.backdropFit === fit.id}
                    onClick={() => surface({ backdropFit: fit.id })}
                  >
                    {fit.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="builder-panel__button"
                onClick={() => surface({ backdropImage: null })}
              >
                No picture — plain backdrop color
              </button>
            </>
          )}
        </SubCategory>

        <SubCategory title="Floor">
          <div className="builder-panel__row" role="group" aria-label="Floor kind">
            {FLOOR_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                className="builder-panel__button"
                aria-pressed={room.surfaces.floorStyle === style.id}
                onClick={() => surface({ floorStyle: style.id })}
              >
                {style.label}
              </button>
            ))}
          </div>
          {room.surfaces.floorStyle !== "picture" && (
            <label className="builder-panel__field">
              <span>Floor color</span>
              <input
                type="color"
                value={room.surfaces.floor}
                onChange={(event) => surface({ floor: event.target.value })}
                aria-label="Floor color"
              />
            </label>
          )}
          {room.surfaces.floorStyle === "color" && (
            <p className="builder-panel__hint">
              Your color covers the whole floor, edge to edge — the room's surfaces are all
              there is. (The grid is gone from the room entirely, by your order.)
            </p>
          )}
          {room.surfaces.floorStyle === "picture" && (
            <>
              <p className="builder-panel__hint">
                Your picture covers the whole floor, fitted across it, edge to edge.
              </p>
              <BackdropPicker
                label="Floor picture — Egyptian themes"
                assets={egyptian}
                picked={room.surfaces.floorImage}
                onPick={(id) => surface({ floorStyle: "picture", floorImage: id })}
              />
              <BackdropPicker
                label="Floor picture — World maps"
                assets={maps}
                picked={room.surfaces.floorImage}
                onPick={(id) => surface({ floorStyle: "picture", floorImage: id })}
              />
            </>
          )}
        </SubCategory>

        <SubCategory title="Walls">
          <label className="builder-panel__field">
            <span>Wall color</span>
            <input
              type="color"
              value={room.surfaces.wall}
              onChange={(event) => surface({ wall: event.target.value })}
              aria-label="Wall color"
            />
          </label>
        </SubCategory>
      </CategorySection>

      {/* --------------------------- the wider world --------------------------- */}
      <CategorySection title="The wider world">
        <p className="builder-panel__hint">
          Past the home plot the world runs on in darkness — unbuilt, until you build it. Drag
          empty ground (or use the arrow keys) to travel the view, then build where you land:
          pieces stand anywhere in the world, and a piece dropped on dark ground claims its
          plot and covers it.
        </p>
        <p className="builder-panel__hint" role="status">
          {props.worldView && (props.worldView.x !== 0 || props.worldView.z !== 0)
            ? `You are looking at ${describeOffset(props.worldView.x, props.worldView.z)}.`
            : "You are looking at the home plot."}{" "}
          {room.plots.length > 0
            ? `${room.plots.length} plot${room.plots.length === 1 ? "" : "s"} claimed beyond home.`
            : "No plots claimed beyond home yet."}
        </p>
        <div className="builder-panel__row">
          <button
            type="button"
            className="builder-panel__button"
            onClick={() => props.onGoHome?.()}
          >
            <Home aria-hidden="true" /> Back to the home plot
          </button>
          <button
            type="button"
            className="builder-panel__button"
            aria-pressed={props.layGroundArmed === true}
            onClick={() => props.onToggleLayGround?.()}
          >
            {props.layGroundArmed ? "Laying ground: ON — tap dark ground" : "Lay ground cover"}
          </button>
        </div>
        <p className="builder-panel__hint">
          With Lay ground on, tapping dark ground covers that plot with your floor — your
          color, or your floor picture. Tap a covered plot again to take the cover back up.
          Grass is a floor color: the green below lays it everywhere your ground stands.
        </p>
        <div className="builder-panel__row">
          <button
            type="button"
            className="builder-panel__button"
            onClick={() => surface({ floorStyle: "color", floor: "#4a7c3a" })}
          >
            Lay grass (green floor)
          </button>
        </div>
        <SubCategory title="World sky">
          <p className="builder-panel__hint">
            The sky stands far behind the world — stars above, earth below — and stays over
            you as you travel, like a real sky. It is the world's sky, not the room's backdrop:
            the backdrop hangs on the home wall; the sky is what you see out in the open
            world. Pictures you add for the sky land in this same list.
          </p>
          <BackdropPicker
            label="World sky — his sky pictures"
            assets={SKY_CHOICES}
            picked={room.surfaces.skyImage}
            onPick={(id) => surface({ skyImage: id })}
          />
          {room.surfaces.skyImage && (
            <button
              type="button"
              className="builder-panel__button"
              onClick={() => surface({ skyImage: null })}
            >
              No sky — plain darkness
            </button>
          )}
        </SubCategory>
      </CategorySection>

      {/* ------------------------------ layouts ------------------------------ */}
      <CategorySection title="Saved layouts" defaultOpen={false}>
        <SubCategory title="This layout">
          <div className="builder-panel__row">
            <select
              value={active.id}
              onChange={(event) => props.onSwitchLayout(event.target.value)}
              aria-label="Active layout"
            >
              {layouts.layouts.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
            </select>
            <button type="button" className="builder-panel__button" onClick={props.onNewLayout}>
              <Plus aria-hidden="true" /> New
            </button>
          </div>
          <div className="builder-panel__row">
            <input
              type="text"
              value={renameDraft ?? active.name}
              onChange={(event) => setRenameDraft(event.target.value)}
              aria-label="Layout name"
            />
            <button
              type="button"
              className="builder-panel__button"
              onClick={() => {
                if (renameDraft !== null) props.onRenameLayout(active.id, renameDraft);
                setRenameDraft(null);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="builder-panel__button builder-panel__button--danger"
              onClick={() => props.onDeleteLayout(active.id)}
              disabled={layouts.layouts.length <= 1}
            >
              <Trash2 aria-hidden="true" /> Delete
            </button>
          </div>
          <div className="builder-panel__row">
            <button type="button" className="builder-panel__button" onClick={props.onResetDefaultLayout}>
              <RotateCcw aria-hidden="true" /> Reset to the shipped Room
            </button>
          </div>
          <p className="builder-panel__hint">Layouts save as you go — there is no save button.</p>
        </SubCategory>
        <SubCategory title="Carry it away">
          <div className="builder-panel__row">
            <button
              type="button"
              className="builder-panel__button"
              onClick={() => setExportText(props.onExport())}
            >
              Export this room
            </button>
          </div>
          {exportText && (
            <textarea
              className="builder-panel__package"
              value={exportText}
              readOnly
              rows={6}
              aria-label="Exported room package — data only, lift it onto another site"
            />
          )}
          <textarea
            className="builder-panel__package"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={4}
            placeholder="Paste a room package here to bring it in as a new layout"
            aria-label="Import a room package"
          />
          <div className="builder-panel__row">
            <button
              type="button"
              className="builder-panel__button"
              disabled={!importText.trim()}
              onClick={() => setImportStatus(props.onImport(importText))}
            >
              Import as a new layout
            </button>
            {importStatus && <span className="builder-panel__status">{importStatus}</span>}
          </div>
        </SubCategory>
      </CategorySection>

      {/* ---------------------------- stage frames ---------------------------- */}
      <CategorySection
        title="Stage frames"
        defaultOpen={false}
        hint="Arm frame-moving, then drag the medallions and the corner clusters on the stage itself. They snap to the center lines and to each other — hold Alt while dragging to move free. The chat panel carries its own anchor and reset on its rail."
      >
        <button
          type="button"
          className="builder-panel__button"
          aria-pressed={props.framesArmed}
          onClick={props.onToggleFramesArmed}
        >
          <Anchor aria-hidden="true" /> {props.framesArmed ? "Frame-moving is ON" : "Move frames"}
        </button>
        <ul className="builder-panel__frames">
          {STAGE_FRAMES.map((def) => {
            const offset = frameOffset(props.frames, def.id);
            return (
              <li key={def.id} className="builder-panel__frame">
                <span className="builder-panel__frame-name">{def.name}</span>
                <span className="builder-panel__frame-offset">
                  {def.selfManaged
                    ? "its own mover"
                    : offset.dx === 0 && offset.dy === 0
                      ? "home spot"
                      : `${offset.dx}, ${offset.dy}`}
                </span>
                {!def.selfManaged && (
                  <button
                    type="button"
                    className="builder-panel__button"
                    onClick={() => props.onResetFrame(def.id)}
                    aria-label={`Reset ${def.name} to its home spot`}
                  >
                    <RotateCcw aria-hidden="true" /> Reset
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <button type="button" className="builder-panel__button" onClick={props.onResetAllFrames}>
          <RotateCcw aria-hidden="true" /> Reset every frame
        </button>
      </CategorySection>

      {/* Placed pieces list — a text way back to any piece. */}
      {room.items.length > 0 && (
        <CategorySection title={`In the room (${room.items.length})`} defaultOpen={false}>
          <ul className="builder-panel__frames">
            {room.items.map((item) => (
              <li key={item.id} className="builder-panel__frame">
                <button
                  type="button"
                  className="builder-panel__frame-pick"
                  onClick={() => props.onSelectItem(item.id)}
                  aria-pressed={item.id === selectedId}
                >
                  {libraryItem(item.baseId)?.name ?? item.baseId}
                  {item.anchored ? " · anchored" : ""}
                </button>
              </li>
            ))}
          </ul>
        </CategorySection>
      )}
    </div>
  );
}

function BackdropPicker({
  label,
  assets,
  picked,
  onPick,
}: {
  label: string;
  assets: readonly BackdropAsset[];
  picked: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="builder-panel__field">
      <span>{label}</span>
      <div className="builder-panel__backdrops" role="group" aria-label={label}>
        {assets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            className={`builder-panel__backdrop${picked === asset.id ? " is-picked" : ""}`}
            onClick={() => onPick(asset.id)}
            aria-pressed={picked === asset.id}
            title={asset.name}
          >
            <img src={asset.src} alt="" loading="lazy" />
            <span>{asset.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
