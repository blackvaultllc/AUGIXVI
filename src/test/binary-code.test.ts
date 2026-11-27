import { describe, expect, it } from "vitest";
import {
  BINARY_CHART,
  BIT_PLACES,
  byteBreakdown,
  byteSumWords,
  byteToChar,
  byteValue,
  charToByte,
  decodeBinary,
  encodeText,
} from "@/avatar/binaryCode";

describe("binary reading core", () => {
  it("reads the places right to left: 1, 2, 4, 8, 16, 32, 64, 128", () => {
    expect([...BIT_PLACES].reverse()).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
  });

  it("adds the places where a 1 sits", () => {
    expect(byteValue("00000000")).toBe(0);
    expect(byteValue("11111111")).toBe(255);
    expect(byteValue("01001000")).toBe(72);
    expect(byteValue("0100100")).toBeNull();
    expect(byteValue("0100100x")).toBeNull();
    expect(byteSumWords("01001001")).toBe("64 + 8 + 1 = 73");
    expect(byteSumWords("00000000")).toBe("nothing is on = 0");
  });

  it("breaks a byte into its places with the counted ones marked", () => {
    const places = byteBreakdown("01001000");
    expect(places).toHaveLength(8);
    expect(places?.filter((p) => p.counted).map((p) => p.place)).toEqual([64, 8]);
  });

  it("knows the letters: H is 01001000, and space is a real character", () => {
    expect(charToByte("H")).toBe("01001000");
    expect(charToByte(" ")).toBe("00100000");
    expect(byteToChar("01001000")).toBe("H");
    expect(byteToChar("00100000")).toBe(" ");
    expect(byteToChar("00000000")).toBeNull();
  });

  it("translates both ways, whole words at a time", () => {
    expect(encodeText("Hi")).toEqual({ binary: "01001000 01101001", unsupported: [] });
    expect(decodeBinary("01001000 01101001")).toEqual({ text: "Hi", badGroups: [] });
    expect(decodeBinary("0100100001101001").text).toBe("Hi");
    const roundTrip = decodeBinary(encodeText("Zero and One 123").binary);
    expect(roundTrip.text).toBe("Zero and One 123");
  });

  it("names what it cannot read instead of guessing", () => {
    expect(decodeBinary("0100100").badGroups).toEqual(["unfinished group: 0100100"]);
    expect(decodeBinary("00000000").badGroups).toEqual(["00000000"]);
    expect(decodeBinary("hello").badGroups[0]).toMatch(/^not binary:/);
    expect(encodeText("café").unsupported).toEqual(["é"]);
  });

  it("the chart is the full ordered set and agrees with the translator", () => {
    const groups = Object.fromEntries(BINARY_CHART.map((g) => [g.group, g.entries]));
    expect(groups["Space"]?.map((e) => e.label)).toEqual(["space"]);
    expect(groups["Numbers"]).toHaveLength(10);
    expect(groups["Capital letters"]).toHaveLength(26);
    expect(groups["Small letters"]).toHaveLength(26);
    for (const group of BINARY_CHART) {
      for (const entry of group.entries) {
        expect(entry.bits).toBe(charToByte(entry.char));
        expect(byteToChar(entry.bits)).toBe(entry.char);
        expect(entry.code).toBe(byteValue(entry.bits));
      }
    }
  });
});
