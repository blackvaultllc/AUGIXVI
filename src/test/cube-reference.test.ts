import { describe, expect, it } from "vitest";
import {
  calculateBitwise,
  convertCubeValue,
  getCubieBits,
  isCubePanelCommand,
  parseCubeValue,
} from "@/avatar/cubeReference";

describe("cube reference calculations", () => {
  it("converts unsigned values among binary, hexadecimal, and decimal", () => {
    expect(convertCubeValue("101010", 2)).toEqual({
      binary: "101010",
      hexadecimal: "2A",
      decimal: "42",
    });
    expect(convertCubeValue("ff", 16)?.decimal).toBe("255");
    expect(convertCubeValue("42", 10)?.hexadecimal).toBe("2A");
  });

  it("rejects malformed or out-of-range values", () => {
    expect(parseCubeValue("102", 2)).toBeNull();
    expect(parseCubeValue("-1", 10)).toBeNull();
    expect(parseCubeValue("100000000", 16)).toBeNull();
    expect(parseCubeValue("4294967296", 10)).toBeNull();
  });

  it.each([
    ["AND", "1000"],
    ["OR", "1110"],
    ["XOR", "110"],
  ] as const)("calculates %s over validated bits", (operation, expected) => {
    expect(calculateBitwise("1010", "1100", operation, 2)?.binary).toBe(expected);
  });

  it("maps eight low-order bits to the cube corner coordinate triplets", () => {
    expect(getCubieBits(0b10000001n)).toEqual([
      { corner: 0, coordinates: "000", active: true },
      { corner: 1, coordinates: "001", active: false },
      { corner: 2, coordinates: "010", active: false },
      { corner: 3, coordinates: "011", active: false },
      { corner: 4, coordinates: "100", active: false },
      { corner: 5, coordinates: "101", active: false },
      { corner: 6, coordinates: "110", active: false },
      { corner: 7, coordinates: "111", active: true },
    ]);
  });

  it("opens only for the explicit cube phrase", () => {
    expect(isCubePanelCommand("Pull up the cube!")).toBe(true);
    expect(isCubePanelCommand("show me the cube")).toBe(false);
    expect(isCubePanelCommand("pull up the cube and run a command")).toBe(false);
  });
});
