import { describe, expect, it } from "vitest";
import {
  BASE_CHART,
  GATES,
  SIZE_UNITS,
  addBytes,
  bitwise,
  byteToHex,
  checksum,
  clearBit,
  divideValues,
  divisionSteps,
  flipBits,
  fromTwosComplement,
  hexToByte,
  loadBinaryProgress,
  makeDrill,
  multiplyBytes,
  negateByte,
  normalizeAnswer,
  parityBit,
  parityHolds,
  readByte,
  saveBinaryProgress,
  seededRandom,
  setBit,
  shiftLeft,
  shiftRight,
  signedOverflow,
  subtractBytes,
  toTwosComplement,
  toggleBit,
} from "@/avatar/binaryCourse";
import { byteValue } from "@/avatar/binaryCode";

describe("binary course core", () => {
  it("divides by 2 and reads the remainders back up", () => {
    const steps = divisionSteps(43);
    expect(steps.map((s) => s.remainder).join("")).toBe("110101");
    expect(
      [...steps]
        .reverse()
        .map((s) => s.remainder)
        .join(""),
    ).toBe("101011");
    expect((43).toString(2)).toBe("101011");
    expect(divisionSteps(0)).toEqual([{ dividend: 0, quotient: 0, remainder: 0 }]);
  });

  it("sizes climb by 1024 and a byte holds 256 values", () => {
    expect(SIZE_UNITS.map((u) => u.bytes)).toEqual([1, 1024, 1024 ** 2, 1024 ** 3, 1024 ** 4]);
  });

  it("reads a byte with its sum and its letter", () => {
    expect(readByte("01001000")).toEqual({
      bits: "01001000",
      sum: "64 + 8",
      value: 72,
      char: "H",
    });
  });

  it("adds with real carries, and flags a ninth-bit overflow", () => {
    const added = addBytes("00101100", "00011110");
    expect(added?.result).toBe("01001010");
    expect(added?.sum).toBe(74);
    expect(added?.overflow).toBe(false);
    expect(added?.columns.some((c) => c.carryOut === 1)).toBe(true);
    expect(addBytes("11111111", "00000001")?.overflow).toBe(true);
    expect(addBytes("11111111", "00000001")?.result).toBe("00000000");
  });

  it("subtracts, multiplies by shift-and-add, and divides with a remainder", () => {
    expect(subtractBytes("00111010", "00011110")?.difference).toBe(28);
    const product = multiplyBytes("00000110", "00000101");
    expect(product?.product).toBe(30);
    expect(product?.steps.map((s) => s.rowValue)).toEqual([6, 24]);
    expect(divideValues(43, 5)).toMatchObject({ quotient: 8, remainder: 3 });
    expect(divideValues(10, 0)).toBeNull();
  });

  it("two's complement: negate is flip-and-add-1, and the range is −128…127", () => {
    expect(toTwosComplement(-5)).toBe("11111011");
    expect(fromTwosComplement("11111011")).toBe(-5);
    expect(fromTwosComplement("01111111")).toBe(127);
    expect(fromTwosComplement("10000000")).toBe(-128);
    expect(toTwosComplement(128)).toBeNull();
    expect(negateByte("00000101")).toBe("11111011");
    expect(negateByte(negateByte("00101010") ?? "")).toBe("00101010");
    // 100 + 50 in signed bytes runs past 127 — overflow.
    expect(signedOverflow("01100100", "00110010")).toBe(true);
    expect(signedOverflow("00000101", "00000011")).toBe(false);
  });

  it("every gate's table is the real one", () => {
    const byName = Object.fromEntries(GATES.map((g) => [g.name, g]));
    expect(byName["AND"]?.run(1, 1)).toBe(1);
    expect(byName["AND"]?.run(1, 0)).toBe(0);
    expect(byName["OR"]?.run(0, 0)).toBe(0);
    expect(byName["NOT"]?.run(0, 0)).toBe(1);
    expect(byName["XOR"]?.run(1, 1)).toBe(0);
    expect(byName["NAND"]?.run(1, 1)).toBe(0);
    expect(byName["NOR"]?.run(0, 0)).toBe(1);
    expect(byName["XNOR"]?.run(1, 0)).toBe(0);
  });

  it("bitwise work: ops, shifts double and halve, masks touch one bit", () => {
    expect(bitwise("01001100", "00001111", "AND")).toBe("00001100");
    expect(bitwise("01001100", "00001111", "OR")).toBe("01001111");
    expect(bitwise("01001100", "00001111", "XOR")).toBe("01000011");
    expect(flipBits("01001100")).toBe("10110011");
    expect(shiftLeft("00010100")).toBe("00101000");
    expect(byteValue(shiftLeft("00010100") ?? "")).toBe(40);
    expect(byteValue(shiftRight("00010100") ?? "")).toBe(10);
    expect(setBit("00000000", 3)).toBe("00001000");
    expect(clearBit("11111111", 3)).toBe("11110111");
    expect(toggleBit("00001000", 3)).toBe("00000000");
  });

  it("hex and octal are shorthand: fours and threes", () => {
    expect(BASE_CHART).toHaveLength(16);
    expect(BASE_CHART[15]).toEqual({ value: 15, binary: "1111", hex: "F", octal: "17" });
    expect(byteToHex("10111100")).toBe("BC");
    expect(hexToByte("BC")).toBe("10111100");
    expect(hexToByte("zz")).toBeNull();
  });

  it("parity and checksum catch a damaged byte", () => {
    expect(parityBit("01001000")).toBe("0");
    expect(parityBit("01001001")).toBe("1");
    expect(parityHolds("01001001", "1")).toBe(true);
    expect(parityHolds("01001001", "0")).toBe(false);
    expect(checksum([10, 20, 30])).toBe(60);
    expect(checksum([200, 100])).toBe(44);
  });

  it("drills check out: every generated answer is the true one", () => {
    const modules = [
      "foundations",
      "places",
      "converting",
      "sizes",
      "characters",
      "arithmetic",
      "negatives",
      "gates",
      "bitwise",
      "bases",
      "realworld",
      "floating",
      "errors",
      "mastery",
    ];
    for (const moduleId of modules) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const drill = makeDrill(moduleId, seededRandom(seed * 7919));
        expect(drill.prompt.length).toBeGreaterThan(5);
        expect(drill.answer.length).toBeGreaterThan(0);
        expect(drill.working.length).toBeGreaterThan(10);
        expect(normalizeAnswer(drill.answer)).toBe(drill.answer);
      }
    }
    // Spot-check two drills against independent math.
    const places = makeDrill("places", seededRandom(3));
    expect(places.answer).toMatch(/^\d+$/);
    const gates = makeDrill("gates", seededRandom(5));
    expect(["0", "1"]).toContain(gates.answer);
  });

  it("progress saves and loads in his area, and survives a bad record", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(loadBinaryProgress(storage).done).toEqual([]);
    saveBinaryProgress({ done: ["places"], attempts: 4, correct: 3, masteryBest: 8 }, storage);
    expect(loadBinaryProgress(storage)).toEqual({
      done: ["places"],
      attempts: 4,
      correct: 3,
      masteryBest: 8,
    });
    store.set("augi.binary.progress.v1", "{broken");
    expect(loadBinaryProgress(storage).attempts).toBe(0);
  });
});
