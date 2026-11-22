/**
 * THE MEDALLION ANCHOR, as a hook (owner order 2026-11-22): every
 * stage presence medallion is grabbable, movable, and stretchable
 * under his anchor law, on this one system (the plain-data half is
 * medallionAnchor.ts).
 *
 * - GRAB: press the medallion and drag — it lifts (the lifted state)
 *   and follows the hand; release sets it down anchored at the drop
 *   point, and the placement is saved.
 * - STRETCH: the corner handle at the medallion's lower right drags
 *   its size; the size he leaves is saved with the placement.
 * - TAP: a press that does not travel still counts as a tap — the
 *   wrapped select handler fires the medallion's own action (taking
 *   the perspective), while a real drag's trailing click is eaten so
 *   moving a medallion never also triggers it.
 * - BOUNDS: geometry is clamped into the stage on load, on drag, on
 *   stretch, and when the stage itself resizes.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  OWNER_MEDALLION_ID,
  centeredMedallionGeometry,
  clampMedallionGeometry,
  loadOrDefaultMedallionGeometry,
  registerMedallionGeometry,
  registeredMedallionGeometry,
  saveMedallionGeometry,
  unregisterMedallionGeometry,
  type MedallionGeometry,
} from "./medallionAnchor";

/** Press travel (px) beyond which a press is a drag, not a tap. */
const TAP_TRAVEL = 4;

function stageWidth(): number {
  return typeof window === "undefined" ? 0 : window.innerWidth;
}
function stageHeight(): number {
  return typeof window === "undefined" ? 0 : window.innerHeight;
}

export function useMedallionAnchor(id: string) {
  const [geometry, setGeometry] = useState<MedallionGeometry>(() =>
    loadOrDefaultMedallionGeometry(id, stageWidth(), stageHeight()),
  );
  const [lifted, setLifted] = useState(false);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  const drag = useRef<{
    mode: "move" | "stretch";
    startX: number;
    startY: number;
    geometry: MedallionGeometry;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  // Keep the live registry current: the center action consults it
  // so no medallion is ever centered onto the Captain's face.
  useEffect(() => {
    registerMedallionGeometry(id, geometry);
    return () => unregisterMedallionGeometry(id);
  }, [id, geometry]);

  // The stage shrank (rotation, split screen, a smaller pane): pull
  // the medallion back inside the bounds instead of leaving it
  // stranded off the edge.
  useEffect(() => {
    const onResize = () =>
      setGeometry((current) =>
        clampMedallionGeometry(current, window.innerWidth, window.innerHeight),
      );
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const beginDrag = (
    mode: "move" | "stretch",
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if ("button" in event && event.button !== 0) return false;
    // A fresh press clears any stale suppression — the flag only ever
    // eats the one click that trails THIS drag.
    suppressClick.current = false;
    drag.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      geometry: geometryRef.current,
      moved: false,
    };
    setLifted(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // capture is a nicety; the drag still tracks inside the element
    }
    return true;
  };

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    // The stretch handle runs its own drag; the medallion's press
    // never starts a move from the handle. A press on one of the
    // medallion's own buttons (the head/body view switch) keeps its
    // click too — a captured pointer would retarget the click to
    // the medallion and the button would never receive it (the same
    // rule the windows follow).
    if ((event.target as HTMLElement).closest?.("[data-medallion-stretch]")) return;
    if ((event.target as HTMLElement).closest?.("button")) return;
    beginDrag("move", event);
  }, []);

  const onStretchPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    beginDrag("stretch", event);
  }, []);

  /**
   * THE MOVE HANDLE (owner order 2026-11-22): a labeled button ON
   * the medallion that IS the drag — press it and drag, the face
   * follows the hand. Moving an avatar is no longer a gesture he
   * has to guess at; the handle says "Move" in plain words and the
   * medallion's state chip says whether it sits anchored or free in
   * his hand.
   */
  const onMoveHandlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    beginDrag("move", event);
  }, []);

  /**
   * ONE-CLICK CENTER (owner order 2026-11-22): the medallion goes
   * dead-center at the size it wears — no pixel-hunting. Another
   * face never lands on the Captain's: his registered geometry is
   * the obstacle the centering clears (centeredMedallionGeometry).
   */
  const center = useCallback(() => {
    const avoid =
      id === OWNER_MEDALLION_ID ? null : registeredMedallionGeometry(OWNER_MEDALLION_ID);
    const next = centeredMedallionGeometry(
      geometryRef.current,
      stageWidth(),
      stageHeight(),
      avoid,
    );
    setGeometry(next);
    saveMedallionGeometry(id, next);
  }, [id]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active) return;
    // In his hand, the pointer moves the medallion — it never
    // starts or extends a text selection (owner defect 2026-11-22).
    event.preventDefault();
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (Math.abs(dx) + Math.abs(dy) > TAP_TRAVEL) active.moved = true;
    if (active.mode === "move") {
      setGeometry(
        clampMedallionGeometry(
          { ...active.geometry, x: active.geometry.x + dx, y: active.geometry.y + dy },
          window.innerWidth,
          window.innerHeight,
        ),
      );
    } else {
      // Stretch from the lower-right corner: the larger axis rules,
      // so a drag in any outward direction grows the face evenly.
      const delta = Math.max(dx, dy);
      setGeometry(
        clampMedallionGeometry(
          { ...active.geometry, size: active.geometry.size + delta },
          window.innerWidth,
          window.innerHeight,
        ),
      );
    }
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    setLifted(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
    if (active.moved) {
      // A drag is not a tap: eat the click that trails it, and save
      // where the medallion was set down.
      suppressClick.current = true;
      saveMedallionGeometry(id, geometryRef.current);
    }
  }, [id]);

  /** Wrap the medallion's tap action so a drag never fires it. */
  const wrapSelect = useCallback(
    (select?: () => void) =>
      (_event: ReactMouseEvent<HTMLElement>) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        select?.();
      },
    [],
  );

  const rootStyle: CSSProperties = { left: geometry.x, top: geometry.y };
  const faceStyle: CSSProperties = { width: geometry.size, height: geometry.size };

  return {
    geometry,
    lifted,
    center,
    rootProps: {
      style: rootStyle,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
    faceStyle,
    stretchProps: {
      "data-medallion-stretch": "true",
      onPointerDown: onStretchPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
    moveHandleProps: {
      "data-medallion-move": "true",
      onPointerDown: onMoveHandlePointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
    /**
     * For the Move button's click: consumes a drag's suppression
     * flag exactly like a click on the medallion itself would, so a
     * drag that started on the handle never leaks its eaten click
     * into the next genuine tap — and a plain tap on Move selects
     * nothing.
     */
    eatClick: wrapSelect(),
    wrapSelect,
  };
}
