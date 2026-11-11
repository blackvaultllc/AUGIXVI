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
import { Minus, X, Square } from "lucide-react";

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
}: {
  id: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  accent?: string;
}) {
  const saved = useRef(loadGeometry(id)).current;
  const [position, setPosition] = useState(() => ({
    x: saved?.x ?? 120,
    y: saved?.y ?? 90,
  }));
  const [size, setSize] = useState({
    w: saved?.w ?? initialWidth,
    h: saved?.h ?? initialHeight,
  });
  const [minimized, setMinimized] = useState(saved?.minimized ?? false);
  const drag = useRef<{ mode: "move" | "resize"; dx: number; dy: number } | null>(null);
  const winRef = useRef<HTMLElement>(null);

  useEffect(() => {
    saveGeometry(id, { ...position, ...size, minimized });
  }, [id, position, size, minimized]);

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
      setSize((current) => ({
        w: Math.max(
          260,
          event.clientX + d.dx - (winRef.current?.getBoundingClientRect().left ?? 0),
        ),
        h: Math.max(140, event.clientY + d.dy - (winRef.current?.getBoundingClientRect().top ?? 0)),
      }));
    }
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section
      ref={winRef}
      className={`floating-window${minimized ? " floating-window--minimized" : ""}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.w,
        height: minimized ? undefined : size.h,
      }}
      aria-label={title}
    >
      <header
        className="floating-window__bar"
        onPointerDown={startDrag("move")}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => setMinimized((m) => !m)}
      >
        <span className="floating-window__title" style={{ color: accent }}>
          {title}
        </span>
        <span className="floating-window__buttons">
          <button
            type="button"
            className="floating-window__button"
            onClick={() => setMinimized((m) => !m)}
            aria-label={minimized ? `Restore ${title}` : `Minimize ${title}`}
          >
            {minimized ? <Square aria-hidden="true" /> : <Minus aria-hidden="true" />}
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
