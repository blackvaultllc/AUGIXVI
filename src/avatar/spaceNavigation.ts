export type SpaceNavigationCommand = "enter-live" | "return-to-space";

function stripGreeting(text: string): string {
  return text
    .trim()
    .replace(/^(?:(?:hey|okay|ok)\b[, ]*)+/i, "")
    .replace(/^osiris\b[, ]*/i, "")
    .replace(/[.!?,;:]+$/g, "")
    .trim();
}

export function parseSpaceNavigationCommand(text: string): SpaceNavigationCommand | null {
  const command = stripGreeting(text);
  const liveCommand =
    /^(?:(?:can we|please)\s+)?(?:(?:go|take me|bring me|come back|return)\s+(?:back\s+)?(?:to\s+)?)?(?:(?:your|osiris(?:'s)?|the)\s+)?(?:house|home|world|live (?:mode|world))$/i;
  const spaceCommand =
    /^(?:(?:can we|please)\s+)?(?:(?:go|take me|bring me|return|launch)\s+(?:back\s+)?to\s+)?(?:space|orbit|space view)$/i;

  if (/^(?:enter|show)\s+(?:the\s+)?live mode$/i.test(command) || liveCommand.test(command)) {
    return "enter-live";
  }
  if (
    /^(?:return|go|launch)\s+(?:back\s+)?to\s+(?:space|orbit)$/i.test(command) ||
    /^(?:show|open)\s+(?:the\s+)?(?:earth|space view)$/i.test(command) ||
    spaceCommand.test(command)
  ) {
    return "return-to-space";
  }
  return null;
}

export type EarthRegion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export const EARTH_REGIONS: readonly EarthRegion[] = [
  { id: "north-america", label: "North America", latitude: 39.83, longitude: -98.58 },
  { id: "south-america", label: "South America", latitude: -8.78, longitude: -55.49 },
  { id: "europe", label: "Europe", latitude: 54.53, longitude: 15.26 },
  { id: "africa", label: "Africa", latitude: 1.65, longitude: 17.68 },
  { id: "asia", label: "Asia", latitude: 34.05, longitude: 100.62 },
  { id: "oceania", label: "Oceania", latitude: -22.74, longitude: 140.02 },
];

export function formatCoordinates(latitude: number, longitude: number): string {
  const latDirection = latitude < 0 ? "S" : "N";
  const lonDirection = longitude < 0 ? "W" : "E";
  return `${Math.abs(latitude).toFixed(2)}° ${latDirection}, ${Math.abs(longitude).toFixed(2)}° ${lonDirection}`;
}

export function projectEarthMarker(latitude: number, longitude: number) {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeRadians = (longitude * Math.PI) / 180;
  const depth = Math.cos(latitudeRadians) * Math.cos(longitudeRadians);
  if (depth < 0) return null;
  const x = 50 + Math.cos(latitudeRadians) * Math.sin(longitudeRadians) * 40;
  const y = 50 - Math.sin(latitudeRadians) * 40;
  return { x, y };
}
