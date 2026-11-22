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
  line(
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    n: number,
    color: Rgb,
  ) {
    for (let i = 0; i < n; i += 1) {
      const t = n === 1 ? 0 : i / (n - 1);
      this.point(
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
        color,
        0.01,
      );
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
  boxEdges(
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    n: number,
    color: Rgb,
  ) {
    const x0 = cx - w / 2,
      x1 = cx + w / 2,
      y0 = cy - h / 2,
      y1 = cy + h / 2,
      z0 = cz - d / 2,
      z1 = cz + d / 2;
    const corners: [number, number, number][] = [
      [x0, y0, z0],
      [x1, y0, z0],
      [x0, y1, z0],
      [x1, y1, z0],
      [x0, y0, z1],
      [x1, y0, z1],
      [x0, y1, z1],
      [x1, y1, z1],
    ];
    const edges = [
      [0, 1],
      [0, 2],
      [0, 4],
      [1, 3],
      [1, 5],
      [2, 3],
      [2, 6],
      [3, 7],
      [4, 5],
      [4, 6],
      [5, 7],
      [6, 7],
    ] as const;
    for (const [a, b] of edges) this.line(corners[a]!, corners[b]!, n, color);
  }
  ellipsoid(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    n: number,
    color: Rgb,
  ) {
    for (let i = 0; i < n; i += 1) {
      const y = this.random() * 2 - 1;
      const angle = this.random() * Math.PI * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const s = 0.8 + this.random() * 0.2;
      this.point(
        cx + Math.cos(angle) * ring * rx * s,
        cy + y * ry * s,
        cz + Math.sin(angle) * ring * rz * s,
        color,
        0.008,
      );
    }
  }
  cone(
    cx: number,
    baseY: number,
    cz: number,
    radius: number,
    height: number,
    n: number,
    color: Rgb,
  ) {
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
      const px = points[i]!,
        py = points[i + 1]!,
        pz = points[i + 2]!;
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
const isTrunkPoint = (x: number, y: number, z: number) => y < 1.0 && Math.hypot(x, z) < 0.21;

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
    const px = points[i]!,
      py = points[i + 1]!,
      pz = points[i + 2]!;
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

function stampPalm(
  cloud: Cloud,
  x: number,
  z: number,
  scale: number,
  density: number,
  random: () => number,
) {
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
  /**
   * Multi-floor scenes (the Office, owner order 2026-11-21): distinct
   * floors joined by portals. When present, the scene-level fields
   * above mirror floor 1 and the renderer swaps floors as Augie walks
   * through a portal. totalParticles is the largest single floor —
   * only one floor is ever on stage at a time.
   */
  floors?: readonly BuiltFloor[];
};

export type PortalKind = "up" | "down";

export type PortalDef = {
  kind: PortalKind;
  x: number;
  z: number;
  /** How close Augie must walk to be carried through. */
  radius: number;
  /** Floor number this portal leads to. */
  toFloor: number;
  /** Where he materializes on the destination floor. */
  arriveX: number;
  arriveZ: number;
};

export type BuiltFloor = {
  floor: number;
  name: string;
  /** What Augie says when a portal delivers him to this floor. */
  line: string;
  staticPositions: Float32Array;
  staticColors: Float32Array;
  staticCount: number;
  people: readonly PersonDef[];
  portals: readonly PortalDef[];
  totalParticles: number;
};

/** A completed portal trip, handed to the stage so Augie lands + speaks. */
export type PortalTransition = {
  toFloor: number;
  floorName: string;
  line: string;
  arriveX: number;
  arriveZ: number;
};

function peoplePointCount(people: readonly PersonDef[]): number {
  return people.reduce(
    (sum, def) =>
      sum + buildPersonPoints(def.appearance, { mode: "stand", gaitTime: 0, time: 0 }).count,
    0,
  );
}

function finish(
  id: WorldSceneId,
  cloud: Cloud,
  people: readonly PersonDef[],
  water: BuiltScene["water"],
): BuiltScene {
  const peoplePoints = peoplePointCount(people);
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

/**
 * THE BIG OFFICE (owner order 2026-11-21): "make it a big office, make
 * it have different floors — if he wants to walk up to another floor he
 * can walk through a portal and go to the next floor, just like we had
 * the other office." One tower, three floors on the same enlarged
 * plate, joined by two portal doorways against the back wall: GOLD
 * carries him up, BLUE carries him down. He arrives in front of the
 * far floor's return door, facing into the room. The furniture is
 * scaled to the citizens' new height (see people.ts) so desks, chairs
 * and screens sit at honest proportions around them.
 *
 * Every floor keeps the same walking aisles clear — the front band
 * (z ≈ −1), the side aisles (|x| ≈ 7) and the back band (z ≈ −6.6) —
 * so the portal route the renderer walks him on never crosses a desk.
 */
const OFFICE_PLATE = { x0: -11, x1: 11, z0: -9, z1: 3 } as const;
/**
 * Desk/furniture scale against the ORIGINAL office build. The people
 * shrank (see people.ts), the desks matched them — then the owner
 * asked for the desks smaller still, in his words "that's how we can
 * conserve space on the screen" (2026-11-21). 0.62 it is: desk tops
 * sit at 0.88, right for a seated citizen, and the rows take
 * noticeably less of the frame.
 */
const FURNITURE_SCALE = 0.62;

const UP_SPOT = { x: -8.6, z: -7.7 } as const;
const DOWN_SPOT = { x: 8.6, z: -7.7 } as const;
const PORTAL_RADIUS = 0.85;
const PORTAL_UP_COLOR: Rgb = [1.0, 0.8, 0.35];
const PORTAL_DOWN_COLOR: Rgb = [0.4, 0.75, 1.0];

function portalArch(
  cloud: Cloud,
  random: () => number,
  spot: { x: number; z: number },
  color: Rgb,
) {
  const { x, z } = spot;
  for (const side of [-1, 1] as const) {
    cloud.line([x + side * 0.62, 0, z], [x + side * 0.62, 2.5, z], 16, color);
  }
  cloud.line([x - 0.62, 2.5, z], [x + 0.62, 2.5, z], 10, color);
  // Threshold ring on the floor — step inside it and the portal takes you.
  for (let i = 0; i < 26; i += 1) {
    const a = (i / 26) * Math.PI * 2;
    cloud.point(
      x + Math.cos(a) * PORTAL_RADIUS,
      0.06,
      z + Math.sin(a) * PORTAL_RADIUS,
      color,
      0.008,
    );
  }
  // Light rising inside the arch.
  for (let i = 0; i < 16; i += 1) {
    cloud.point(
      x + (random() - 0.5) * 0.9,
      0.25 + (i / 16) * 2.1,
      z + (random() - 0.5) * 0.16,
      color,
      0.02,
    );
  }
}

type DeskPalette = { top: Rgb; edge: Rgb; screen: Rgb };

/** A desk + monitor + chair, built at the citizens' scale. */
function officeDesk(
  cloud: Cloud,
  random: () => number,
  cx: number,
  cz: number,
  s: number,
  palette: DeskPalette,
) {
  cloud.slab(cx, 1.42 * s, cz, 1.9 * s, 0.95 * s, 0.19, vary(palette.top, 0.08, random));
  cloud.boxEdges(cx, 1.38 * s, cz, 1.9 * s, 0.08, 0.95 * s, 7, palette.edge);
  for (const lx of [-0.85 * s, 0.85 * s]) {
    for (const lz of [-0.38 * s, 0.38 * s]) {
      cloud.line([cx + lx, 0, cz + lz], [cx + lx, 1.4 * s, cz + lz], 9, palette.edge);
    }
  }
  // Monitor + screen glow at the back of the desk.
  cloud.boxEdges(cx, 1.85 * s, cz - 0.28 * s, 0.95 * s, 0.58 * s, 0.06, 8, [0.4, 0.45, 0.5]);
  cloud.panel(cx, 1.85 * s, cz - 0.24 * s, 0.85 * s, 0.48 * s, 0.16, palette.screen);
  cloud.line([cx, 1.42 * s, cz - 0.28 * s], [cx, 1.58 * s, cz - 0.28 * s], 4, [0.4, 0.45, 0.5]);
  // Chair on the camera side.
  cloud.slab(cx, 0.8 * s, cz + 0.78 * s, 0.62 * s, 0.55 * s, 0.15, [0.3, 0.3, 0.38]);
  cloud.panel(cx, 1.25 * s, cz + 1.02 * s, 0.62 * s, 0.85 * s, 0.15, [0.3, 0.3, 0.38]);
  for (const lx of [-0.26 * s, 0.26 * s]) {
    cloud.line(
      [cx + lx, 0, cz + 0.62 * s],
      [cx + lx, 0.8 * s, cz + 0.62 * s],
      6,
      [0.35, 0.35, 0.42],
    );
  }
}

/** Where a seated citizen sits relative to their desk. */
const seatOffset = FURNITURE_SCALE * 0.78;

function finishFloor(
  floor: number,
  name: string,
  line: string,
  cloud: Cloud,
  people: readonly PersonDef[],
  portals: readonly PortalDef[],
): BuiltFloor {
  return {
    floor,
    name,
    line,
    staticPositions: new Float32Array(cloud.positions),
    staticColors: new Float32Array(cloud.colors),
    staticCount: cloud.positions.length / 3,
    people,
    portals,
    totalParticles: cloud.positions.length / 3 + peoplePointCount(people),
  };
}

function officeGround(cloud: Cloud, random: () => number, base: Rgb, edge: Rgb) {
  cloud.ground(
    OFFICE_PLATE.x0,
    OFFICE_PLATE.x1,
    OFFICE_PLATE.z0,
    OFFICE_PLATE.z1,
    0.62,
    (x, z) => ({
      y: 0,
      color:
        Math.abs(x) > 10.4 || Math.abs(z + 3) > 5.5
          ? vary(edge, 0.1, random)
          : vary(base, 0.16, random),
    }),
  );
}

function buildOfficeFloor1(): BuiltFloor {
  const random = createSeededRandom(101);
  const cloud = new Cloud(random);
  officeGround(cloud, random, [0.13, 0.21, 0.34], [0.2, 0.6, 0.75]);
  // Back wall: window frames glowing faint steel blue.
  for (const wx of [-6, 0, 6]) {
    cloud.boxEdges(wx, 2.6, OFFICE_PLATE.z0, 3.4, 2.6, 0.1, 10, [0.3, 0.55, 0.75]);
  }
  // Ceiling light strips.
  for (const lz of [-2.2, -5.4]) cloud.line([-9, 4.3, lz], [9, 4.3, lz], 44, [0.8, 0.92, 1.0]);

  const palette: DeskPalette = {
    top: [0.5, 0.38, 0.24],
    edge: [0.62, 0.48, 0.3],
    screen: [0.35, 0.8, 0.95],
  };
  const deskXs = [-8.75, -5.25, -1.75, 1.75, 5.25, 8.75];
  const deskZs = [-3.0, -5.6];
  for (const dz of deskZs)
    for (const dx of deskXs) officeDesk(cloud, random, dx, dz, FURNITURE_SCALE, palette);

  // Water cooler in the back corner.
  cloud.ellipsoid(9.9, 0.44, -8.2, 0.21, 0.44, 0.21, 70, [0.75, 0.8, 0.85]);
  cloud.ellipsoid(9.9, 1.16, -8.2, 0.16, 0.28, 0.16, 48, [0.45, 0.75, 0.95]);
  // Office plants — the tree code again, desk-sized.
  stampTree(cloud, -10.2, -8.3, 0.34, 0.3, PINE_GREEN, random);
  stampTree(cloud, 10.3, -1.0, 0.3, 0.3, PINE_GREEN, random);

  portalArch(cloud, random, UP_SPOT, PORTAL_UP_COLOR);

  const breaks: [number, number][] = [
    [9.3, -7.3],
    [-3.0, -8.2],
    [9.8, -1.6],
    [-9.8, -4.9],
    [0.2, -8.3],
  ];
  const seats: [number, number][] = [
    [-8.75, -3.0],
    [-5.25, -3.0],
    [1.75, -3.0],
    [-5.25, -5.6],
    [5.25, -5.6],
  ];
  const people: PersonDef[] = seats.map(([dx, dz], i) => {
    const b = breaks[i % breaks.length]!;
    return {
      appearance: makeAppearance(i, 21),
      waypoints: [
        wp(dx, dz + seatOffset, "work", [7, 14], Math.PI),
        wp(b[0], b[1], "stand", [2.5, 4.5]),
      ],
    };
  });
  people.push(
    {
      appearance: makeAppearance(5, 21),
      waypoints: [
        wp(-9.6, 0.9, "stand", [0.6, 1.6]),
        wp(9.6, 0.9, "stand", [0.6, 1.6]),
        wp(9.6, -4.4, "stand", [0.6, 1.6]),
        wp(-9.6, -4.4, "stand", [0.6, 1.6]),
      ],
    },
    {
      appearance: makeAppearance(6, 21),
      waypoints: [
        wp(-9.8, -1.1, "stand", [1, 2]),
        wp(1.75, -1.55, "stand", [3, 5], Math.PI),
        wp(9.9, -1.1, "stand", [1, 2]),
        wp(-1.75, -1.55, "stand", [3, 5], Math.PI),
      ],
    },
    {
      appearance: makeAppearance(7, 21),
      waypoints: [
        wp(-3.5, 1.6, "stand", [0.8, 2]),
        wp(3.5, 1.6, "stand", [0.8, 2]),
        wp(3.5, -0.6, "stand", [0.8, 2]),
        wp(-3.5, -0.6, "stand", [0.8, 2]),
      ],
    },
  );
  return finishFloor(
    1,
    "Floor 1 — Front Lobby & Desks",
    "Floor one — the lobby. The crew is at their desks.",
    cloud,
    people,
    [
      {
        kind: "up",
        x: UP_SPOT.x,
        z: UP_SPOT.z,
        radius: PORTAL_RADIUS,
        toFloor: 2,
        arriveX: DOWN_SPOT.x,
        arriveZ: DOWN_SPOT.z + 1.4,
      },
    ],
  );
}

function buildOfficeFloor2(): BuiltFloor {
  const random = createSeededRandom(102);
  const cloud = new Cloud(random);
  officeGround(cloud, random, [0.09, 0.15, 0.12], [0.15, 0.55, 0.35]);
  // Screen wall across the back: radar feeds and watch boards.
  for (const [wx, glow] of [
    [-6, [0.25, 0.8, 0.45]],
    [0, [0.3, 0.85, 0.9]],
    [6, [0.25, 0.8, 0.45]],
  ] as const) {
    cloud.boxEdges(wx, 2.3, OFFICE_PLATE.z0 + 0.05, 3.4, 1.9, 0.06, 9, [0.35, 0.4, 0.42]);
    cloud.panel(wx, 2.3, OFFICE_PLATE.z0 + 0.1, 3.1, 1.6, 0.28, glow as Rgb);
  }
  // Alert globes in the back corners.
  cloud.ellipsoid(-10.4, 3.4, -8.7, 0.17, 0.19, 0.17, 40, [0.95, 0.3, 0.25]);
  cloud.ellipsoid(10.4, 3.4, -8.7, 0.17, 0.19, 0.17, 40, [0.95, 0.3, 0.25]);
  // Ceiling strips, cooler light.
  for (const lz of [-2.2, -5.4]) cloud.line([-9, 4.3, lz], [9, 4.3, lz], 44, [0.75, 0.9, 0.8]);

  // The radar table — concentric rings and a sweep, mid-floor,
  // shrunk with the rest of the furniture (owner order 2026-11-21).
  const RADAR: Rgb = [0.3, 0.95, 0.55];
  cloud.line([0, 0, -3.2], [0, 0.6, -3.2], 6, [0.35, 0.4, 0.42]);
  for (const [ringR, n] of [
    [0.5, 22],
    [0.9, 36],
    [1.3, 50],
  ] as const) {
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      cloud.point(Math.cos(a) * ringR, 0.62, -3.2 + Math.sin(a) * ringR, RADAR, 0.008);
    }
  }
  cloud.line([0, 0.64, -3.2], [1.1, 0.64, -3.95], 12, RADAR);
  for (let i = 0; i < 46; i += 1) {
    const a = (i / 46) * Math.PI * 2;
    cloud.point(Math.cos(a) * 1.45, 0.05, -3.2 + Math.sin(a) * 1.45, [0.2, 0.5, 0.3], 0.008);
  }

  // Build benches along the side walls — the desk builder, watch colors.
  const benchPalette: DeskPalette = {
    top: [0.3, 0.34, 0.38],
    edge: [0.42, 0.46, 0.5],
    screen: [0.95, 0.7, 0.3],
  };
  for (const [bx, bz] of [
    [-8.75, -3.0],
    [-8.75, -5.6],
    [8.75, -3.0],
    [8.75, -5.6],
  ] as const) {
    officeDesk(cloud, random, bx, bz, FURNITURE_SCALE, benchPalette);
  }

  portalArch(cloud, random, UP_SPOT, PORTAL_UP_COLOR);
  portalArch(cloud, random, DOWN_SPOT, PORTAL_DOWN_COLOR);

  const people: PersonDef[] = [
    {
      appearance: makeAppearance(0, 31),
      waypoints: [
        wp(-8.75, -3.0 + seatOffset, "work", [8, 15], Math.PI),
        wp(-9.7, -7.3, "stand", [2, 4]),
      ],
    },
    {
      appearance: makeAppearance(1, 31),
      waypoints: [
        wp(8.75, -5.6 + seatOffset, "work", [8, 15], Math.PI),
        wp(9.7, -1.4, "stand", [2, 4]),
      ],
    },
    {
      // The radar watcher — stands at the table, crosses to the far side.
      appearance: makeAppearance(2, 31),
      speed: 0.6,
      waypoints: [
        wp(2.05, -3.2, "stand", [5, 8], -Math.PI / 2),
        wp(-2.05, -3.2, "stand", [5, 8], Math.PI / 2),
      ],
    },
    {
      appearance: makeAppearance(3, 31),
      waypoints: [
        wp(-9.6, 0.9, "stand", [0.8, 1.8]),
        wp(9.6, 0.9, "stand", [0.8, 1.8]),
        wp(9.6, -4.4, "stand", [0.8, 1.8]),
        wp(-9.6, -4.4, "stand", [0.8, 1.8]),
      ],
    },
    {
      // The aisle walker — his round IS the portal route's aisles.
      appearance: makeAppearance(4, 31),
      speed: 0.9,
      waypoints: [
        wp(-7.0, 1.4, "stand", [0.6, 1.4]),
        wp(7.0, 1.4, "stand", [0.6, 1.4]),
        wp(7.0, -6.6, "stand", [0.6, 1.4]),
        wp(-7.0, -6.6, "stand", [0.6, 1.4]),
      ],
    },
    {
      appearance: makeAppearance(5, 31),
      speed: 0.7,
      waypoints: [wp(-4, 0.2, "stand", [2, 4]), wp(4, 0.2, "stand", [2, 4])],
    },
  ];
  return finishFloor(
    2,
    "Floor 2 — War Room & Build Hall",
    "Floor two — the War Room. Radar's up, benches are hot.",
    cloud,
    people,
    [
      {
        kind: "up",
        x: UP_SPOT.x,
        z: UP_SPOT.z,
        radius: PORTAL_RADIUS,
        toFloor: 3,
        arriveX: DOWN_SPOT.x,
        arriveZ: DOWN_SPOT.z + 1.4,
      },
      {
        kind: "down",
        x: DOWN_SPOT.x,
        z: DOWN_SPOT.z,
        radius: PORTAL_RADIUS,
        toFloor: 1,
        arriveX: UP_SPOT.x,
        arriveZ: UP_SPOT.z + 1.4,
      },
    ],
  );
}

function buildOfficeFloor3(): BuiltFloor {
  const random = createSeededRandom(103);
  const cloud = new Cloud(random);
  officeGround(cloud, random, [0.15, 0.12, 0.09], [0.6, 0.45, 0.2]);
  // Window frames in gold on the back wall.
  for (const wx of [-6, 0, 6]) {
    cloud.boxEdges(wx, 2.6, OFFICE_PLATE.z0, 3.4, 2.6, 0.1, 10, [0.75, 0.58, 0.3]);
  }
  for (const lz of [-2.2, -5.4]) cloud.line([-9, 4.3, lz], [9, 4.3, lz], 44, [1.0, 0.85, 0.55]);

  // The rug — a deep red circle of points under the middle of the room.
  const RUG: Rgb = [0.45, 0.16, 0.14];
  for (const [ringR, n] of [
    [0.7, 20],
    [1.3, 34],
    [1.9, 48],
    [2.3, 56],
  ] as const) {
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      cloud.point(
        Math.cos(a) * ringR,
        0.05,
        -2.6 + Math.sin(a) * ringR,
        vary(RUG, 0.12, random),
        0.01,
      );
    }
  }

  // His desk at the back — grander than the staff desks, still
  // shrunk with the room (owner order 2026-11-21), the cube above it.
  officeDesk(cloud, random, 0, -6.4, 0.85, {
    top: [0.42, 0.3, 0.16],
    edge: [0.75, 0.58, 0.3],
    screen: [0.95, 0.8, 0.4],
  });
  cloud.boxEdges(0, 2.45, -6.4, 0.55, 0.55, 0.55, 7, [1.0, 0.8, 0.35]);

  // Bookshelves along both side walls — rows of spines in shelf colors.
  const BOOK_COLORS: Rgb[] = [
    [0.6, 0.25, 0.2],
    [0.25, 0.4, 0.6],
    [0.7, 0.55, 0.25],
    [0.35, 0.55, 0.35],
    [0.55, 0.35, 0.6],
  ];
  for (const sideX of [-10.6, 10.6]) {
    for (const shelfY of [0.6, 1.25, 1.9, 2.55]) {
      cloud.line([sideX, shelfY - 0.08, -8.2], [sideX, shelfY - 0.08, -1.8], 20, [0.4, 0.3, 0.18]);
      for (let seg = 0; seg < 7; seg += 1) {
        const z0 = -8.1 + seg * 0.9;
        cloud.line(
          [sideX, shelfY, z0],
          [sideX, shelfY + 0.42, z0],
          5,
          BOOK_COLORS[Math.floor(random() * BOOK_COLORS.length)]!,
        );
      }
    }
  }
  // A reading chair + side table on the right.
  cloud.slab(4.6, 0.42, -6.2, 0.7, 0.62, 0.15, [0.4, 0.24, 0.18]);
  cloud.panel(4.6, 0.85, -5.9, 0.7, 0.8, 0.15, [0.4, 0.24, 0.18]);
  cloud.slab(5.6, 0.62, -6.2, 0.5, 0.5, 0.14, [0.5, 0.38, 0.24]);

  portalArch(cloud, random, DOWN_SPOT, PORTAL_DOWN_COLOR);

  const people: PersonDef[] = [
    {
      // The lore scholar — shelf to shelf, long dwells with the books.
      appearance: makeAppearance(0, 41),
      speed: 0.55,
      waypoints: [
        wp(-9.8, -5.0, "stand", [6, 10], -Math.PI / 2),
        wp(9.8, -5.0, "stand", [6, 10], Math.PI / 2),
        wp(9.8, -2.6, "stand", [4, 7], Math.PI / 2),
        wp(-9.8, -2.6, "stand", [4, 7], -Math.PI / 2),
      ],
    },
    {
      appearance: makeAppearance(1, 41),
      waypoints: [wp(4.6, -6.05, "sit", [30, 45], Math.PI)],
    },
    {
      appearance: makeAppearance(2, 41),
      speed: 0.6,
      waypoints: [
        wp(-3.4, 0.8, "stand", [1.5, 3]),
        wp(3.4, 0.8, "stand", [1.5, 3]),
        wp(3.4, -1.2, "stand", [1.5, 3]),
        wp(-3.4, -1.2, "stand", [1.5, 3]),
      ],
    },
  ];
  return finishFloor(
    3,
    "Floor 3 — Osiris's Office & Lore Hall",
    "Floor three — my office. Mind the cube over the desk.",
    cloud,
    people,
    [
      {
        kind: "down",
        x: DOWN_SPOT.x,
        z: DOWN_SPOT.z,
        radius: PORTAL_RADIUS,
        toFloor: 2,
        arriveX: UP_SPOT.x,
        arriveZ: UP_SPOT.z + 1.4,
      },
    ],
  );
}

function buildOffice(): BuiltScene {
  const floors = [buildOfficeFloor1(), buildOfficeFloor2(), buildOfficeFloor3()];
  const first = floors[0]!;
  return {
    id: "office",
    staticPositions: first.staticPositions,
    staticColors: first.staticColors,
    staticCount: first.staticCount,
    water: null,
    people: first.people,
    totalParticles: Math.max(...floors.map((floor) => floor.totalParticles)),
    floors,
  };
}

/**
 * Floor phrases — typed or spoken, full-string like the scene commands.
 * "Next floor", "go through the portal", "floor down". Returns which
 * portal to walk to; the stage only honors it inside the office scene.
 */
export function parseFloorCommand(text: string): PortalKind | null {
  const phrase = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?…]+$/, "")
    .trim();
  if (!phrase) return null;
  if (
    /^(?:next floor|floor up|go up(?: a floor)?|up a floor|go through the portal|through the portal|enter the portal|take the portal|portal)$/.test(
      phrase,
    )
  ) {
    return "up";
  }
  if (
    /^(?:previous floor|floor down|go down(?: a floor)?|down a floor|back a floor)$/.test(phrase)
  ) {
    return "down";
  }
  return null;
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
      waypoints: [
        wp(-6.5, -0.9, "stand", [1.5, 3], Math.PI),
        wp(6.5, -0.9, "stand", [1.5, 3], Math.PI),
      ],
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
          cloud.point(
            x + Math.cos(a) * r,
            y,
            z + Math.sin(a) * r,
            vary(CACTUS, 0.12, random),
            0.01,
          );
        }
      }
    };
    trunk(cx, baseY, cz, 2.2 * s, 0.16 * s);
    // Arms: out, then up.
    for (const side of [-1, 1] as const) {
      const ax = cx + side * 0.34 * s;
      cloud.line(
        [cx + side * 0.14 * s, baseY + 1.15 * s, cz],
        [ax, baseY + 1.15 * s, cz],
        6,
        CACTUS,
      );
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
    for (const off of [-0.18, 0.02, 0.22])
      cloud.slab(cx, 0.8, cz + off, 1.9, 0.15, 0.16, vary(WOOD, 0.08, random));
    for (const off of [0, 0.22])
      cloud.slab(
        cx,
        1.22 + off * 0.9,
        cz + 0.42 + off * 0.18,
        1.9,
        0.13,
        0.16,
        vary(WOOD, 0.08, random),
      );
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
      waypoints: [
        wp(2.2, 1.6, "stand", [4, 7], Math.PI * 1.2),
        wp(-1.9, -2.3, "stand", [3, 6], Math.PI * 0.8),
      ],
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
    cloud.line(
      [-2.7, 3.5 - row * 0.32, -5.44],
      [-0.4 + (row % 2) * 0.5, 3.5 - row * 0.32, -5.44],
      12,
      [0.92, 0.9, 0.78],
    );
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
    for (const lx of [-0.22, 0.22])
      cloud.line([cx + lx, 0, cz], [cx + lx, 0.78, cz], 6, [0.35, 0.3, 0.24]);
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
