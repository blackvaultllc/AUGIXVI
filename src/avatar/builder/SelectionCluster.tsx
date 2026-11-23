import { Check, Lock, LockOpen, Trash2 } from "lucide-react";
import { libraryItem } from "./library";
import type { RoomContent } from "./room";

/**
 * THE PICKED PIECE'S OWN CONTROLS (owner order 2026-11-23): he
 * placed a building, it sat on his stage, and he did not know how
 * to move it or take it away — the controls lived in a panel he
 * had to go find. Now the controls come to the piece: tap a
 * placed piece and this small cluster appears beside it — drag to
 * move (in words, on the cluster), turn it, anchor or unanchor
 * it, delete it, done. The anchor law is stated where it bites:
 * an anchored piece says it is locked, and the way to free it is
 * the button right there — never a silent refusal.
 */
export type BuilderSelectionClusterProps = {
  room: RoomContent;
  selectedId: string;
  /** Where the piece stands on the stage, in host pixels. */
  point: { x: number; y: number };
  onRotate: (id: string, rotation: number) => void;
  onToggleAnchor: (id: string, anchored: boolean) => void;
  onRemove: (id: string) => void;
  onDone: () => void;
};

export function BuilderSelectionCluster({
  room,
  selectedId,
  point,
  onRotate,
  onToggleAnchor,
  onRemove,
  onDone,
}: BuilderSelectionClusterProps) {
  const item = room.items.find((entry) => entry.id === selectedId);
  if (!item) return null;
  const base = libraryItem(item.baseId);
  return (
    <div
      className="builder-selection-cluster"
      style={{ left: point.x, top: point.y }}
      role="group"
      aria-label={`Controls for the ${base?.name ?? "piece"} you picked`}
    >
      <p className="builder-selection-cluster__name">
        {base?.name ?? item.baseId}
        {item.anchored ? " — anchored" : ""}
      </p>
      <p className="builder-selection-cluster__line">
        {item.anchored
          ? "Anchored — locked in place. Unanchor it to move it."
          : "Drag it on the stage to move it."}
      </p>
      <div className="builder-selection-cluster__row">
        <button
          type="button"
          className="builder-panel__button"
          onClick={() => onRotate(item.id, item.rotation - 45)}
          aria-label="Turn left"
        >
          ⟲ Turn
        </button>
        <button
          type="button"
          className="builder-panel__button"
          onClick={() => onRotate(item.id, item.rotation + 45)}
          aria-label="Turn right"
        >
          Turn ⟳
        </button>
        <button
          type="button"
          className="builder-panel__button"
          onClick={() => onToggleAnchor(item.id, !item.anchored)}
          aria-pressed={item.anchored}
        >
          {item.anchored ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}
          {item.anchored ? " Unanchor" : " Anchor"}
        </button>
        <button
          type="button"
          className="builder-panel__button builder-panel__button--danger"
          onClick={() => onRemove(item.id)}
        >
          <Trash2 aria-hidden="true" /> Delete
        </button>
        <button type="button" className="builder-panel__button" onClick={onDone}>
          <Check aria-hidden="true" /> Done
        </button>
      </div>
    </div>
  );
}
