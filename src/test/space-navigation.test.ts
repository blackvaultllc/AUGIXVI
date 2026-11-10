import { describe, expect, it } from "vitest";
import {
  EARTH_REGIONS,
  formatCoordinates,
  parseSpaceNavigationCommand,
  projectEarthMarker,
} from "@/avatar/spaceNavigation";

describe("space view navigation", () => {
  it.each([
    ["hey, can we go to your house", "enter-live"],
    ["Osiris, take me home", "enter-live"],
    ["enter live mode", "enter-live"],
    ["go to the live world", "enter-live"],
    ["go to space", "return-to-space"],
    ["show the Earth", "return-to-space"],
    ["launch back to orbit", "return-to-space"],
  ] as const)("recognizes %s", (text, expected) => {
    expect(parseSpaceNavigationCommand(text)).toBe(expected);
  });

  it.each(["Tell me about your house", "make a house", "fly around the world"])(
    "does not intercept unrelated command %s",
    (text) => {
      expect(parseSpaceNavigationCommand(text)).toBeNull();
    },
  );

  it("provides named Earth regions and formats coordinates", () => {
    expect(EARTH_REGIONS.map((region) => region.label)).toEqual([
      "North America",
      "South America",
      "Europe",
      "Africa",
      "Asia",
      "Oceania",
    ]);
    expect(formatCoordinates(-12.345, 45.678)).toBe("12.35° S, 45.68° E");
  });

  it("projects visible hemisphere locations and hides the far side", () => {
    expect(projectEarthMarker(0, 0)).toEqual({ x: 50, y: 50 });
    expect(projectEarthMarker(0, 180)).toBeNull();
  });
});
