/**
 * CHALKBOARD — freehand chalk drawing (owner fix #1).
 * Mouse / touch draws like chalk in chalk colors; rubbing erases. The typed
 * side stays for Osiris writing — but drawing is the primary surface.
 */
import { useEffect, useRef, useState } from "react";
import { Eraser, Pencil } from "lucide-react";

export const CHALK_COLORS = ["#f5f0dc", "#ffd9a0", "#a0e8ff", "#ffb0c8", "#b8ffc8"] as const;

export function useChalkCanvas(colors: readonly string[] = CHALK_COLORS) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState<string>(colors[0]!);
  const [erasing, setErasing] = useState(false);
  const colorRef = useRef(color);
  const erasingRef = useRef(erasing);
  colorRef.current = color;
  erasingRef.current = erasing;

  /** Prepare the canvas: blackboard fill + coarse chalk texture. */
  const prepare = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#1d3a2a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.03})`;
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const snapshot = canvas.toDataURL();
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      prepare();
      const img = new Image();
      img.onload = () => canvas.getContext("2d")?.drawImage(img, 0, 0);
      img.src = snapshot;
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);

  const point = (event: PointerEvent | React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (erasingRef.current) {
      // Rub to erase: paint board color back over the path.
      ctx.strokeStyle = "#1d3a2a";
      ctx.lineWidth = 26;
      ctx.globalCompositeOperation = "source-over";
    } else {
      // Chalk: semi-transparent, grainy, slightly jittered stroke.
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.75;
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    if (!erasingRef.current) {
      // Chalk dust grain along the stroke.
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 4; i++) {
        const gx = from.x + (to.x - from.x) * Math.random();
        const gy = from.y + (to.y - from.y) * Math.random();
        ctx.fillRect(gx, gy, 1.6, 1.6);
      }
    }
    ctx.globalAlpha = 1;
  };

  return {
    canvasRef,
    color,
    setColor,
    erasing,
    setErasing,
    colors,
    onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => {
      drawing.current = true;
      last.current = point(event);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || !last.current) return;
      const next = point(event);
      stroke(last.current, next);
      last.current = next;
    },
    onPointerUp: () => {
      drawing.current = false;
      last.current = null;
    },
    clear: prepare,
  };
}
