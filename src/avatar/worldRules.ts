export type WorldPoint = Readonly<{ x: number; z: number }>;

export type WorldZone = Readonly<{
  id: string;
  name: string;
  kind: "safe" | "forest" | "hot";
  x: number;
  z: number;
  radius: number;
}>;

const TOWN_SAFE_ZONE = {
  id: "town-center",
  name: "Town center",
  x: 0,
  z: 0,
  radius: 2.4,
} as const;

export const WORLD_RULES = {
  safeZones: [TOWN_SAFE_ZONE],
  zones: [
    { ...TOWN_SAFE_ZONE, kind: "safe" },
    { id: "outer-forest", name: "Outer forest", kind: "forest", x: -5, z: -3.5, radius: 2.4 },
    { id: "warm-fields", name: "Warm fields", kind: "hot", x: 5, z: -3.5, radius: 2.4 },
  ] satisfies readonly WorldZone[],
  walkRoute: [
    { x: 0, z: 0 },
    { x: -2.7, z: -1 },
    { x: -4.7, z: -3.1 },
    { x: 0, z: -5.8 },
    { x: 4.7, z: -3.1 },
    { x: 2.6, z: -0.6 },
    { x: 0, z: 0 },
  ] satisfies readonly WorldPoint[],
  encounterSites: [
    {
      id: "forest-marker",
      zoneId: "outer-forest",
      label: "Forest encounter site",
      x: -5,
      z: -3.5,
    },
  ],
  trainerSites: [
    {
      id: "town-guide",
      zoneId: "town-center",
      label: "Town trainer",
      x: 1.15,
      z: 0.85,
    },
  ],
} as const;

/** Returns the configured region containing a world-space point, if any. */
export function getWorldZoneAt(x: number, z: number): WorldZone | undefined {
  return WORLD_RULES.zones.find((zone) => Math.hypot(x - zone.x, z - zone.z) <= zone.radius);
}

/** Safe-zone checks are local layout rules, not multiplayer-authoritative protection. */
export function isSafeZone(x: number, z: number): boolean {
  return WORLD_RULES.safeZones.some((zone) => Math.hypot(x - zone.x, z - zone.z) <= zone.radius);
}
