import type { ReactNode } from "react";
import { WORLD_RULES } from "./worldRules";

const mapX = (x: number) => 80 + (x + 8) * 40;
const mapY = (z: number) => 80 + (z + 8) * 40;
const routePath = WORLD_RULES.walkRoute
  .map((point, index) => `${index === 0 ? "M" : "L"} ${mapX(point.x)} ${mapY(point.z)}`)
  .join(" ");

export function CityView({ children }: { children?: ReactNode }) {
  return (
    <main className="city-view" aria-label="Construct map placeholder">
      {children ?? (
        <div className="city-view__map">
          <header className="city-view__header">
            <p className="city-view__eyebrow">Osiris&apos;s construct</p>
            <h1>City map placeholder</h1>
            <p>Layout derived from the supplied world rules; no game systems are loaded.</p>
          </header>
          <svg
            className="city-view__diagram"
            viewBox="0 0 800 560"
            role="img"
            aria-labelledby="city-map-title city-map-description"
          >
            <title id="city-map-title">Town, outer forest, hot zone and walk route</title>
            <desc id="city-map-description">
              A safe town center connected by a walking route to an outer forest encounter site and
              a hot zone. A trainer marker is inside the town center.
            </desc>
            <path className="city-view__route" d={routePath} />
            {WORLD_RULES.zones.map((zone) => (
              <g key={zone.id} className={`city-view__zone city-view__zone--${zone.kind}`}>
                <circle cx={mapX(zone.x)} cy={mapY(zone.z)} r={zone.radius * 40} />
                <text x={mapX(zone.x)} y={mapY(zone.z) - zone.radius * 40 - 12}>
                  {zone.name}
                </text>
              </g>
            ))}
            {WORLD_RULES.encounterSites.map((site) => (
              <g key={site.id} className="city-view__marker city-view__marker--encounter">
                <circle cx={mapX(site.x)} cy={mapY(site.z)} r="8" />
                <text x={mapX(site.x) + 14} y={mapY(site.z) + 4}>
                  {site.label}
                </text>
              </g>
            ))}
            {WORLD_RULES.trainerSites.map((site) => (
              <g key={site.id} className="city-view__marker city-view__marker--trainer">
                <circle cx={mapX(site.x)} cy={mapY(site.z)} r="7" />
                <text x={mapX(site.x) + 12} y={mapY(site.z) - 12}>
                  {site.label}
                </text>
              </g>
            ))}
            <path className="city-view__north" d="M 755 72 L 755 38 M 747 48 L 755 38 L 763 48" />
            <text className="city-view__north-label" x="755" y="28" textAnchor="middle">
              N
            </text>
          </svg>
          <footer className="city-view__legend" aria-label="Map legend">
            <span data-kind="safe">Safe town</span>
            <span data-kind="forest">Forest</span>
            <span data-kind="hot">Hot zone</span>
            <span>Walking route</span>
          </footer>
        </div>
      )}
    </main>
  );
}
