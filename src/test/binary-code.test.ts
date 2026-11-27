import { describe, expect, it } from "vitest";
import {
  BINARY_CHART,
  BIT_PLACES,
  COUNTING_CHART,
  byteBreakdown,
  byteSumWords,
  byteToChar,
  byteValue,
  charToByte,
  countingSteps,
  countingSumWords,
  decodeBinary,
  encodeText,
  numberToBinary,
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
    expect(groups["Typed numbers — the characters '0' to '9'"]).toHaveLength(10);
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

  it("counts the slow way: biggest place that fits, subtract, keep going", () => {
    expect(numberToBinary(0)).toBe("0");
    expect(numberToBinary(5)).toBe("101");
    expect(numberToBinary(17)).toBe("10001");
    expect(countingSteps(17)).toEqual([
      { place: 16, remaining: 1 },
      { place: 1, remaining: 0 },
    ]);
    expect(countingSteps(0)).toEqual([]);
    expect(countingSumWords(5)).toBe("4 + 1 = 5");
    expect(countingSumWords(7)).toBe("4 + 2 + 1 = 7");
    expect(countingSumWords(9)).toBe("8 + 1 = 9");
    expect(countingSumWords(17)).toBe("16 + 1 = 17");
  });

  it("the counting chart runs 0 through 20 and every row adds up", () => {
    expect(COUNTING_CHART).toHaveLength(21);
    for (const entry of COUNTING_CHART) {
      expect(entry.bits).toBe(numberToBinary(entry.value));
      expect(entry.placed).toHaveLength(5);
      expect(byteValue(`000${entry.placed}`)).toBe(entry.value);
    }
    expect(COUNTING_CHART[20]).toMatchObject({ bits: "10100", sum: "16 + 4 = 20" });
  });

  it("keeps the number and the typed character apart: 5 is 101, '5' is 00110101", () => {
    expect(numberToBinary(5)).toBe("101");
    expect(charToByte("5")).toBe("00110101");
    // The typed digit pattern: 0011 + the digit's own binary.
    for (let d = 0; d <= 9; d += 1) {
      expect(charToByte(String(d))).toBe(`0011${numberToBinary(d).padStart(4, "0")}`);
    }
    // Capitals: 010 + the letter's number. Small letters: 011 + it.
    expect(charToByte("A")).toBe(`010${numberToBinary(1).padStart(5, "0")}`);
    expect(charToByte("Z")).toBe(`010${numberToBinary(26).padStart(5, "0")}`);
    expect(charToByte("a")).toBe(`011${numberToBinary(1).padStart(5, "0")}`);
    expect(charToByte("z")).toBe(`011${numberToBinary(26).padStart(5, "0")}`);
  });
});
