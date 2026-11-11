/**
 * MOM'S BLUE ATTACK BOX — the container only (owner order).
 * The classic blue battle-menu box: black panel, double cyan border, gold
 * command rows — Attack / Items / Magic / Run. THE FIX: subcategories pop
 * out INSIDE the same box, inline, until an answer is selected — never a
 * whole new screen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

export type BattleCommandId = "attack" | "magic" | "items" | "run";

export type BattleChoice = {
  id: string;
  label: string;
  /** Optional inline submenu — opens INSIDE the box, not a new screen. */
  children?: BattleChoice[];
};

export type BattleTurn = { command: BattleCommandId | "chosen"; label: string; outcome: string };

export const TOP_LEVEL: BattleChoice[] = [
  {
    id: "attack",
    label: "Attack",
    children: [
      { id: "strike", label: "Strike" },
      { id: "flurry", label: "Flurry" },
      { id: "guard-break", label: "Guard Break" },
    ],
  },
  {
    id: "magic",
    label: "Magic",
    children: [
      { id: "fire", label: "Fire" },
      { id: "blizzard", label: "Blizzard" },
      { id: "cure", label: "Cure" },
    ],
  },
  {
    id: "items",
    label: "Items",
    children: [
      { id: "potion", label: "Potion" },
      { id: "ether", label: "Ether" },
      { id: "phoenix-down", label: "Phoenix Down" },
    ],
  },
  { id: "run", label: "Run" },
];

/** The chosen answer + a one-line outcome — pure logic for tests. */
export function resolveChoice(command: BattleCommandId | "chosen", id?: string): string {
  switch (id) {
    case "strike":
      return "You strike true — solid hit.";
    case "flurry":
      return "A flurry of blows lands.";
    case "guard-break":
      return "Their guard shatters.";
    case "fire":
      return "Fire burns for heavy damage.";
    case "blizzard":
      return "Blizzard freezes them in place.";
    case "cure":
      return "Cure restores your strength.";
    case "potion":
      return "Potion — you feel better.";
    case "ether":
      return "Ether restores your focus.";
    case "phoenix-down":
      return "Phoenix Down — back on your feet.";
    case "run":
      return "You slip away safely.";
    default:
      return "The battle continues.";
  }
}

export function BattleBox({
  open,
  onClose,
  onTurn,
  foeName = "Shadow Beast",
}: {
  open: boolean;
  onClose: () => void;
  onTurn?: (turn: BattleTurn) => void;
  foeName?: string;
}) {
  const [trail, setTrail] = useState<BattleChoice[]>([]);
  const [cursor, setCursor] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  const level = trail.length === 0 ? TOP_LEVEL : (trail[trail.length - 1]?.children ?? []);
  const current = level[cursor] ?? level[0] ?? null;

  const reset = useCallback(() => {
    setTrail([]);
    setCursor(0);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const choose = useCallback(
    (choice: BattleChoice | null) => {
      if (!choice) return;
      if (choice.children?.length) {
        // SUBCATEGORIES OPEN INLINE — same box, deeper column. No new screen.
        setTrail((t) => [...t, choice]);
        setCursor(0);
        return;
      }
      const rawCommand = trail[0]?.id ?? choice.id;
      const commandId: BattleCommandId | "chosen" = (
        ["attack", "magic", "items", "run"].includes(rawCommand) ? rawCommand : "chosen"
      ) as BattleCommandId | "chosen";
      const outcome = resolveChoice(commandId, choice.id);
      setLog((l) => [`▸ ${choice.label}`, outcome, ...l].slice(0, 6));
      onTurn?.({ command: "chosen", label: choice.label, outcome });
      reset();
    },
    [onTurn, reset, trail],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((c) => (c + 1) % Math.max(1, level.length));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((c) => (c - 1 + level.length) % Math.max(1, level.length));
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        choose(current);
      } else if (event.key === "Backspace" || event.key === "Escape") {
        event.preventDefault();
        if (trail.length > 0) {
          setTrail((t) => t.slice(0, -1));
          setCursor(0);
        } else {
          onClose();
        }
      }
    },
    [choose, current, level.length, onClose, trail.length],
  );

  // Drag-to-move like every window.
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !boxRef.current) return;
    const vw = window.innerWidth;
    setPos({
      x: Math.min(Math.max(event.clientX - d.dx, 8), vw - (boxRef.current.offsetWidth ?? 300) - 8),
      y: Math.min(Math.max(event.clientY - d.dy, 8), window.innerHeight - 120),
    });
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (!open) return null;

  return (
    <div
      ref={boxRef}
      className="battle-box"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      tabIndex={0}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-label="Battle command box"
      data-testid="battle-box"
    >
      <div
        className="battle-box__bar"
        onPointerDown={startDrag}
        onPointerMove={onMove}
        onPointerUp={endDrag}
      >
        <span className="battle-box__foe">{foeName}</span>
        <button
          type="button"
          className="battle-box__close"
          onClick={onClose}
          aria-label="Close battle box"
        >
          ✕
        </button>
      </div>
      <div className="battle-box__columns">
        {/* Breadcrumb of opened inline submenus — leftmost first. */}
        {trail.map((crumb, i) => (
          <button
            key={crumb.id}
            type="button"
            className="battle-box__col battle-box__col--crumb"
            onClick={() => {
              setTrail((t) => t.slice(0, i + 1));
              setCursor(0);
            }}
          >
            {crumb.label}
          </button>
        ))}
        <ul className="battle-box__col" role="listbox" aria-label="Battle commands">
          {level.map((choice, index) => (
            <li key={choice.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === cursor}
                className={`battle-box__option${index === cursor ? " is-cursor" : ""}`}
                onMouseEnter={() => setCursor(index)}
                onClick={() => choose(choice)}
              >
                <span className="battle-box__cursor">{index === cursor ? "▶" : ""}</span>
                {choice.label}
                {choice.children?.length ? <span className="battle-box__arrow">»</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="battle-box__log" aria-live="polite">
        {log.length === 0 ? (
          <p className="battle-box__hint">Choose a command. Subcategories open inside this box.</p>
        ) : (
          log.map((line, i) => <p key={`${line}-${i}`}>{line}</p>)
        )}
      </div>
    </div>
  );
}
