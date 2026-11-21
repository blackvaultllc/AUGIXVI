/**
 * AUGIE'S LIVING WORLD SCENES (owner order 2026-11-21).
 * "Be creative. The code is alive. Respect the code."
 *
 * The particle trees were never the problem — they were the seed. This
 * module grows five living scenes from the SAME point-cloud machinery
 * that builds Augie and his world: the park's pines and the beach's
 * palms are literally sceneManager.makeObjectPoints("tree") output,
 * stamped, recolored and — for palms — reshaped. Nothing was deleted;
 * the tree code became the vegetation builder for a whole world.
 *
 * Scenes: the Office (populated — citizens at their desks), the Beach
 * (particle waves that actually move), the Desert, the Park (the
 * original pines, at home), the Coffee Shop (someone always just
 * walked in). Pure data + math; worldSceneRenderer.ts renders it.
 */
import { makeObjectPoints } from "./sceneManager";
import {
  buildPersonPoints,
  createSeededRandom,
  makeAppearance,
  type PersonDef,
  type Rgb,
  type Waypoint,
} from "./people";

export type WorldSceneId = "office" | "beach" | "desert" | "park" | "coffee";

export const WORLD_SCENES: readonly {
  id: WorldSceneId;
  name: string;
  blurb: string;
  /** What Augie says when the world changes to this scene. */
  line: string;
}[] = [
  {
    id: "office",
    name: "The Office",
    blurb: "The Command deck's office — desks in rows, the crew at work.",
    line: "The office — the crew is at their desks, working.",
  },
  {
    id: "beach",
    name: "The Beach",
    blurb: "Sand, palms, and water made of particles — the waves move.",
    line: "The beach — hear those particle waves rolling in.",
  },
  {
    id: "desert",
    name: "The Desert",
    blurb: "Dunes, cacti, a low sun and a long quiet.",
    line: "The desert — hot, quiet, endless.",
  },
  {
    id: "park",
    name: "The Park",
    blurb: "The original pines, a path, a bench — the trees at home.",
    line: "The park — your pines are home here.",
  },
  {
    id: "coffee",
    name: "The Coffee Shop",
    blurb: "A counter, warm light, and someone always just walking in.",
    line: "The coffee shop — someone's always just walked in.",
  },
];

export const DEFAULT_WORLD_SCENE: WorldSceneId = "office";

/**
 * The whole scene — set, water and citizens together — stays under this
 * many points so the stage keeps a smooth frame rate next to Augie's
 * own cloud. Measured per scene in the tests; the park (five pines) is
 * the heavyweight and still lands well under.
 */
export const SCENE_PARTICLE_BUDGET = 16000;

/* --------------------------- cloud builder --------------------------- */

class Cloud {
  positions: number[] = [];
  colors: number[] = [];
  constructor(private random: () => number) {}
  point(x: number, y: number, z: number, color: Rgb, jitter = 0.014) {
    const r = this.random;
    this.positions.push(
      x + (r() - 0.5) * 2 * jitter,
      y + (r() - 0.5) * 2 * jitter,
      z + (r() - 0.5) * 2 * jitter,
    );
    this.colors.push(color[0], color[1], color[2]);
  }
  line(a: readonly [number, number, number], b: readonly [number, number, number], n: number, color: Rgb) {
    for (let i = 0; i < n; i += 1) {
      const t = n === 1 ? 0 : i / (n - 1);
      this.point(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, color, 0.01);
    }
  }
  /** Flat grid of points over a rectangle at height y(x,z). */
  ground(
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    step: number,
    fn: (x: number, z: number) => { y: number; color: Rgb },
  ) {
    for (let x = x0; x <= x1 + 0.001; x += step) {
      for (let z = z0; z <= z1 + 0.001; z += step) {
        const { y, color } = fn(x, z);
        this.point(x, y, z, color, step * 0.22);
      }
    }
  }
  /** A filled horizontal rectangle (table tops, desk tops, towels). */
  slab(cx: number, y: number, cz: number, w: number, d: number, step: number, color: Rgb) {
    for (let x = cx - w / 2; x <= cx + w / 2 + 0.001; x += step) {
      for (let z = cz - d / 2; z <= cz + d / 2 + 0.001; z += step) {
        this.point(x, y, z, color, step * 0.2);
      }
    }
  }
  /** A filled vertical rectangle facing +z (counter fronts, panels). */
  panel(cx: number, cy: number, cz: number, w: number, h: number, step: number, color: Rgb) {
    for (let x = cx - w / 2; x <= cx + w / 2 + 0.001; x += step) {
      for (let y = cy - h / 2; y <= cy + h / 2 + 0.001; y += step) {
        this.point(x, y, cz, color, step * 0.2);
      }
    }
  }
  boxEdges(cx: number, cy: number, cz: number, w: number, h: number, d: number, n: number, color: Rgb) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const corners: [number, number, number][] = [
      [x0, y0, z0], [x1, y0, z0], [x0, y1, z0], [x1, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x0, y1, z1], [x1, y1, z1],
    ];
    const edges = [[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]] as const;
    for (const [a, b] of edges) this.line(corners[a]!, corners[b]!, n, color);
  }
  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, n: number, color: Rgb) {
    for (let i = 0; i < n; i += 1) {
      const y = this.random() * 2 - 1;
      const angle = this.random() * Math.PI * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const s = 0.8 + this.random() * 0.2;
      this.point(cx + Math.cos(angle) * ring * rx * s, cy + y * ry * s, cz + Math.sin(angle) * ring * rz * s, color, 0.008);
    }
  }
  cone(cx: number, baseY: number, cz: number, radius: number, height: number, n: number, color: Rgb) {
    for (let i = 0; i < n; i += 1) {
      const y = this.random() * height;
      const angle = this.random() * Math.PI * 2;
      const r = radius * (1 - y / height) * (0.6 + this.random() * 0.4);
      this.point(cx + Math.cos(angle) * r, baseY + y, cz + Math.sin(angle) * r, color, 0.01);
    }
  }
  /** A flat disc of points facing the camera (suns, table tops from above use slab). */
  disc(cx: number, cy: number, cz: number, radius: number, n: number, color: Rgb) {
    for (let i = 0; i < n; i += 1) {
      const angle = this.random() * Math.PI * 2;
      const r = radius * Math.sqrt(this.random());
      this.point(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, cz, color, 0.01);
    }
  }
  /**
   * Stamp an existing point cloud (from the avatar's own shape builders)
   * into this scene — translated, scaled, recolored. This is how the
   * tree code becomes park pines, office plants and beach palms.
   */
  stamp(
    points: Float32Array,
    opts: {
      x?: number;
      y?: number;
      z?: number;
      scale?: number;
      sy?: number;
      colorFor: (x: number, y: number, z: number, index: number) => Rgb;
    },
  ) {
    const scale = opts.scale ?? 1;
    const sy = opts.sy ?? scale;
    for (let i = 0; i < points.length; i += 3) {
      const px = points[i]!, py = points[i + 1]!, pz = points[i + 2]!;
      this.point(
        (opts.x ?? 0) + px * scale,
        (opts.y ?? 0) + py * sy,
        (opts.z ?? 0) + pz * scale,
        opts.colorFor(px, py, pz, i / 3),
        0.006,
      );
    }
  }
}

const vary = (color: Rgb, amount: number, random: () => number): Rgb => {
  const f = 1 + (random() - 0.5) * 2 * amount;
  return [color[0] * f, color[1] * f, color[2] * f];
};

/* --------------------- the tree, alive in new shapes --------------------- */

const TRUNK: Rgb = [0.42, 0.3, 0.17];
const PINE_GREEN: Rgb = [0.3, 0.78, 0.42];
const PALM_GREEN: Rgb = [0.35, 0.85, 0.45];

/** Trunk points in the tree builder are the low, narrow ones (y<1, r<0.21). */
const isTrunkPoint = (x: number, y: number, z: number) =>
  y < 1.0 && Math.hypot(x, z) < 0.21;

function stampTree(
  cloud: Cloud,
  x: number,
  z: number,
  scale: number,
  density: number,
  green: Rgb,
  random: () => number,
) {
  cloud.stamp(makeObjectPoints("tree", density), {
    x,
    z,
    scale,
    colorFor: (px, py, pz) =>
      isTrunkPoint(px, py, pz) ? vary(TRUNK, 0.15, random) : vary(green, 0.22, random),
  });
}

/**
 * A palm IS the pine, reshaped: trunk stretched tall and leaning, canopy
 * flattened so the fronds droop. Same points, same count — new life.
 */
export function reshapeToPalm(points: Float32Array): Float32Array {
  const out = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 3) {
    const px = points[i]!, py = points[i + 1]!, pz = points[i + 2]!;
    if (py < 1.0) {
      const y = py * 2.1;
      out[i] = px * 0.55 + y * 0.16; // lean as it climbs
      out[i + 1] = y;
      out[i + 2] = pz * 0.55;
    } else {
      const radial = Math.hypot(px, pz);
      out[i] = px * 1.3 + 2.1 * 0.16;
      out[i + 1] = 2.1 + (py - 1.0) * 0.3 - radial * 0.5; // the droop
      out[i + 2] = pz * 1.3;
    }
  }
  return out;
}

function stampPalm(cloud: Cloud, x: number, z: number, scale: number, density: number, random: () => number) {
  cloud.stamp(reshapeToPalm(makeObjectPoints("tree", density)), {
    x,
    z,
    scale,
    colorFor: (px, py) => (py < 2.1 ? vary(TRUNK, 0.15, random) : vary(PALM_GREEN, 0.22, random)),
  });
}

/* ------------------------------- the beach ------------------------------- */

export const BEACH_WATER = {
  cols: 40,
  rows: 15,
  foam: 130,
  get count() {
    return this.cols * this.rows + this.foam;
  },
} as const;

const WATER_DEEP: Rgb = [0.1, 0.36, 0.78];
const WATER_SHALLOW: Rgb = [0.28, 0.68, 0.92];
const FOAM: Rgb = [0.95, 0.98, 1.0];

/** One frame of the sea: rows of points riding a traveling wave. */
export function writeWaterPoints(time: number, out: Float32Array) {
  const { cols, rows, foam } = BEACH_WATER;
  let i = 0;
  for (let r = 0; r < rows; r += 1) {
    const z = -7.6 + (r / (rows - 1)) * 6.25; // -7.6 .. -1.35
    const shoreFade = 0.45 + 0.55 * (r / (rows - 1));
    for (let c = 0; c < cols; c += 1) {
      const x = -8.6 + (c / (cols - 1)) * 17.2;
      out[i] = x;
      out[i + 1] =
        0.1 +
        shoreFade *
          (0.15 * Math.sin(x * 0.9 + time * 1.7) +
            0.12 * Math.sin(z * 1.7 - time * 1.25) +
            0.06 * Math.sin((x + z) * 2.3 + time * 2.6));
      out[i + 2] = z;
      i += 3;
    }
  }
  // The foam edge breathes in and out over the sand.
  const shoreline = -1.32 + Math.sin(time * 0.45) * 0.3;
  for (let f = 0; f < foam; f += 1) {
    const spread = (f * 0.6180339887) % 1;
    out[i] = -8.4 + spread * 16.8;
    out[i + 1] = 0.07;
    out[i + 2] = shoreline + Math.sin(f * 12.9898) * 0.16;
    i += 3;
  }
}

function waterColors(): Float32Array {
  const colors: number[] = [];
  const { cols, rows, foam } = BEACH_WATER;
  for (let r = 0; r < rows; r += 1) {
    const t = r / (rows - 1);
    const color: Rgb = [
      WATER_DEEP[0] + (WATER_SHALLOW[0] - WATER_DEEP[0]) * t,
      WATER_DEEP[1] + (WATER_SHALLOW[1] - WATER_DEEP[1]) * t,
      WATER_DEEP[2] + (WATER_SHALLOW[2] - WATER_DEEP[2]) * t,
    ];
    for (let c = 0; c < cols; c += 1) colors.push(color[0], color[1], color[2]);
  }
  for (let f = 0; f < foam; f += 1) colors.push(FOAM[0], FOAM[1], FOAM[2]);
  return new Float32Array(colors);
}

/* ------------------------------ scene builds ------------------------------ */

export type BuiltScene = {
  id: WorldSceneId;
  staticPositions: Float32Array;
  staticColors: Float32Array;
  staticCount: number;
  water: { positions: Float32Array; colors: Float32Array; count: number } | null;
  people: readonly PersonDef[];
  /** Static + water + every citizen's cloud — the number the budget caps. */
  totalParticles: number;
};

function finish(
  id: WorldSceneId,
  cloud: Cloud,
  people: readonly PersonDef[],
  water: BuiltScene["water"],
): BuiltScene {
  const peoplePoints = people.reduce(
    (sum, def) =>
      sum + buildPersonPoints(def.appearance, { mode: "stand", gaitTime: 0, time: 0 }).count,
    0,
  );
  return {
    id,
    staticPositions: new Float32Array(cloud.positions),
    staticColors: new Float32Array(cloud.colors),
    staticCount: cloud.positions.length / 3,
    water,
    people,
    totalParticles: cloud.positions.length / 3 + (water?.count ?? 0) + peoplePoints,
  };
}

const wp = (
  x: number,
  z: number,
  mode: Waypoint["mode"],
  dwell: readonly [number, number],
  face?: number,
): Waypoint => (face === undefined ? { x, z, mode, dwell } : { x, z, mode, dwell, face });

/* ------------------------------- THE OFFICE ------------------------------- */

function buildOffice(): BuiltScene {
  const random = createSeededRandom(101);
  const cloud = new Cloud(random);
  const FLOOR: Rgb = [0.13, 0.21, 0.34];
  const FLOOR_EDGE: Rgb = [0.2, 0.6, 0.75];
  cloud.ground(-7, 7, -6, 2, 0.58, (x, z) => ({
    y: 0,
    color:
      Math.abs(x) > 6.6 || Math.abs(z + 2) > 3.8 ? vary(FLOOR_EDGE, 0.1, random) : vary(FLOOR, 0.16, random),
  }));
  // Back wall: window frames glowing faint steel blue.
  for (const wx of [-4.4, 0, 4.4]) {
    cloud.boxEdges(wx, 2.6, -6, 3.4, 2.6, 0.1, 10, [0.3, 0.55, 0.75]);
  }
  // Ceiling light strips.
  for (const lz of [-1.6, -4.2]) cloud.line([-5.4, 4.3, lz], [5.4, 4.3, lz], 40, [0.8, 0.92, 1.0]);

  const DESK_TOP: Rgb = [0.5, 0.38, 0.24];
  const DESK_EDGE: Rgb = [0.62, 0.48, 0.3];
  const SCREEN: Rgb = [0.35, 0.8, 0.95];
  const desk = (cx: number, cz: number) => {
    cloud.slab(cx, 1.42, cz, 1.9, 0.95, 0.19, vary(DESK_TOP, 0.08, random));
    cloud.boxEdges(cx, 1.38, cz, 1.9, 0.08, 0.95, 7, DESK_EDGE);
    for (const lx of [-0.85, 0.85]) {
      for (const lz of [-0.38, 0.38]) cloud.line([cx + lx, 0, cz + lz], [cx + lx, 1.4, cz + lz], 9, DESK_EDGE);
    }
    // Monitor + screen glow at the back of the desk.
    cloud.boxEdges(cx, 1.85, cz - 0.28, 0.95, 0.58, 0.06, 8, [0.4, 0.45, 0.5]);
    cloud.panel(cx, 1.85, cz - 0.24, 0.85, 0.48, 0.16, SCREEN);
    cloud.line([cx, 1.42, cz - 0.28], [cx, 1.58, cz - 0.28], 4, [0.4, 0.45, 0.5]);
    // Chair on the camera side.
    cloud.slab(cx, 0.8, cz + 0.78, 0.62, 0.55, 0.15, [0.3, 0.3, 0.38]);
    cloud.panel(cx, 1.25, cz + 1.02, 0.62, 0.85, 0.15, [0.3, 0.3, 0.38]);
    for (const lx of [-0.26, 0.26]) cloud.line([cx + lx, 0, cz + 0.62], [cx + lx, 0.8, cz + 0.62], 6, [0.35, 0.35, 0.42]);
  };
  const deskXs = [-4.8, -1.7, 1.7, 4.8];
  const deskZs = [-2.3, -4.5];
  for (const dz of deskZs) for (const dx of deskXs) desk(dx, dz);

  // Water cooler in the back corner.
  cloud.ellipsoid(6.3, 0.55, -5.3, 0.26, 0.55, 0.26, 90, [0.75, 0.8, 0.85]);
  cloud.ellipsoid(6.3, 1.45, -5.3, 0.2, 0.35, 0.2, 60, [0.45, 0.75, 0.95]);
  // Office plants — the tree code again, desk-sized.
  stampTree(cloud, -6.4, -5.4, 0.34, 0.3, PINE_GREEN, random);
  stampTree(cloud, 6.5, -0.7, 0.3, 0.3, PINE_GREEN, random);

  const seat = (dx: number, dz: number) => ({ x: dx, z: dz + 0.78 });
  const breaks: [number, number][] = [
    [6.0, -4.8],
    [-3.0, -5.4],
    [6.1, -1.2],
    [-6.0, -4.6],
    [0.2, -5.5],
  ];
  const seats: [number, number][] = [
    [-4.8, -2.3],
    [-1.7, -2.3],
    [1.7, -2.3],
    [-4.8, -4.5],
    [4.8, -4.5],
  ];
  const people: PersonDef[] = seats.map(([dx, dz], i) => {
    const s = seat(dx, dz);
    const b = breaks[i % breaks.length]!;
    return {
      appearance: makeAppearance(i, 21),
      waypoints: [
        wp(s.x, s.z, "work", [7, 14], Math.PI),
        wp(b[0], b[1], "stand", [2.5, 4.5]),
      ],
    };
  });
  people.push(
    {
      appearance: makeAppearance(5, 21),
      waypoints: [
        wp(-5.6, 0.9, "stand", [0.6, 1.6]),
        wp(5.6, 0.9, "stand", [0.6, 1.6]),
        wp(5.6, -3.3, "stand", [0.6, 1.6]),
        wp(-5.6, -3.3, "stand", [0.6, 1.6]),
      ],
    },
    {
      appearance: makeAppearance(6, 21),
      waypoints: [
        wp(-5.8, -1.1, "stand", [1, 2]),
        wp(1.7, -1.35, "stand", [3, 5], Math.PI),
        wp(5.9, -1.1, "stand", [1, 2]),
        wp(-1.7, -1.35, "stand", [3, 5], Math.PI),
      ],
    },
    {
      appearance: makeAppearance(7, 21),
      waypoints: [
        wp(-2.5, 1.5, "stand", [0.8, 2]),
        wp(2.5, 1.5, "stand", [0.8, 2]),
        wp(2.5, -0.5, "stand", [0.8, 2]),
        wp(-2.5, -0.5, "stand", [0.8, 2]),
      ],
    },
  );
  return finish("office", cloud, people, null);
}

/* ------------------------------- THE BEACH -------------------------------- */

function buildBeach(): BuiltScene {
  const random = createSeededRandom(202);
  const cloud = new Cloud(random);
  const SAND: Rgb = [0.88, 0.72, 0.46];
  cloud.ground(-8, 8, -1.6, 2.5, 0.45, () => ({ y: 0.02, color: vary(SAND, 0.14, random) }));
  // Umbrella + towel.
  cloud.line([-2.6, 0, 0.9], [-2.45, 2.0, 0.9], 12, [0.6, 0.6, 0.62]);
  cloud.cone(-2.4, 1.85, 0.9, 1.2, 0.55, 150, [0.95, 0.5, 0.4]);
  cloud.ground(-4.0, -2.9, 0.85, 2.1, 0.22, (x) => ({
    y: 0.05,
    color: Math.floor((x + 4.0) / 0.28) % 2 === 0 ? [0.3, 0.75, 0.75] : [0.95, 0.95, 0.95],
  }));
  // Palms — the pine, reshaped.
  stampPalm(cloud, -5.6, -0.7, 1.05, 0.55, random);
  stampPalm(cloud, 5.9, -1.8, 0.9, 0.55, random);
  // Sun + clouds.
  cloud.disc(-4.6, 3.7, -8.2, 0.85, 150, [1.0, 0.82, 0.38]);
  cloud.ellipsoid(3.5, 4.0, -7.5, 1.5, 0.4, 0.5, 170, [0.92, 0.95, 1.0]);
  cloud.ellipsoid(-1.2, 4.4, -8, 1.1, 0.32, 0.4, 140, [0.92, 0.95, 1.0]);

  const waterPositions = new Float32Array(BEACH_WATER.count * 3);
  writeWaterPoints(0, waterPositions);
  const people: PersonDef[] = [
    {
      appearance: makeAppearance(1, 33),
      speed: 0.7,
      waypoints: [wp(-6.5, -0.9, "stand", [1.5, 3], Math.PI), wp(6.5, -0.9, "stand", [1.5, 3], Math.PI)],
    },
    {
      appearance: makeAppearance(2, 33),
      waypoints: [wp(-3.45, 1.15, "sit", [40, 60], Math.PI)],
    },
    {
      appearance: makeAppearance(3, 33),
      speed: 0.6,
      waypoints: [wp(1.8, -1.0, "stand", [4, 7], Math.PI), wp(3.4, -0.5, "stand", [3, 5], Math.PI)],
    },
  ];
  return finish("beach", cloud, people, {
    positions: waterPositions,
    colors: waterColors(),
    count: BEACH_WATER.count,
  });
}

/* ------------------------------- THE DESERT ------------------------------- */

function buildDesert(): BuiltScene {
  const random = createSeededRandom(303);
  const cloud = new Cloud(random);
  const DUNE_LOW: Rgb = [0.82, 0.6, 0.33];
  const DUNE_HIGH: Rgb = [0.96, 0.74, 0.43];
  const duneY = (x: number, z: number) => {
    const swell = Math.max(0, Math.sin(x * 0.3 + 1.0) * Math.cos(z * 0.22));
    const backWeight = z < -1 ? 1 : 0.22;
    return 0.85 * Math.pow(swell, 1.5) * backWeight;
  };
  cloud.ground(-9, 9, -7, 2.5, 0.6, (x, z) => {
    const y = duneY(x, z);
    const t = Math.min(1, y / 0.85);
    return {
      y,
      color: vary(
        [
          DUNE_LOW[0] + (DUNE_HIGH[0] - DUNE_LOW[0]) * t,
          DUNE_LOW[1] + (DUNE_HIGH[1] - DUNE_LOW[1]) * t,
          DUNE_LOW[2] + (DUNE_HIGH[2] - DUNE_LOW[2]) * t,
        ],
        0.1,
        random,
      ),
    };
  });
  // Saguaro cacti — ring stacks, the vegetation language again.
  const CACTUS: Rgb = [0.3, 0.66, 0.36];
  const cactus = (cx: number, cz: number, s: number) => {
    const baseY = duneY(cx, cz);
    const trunk = (x: number, y0: number, z: number, h: number, r: number) => {
      const rings = Math.max(3, Math.round(h / 0.22));
      for (let ring = 0; ring < rings; ring += 1) {
        const y = y0 + ring * 0.22;
        for (let i = 0; i < 9; i += 1) {
          const a = (i / 9) * Math.PI * 2 + ring * 0.4;
          cloud.point(x + Math.cos(a) * r, y, z + Math.sin(a) * r, vary(CACTUS, 0.12, random), 0.01);
        }
      }
    };
    trunk(cx, baseY, cz, 2.2 * s, 0.16 * s);
    // Arms: out, then up.
    for (const side of [-1, 1] as const) {
      const ax = cx + side * 0.34 * s;
      cloud.line([cx + side * 0.14 * s, baseY + 1.15 * s, cz], [ax, baseY + 1.15 * s, cz], 6, CACTUS);
      trunk(ax, baseY + 1.15 * s, cz, 0.75 * s, 0.11 * s);
    }
  };
  cactus(-3.4, -2.8, 1.0);
  cactus(2.9, -3.4, 0.8);
  cactus(5.6, -1.4, 0.65);
  cactus(-6.2, -1.8, 0.75);
  // Rocks.
  for (const [rx, rz, rs] of [
    [-1.8, -0.9, 0.3],
    [4.3, 0.6, 0.22],
    [-5.2, 0.9, 0.26],
    [1.4, -4.6, 0.38],
  ] as const) {
    cloud.ellipsoid(rx, duneY(rx, rz) + 0.05, rz, rs, rs * 0.55, rs * 0.8, 80, [0.55, 0.45, 0.38]);
  }
  // A mesa on the horizon — the mountain builder, flattened and rusted.
  cloud.stamp(makeObjectPoints("mountain", 0.3), {
    x: -6.8,
    z: -8.4,
    scale: 1.5,
    sy: 0.68,
    colorFor: () => vary([0.78, 0.42, 0.26], 0.18, random),
  });
  // Low, heavy sun.
  cloud.disc(5.6, 1.6, -8.6, 1.3, 220, [1.0, 0.62, 0.26]);

  const people: PersonDef[] = [
    {
      appearance: makeAppearance(4, 44),
      speed: 0.7,
      waypoints: [wp(-7.5, 0.7, "stand", [1, 2]), wp(7.5, -0.7, "stand", [1, 2])],
    },
    {
      appearance: makeAppearance(5, 44),
      speed: 0.65,
      waypoints: [wp(7.2, 1.3, "stand", [1, 2]), wp(-7.2, 1.6, "stand", [1, 2])],
    },
    {
      appearance: makeAppearance(6, 44),
      speed: 0.6,
      waypoints: [wp(2.2, -0.6, "stand", [5, 8], Math.PI * 0.9), wp(4.4, -0.4, "stand", [3, 5])],
    },
  ];
  return finish("desert", cloud, people, null);
}

/* -------------------------------- THE PARK -------------------------------- */

function buildPark(): BuiltScene {
  const random = createSeededRandom(404);
  const cloud = new Cloud(random);
  const GRASS: Rgb = [0.3, 0.66, 0.3];
  cloud.ground(-8, 8, -6.5, 2.5, 0.55, () => ({ y: 0, color: vary(GRASS, 0.2, random) }));
  // The winding path.
  const pathX = (z: number) => 1.2 * Math.sin(z * 0.55);
  for (let z = 2.4; z >= -5.6; z -= 0.3) {
    for (let off = -0.7; off <= 0.7; off += 0.28) {
      cloud.point(pathX(z) + off, 0.02, z, vary([0.82, 0.7, 0.5], 0.12, random), 0.05);
    }
  }
  // THE PINES — the original environment trees, at their original spots.
  stampTree(cloud, -6.25, -3.65, 0.82, 0.55, PINE_GREEN, random);
  stampTree(cloud, -3.65, -4.7, 0.72, 0.55, PINE_GREEN, random);
  stampTree(cloud, 6.2, -3.8, 0.86, 0.55, PINE_GREEN, random);
  stampTree(cloud, 4.0, -5.5, 1.0, 0.5, PINE_GREEN, random);
  stampTree(cloud, -1.6, -5.9, 0.9, 0.5, PINE_GREEN, random);
  // Benches — planks and legs, a place to sit.
  const WOOD: Rgb = [0.5, 0.36, 0.2];
  const bench = (cx: number, cz: number) => {
    for (const off of [-0.18, 0.02, 0.22]) cloud.slab(cx, 0.8, cz + off, 1.9, 0.15, 0.16, vary(WOOD, 0.08, random));
    for (const off of [0, 0.22]) cloud.slab(cx, 1.22 + off * 0.9, cz + 0.42 + off * 0.18, 1.9, 0.13, 0.16, vary(WOOD, 0.08, random));
    for (const lx of [-0.8, 0.8]) {
      cloud.line([cx + lx, 0, cz - 0.15], [cx + lx, 0.8, cz - 0.15], 6, [0.3, 0.3, 0.32]);
      cloud.line([cx + lx, 0, cz + 0.3], [cx + lx, 1.35, cz + 0.48], 8, [0.3, 0.3, 0.32]);
    }
  };
  bench(-2.6, -0.9);
  bench(3.1, -2.9);
  // Lamp posts with warm globes.
  for (const [lx, lz] of [
    [1.9, 0.9],
    [-0.6, -3.6],
  ] as const) {
    cloud.line([lx, 0, lz], [lx, 2.6, lz], 16, [0.25, 0.25, 0.3]);
    cloud.ellipsoid(lx, 2.75, lz, 0.17, 0.19, 0.17, 55, [1.0, 0.85, 0.55]);
  }
  // Flower clusters along the path.
  const PETALS: Rgb[] = [
    [0.95, 0.5, 0.65],
    [0.98, 0.85, 0.35],
    [0.95, 0.95, 0.98],
    [0.75, 0.55, 0.95],
  ];
  for (let cluster = 0; cluster < 6; cluster += 1) {
    const cz = 1.8 - cluster * 1.25;
    const cx = pathX(cz) + (cluster % 2 === 0 ? 1.25 : -1.25);
    for (let i = 0; i < 36; i += 1) {
      cloud.point(
        cx + (random() - 0.5) * 0.7,
        0.14 + random() * 0.12,
        cz + (random() - 0.5) * 0.7,
        PETALS[Math.floor(random() * PETALS.length)]!,
        0.02,
      );
    }
  }

  const people: PersonDef[] = [
    {
      appearance: makeAppearance(8, 55),
      waypoints: [wp(-2.6, -0.82, "sit", [45, 70], Math.PI)],
    },
    {
      appearance: makeAppearance(9, 55),
      speed: 0.8,
      waypoints: [
        wp(1.12, 2.2, "stand", [0.8, 1.6]),
        wp(0.33, 0.5, "stand", [0.8, 1.6]),
        wp(-0.93, -1.6, "stand", [0.8, 1.6]),
        wp(-1.15, -3.4, "stand", [0.8, 1.6]),
        wp(-0.33, -5.2, "stand", [1.5, 2.5]),
      ],
    },
    {
      appearance: makeAppearance(10, 55),
      speed: 0.75,
      waypoints: [
        wp(0.12, -5.0, "stand", [1, 2]),
        wp(-0.7, -3.2, "stand", [1, 2]),
        wp(0.75, -1.2, "stand", [1, 2]),
        wp(1.55, 0.8, "stand", [1, 2]),
        wp(1.5, 2.3, "stand", [2, 3.5]),
      ],
    },
    {
      appearance: makeAppearance(11, 55),
      speed: 0.6,
      waypoints: [wp(2.2, 1.6, "stand", [4, 7], Math.PI * 1.2), wp(-1.9, -2.3, "stand", [3, 6], Math.PI * 0.8)],
    },
  ];
  return finish("park", cloud, people, null);
}

/* ----------------------------- THE COFFEE SHOP ----------------------------- */

function buildCoffee(): BuiltScene {
  const random = createSeededRandom(505);
  const cloud = new Cloud(random);
  const WOOD_FLOOR: Rgb = [0.46, 0.33, 0.21];
  cloud.ground(-7, 7, -5.5, 2.5, 0.55, (x) => ({
    y: 0,
    color: vary(Math.floor((x + 7) / 1.1) % 2 === 0 ? WOOD_FLOOR : [0.52, 0.38, 0.24], 0.1, random),
  }));
  // Back wall + menu board with its chalk lines.
  cloud.panel(-1.2, 3.0, -5.5, 3.6, 1.5, 0.3, [0.16, 0.15, 0.14]);
  cloud.boxEdges(-1.2, 3.0, -5.48, 3.6, 1.5, 0.05, 9, [0.7, 0.6, 0.4]);
  for (let row = 0; row < 4; row += 1) {
    cloud.line([-2.7, 3.5 - row * 0.32, -5.44], [-0.4 + (row % 2) * 0.5, 3.5 - row * 0.32, -5.44], 12, [0.92, 0.9, 0.78]);
  }
  // The counter.
  const COUNTER: Rgb = [0.55, 0.4, 0.26];
  cloud.panel(-1.6, 0.68, -3.85, 6.0, 1.36, 0.24, vary(COUNTER, 0.06, random));
  cloud.slab(-1.6, 1.4, -4.3, 6.2, 1.0, 0.22, [0.68, 0.52, 0.34]);
  // Espresso machine + a row of cups.
  cloud.boxEdges(-3.4, 1.78, -4.45, 1.1, 0.62, 0.55, 8, [0.75, 0.78, 0.82]);
  cloud.panel(-3.4, 1.78, -4.16, 0.95, 0.45, 0.15, [0.5, 0.55, 0.6]);
  for (const cupX of [-1.2, -0.7, 1.6]) {
    cloud.ellipsoid(cupX, 1.5, -4.1, 0.07, 0.09, 0.07, 16, [0.95, 0.95, 0.95]);
  }
  // Tables + chairs.
  const table = (cx: number, cz: number) => {
    cloud.slab(cx, 1.05, cz, 1.25, 1.25, 0.16, [0.6, 0.46, 0.3]);
    cloud.line([cx, 0, cz], [cx, 1.05, cz], 8, [0.4, 0.4, 0.42]);
    cloud.slab(cx, 0.04, cz, 0.6, 0.6, 0.15, [0.4, 0.4, 0.42]);
    cloud.ellipsoid(cx + 0.25, 1.14, cz - 0.15, 0.06, 0.08, 0.06, 14, [0.95, 0.95, 0.95]);
  };
  const chair = (cx: number, cz: number, backDz: number) => {
    cloud.slab(cx, 0.78, cz, 0.55, 0.5, 0.14, [0.42, 0.32, 0.22]);
    cloud.panel(cx, 1.2, cz + backDz, 0.55, 0.8, 0.14, [0.42, 0.32, 0.22]);
    for (const lx of [-0.22, 0.22]) cloud.line([cx + lx, 0, cz], [cx + lx, 0.78, cz], 6, [0.35, 0.3, 0.24]);
  };
  table(-3.6, -1.4);
  chair(-3.6, -0.68, 0.3);
  chair(-4.35, -1.4, 0);
  table(0.4, -2.0);
  chair(0.4, -1.28, 0.3);
  chair(1.15, -2.0, 0);
  table(3.9, -1.0);
  chair(3.9, -0.28, 0.3);
  chair(3.15, -1.0, 0);
  // Hanging lamps over the tables.
  for (const [lx, lz] of [
    [-3.6, -1.4],
    [0.4, -2.0],
    [3.9, -1.0],
  ] as const) {
    cloud.line([lx, 4.4, lz], [lx, 3.3, lz], 7, [0.3, 0.3, 0.3]);
    cloud.cone(lx, 2.95, lz, 0.34, 0.35, 40, [0.95, 0.75, 0.4]);
    cloud.ellipsoid(lx, 2.92, lz, 0.1, 0.08, 0.1, 18, [1.0, 0.9, 0.6]);
  }
  // Window on the right wall.
  cloud.boxEdges(6.9, 2.4, -1.5, 0.08, 2.4, 3.0, 9, [0.55, 0.75, 0.9]);

  const people: PersonDef[] = [
    {
      // The barista — behind the counter, back and forth along it.
      appearance: makeAppearance(12, 66),
      speed: 0.7,
      waypoints: [
        wp(-3.4, -4.95, "work", [4, 7], 0),
        wp(-0.5, -4.95, "stand", [2, 3.5], 0),
        wp(0.9, -4.95, "work", [3, 5], 0),
      ],
    },
    {
      appearance: makeAppearance(13, 66),
      waypoints: [wp(-3.6, -0.72, "sit", [40, 60], Math.PI)],
    },
    {
      appearance: makeAppearance(14, 66),
      waypoints: [wp(3.9, -0.32, "sit", [40, 60], Math.PI)],
    },
    {
      // The regular: in the door, up to the counter, then to a table.
      appearance: makeAppearance(15, 66),
      speed: 0.9,
      waypoints: [
        wp(0, 2.3, "stand", [0.4, 0.8], Math.PI),
        wp(0, -3.2, "stand", [2.5, 4], Math.PI),
        wp(0.4, -1.32, "sit", [14, 22], Math.PI),
        wp(0, 2.3, "stand", [0.4, 0.8], Math.PI),
      ],
    },
  ];
  return finish("coffee", cloud, people, null);
}

/* -------------------------------- registry -------------------------------- */

const BUILDERS: Record<WorldSceneId, () => BuiltScene> = {
  office: buildOffice,
  beach: buildBeach,
  desert: buildDesert,
  park: buildPark,
  coffee: buildCoffee,
};

export function buildScene(id: WorldSceneId): BuiltScene {
  return BUILDERS[id]();
}

export function sceneName(id: WorldSceneId): string {
  return WORLD_SCENES.find((scene) => scene.id === id)?.name ?? id;
}

export function sceneLine(id: WorldSceneId): string {
  return WORLD_SCENES.find((scene) => scene.id === id)?.line ?? "";
}

/* ------------------------------ phrase routing ----------------------------- */

const SCENE_WORDS: readonly (readonly [string, WorldSceneId])[] = [
  ["coffee shop", "coffee"],
  ["coffee", "coffee"],
  ["cafe", "coffee"],
  ["office", "office"],
  ["beach", "beach"],
  ["desert", "desert"],
  ["park", "park"],
];

function resolveSceneWord(word: string): WorldSceneId | null {
  for (const [name, id] of SCENE_WORDS) if (word === name) return id;
  return null;
}

/**
 * Scene phrases — typed or spoken, full-string like the room commands.
 * "Take me to the beach", "show me the desert", "office scene",
 * "/beach". The OFFICE WALK-IN keeps its own phrases: "go to the
 * office", "take me to the office", "enter the office" and bare
 * "office" return null here on purpose — that door is already his.
 */
export function parseSceneCommand(text: string): WorldSceneId | null {
  const phrase = text
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?…]+$/, "")
    .trim();
  if (!phrase) return null;

  const sceneSuffix = phrase.match(/^(.+?)\s+scene$/);
  if (sceneSuffix) {
    const resolved = resolveSceneWord(sceneSuffix[1]!);
    if (resolved) return resolved;
    // "switch to the office scene" lands here first with an unresolvable
    // prefix — fall through and let the verb pattern claim it instead.
  }

  const verb = phrase.match(
    /^(?:take me to|go to|show me|switch to|change to|head to|visit|open|enter)\s+(?:the\s+)?(.+?)(?:\s+scene)?$/,
  );
  if (verb) {
    const id = resolveSceneWord(verb[1]!);
    if (id === "office" && /^(?:go to|take me to|enter)\s/.test(phrase)) return null;
    return id;
  }

  // Bare names switch too — except bare "office" (the walk-in's word).
  if (phrase !== "office") return resolveSceneWord(phrase);
  return null;
}
