/**
 * OSIRIS'S REGALIA (owner order): crook and flail crossed in his hands, the
 * Atef crown, the gold-and-blue collar, and the ankh — his Egyptian
 * material, always with him. Pure point geometry, no three.js.
 */
import type { V3 } from "./armIK";

export type RegaliaPiece = {
  id: "crook" | "flail" | "atef" | "collar" | "ankh";
  /** Points along the piece, avatar-local coordinates (right-handed, +z fwd). */
  points: V3[];
};

function line(from: V3, to: V3, count: number): V3[] {
  const points: V3[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    points.push([
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
    ]);
  }
  return points;
}

function arc(
  center: V3,
  radius: number,
  a0: number,
  a1: number,
  axis: "x" | "y",
  count = 24,
): V3[] {
  const points: V3[] = [];
  for (let i = 0; i <= count; i++) {
    const a = a0 + (a1 - a0) * (i / count);
    if (axis === "y")
      points.push([center[0] + Math.cos(a) * radius, center[1], center[2] + Math.sin(a) * radius]);
    else
      points.push([center[0], center[1] + Math.cos(a) * radius, center[2] + Math.sin(a) * radius]);
  }
  return points;
}

/** Crook: staff with the hooked shepherd's end, held in his right hand. */
export function crook(): RegaliaPiece {
  const shaft = line([0.62, -1.1, 0.45], [0.78, 0.55, 0.32], 40);
  const hook = [...arc([0.78, 0.55, 0.32], 0.14, 0, Math.PI * 0.9, "y", 16)];
  return { id: "crook", points: [...shaft, ...hook] };
}

/** Flail: staff with three hanging strands, held in his left hand. */
export function flail(): RegaliaPiece {
  const shaft = line([-0.62, -1.1, 0.45], [-0.78, 0.55, 0.32], 40);
  const strands: V3[] = [];
  for (const dx of [-0.07, 0, 0.07]) {
    strands.push(...line([-0.78 + dx, 0.55, 0.32], [-0.82 + dx * 2, 0.2, 0.4], 14));
  }
  return { id: "flail", points: [...shaft, ...strands] };
}

/** Atef crown: tall white mitre between the ram horns, feather plume aside. */
export function atefCrown(): RegaliaPiece {
  const bowl = [...arc([0, 1.42, 0], 0.3, 0, Math.PI * 2, "y", 20)];
  const bowlSide = [...arc([0, 1.42, 0], 0.3, -Math.PI / 2, Math.PI / 2, "x", 20)];
  const mitre = line([0, 1.44, 0], [0, 2.16, -0.04], 26);
  const leftPlume = line([-0.12, 1.6, -0.02], [-0.16, 2.3, -0.06], 16);
  const rightPlume = line([0.12, 1.6, -0.02], [0.16, 2.3, -0.06], 16);
  return {
    id: "atef",
    points: [...bowl, ...bowlSide, ...mitre, ...leftPlume, ...rightPlume],
  };
}

/** Collar: usekh — wide gold arcs with blue lapis bands across the chest. */
export function collar(): RegaliaPiece {
  const bands: V3[] = [];
  for (const [radius, tilt] of [
    [0.52, -0.2],
    [0.46, -0.12],
    [0.4, -0.04],
  ] as const) {
    for (let i = 0; i <= 26; i++) {
      const a = -Math.PI * 0.28 + (Math.PI * 0.56 * i) / 26;
      const x = Math.sin(a) * radius;
      const y = 0.28 + Math.cos(a) * radius * 0.62 + tilt;
      const z = 0.34 + Math.cos(a) * 0.14;
      bands.push([x, y, z]);
    }
  }
  return { id: "collar", points: bands };
}

/** Ankh: loop, crossbar, stem — carried as a small emblem at his core. */
export function ankh(): RegaliaPiece {
  const loop = [...arc([0, 0.62, 0.42], 0.075, 0, Math.PI * 2, "y", 20)];
  const crossbar = line([-0.13, 0.5, 0.42], [0.13, 0.5, 0.42], 12);
  const stem = line([0, 0.5, 0.42], [0, 0.16, 0.42], 12);
  return { id: "ankh", points: [...loop, ...crossbar, ...stem] };
}

export function allRegalia(): RegaliaPiece[] {
  return [crook(), flail(), atefCrown(), collar(), ankh()];
}
