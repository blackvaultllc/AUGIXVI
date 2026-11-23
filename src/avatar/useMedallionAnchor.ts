/**
 * THE MEDALLION ANCHOR, as a hook (owner order 2026-11-22): every
 * stage presence medallion is grabbable, movable, and stretchable
 * under his anchor law, on this one system (the plain-data half is
 * medallionAnchor.ts).
 *
 * - GRAB: press the medallion and drag — it lifts (the lifted state)
 *   and follows the hand; release sets it down anchored at the drop
 *   point, and the placement is saved.
 * - SIZE: set from the medallion's box menu (owner eye-check
 *   2026-11-23 — the stretch tab drawn on the circle is gone; the
 *   circle stays clean). setSize below is the menu's one door.
 * - TAP: a press that does not travel still counts as a tap — the
 *   wrapped select handler fires the medallion's own action (taking
 *   the perspective), while a real drag's trailing click is eaten so
 *   moving a medallion never also triggers it.
 * - BOUNDS: geometry is clamped into the stage on load, on drag, on
 *   stretch, and when the stage itself resizes.
 *
 * THE LOCKED SEAT (owner eye-check 2026-11-23 ~06:51 EST — the
 * `lockedSeat` option, Anubis only): "I don't want to move it
 * around anymore — even if it's anchored it still lets me click
 * and move it, that's stupid. Anubis needs to stay centered,
 * anchored, nobody can move him around — unless I have an emergency
 * edit I have to do." A locked-seat medallion:
 * - does not drag — the grab is never begun, so the grab-to-move
 *   path the other medallions live by does not exist for it;
 * - sits at its centered factory home (medallionAnchor refuses its
 *   saved record), and re-centers on stage resize — centered is a
 *   standing state, not a one-time placement;
 * - heals its saved record to the centered seat on mount, so a
 *   stale off-center record from before the lock-down is reset;
 * - moves ONLY inside an EMERGENCY EDIT session the Captain
 *   explicitly opens (enterEmergencyEdit — session-only, never
 *   persisted, so every load starts locked). Closing the session
 *   (exitEmergencyEdit) re-seats him centered at his big home and
 *   saves that seat: the lock restores the seat, always.
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
  defaultMedallionGeometry,
  loadOrDefaultMedallionGeometry,
  registerMedallionGeometry,
  registeredMedallionGeometry,
  saveMedallionGeometry,
  unregisterMedallionGeometry,
  type MedallionGeometry,
} from "./medallionAnchor";

/** Press travel (px) beyond which a press is a drag, not a tap. */
const TAP_TRAVEL = 4;

/**
 * THE RESPECT ASK (owner order 2026-11-23 ~07:22 EST): "these are
 * my gods — if somebody tries to use the AI and touch the face
 * too much, the gods will out of respect ask the person please…
 * the Egyptian understanding and culture of respect in the
 * system." Repeated handling of a god's face — presses and drag
 * starts landing in a rush — crosses this threshold ONCE per
 * session per god, and the god asks, politely and once, not to
 * be handled. No nagging: the ask is spent for the session.
 */
export const RESPECT_POKE_THRESHOLD = 5;
/** The window the pokes must land inside to count as handling, ms. */
export const RESPECT_POKE_WINDOW_MS = 4000;
/** Gods who have already asked this session — spent asks. */
const respectAsked = new Set<string>();
/** Test support: a fresh session for the respect doctrine. */
export function clearRespectAsks() {
  respectAsked.clear();
}

function stageWidth(): number {
  return typeof window === "undefined" ? 0 : window.innerWidth;
}
function stageHeight(): number {
  return typeof window === "undefined" ? 0 : window.innerHeight;
}

export function useMedallionAnchor(
  id: string,
  options?: { lockedSeat?: boolean; onRespectAsk?: (() => void) | undefined },
) {
  const lockedSeat = options?.lockedSeat ?? false;
  const respectAskRef = useRef(options?.onRespectAsk);
  respectAskRef.current = options?.onRespectAsk;
  /** Press timestamps inside the respect window — the handling count. */
  const pokesRef = useRef<number[]>([]);
  const [geometry, setGeometry] = useState<MedallionGeometry>(() =>
    loadOrDefaultMedallionGeometry(id, stageWidth(), stageHeight()),
  );
  const [lifted, setLifted] = useState(false);
  /**
   * EMERGENCY EDIT (the lock-down's one door): session-only —
   * every load starts locked, and the state is never written to
   * storage. Only meaningful for a locked seat.
   */
  const [emergencyEdit, setEmergencyEdit] = useState(false);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  const movableRef = useRef(!lockedSeat);
  movableRef.current = !lockedSeat || emergencyEdit;
  const emergencyEditRef = useRef(emergencyEdit);
  emergencyEditRef.current = emergencyEdit;
  const drag = useRef<{
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

  // THE RECORD HEALS TO THE SEAT (the lock-down): while a locked
  // seat stands locked, its saved record IS the centered seat —
  // a stale off-center record from before the lock-down is reset
  // the first time the stage opens, and an emergency edit that
  // ends (exit re-seats + saves) leaves the same truth behind.
  useEffect(() => {
    if (!lockedSeat || emergencyEdit) return;
    saveMedallionGeometry(
      id,
      defaultMedallionGeometry(id, stageWidth(), stageHeight()),
    );
  }, [id, lockedSeat, emergencyEdit]);

  // The stage shrank (rotation, split screen, a smaller pane): pull
  // the medallion back inside the bounds instead of leaving it
  // stranded off the edge. A LOCKED seat does more than clamp: it
  // re-derives its centered home, so centered survives the resize
  // (unless an emergency edit is live — then the edit's geometry
  // is only clamped, like any medallion's).
  useEffect(() => {
    const onResize = () =>
      setGeometry((current) =>
        lockedSeat && !emergencyEditRef.current
          ? defaultMedallionGeometry(id, window.innerWidth, window.innerHeight)
          : clampMedallionGeometry(current, window.innerWidth, window.innerHeight),
      );
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [id, lockedSeat]);

  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if ("button" in event && event.button !== 0) return false;
    // THE RESPECT COUNT (the doctrine, above): every press on the
    // face counts — drags included, locked or not — because the
    // handling is the handling whether the seat moves or not. The
    // menu's own buttons never reach this handler (the root press
    // routes around them), so opening the menu is never a poke.
    // Past the threshold, once per session, the god asks.
    const now = Date.now();
    pokesRef.current = [
      ...pokesRef.current.filter((at) => now - at < RESPECT_POKE_WINDOW_MS),
      now,
    ];
    if (pokesRef.current.length >= RESPECT_POKE_THRESHOLD && !respectAsked.has(id)) {
      respectAsked.add(id);
      pokesRef.current = [];
      respectAskRef.current?.();
    }
    // THE LOCKED SEAT DOES NOT DRAG (the lock-down): the grab is
    // never begun — no lift, no follow, no saved drop. Last round's
    // grab-unanchors-in-place law is for the free medallions; for
    // Anubis there is no grab at all outside an emergency edit.
    if (!movableRef.current) return false;
    // A fresh press clears any stale suppression — the flag only ever
    // eats the one click that trails THIS drag.
    suppressClick.current = false;
    drag.current = {
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
    // A press on one of the medallion's own buttons (the menu, the
    // head/body view switch) keeps its click — a captured pointer
    // would retarget the click to the medallion and the button
    // would never receive it (the same rule the windows follow).
    if ((event.target as HTMLElement).closest?.("[data-medallion-menu]")) return;
    if ((event.target as HTMLElement).closest?.("button")) return;
    beginDrag(event);
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
    beginDrag(event);
  }, []);

  /**
   * ONE-CLICK CENTER (owner order 2026-11-22): the medallion goes
   * dead-center at the size it wears — no pixel-hunting. Another
   * face never lands on the Captain's: his registered geometry is
   * the obstacle the centering clears (centeredMedallionGeometry).
   */
  const center = useCallback(() => {
    if (!movableRef.current) return;
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

  /**
   * SET THE SIZE FROM THE MENU (owner eye-check 2026-11-23): the
   * yellow stretch tab drawn on the circle is GONE — "It needs to
   * be a nice clean circle." Sizing now lives in the medallion's
   * box menu (Smaller / Bigger), through this one door: clamp into
   * the stage, keep the medallion's center where it was, save.
   */
  const setSize = useCallback(
    (size: number) => {
      if (!movableRef.current) return;
      const current = geometryRef.current;
      const next = clampMedallionGeometry(
        {
          x: current.x + (current.size - size) / 2,
          y: current.y + (current.size - size) / 2,
          size,
        },
        stageWidth(),
        stageHeight(),
      );
      setGeometry(next);
      saveMedallionGeometry(id, next);
    },
    [id],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active) return;
    // In his hand, the pointer moves the medallion — it never
    // starts or extends a text selection (owner defect 2026-11-22).
    event.preventDefault();
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (Math.abs(dx) + Math.abs(dy) > TAP_TRAVEL) active.moved = true;
    setGeometry(
      clampMedallionGeometry(
        { ...active.geometry, x: active.geometry.x + dx, y: active.geometry.y + dy },
        window.innerWidth,
        window.innerHeight,
      ),
    );
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

  /**
   * EMERGENCY EDIT — OPEN (the lock-down's deliberate unlock): the
   * Captain turns it on himself, from the medallion's menu, when
   * he has an emergency edit to do. While it is on, the locked
   * seat drags, centers, and sizes like any medallion. It is
   * session-only: a reload starts locked again.
   */
  const enterEmergencyEdit = useCallback(() => {
    if (!lockedSeat) return;
    setEmergencyEdit(true);
  }, [lockedSeat]);

  /**
   * EMERGENCY EDIT — CLOSE: turning it off RE-SEATS HIM CENTERED
   * (his order: "I need him to be centered") at his big factory
   * home, and that seat is what gets saved. Whatever the edit
   * moved, the lock restores the seat.
   */
  const exitEmergencyEdit = useCallback(() => {
    if (!lockedSeat) return;
    const seat = defaultMedallionGeometry(id, stageWidth(), stageHeight());
    setGeometry(seat);
    saveMedallionGeometry(id, seat);
    setEmergencyEdit(false);
  }, [id, lockedSeat]);

  const rootStyle: CSSProperties = { left: geometry.x, top: geometry.y };
  const faceStyle: CSSProperties = { width: geometry.size, height: geometry.size };

  return {
    geometry,
    lifted,
    center,
    setSize,
    /** The locked seat's state (always false for free medallions). */
    emergencyEdit,
    enterEmergencyEdit,
    exitEmergencyEdit,
    /** False only for a locked seat outside an emergency edit. */
    movable: !lockedSeat || emergencyEdit,
    rootProps: {
      style: rootStyle,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
    faceStyle,
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
