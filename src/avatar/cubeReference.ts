export type NumberBase = 2 | 10 | 16;
export type BitOperation = "AND" | "OR" | "XOR";

export type CubeConversion = {
  decimal: string;
  binary: string;
  hexadecimal: string;
};

export type CubieBit = {
  corner: number;
  coordinates: string;
  active: boolean;
};

export const CUBE_LAYERS = [
  { id: "core", name: "Core", description: "The central reference point." },
  { id: "inner", name: "Inner layer", description: "The middle set of cubie positions." },
  { id: "surface", name: "Surface layer", description: "The outer faces and corner positions." },
] as const;

const MAX_UNSIGNED_32 = 0xffff_ffffn;

/** Parse a non-negative, unsigned 32-bit value in the selected radix. */
export function parseCubeValue(input: string, radix: NumberBase): bigint | null {
  const value = input.trim();
  const pattern = radix === 2 ? /^[01]+$/ : radix === 10 ? /^\d+$/ : /^[\da-f]+$/i;
  if (!pattern.test(value)) return null;

  try {
    const parsed = BigInt(`${radix === 2 ? "0b" : radix === 16 ? "0x" : ""}${value}`);
    return parsed <= MAX_UNSIGNED_32 ? parsed : null;
  } catch {
    return null;
  }
}

export function convertCubeValue(input: string, radix: NumberBase): CubeConversion | null {
  const value = parseCubeValue(input, radix);
  if (value === null) return null;
  return {
    decimal: value.toString(10),
    binary: value.toString(2),
    hexadecimal: value.toString(16).toUpperCase(),
  };
}

export function calculateBitwise(
  leftInput: string,
  rightInput: string,
  operation: BitOperation,
  radix: NumberBase,
): CubeConversion | null {
  const left = parseCubeValue(leftInput, radix);
  const right = parseCubeValue(rightInput, radix);
  if (left === null || right === null) return null;

  const result =
    operation === "AND" ? left & right : operation === "OR" ? left | right : left ^ right;
  return convertCubeValue(result.toString(10), 10);
}

/** Map the low eight bits to eight cube corners; each coordinate is an x/y/z bit triplet. */
export function getCubieBits(value: bigint): CubieBit[] {
  return Array.from({ length: 8 }, (_, corner) => ({
    corner,
    coordinates: `${(corner >> 2) & 1}${(corner >> 1) & 1}${corner & 1}`,
    active: ((value >> BigInt(corner)) & 1n) === 1n,
  }));
}

/** The panel opens only for the explicit, exact spoken or typed phrase. */
export function isCubePanelCommand(text: string): boolean {
  return /^pull up the cube[.!?]*$/i.test(text.trim());
}
