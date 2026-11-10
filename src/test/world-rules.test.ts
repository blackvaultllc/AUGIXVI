import { describe, expect, it } from "vitest";
import { getWorldZoneAt, isSafeZone, WORLD_RULES } from "@/avatar/worldRules";

describe("avatar world layout rules", () => {
  it("keeps the town center safe while forest and hot regions remain outside it", () => {
    expect(isSafeZone(0, 0)).toBe(true);
    expect(getWorldZoneAt(-5, -3.5)?.kind).toBe("forest");
    expect(getWorldZoneAt(5, -3.5)?.kind).toBe("hot");
    expect(isSafeZone(-5, -3.5)).toBe(false);
    expect(isSafeZone(5, -3.5)).toBe(false);
  });

  it("provides a walk route through the outer zones plus encounter and trainer markers", () => {
    const routeZones = new Set(
      WORLD_RULES.walkRoute.map((point) => getWorldZoneAt(point.x, point.z)?.kind),
    );

    expect(routeZones).toContain("safe");
    expect(routeZones).toContain("forest");
    expect(routeZones).toContain("hot");
    expect(WORLD_RULES.encounterSites[0]?.zoneId).toBe("outer-forest");
    expect(WORLD_RULES.trainerSites[0]?.zoneId).toBe("town-center");
  });
});
