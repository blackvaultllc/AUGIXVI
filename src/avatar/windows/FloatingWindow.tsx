/**
 * FLOATING WINDOW SYSTEM (owner order 2026-11-11).
 * One base for every panel: movable (drag the title bar), resizable
 * (corner grip), closable and minimizable. Position and size persist in
 * localStorage per window id. Operator-only — rendered inside the signed-in
 * stage, never exposed publicly.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import {
  WINDOW_MARGIN,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
  clampWindowPosition,
  clampWindowSize,
} from "./windowGeometry";

type SavedGeometry = { x: number; y: number; w: number; h: number; minimized: boolean };

const GEOMETRY_PREFIX = "augi.window.";

function loadGeometry(id: string): SavedGeometry | null {
  try {
    const raw = globalThis.localStorage?.getItem(GEOMETRY_PREFIX + id);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { x?: unknown })["x"] === "number" &&
      typeof (parsed as { y?: unknown })["y"] === "number"
    ) {
      const g = parsed as Partial<SavedGeometry>;
      return {
        x: g.x as number,
        y: g.y as number,
        w: typeof g.w === "number" ? g.w : 420,
        h: typeof g.h === "number" ? g.h : 320,
        minimized: g.minimized === true,
      };
    }
  } catch {
    // fall through
  }
  return null;
}

function saveGeometry(id: string, geometry: SavedGeometry) {
  try {
    globalThis.localStorage?.setItem(GEOMETRY_PREFIX + id, JSON.stringify(geometry));
  } catch {
    // best effort
  }
}

export function FloatingWindow({
  id,
  title,
  onClose,
  children,
  initialWidth = 420,
  initialHeight = 320,
  accent = "var(--avatar-hud-accent, #22d3ee)",
  fitContentHeight = false,
}: {
  id: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  accent?: string;
  /**
   * NO EMPTY GAPS (owner law, 2026-11-22 ~19:25 CST): "when
   * something opens and there's an open gap with nothing there —
   * get rid of it." A fit-content window carries NO fixed height:
   * it opens exactly as tall as its content, capped by the
   * viewport (the body scrolls past the cap). The persisted/dragged
   * height is ignored while this is on — the grip still sets the
   * width, and maximize still fills the screen on purpose.
   */
  fitContentHeight?: boolean;
}) {
  const saved = useRef(loadGeometry(id)).current;
  // Bounds (operator order 2026-11-21): saved geometry is never trusted
  // blindly — a size persisted on a big screen (or dragged huge) must
  // not reopen covering a smaller viewport. Clamp size and position to
  // the current viewport so the window always opens inside the stage
  // with clear margins; the clamped values are what get re-saved.
  const initialSize = clampWindowSize(
    saved?.w ?? initialWidth,
    saved?.h ?? initialHeight,
    window.innerWidth,
    window.innerHeight,
  );
  const initialPosition = clampWindowPosition(
    saved?.x ?? 120,
    saved?.y ?? 90,
    initialSize.w,
    initialSize.h,
    window.innerWidth,
    window.innerHeight,
  );
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState(initialSize);
  const [minimized, setMinimized] = useState(saved?.minimized ?? false);
  const [maximized, setMaximized] = useState(false);
  const drag = useRef<{ mode: "move" | "resize"; dx: number; dy: number } | null>(null);
  const winRef = useRef<HTMLElement>(null);

  useEffect(() => {
    saveGeometry(id, { ...position, ...size, minimized });
  }, [id, position, size, minimized]);

  // If the viewport itself shrinks (split screen, phone rotation, a
  // smaller browser pane), pull the window back inside the bounds
  // instead of leaving it covering the stage.
  useEffect(() => {
    const onViewportResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const nextSize = clampWindowSize(size.w, size.h, vw, vh);
      setSize(nextSize);
      setPosition((current) =>
        clampWindowPosition(current.x, current.y, nextSize.w, minimized ? 40 : nextSize.h, vw, vh),
      );
    };
    window.addEventListener("resize", onViewportResize);
    return () => window.removeEventListener("resize", onViewportResize);
  }, [size, minimized]);

  const clamp = useCallback(
    (x: number, y: number) => {
      const rect = winRef.current?.getBoundingClientRect();
      const w = rect?.width ?? size.w;
      const h = minimized ? 40 : (rect?.height ?? size.h);
      return {
        x: Math.min(Math.max(x, 4), Math.max(4, window.innerWidth - w - 4)),
        y: Math.min(Math.max(y, 4), Math.max(4, window.innerHeight - h - 4)),
      };
    },
    [minimized, size.h, size.w],
  );

  const startDrag = (mode: "move" | "resize") => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    // The bar's own buttons (minimize / maximize / close) keep their clicks:
    // starting a drag here captures the pointer to the bar, and a captured
    // pointer retargets the click to the bar — the button never receives
    // it, so pressing X appeared to resize the window instead of closing
    // it. Dragging starts from the bar itself, never from its buttons.
    if ((event.target as HTMLElement).closest?.("button")) return;
    const rect = event.currentTarget.closest(".floating-window")?.getBoundingClientRect();
    if (!rect) return;
    drag.current =
      mode === "move"
        ? { mode, dx: event.clientX - rect.left, dy: event.clientY - rect.top }
        : { mode, dx: rect.right - event.clientX, dy: rect.bottom - event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onMove = (event: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "move") {
      setPosition(clamp(event.clientX - d.dx, event.clientY - d.dy));
    } else {
      // Resize can grow the window only into the space left before the
      // viewport edge (minus the margin) — never past it, so a resize
      // can no longer make a window swallow the whole screen.
      const rect = winRef.current?.getBoundingClientRect();
      const left = rect?.left ?? 0;
      const top = rect?.top ?? 0;
      setSize((current) => ({
        w: Math.min(
          Math.max(WINDOW_MIN_WIDTH, event.clientX + d.dx - left),
          Math.max(WINDOW_MIN_WIDTH, window.innerWidth - left - WINDOW_MARGIN),
        ),
        h: Math.min(
          Math.max(WINDOW_MIN_HEIGHT, event.clientY + d.dy - top),
          Math.max(WINDOW_MIN_HEIGHT, window.innerHeight - top - WINDOW_MARGIN),
        ),
      }));
    }
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  // Restoring from minimized brings the full height back: pull the
  // window inside the bounds first — while minimized it may sit at the
  // very bottom, where the full window would spill off-screen.
  const toggleMinimized = () => {
    if (minimized) {
      setPosition((current) =>
        clampWindowPosition(
          current.x,
          current.y,
          size.w,
          size.h,
          window.innerWidth,
          window.innerHeight,
        ),
      );
    }
    setMinimized((m) => !m);
  };

  // THREE BUTTONS, THREE JOBS: X closes, maximize/restore fills the screen,
  // minus minimizes to the title bar.
  const maximizedStyle = maximized
    ? {
        left: 8,
        top: 8,
        width: window.innerWidth - 16,
        height: window.innerHeight - 16,
      }
    : undefined;

  return (
    <section
      ref={winRef}
      className={`floating-window${minimized ? " floating-window--minimized" : ""}${maximized ? " floating-window--maximized" : ""}`}
      style={
        maximized
          ? maximizedStyle
          : fitContentHeight && !minimized
            ? {
                left: position.x,
                top: position.y,
                width: size.w,
                maxHeight: "calc(100dvh - 16px)",
              }
            : {
                left: position.x,
                top: position.y,
                width: size.w,
                height: minimized ? undefined : size.h,
              }
      }
      aria-label={title}
    >
      <header
        className="floating-window__bar"
        onPointerDown={startDrag("move")}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={toggleMinimized}
      >
        <span className="floating-window__title" style={{ color: accent }}>
          {title}
        </span>
        <span className="floating-window__buttons">
          <button
            type="button"
            className="floating-window__button"
            onClick={() => {
              setMaximized(false);
              toggleMinimized();
            }}
            aria-label={minimized ? `Restore ${title}` : `Minimize ${title}`}
          >
            <Minus aria-hidden="true" />
          </button>
          <button
            type="button"
            className="floating-window__button"
            onClick={() => {
              setMinimized(false);
              setMaximized((m) => !m);
            }}
            aria-label={maximized ? `Restore ${title} size` : `Maximize ${title}`}
          >
            {maximized ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="floating-window__button"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            <X aria-hidden="true" />
          </button>
        </span>
      </header>
      {!minimized && <div className="floating-window__body">{children}</div>}
      {!minimized && (
        <div
          className="floating-window__grip"
          onPointerDown={startDrag("resize")}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-hidden="true"
        />
      )}
    </section>
  );
}
