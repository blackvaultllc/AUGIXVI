/**
 * THE MEDALLION'S BOX MENU (owner eye-check 2026-11-22 ~19:40 EST).
 *
 * His order, from his own screen: "I don't need those options
 * always there — the move center anchor — they don't need to be
 * there, they can be inside the box menu. I just want face there.
 * I don't need to see his name, I know his name."
 *
 * So the medallion on the stage is the FACE ALONE — no name plate,
 * no controls row standing under it. The controls live here: one
 * small menu button at the face's top-right corner opens the box
 * menu, and inside it sit the same Move handle, Center button, and
 * anchor-state chip the medallion always carried (MedallionControls)
 * — reachable in one tap, invisible the rest of the time. The menu
 * closes on an outside press or Escape.
 */
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { MoreHorizontal } from "lucide-react";
import { MedallionControls } from "./MedallionControls";

export function MedallionMenu({
  name,
  lifted,
  moveHandleProps,
  eatClick,
  onCenter,
  size,
  onSizeChange,
  children,
}: {
  /** The medallion's display name, for the menu's labels. */
  name: string;
  lifted: boolean;
  moveHandleProps: {
    "data-medallion-move": string;
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  };
  eatClick: (event: ReactMouseEvent<HTMLElement>) => void;
  onCenter: () => void;
  /** The face's current diameter (px) — the size row's readout. */
  size?: number;
  /** Step the face's size — the menu's Smaller / Bigger buttons. */
  onSizeChange?: (size: number) => void;
  /** Extra rows for the menu (the head/body view switch, when a
   *  medallion's binding carries body artwork). */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // The menu folds away when he presses anywhere else or hits
  // Escape — it is a tool he opens, never furniture on the face.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  return (
    <div className="medallion-menu" data-medallion-menu ref={rootRef}>
      <button
        type="button"
        className="medallion-menu__button"
        aria-label={`Open ${name}'s menu`}
        aria-expanded={open}
        title={`${name}'s menu — move, center, anchor`}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <MoreHorizontal aria-hidden="true" size={15} />
      </button>
      {open && (
        <div
          className="medallion-menu__panel"
          role="group"
          aria-label={`${name}'s controls`}
          onClick={(event) => event.stopPropagation()}
        >
          <MedallionControls
            name={name}
            lifted={lifted}
            moveHandleProps={moveHandleProps}
            eatClick={eatClick}
            onCenter={onCenter}
          />
          {/* SIZE LIVES HERE NOW (owner eye-check 2026-11-23):
              the stretch tab drawn on the circle is gone — the
              circle stays clean — and the face's size is set from
              this row instead, in plain steps. */}
          {size !== undefined && onSizeChange && (
            <div className="medallion-menu__size" role="group" aria-label={`${name}'s size`}>
              <button
                type="button"
                className="medallion-menu__size-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSizeChange(size - 40);
                }}
                aria-label={`Make ${name} smaller`}
              >
                Smaller
              </button>
              <span className="medallion-menu__size-readout">{Math.round(size)}px</span>
              <button
                type="button"
                className="medallion-menu__size-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSizeChange(size + 40);
                }}
                aria-label={`Make ${name} bigger`}
              >
                Bigger
              </button>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
