import { useMemo, useState } from "react";
import { Anchor, Lock, LockOpen, Plus, RotateCcw, Trash2 } from "lucide-react";
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
  type LayoutStore,
  type PlacedItem,
  type RoomContent,
  type RoomSurfaces,
} from "./room";
import { BACKDROPS, type BackdropAsset } from "./backdrops";
import { STAGE_FRAMES, frameOffset, type FrameId, type FrameStore } from "./frames";

/**
 * THE ENVIRONMENT BUILDER PANEL (owner order 2026-11-22): the
 * Captain designs his own Room here. The library with its honest
 * variant math; click a piece (or drag it onto the stage) to place
 * it; click a placed piece on the stage to select it, drag it to
 * move it; anchor it to lock it; dress the room itself — backdrop
 * color, his theme pictures, floor and wall; keep named layouts
 * that save as you go; carry a finished room away as a data-only
 * package for his other sites.
 *
 * The panel is a dumb surface: AvatarStage owns the room state and
 * every callback lands there, so the same panel can be lifted onto
 * another page with its own state behind it (portability order).
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
};

const CATEGORIES = ["buildings", "nature", "park & street"] as const;

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
        Add a piece, then drag it on the stage to place it. Drag a piece straight from this list
        onto the room, if you like. Anchored pieces are locked until you unanchor them.
      </p>

      {/* ------------------------------ library ------------------------------ */}
      {CATEGORIES.map((category) => (
        <section key={category} className="builder-panel__section" aria-label={`Library — ${category}`}>
          <h3>{category}</h3>
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
        </section>
      ))}

      {/* --------------------------- selected piece --------------------------- */}
      <section className="builder-panel__section" aria-label="Selected piece">
        <h3>Selected piece</h3>
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
      </section>

      {/* ------------------------------ the room ------------------------------ */}
      <section className="builder-panel__section" aria-label="The room itself">
        <h3>The room itself</h3>
        <div className="builder-panel__colors">
          {(
            [
              ["backdrop", "Backdrop color"],
              ["floor", "Floor color"],
              ["wall", "Wall color"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="builder-panel__field">
              <span>{label}</span>
              <input
                type="color"
                value={room.surfaces[key]}
                onChange={(event) => surface({ [key]: event.target.value })}
                aria-label={label}
              />
            </label>
          ))}
        </div>
        <p className="builder-panel__hint">
          A backdrop picture hangs on the back wall, fitted to cover — never stretched — under a
          quiet veil of the backdrop color, so the interface always reads first.
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
          <button
            type="button"
            className="builder-panel__button"
            onClick={() => surface({ backdropImage: null })}
          >
            No picture — plain backdrop color
          </button>
        )}
      </section>

      {/* ------------------------------ layouts ------------------------------ */}
      <section className="builder-panel__section" aria-label="Saved layouts">
        <h3>Saved layouts — saved as you go</h3>
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
      </section>

      {/* ---------------------------- stage frames ---------------------------- */}
      <section className="builder-panel__section" aria-label="Stage frames">
        <h3>Stage frames</h3>
        <p className="builder-panel__hint">
          Arm frame-moving, then drag the medallions and the corner clusters on the stage itself.
          They snap to the center lines and to each other — hold Alt while dragging to move free.
          The chat panel carries its own anchor and reset on its rail.
        </p>
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
      </section>

      {/* Placed pieces list — a text way back to any piece. */}
      {room.items.length > 0 && (
        <section className="builder-panel__section" aria-label="Pieces in the room">
          <h3>In the room ({room.items.length})</h3>
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
        </section>
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
