import { useMemo, useState, type FormEvent } from "react";
import { MapPin } from "lucide-react";
import { BACKDROPS } from "./backdrops";
import {
  GAZETTEER,
  formatLatLon,
  markerPosition,
  resolveLocation,
  type ResolvedLocation,
} from "./gazetteer";

/**
 * THE COMMAND MAP (owner order 2026-11-22): a small contained
 * window — the Part 33 pattern, the stage stays visible — holding
 * the Captain's own world-map pictures. Name a place and Augie
 * pulls it up: a marker on the map and the readout that is the
 * truth of it — latitude and longitude, and magnitude where the
 * data carries one (earthquakes). Coordinates come from the
 * built-in gazetteer or from a pair he types himself; a name the
 * gazetteer does not carry is stated as unresolved, never guessed.
 *
 * Marker honesty: on his FLAT maps the equirectangular marker is
 * placed true. On the curved, globe, and split pictures the marker
 * is approximate and the panel says so, under the marker itself.
 */

type ProjectionKind = "flat" | "curved" | "globe" | "split";

const PROJECTIONS: Record<string, { kind: ProjectionKind; note: string }> = {
  "map-political": { kind: "flat", note: "Flat map — the marker is placed true." },
  "map-pastel": { kind: "flat", note: "Flat map — the marker is placed true." },
  "map-blue-grid": { kind: "flat", note: "Flat map — the marker is placed true." },
  "map-satellite": { kind: "flat", note: "Flat map — the marker is placed true." },
  "map-dark-digital": { kind: "flat", note: "Flat map — the marker is placed true." },
  "map-matrix": { kind: "flat", note: "Flat map — the marker is placed true." },
  "map-wall-flags": { kind: "curved", note: "Curved wall map — the marker is approximate; the readout is exact." },
  "map-oval": { kind: "curved", note: "Oval projection — the marker is approximate; the readout is exact." },
  "map-vintage": { kind: "split", note: "Split vintage layout — the marker is approximate; the readout is exact." },
  "map-network-globe": { kind: "globe", note: "Globe view — the marker is approximate; the readout is exact." },
};

export function MapPanel() {
  const mapAssets = useMemo(() => BACKDROPS.filter((asset) => asset.set === "maps"), []);
  const [mapId, setMapId] = useState(mapAssets[0]!.id);
  const [query, setQuery] = useState("");
  const [resolved, setResolved] = useState<ResolvedLocation | null>(null);
  const [missed, setMissed] = useState<string | null>(null);
  const asset = mapAssets.find((entry) => entry.id === mapId) ?? mapAssets[0]!;
  const projection = PROJECTIONS[asset.id] ?? { kind: "flat" as const, note: "" };
  const marker = resolved ? markerPosition(resolved.lat, resolved.lon) : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = resolveLocation(query);
    if (found) {
      setResolved(found);
      setMissed(null);
    } else {
      setResolved(null);
      setMissed(query.trim());
    }
  };

  return (
    <div className="map-panel">
      <div className="map-panel__maps" role="group" aria-label="Choose the map picture">
        {mapAssets.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`map-panel__map-chip${entry.id === mapId ? " is-picked" : ""}`}
            onClick={() => setMapId(entry.id)}
            aria-pressed={entry.id === mapId}
          >
            {entry.name.replace("World map — ", "")}
          </button>
        ))}
      </div>

      <div className="map-panel__stage">
        <img className="map-panel__img" src={asset.src} alt={asset.name} draggable={false} />
        {marker && (
          <span
            className="map-panel__marker"
            style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            aria-hidden="true"
          >
            <MapPin />
          </span>
        )}
      </div>
      <p className="map-panel__projection">{projection.note}</p>

      <form className="map-panel__form" onSubmit={submit}>
        <label className="sr-only" htmlFor="map-panel-query">
          Place to show on the map
        </label>
        <input
          id="map-panel-query"
          className="map-panel__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name a place — Mobile, Cairo, Tokyo… or type 30.69, -88.04"
          autoComplete="off"
        />
        <button type="submit" className="map-panel__show" disabled={!query.trim()}>
          Show it
        </button>
      </form>

      {resolved && (
        <div className="map-panel__readout" role="status">
          <p className="map-panel__place">{resolved.name}</p>
          <p className="map-panel__coords">{formatLatLon(resolved.lat, resolved.lon)}</p>
          {typeof resolved.magnitude === "number" && (
            <p className="map-panel__magnitude">Magnitude {resolved.magnitude.toFixed(1)}</p>
          )}
          {resolved.kind === "coordinates" && (
            <p className="map-panel__note">The coordinates you typed, marked as given.</p>
          )}
        </div>
      )}
      {missed !== null && (
        <p className="map-panel__miss" role="status">
          “{missed}” is not in the gazetteer — no coordinates were invented for it. Type the
          latitude and longitude directly and it will be marked as given.
        </p>
      )}
      <p className="map-panel__source">
        Gazetteer: {GAZETTEER.length} places with atlas coordinates, carried in the app — no
        network needed. Magnitudes ride only on the earthquake entries, where the data carries
        one.
      </p>
    </div>
  );
}
