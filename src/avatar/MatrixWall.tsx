/**
 * THE MATRIX WALL — the canvas half (phone fix pass, owner
 * orders 2026-11-27): the boxed room of gold binary rain that
 * stands as the construct's background — back wall, floor,
 * ceiling, left and right, each face's streams running their
 * own direction, all of it LIVE and MOVING at the working
 * speed. The model (planes, tuning, drops) lives in
 * matrixWall.ts; this file only paints it.
 *
 * The room is real 3D placement, cheaply: five flat canvases
 * folded by CSS transforms inside a perspective frame — no
 * WebGL, no library, nothing for a modest phone to choke on.
 * Each canvas paints at devicePixelRatio 1, steps on the
 * model's fixed clock, and the whole room pauses when it is
 * off-screen, when the page is hidden, or when the visitor
 * asked for reduced motion (then it stands as one still frame
 * of the rain — the wall, at rest).
 *
 * Pure dress: aria-hidden, pointer-events none. It carries no
 * reading and stands behind everything on the surface it
 * serves (the stage passes variant="stage"; the agents' own
 * pages pass variant="page" and their seat's role — ONE
 * INTERFACE FOR ALL, his order: the same wall everywhere).
 */
import { useEffect, useRef } from "react";
import {
  LANDING_WALL_SPEED,
  LANDING_WEAVE_MESSAGE,
  MATRIX_PLANES,
  MATRIX_ROLE_TUNING,
  MATRIX_WALL_STEP_MS,
  createWovenGlyphSource,
  matrixPlaneColumns,
  newMatrixDrop,
  stepMatrixDrops,
  type MatrixPlaneId,
  type MatrixWallRole,
} from "./matrixWall";
import "./phone-fix-pass.css";

const CELL_PX = 18;

function paintPlane(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  drops: ReturnType<typeof newMatrixDrop>[],
  role: MatrixWallRole,
) {
  const tuning = MATRIX_ROLE_TUNING[role];
  const rows = Math.ceil(height / CELL_PX);
  ctx.fillStyle = "#050403";
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${CELL_PX - 3}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  drops.forEach((drop, column) => {
    const x = column * CELL_PX + CELL_PX / 2;
    for (let offset = 0; offset < drop.glyphs.length; offset++) {
      const row = drop.head - offset;
      if (row < 0 || row > rows) continue;
      const fade = 1 - offset / drop.glyphs.length;
      ctx.globalAlpha = offset === 0 ? 1 : 0.25 + 0.65 * fade;
      ctx.fillStyle = offset === 0 ? tuning.headColor : tuning.trailColor;
      ctx.fillText(drop.glyphs[offset]!, x, row * CELL_PX);
    }
  });
  ctx.globalAlpha = 1;
}

function useRainCanvas(
  plane: MatrixPlaneId,
  role: MatrixWallRole,
  roomRef: React.RefObject<HTMLDivElement | null>,
  glyphSource: ((length: number) => string) | undefined,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const room = roomRef.current;
    if (!canvas || !room) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      ctx = null; // a canvas that cannot hand out a context simply never rains
    }
    if (!ctx) return;
    const tuning = MATRIX_ROLE_TUNING[role];
    // The woven landing rain runs at the landing pace — fast,
    // like rain and water drops (owner order 2026-11-27).
    const stepMs = MATRIX_WALL_STEP_MS / (tuning.speed * (glyphSource ? LANDING_WALL_SPEED : 1));
    let drops: ReturnType<typeof newMatrixDrop>[] = [];
    let raf = 0;
    let lastStep = 0;
    let running = true;
    let visible = true;
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(2, Math.floor(rect.width));
      const height = Math.max(2, Math.floor(rect.height));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const columns = matrixPlaneColumns(plane, width, role);
      const rows = Math.ceil(height / CELL_PX);
      while (drops.length < columns)
        drops.push(newMatrixDrop(rows, tuning.trail, Math.random, glyphSource));
      drops = drops.slice(0, columns);
      paintPlane(ctx, width, height, drops, role);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // Off-screen pause, where the platform offers it; without
    // an IntersectionObserver the wall simply runs (the
    // document-hidden pause still stands).
    const visibility =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries) => {
              visible = entries.some((entry) => entry.isIntersecting);
            },
            { threshold: 0.02 },
          )
        : null;
    visibility?.observe(room);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!running || !visible || document.hidden) return;
      if (now - lastStep < stepMs) return;
      lastStep = now;
      const rows = Math.ceil(canvas.height / CELL_PX);
      drops = stepMatrixDrops(drops, rows, tuning.trail, Math.random, glyphSource);
      paintPlane(ctx, canvas.width, canvas.height, drops, role);
    };
    if (!reduced) raf = requestAnimationFrame(frame);

    const onVisibilityChange = () => {
      running = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      visibility?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [plane, role, roomRef, glyphSource]);

  return canvasRef;
}

function MatrixPlane({
  id,
  role,
  roomRef,
  glyphSource,
}: {
  id: MatrixPlaneId;
  role: MatrixWallRole;
  roomRef: React.RefObject<HTMLDivElement | null>;
  glyphSource?: ((length: number) => string) | undefined;
}) {
  const canvasRef = useRainCanvas(id, role, roomRef, glyphSource);
  return <canvas ref={canvasRef} className={`matrix-wall__plane matrix-wall__plane--${id}`} aria-hidden="true" />;
}

export function MatrixWall({
  role = "owner",
  variant = "stage",
  weave = false,
}: {
  /** The seat this wall stands behind — the tuning follows the seat. */
  role?: MatrixWallRole;
  /** "stage" fills the stage; "page" stands fixed behind a whole page. */
  variant?: "stage" | "page";
  /**
   * THE FRONT DOOR'S COVER (owner order 2026-11-27 ~23:18 CST):
   * the landing rain only. The drops draw their glyphs from the
   * woven byte stream — the bytes spell the authorization
   * message inside the rain — and the pace quickens to falling
   * water. No surface inside the door weaves; this is the cover
   * for trying to get in, and it belongs to the front alone.
   */
  weave?: boolean;
}) {
  const roomRef = useRef<HTMLDivElement | null>(null);
  const glyphSourceRef = useRef<((length: number) => string) | undefined>(undefined);
  if (weave && glyphSourceRef.current === undefined) {
    glyphSourceRef.current = createWovenGlyphSource(LANDING_WEAVE_MESSAGE);
  }
  if (!weave) glyphSourceRef.current = undefined;
  return (
    <div
      ref={roomRef}
      className={`matrix-wall matrix-wall--${variant}`}
      data-role={role}
      data-weave={weave ? "true" : undefined}
      aria-hidden="true"
    >
      {MATRIX_PLANES.map((plane) => (
        <MatrixPlane
          key={plane.id}
          id={plane.id}
          role={role}
          roomRef={roomRef}
          glyphSource={glyphSourceRef.current}
        />
      ))}
    </div>
  );
}
