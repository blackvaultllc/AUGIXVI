import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Home } from "lucide-react";
import { libraryItem } from "./library";
import { PLOT_SIZE, plotCenter, type RoomContent } from "./room";
import {
  HOME_RECT,
  describeOffset,
  mapToWorld,
  worldMapExtent,
  worldToMap,
  type WorldInhabitant,
} from "./worldMap";

/**
 * THE BUILT-WORLD MAP (owner order 2026-11-23): his world the way
 * a map app shows a country — the home plot, every plot he has
 * claimed out in the darkness, every piece standing in them, and
 * the inhabitants where they stand: AUGI's marker follows his
 * real steps (the renderer reports his true floor spot), and the
 * gods hold the command seat at the home plot, which is where
 * their medallions stand on the stage. Tap anywhere on the map
 * and the stage view travels there.
 *
 * Truth rules: positions are read, never invented — the
 * inhabitants arrive through a getter the stage owns, polled
 * while the map is open. Vehicles are NOT in this build: AUGI
 * walks, and the map says so rather than faking a drive.
 */

const MAP_W = 520;
const MAP_H = 400;

export type BuiltWorldMapPanelProps = {
  room: RoomContent;
  getInhabitants: () => WorldInhabitant[];
  viewCenter: { x: number; z: number };
  onGoTo: (x: number, z: number) => void;
};

const ITEM_R: Record<string, number> = { small: 2.5, medium: 3.5, large: 4.5, grand: 6 };

export function BuiltWorldMapPanel({ room, getInhabitants, viewCenter, onGoTo }: BuiltWorldMapPanelProps) {
  const [inhabitants, setInhabitants] = useState<WorldInhabitant[]>(() => getInhabitants());
  const getRef = useRef(getInhabitants);
  getRef.current = getInhabitants;

  // The inhabitants move — re-read their positions while open.
  useEffect(() => {
    const timer = window.setInterval(() => setInhabitants(getRef.current()), 300);
    return () => window.clearInterval(timer);
  }, []);

  const extent = useMemo(
    () => worldMapExtent(room, inhabitants, viewCenter),
    [room, inhabitants, viewCenter],
  );
  const at = (x: number, z: number) => worldToMap(extent, MAP_W, MAP_H, x, z);
  const homeA = at(HOME_RECT.minX, HOME_RECT.minZ);
  const homeB = at(HOME_RECT.maxX, HOME_RECT.maxZ);
  const view = at(viewCenter.x, viewCenter.z);
  const groundFill = room.surfaces.floorStyle === "color" ? room.surfaces.floor : "#33507a";

  const onMapClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const px = ((event.clientX - rect.left) / rect.width) * MAP_W;
    const py = ((event.clientY - rect.top) / rect.height) * MAP_H;
    const target = mapToWorld(extent, MAP_W, MAP_H, px, py);
    onGoTo(target.x, target.z);
  };

  return (
    <div className="built-world-map">
      <svg
        className="built-world-map__svg"
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        role="img"
        aria-label="Map of your built world — tap to travel the stage view there"
        onClick={onMapClick}
      >
        <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#04050a" />
        {/* claimed plots out in the darkness */}
        {room.plots.map((plot) => {
          const center = plotCenter(plot);
          const a = at(center.x - PLOT_SIZE / 2, center.z - PLOT_SIZE / 2);
          const b = at(center.x + PLOT_SIZE / 2, center.z + PLOT_SIZE / 2);
          return (
            <rect
              key={`${plot.x},${plot.z}`}
              x={a.px}
              y={a.py}
              width={b.px - a.px}
              height={b.py - a.py}
              fill={groundFill}
              stroke="#d4af37"
              strokeOpacity={0.45}
              strokeWidth={0.75}
            />
          );
        })}
        {/* the home plot */}
        <rect
          x={homeA.px}
          y={homeA.py}
          width={homeB.px - homeA.px}
          height={homeB.py - homeA.py}
          fill={groundFill}
          stroke="#d4af37"
          strokeWidth={1.25}
        />
        <text x={homeA.px + 5} y={homeA.py + 14} className="built-world-map__label">
          HOME
        </text>
        {/* the pieces standing in the world */}
        {room.items.map((item) => {
          const p = at(item.x, item.z);
          return (
            <circle
              key={item.id}
              cx={p.px}
              cy={p.py}
              r={ITEM_R[item.size] ?? 3.5}
              fill="#d4af37"
              fillOpacity={0.9}
            >
              <title>{libraryItem(item.baseId)?.name ?? item.baseId}</title>
            </circle>
          );
        })}
        {/* the inhabitants */}
        {inhabitants.map((soul) => {
          const p = at(soul.x, soul.z);
          if (soul.kind === "construct") {
            return (
              <g key={soul.id}>
                <rect
                  x={p.px - 5}
                  y={p.py - 5}
                  width={10}
                  height={10}
                  transform={`rotate(45 ${p.px} ${p.py})`}
                  fill="#7ee0ff"
                  stroke="#04050a"
                />
                <text x={p.px + 9} y={p.py + 4} className="built-world-map__soul">
                  {soul.name}
                </text>
              </g>
            );
          }
          return (
            <g key={soul.id}>
              <circle cx={p.px} cy={p.py} r={5} fill="#ffd98a" stroke="#04050a" />
              <text x={p.px + 9} y={p.py + 4} className="built-world-map__soul">
                {soul.name}
              </text>
            </g>
          );
        })}
        {/* where the stage view stands */}
        <g stroke="#ff8a5c" strokeWidth={1.25} aria-hidden="true">
          <line x1={view.px - 8} y1={view.py} x2={view.px + 8} y2={view.py} />
          <line x1={view.px} y1={view.py - 8} x2={view.px} y2={view.py + 8} />
        </g>
      </svg>
      <div className="built-world-map__row">
        <button
          type="button"
          className="builder-panel__button"
          onClick={() => onGoTo(0, 0)}
        >
          <Home aria-hidden="true" /> Home plot
        </button>
        <span className="built-world-map__where">
          <Crosshair aria-hidden="true" /> View: {describeOffset(viewCenter.x, viewCenter.z)}
        </span>
      </div>
      <p className="builder-panel__hint">
        Gold dots are your pieces; the blue diamond is AUGI, following his real steps; the pale
        circles are the gods at the command seat. Tap the map and the stage view travels there.
        AUGI walks this world — vehicles are a later layer, not yet built.
      </p>
      <p className="builder-panel__hint">
        {room.plots.length === 0
          ? "No plots claimed beyond home yet — the darkness past the home plot is unbuilt world, waiting."
          : `${room.plots.length} plot${room.plots.length === 1 ? "" : "s"} claimed beyond home.`}
      </p>
    </div>
  );
}
