/**
 * THE COMMAND MAP'S GAZETTEER (owner order 2026-11-22): the places
 * Augie can pull up on the Captain's world maps, with their real
 * coordinates. Real data only — every entry is a well-known atlas
 * coordinate; a name that is not here does NOT get invented
 * coordinates, the panel says it cannot resolve it. Magnitude rides
 * only on entries that ARE earthquakes — the events whose data
 * carries one — never on plain places.
 *
 * The set is deliberately small and honest: home ground first
 * (Mobile and the Gulf), then the country's anchors, then the
 * world's. It grows by editing this list, never by guessing.
 */

export type GazetteerPlace = {
  name: string;
  lat: number;
  lon: number;
  /** Only earthquake entries carry a magnitude — it is their data. */
  magnitude?: number;
  kind: "place" | "earthquake";
  /** Other names the Captain might use for the same place. */
  aliases?: readonly string[];
};

const place = (
  name: string,
  lat: number,
  lon: number,
  aliases?: readonly string[],
): GazetteerPlace => ({ name, lat, lon, kind: "place", ...(aliases ? { aliases } : {}) });

const quake = (name: string, lat: number, lon: number, magnitude: number): GazetteerPlace => ({
  name,
  lat,
  lon,
  magnitude,
  kind: "earthquake",
});

export const GAZETTEER: readonly GazetteerPlace[] = [
  /* Home ground — Mobile and the Gulf Coast. */
  place("Mobile, Alabama", 30.6944, -88.0431, ["mobile", "mobile al", "home"]),
  place("Bay Minette, Alabama", 30.8829, -87.7739, ["bay minette"]),
  place("New Orleans, Louisiana", 29.9511, -90.0715, ["new orleans", "nola"]),
  place("Baton Rouge, Louisiana", 30.4515, -91.1546, ["baton rouge"]),
  place("Biloxi, Mississippi", 30.396, -88.8853, ["biloxi"]),
  place("Pensacola, Florida", 30.4213, -87.2169, ["pensacola"]),
  place("Houston, Texas", 29.7604, -95.3698, ["houston"]),
  place("Dallas, Texas", 32.7767, -96.797, ["dallas"]),
  /* The country's anchors. */
  place("Atlanta, Georgia", 33.749, -84.388, ["atlanta"]),
  place("Memphis, Tennessee", 35.1495, -90.049, ["memphis"]),
  place("Nashville, Tennessee", 36.1627, -86.7816, ["nashville"]),
  place("Chicago, Illinois", 41.8781, -87.6298, ["chicago"]),
  place("New York City", 40.7128, -74.006, ["new york", "nyc", "new york city"]),
  place("Washington, D.C.", 38.9072, -77.0369, ["washington", "dc", "washington dc"]),
  place("Miami, Florida", 25.7617, -80.1918, ["miami"]),
  place("Denver, Colorado", 39.7392, -104.9903, ["denver"]),
  place("Los Angeles, California", 34.0522, -118.2437, ["los angeles", "la"]),
  place("San Francisco, California", 37.7749, -122.4194, ["san francisco", "sf"]),
  place("Seattle, Washington", 47.6062, -122.3321, ["seattle"]),
  place("Honolulu, Hawaii", 21.3099, -157.8581, ["honolulu"]),
  place("Anchorage, Alaska", 61.2181, -149.9003, ["anchorage"]),
  place("Toronto, Canada", 43.6532, -79.3832, ["toronto"]),
  place("Mexico City, Mexico", 19.4326, -99.1332, ["mexico city"]),
  place("Rio de Janeiro, Brazil", -22.9068, -43.1729, ["rio", "rio de janeiro"]),
  /* The wider world — his heritage threads included. */
  place("London, England", 51.5074, -0.1278, ["london"]),
  place("Paris, France", 48.8566, 2.3522, ["paris"]),
  place("Cairo, Egypt", 30.0444, 31.2357, ["cairo"]),
  place("Giza, Egypt", 29.9792, 31.1342, ["giza", "the pyramids", "pyramids"]),
  place("Lagos, Nigeria", 6.5244, 3.3792, ["lagos"]),
  place("Accra, Ghana", 5.6037, -0.187, ["accra"]),
  place("Tokyo, Japan", 35.6762, 139.6503, ["tokyo"]),
  place("Sydney, Australia", -33.8688, 151.2093, ["sydney"]),
  /* Earthquakes — the entries whose data carries a magnitude. */
  quake("2011 Tōhoku earthquake, Japan", 38.297, 142.373, 9.1),
  quake("2004 Sumatra earthquake", 3.3, 95.98, 9.1),
  quake("1964 Alaska earthquake", 61.02, -147.65, 9.2),
  quake("1906 San Francisco earthquake", 37.75, -122.55, 7.9),
  quake("2010 Haiti earthquake", 18.44, -72.57, 7.0),
];

/**
 * Coordinates typed straight in: "30.69, -88.04", "30.69N 88.04W",
 * "-33.86, 151.21". Returns null when the text is not a coordinate
 * pair — the caller then tries the gazetteer, and failing that says
 * so. Nothing is ever approximated silently.
 */
export function parseCoordinates(query: string): { lat: number; lon: number } | null {
  const text = query.trim();
  const hemi = text.match(
    /^(-?\d{1,3}(?:\.\d+)?)\s*([NS])?[,\s]+(-?\d{1,3}(?:\.\d+)?)\s*([EW])?$/i,
  );
  if (!hemi) return null;
  let lat = Number(hemi[1]);
  let lon = Number(hemi[3]);
  if (hemi[2]) lat = Math.abs(lat) * (hemi[2].toUpperCase() === "S" ? -1 : 1);
  if (hemi[4]) lon = Math.abs(lon) * (hemi[4].toUpperCase() === "W" ? -1 : 1);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

export type ResolvedLocation = {
  name: string;
  lat: number;
  lon: number;
  magnitude?: number;
  kind: "place" | "earthquake" | "coordinates";
};

/** Resolve a name (or a typed coordinate pair) to a real location. */
export function resolveLocation(query: string): ResolvedLocation | null {
  const coords = parseCoordinates(query);
  if (coords) return { name: "Typed coordinates", ...coords, kind: "coordinates" };
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  for (const entry of GAZETTEER) {
    if (entry.name.toLowerCase() === needle) return { ...entry };
    if (entry.aliases?.some((alias) => alias === needle)) return { ...entry };
  }
  // A partial name still has to match exactly one place — ambiguity
  // resolves to nothing rather than to a guess.
  const partial = GAZETTEER.filter(
    (entry) =>
      entry.name.toLowerCase().includes(needle) ||
      entry.aliases?.some((alias) => alias.includes(needle)),
  );
  return partial.length === 1 ? { ...partial[0]! } : null;
}

/** "30.6944° N, 88.0431° W" — the readout the panel prints. */
export function formatLatLon(lat: number, lon: number): string {
  const latPart = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}`;
  const lonPart = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
  return `${latPart}, ${lonPart}`;
}

/**
 * Equirectangular marker position, in percents of the map picture:
 * longitude runs -180..180 left to right, latitude 90..-90 top to
 * bottom. Exact on his flat maps; on the curved/globe/split
 * pictures the panel labels the marker approximate.
 */
export function markerPosition(lat: number, lon: number): { x: number; y: number } {
  return {
    x: ((lon + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  };
}
