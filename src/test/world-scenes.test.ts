import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  BEACH_WATER,
  DEFAULT_WORLD_SCENE,
  SCENE_PARTICLE_BUDGET,
  WORLD_SCENES,
  buildScene,
  parseFloorCommand,
  parseSceneCommand,
  reshapeToPalm,
  writeWaterPoints,
  type WorldSceneId,
} from "@/avatar/worldScenes";
import {
  PeopleSim,
  buildPersonPoints,
  gaitAdvance,
  makeAppearance,
  strideCycleLength,
  type PersonDef,
} from "@/avatar/people";
import { makeObjectPoints, SceneManager } from "@/avatar/sceneManager";
import { WorldSceneManager, softenCitizenColors } from "@/avatar/worldSceneRenderer";

const SCENE_IDS = WORLD_SCENES.map((scene) => scene.id);

function expectFinite(values: Float32Array) {
  for (const value of values) expect(Number.isFinite(value)).toBe(true);
}

describe("living world scenes — registry", () => {
  it("fields exactly the five scenes, office at home as the default", () => {
    expect(SCENE_IDS).toEqual(["office", "beach", "desert", "park", "coffee"]);
    expect(DEFAULT_WORLD_SCENE).toBe("office");
    for (const scene of WORLD_SCENES) {
      expect(scene.name.length).toBeGreaterThan(0);
      expect(scene.blurb.length).toBeGreaterThan(0);
      expect(scene.line.length).toBeGreaterThan(0);
    }
  });
});

describe("living world scenes — builds stay inside the particle budget", () => {
  const expectedPeople: Record<WorldSceneId, number> = {
    office: 10,
    beach: 3,
    desert: 3,
    park: 4,
    coffee: 4,
  };
  for (const id of SCENE_IDS) {
    it(`builds ${id}: real points, matching colors, under budget`, () => {
      const built = buildScene(id);
      expect(built.staticCount).toBeGreaterThan(500);
      expect(built.staticPositions.length).toBe(built.staticCount * 3);
      expect(built.staticColors.length).toBe(built.staticCount * 3);
      expectFinite(built.staticPositions);
      expectFinite(built.staticColors);
      expect(built.people.length).toBe(expectedPeople[id]);
      expect(built.totalParticles).toBeGreaterThan(built.staticCount);
      expect(built.totalParticles).toBeLessThanOrEqual(SCENE_PARTICLE_BUDGET);
      if (id === "beach") {
        expect(built.water).not.toBeNull();
        expect(built.water!.count).toBe(BEACH_WATER.count);
        expect(built.water!.positions.length).toBe(BEACH_WATER.count * 3);
      } else {
        expect(built.water).toBeNull();
      }
    });
  }

  it("staffs the office with women and men", () => {
    const kinds = buildScene("office").people.map((person) => person.appearance.kind);
    expect(kinds).toContain("woman");
    expect(kinds).toContain("man");
  });
});

describe("the tree code, reshaped — never deleted", () => {
  it("a palm is the pine's own points: same count, stretched and drooped", () => {
    const tree = makeObjectPoints("tree", 0.55);
    const palm = reshapeToPalm(tree);
    expect(palm.length).toBe(tree.length);
    expectFinite(palm);
    const treeTop = Math.max(...Array.from(tree).filter((_, i) => i % 3 === 1));
    const palmTop = Math.max(...Array.from(palm).filter((_, i) => i % 3 === 1));
    expect(palmTop).toBeGreaterThan(treeTop); // the trunk stretches tall
  });

  it("reshapes a known point exactly: trunk stretches, canopy droops", () => {
    const input = new Float32Array([0, 0.5, 0, 0.7, 1.6, 0]);
    const palm = reshapeToPalm(input);
    expect(palm[1]).toBeCloseTo(0.5 * 2.1, 5); // trunk point: y * 2.1
    // canopy point: 2.1 + (1.6-1)*0.3 - 0.7*0.5 = 1.93 — lower than a
    // straight stretch would put it. That is the droop.
    expect(palm[4]).toBeCloseTo(1.93, 5);
  });
});

describe("beach water — the waves actually move", () => {
  it("rewrites a full, finite frame that changes with time", () => {
    const a = new Float32Array(BEACH_WATER.count * 3);
    const b = new Float32Array(BEACH_WATER.count * 3);
    writeWaterPoints(0, a);
    writeWaterPoints(1.3, b);
    expectFinite(a);
    expectFinite(b);
    let moved = 0;
    for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i]! - b[i]!) > 0.001) moved += 1;
    expect(moved).toBeGreaterThan(BEACH_WATER.count / 2); // the sea is not still
    // Foam stays at the shoreline band.
    const foamStart = BEACH_WATER.cols * BEACH_WATER.rows * 3;
    for (let i = foamStart + 2; i < a.length; i += 3) {
      expect(a[i]!).toBeGreaterThan(-1.9);
      expect(a[i]!).toBeLessThan(-0.7);
    }
  });
});

describe("citizens — figures from the same particle language", () => {
  it("builds a full person: stable count, colors matched, feet on the ground", () => {
    const figure = buildPersonPoints(makeAppearance(0), { mode: "stand", gaitTime: 0, time: 0 });
    // Part 18 density: solid people, not ghosts — the count moved
    // from ~470 to 742 and is pinned at both ends so it can't drift.
    expect(figure.count).toBeGreaterThanOrEqual(700);
    expect(figure.count).toBeLessThanOrEqual(800);
    expect(figure.positions.length).toBe(figure.count * 3);
    expect(figure.colors.length).toBe(figure.count * 3);
    expectFinite(figure.positions);
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < figure.positions.length; i += 3) {
      minY = Math.min(minY, figure.positions[i]!);
      maxY = Math.max(maxY, figure.positions[i]!);
    }
    expect(minY).toBeGreaterThanOrEqual(-0.05);
    // Owner order 2026-11-21: citizens stand well under Augie (~3.1) —
    // "they're very tall, they shouldn't be that tall. Make them smaller."
    // (Top of the bun included; heights run 2.02–2.26.)
    expect(maxY).toBeGreaterThan(2.0);
    expect(maxY).toBeLessThan(2.55);
  });

  it("keeps point order stable across poses, so colors stream once", () => {
    const appearance = makeAppearance(3);
    const standing = buildPersonPoints(appearance, { mode: "stand", gaitTime: 0, time: 0 });
    const walking = buildPersonPoints(appearance, { mode: "walk", gaitTime: 0.35, time: 0 });
    expect(walking.count).toBe(standing.count);
    expect(Array.from(walking.colors)).toEqual(Array.from(standing.colors));
    // …but the walk pose is genuinely different geometry (legs swing).
    let differs = false;
    for (let i = 0; i < standing.positions.length; i += 1) {
      if (Math.abs(standing.positions[i]! - walking.positions[i]!) > 0.05) differs = true;
    }
    expect(differs).toBe(true);
  });

  it("sits lower than it stands — the seated figure settles onto the chair", () => {
    const appearance = makeAppearance(1);
    const top = (mode: "stand" | "sit") => {
      const figure = buildPersonPoints(appearance, { mode, gaitTime: 0, time: 0 });
      let max = -Infinity;
      for (let i = 1; i < figure.positions.length; i += 3) {
        max = Math.max(max, figure.positions[i]!);
      }
      return max;
    };
    expect(top("sit")).toBeLessThan(top("stand") - 0.4);
  });
});

describe("citizens — the daily round (PeopleSim)", () => {
  const twoStop: PersonDef[] = [
    {
      appearance: makeAppearance(0),
      speed: 1,
      waypoints: [
        { x: 0, z: 0, mode: "stand", dwell: [0.05, 0.05] },
        { x: 3, z: 0, mode: "stand", dwell: [0.05, 0.05] },
      ],
    },
  ];

  it("spawns one citizen per definition, standing at the first waypoint", () => {
    const sim = new PeopleSim(twoStop);
    expect(sim.people.length).toBe(1);
    expect(sim.people[0]!.x).toBe(0);
    expect(sim.people[0]!.walking).toBe(false);
  });

  it("walks the round: gait phase advances, then it arrives and dwells", () => {
    const sim = new PeopleSim(twoStop);
    const person = sim.people[0]!;
    sim.tick(0.05); // dwell (0.05s) expires → sets off
    expect(person.walking).toBe(true);
    const startX = person.x;
    for (let i = 0; i < 10; i += 1) sim.tick(0.05);
    expect(person.x).toBeGreaterThan(startX);
    // The gait clock runs on ground covered (owner fix 2026-11-21),
    // so it advances slower than the old wall-time scurry did.
    expect(person.gaitTime).toBeGreaterThan(0.15); // the walk cycle is turning
    expect(person.mode).toBe("walk");
    // Tick to the moment of arrival (the round loops, so catch it there).
    for (let i = 0; i < 200 && person.walking; i += 1) sim.tick(0.05);
    expect(person.walking).toBe(false);
    expect(person.x).toBeCloseTo(3, 1);
    expect(person.mode).toBe("stand");
  });

  it("keeps the office crew at their desks while they work", () => {
    const office = buildScene("office");
    const sim = new PeopleSim(office.people);
    expect(sim.people.length).toBe(10);
    const worker = sim.people[0]!;
    const seat = office.people[0]!.waypoints[0]!;
    for (let i = 0; i < 40; i += 1) sim.tick(0.05); // 2 seconds in
    expect(worker.mode).toBe("work");
    expect(worker.x).toBe(seat.x);
    expect(worker.z).toBe(seat.z);
  });

  it("labels every department the owner named (Part 9)", () => {
    const office = buildScene("office");
    const labels = (office.floors ?? []).flatMap((floor) => floor.labels.map((l) => l.text));
    for (const name of ["FINANCE", "MAIN FLOOR", "MARKETING", "SOCIAL MEDIA", "SECURITY OPERATIONS"]) {
      expect(labels).toContain(name);
    }
    // And the boss's own office is labeled on his floor.
    expect(labels.some((text) => text.includes("OSIRIS"))).toBe(true);
  });

  it("floor 1's crew starts seated at work — nobody opens on a patrol loop (Part 9)", () => {
    const office = buildScene("office");
    for (const person of office.people) {
      expect(person.waypoints[0]!.mode).toBe("work");
    }
  });

  it("citizens are dense enough to read as solid people, not ghosts (Part 18)", () => {
    const figure = buildPersonPoints(makeAppearance(0, 21), { mode: "stand", gaitTime: 0, time: 0 });
    // Pre-Part-18 figures were ~470 points; the solid build is 700+.
    expect(figure.count).toBeGreaterThanOrEqual(700);
  });
});

describe("scene phrases — deterministic routing", () => {
  it("resolves the journeys", () => {
    expect(parseSceneCommand("take me to the beach")).toBe("beach");
    expect(parseSceneCommand("go to the park")).toBe("park");
    expect(parseSceneCommand("show me the desert")).toBe("desert");
    expect(parseSceneCommand("take me to the coffee shop")).toBe("coffee");
    expect(parseSceneCommand("coffee shop")).toBe("coffee");
    expect(parseSceneCommand("beach")).toBe("beach");
    expect(parseSceneCommand("/beach")).toBe("beach");
    expect(parseSceneCommand("Take me to the beach!")).toBe("beach");
  });

  it("routes the office scene by its own words", () => {
    expect(parseSceneCommand("office scene")).toBe("office");
    expect(parseSceneCommand("switch to the office scene")).toBe("office");
    expect(parseSceneCommand("show me the office")).toBe("office");
  });

  it("leaves the office walk-in its phrases — and everything else alone", () => {
    expect(parseSceneCommand("go to the office")).toBeNull();
    expect(parseSceneCommand("take me to the office")).toBeNull();
    expect(parseSceneCommand("enter the office")).toBeNull();
    expect(parseSceneCommand("office")).toBeNull();
    expect(parseSceneCommand("/office")).toBeNull();
    expect(parseSceneCommand("open the cube")).toBeNull();
    expect(parseSceneCommand("make a tree")).toBeNull();
    expect(parseSceneCommand("what time is it")).toBeNull();
    expect(parseSceneCommand("")).toBeNull();
  });
});

describe("WorldSceneManager — the stage side", () => {
  it("builds, switches and disposes scenes inside a three scene", () => {
    const scene = new THREE.Scene();
    const manager = new WorldSceneManager(scene);
    manager.setScene("office");
    expect(manager.currentScene).toBe("office");
    expect(manager.citizenCount).toBe(10);
    expect(manager.particleCount).toBeGreaterThan(0);
    expect(manager.particleCount).toBeLessThanOrEqual(SCENE_PARTICLE_BUDGET);
    expect(scene.getObjectByName("living-world-office-floor-1")).toBeDefined();

    manager.setScene("beach");
    expect(manager.currentScene).toBe("beach");
    expect(manager.citizenCount).toBe(3);
    expect(scene.getObjectByName("living-world-water")).toBeDefined();
    expect(scene.getObjectByName("living-world-office-floor-1")).toBeUndefined();
    manager.tick(0.05); // waves + citizens advance without error

    manager.dispose();
    expect(scene.children.length).toBe(0);
    expect(manager.currentScene).toBeNull();
  });

  it("lets the old backdrop step aside (SceneManager environment toggle)", () => {
    const scene = new THREE.Scene();
    const manager = new SceneManager(scene);
    const environment = scene.getObjectByName("avatar-particle-environment");
    expect(environment).toBeDefined();
    manager.setEnvironmentVisible(false);
    expect(environment!.visible).toBe(false);
    manager.setEnvironmentVisible(true);
    expect(environment!.visible).toBe(true);
    manager.dispose();
  });
});

describe("citizens — the facing law (owner defect 2026-11-21)", () => {
  // "The people around him look like they're walking backwards
  // sometimes." Measured before the fix: dot(facing, velocity) hit
  // −1.0 (dead backwards) in every scene. The law now: a citizen only
  // ever covers ground in the direction they face.
  for (const id of SCENE_IDS) {
    it(`${id}: no citizen ever translates against their facing`, () => {
      const sim = new PeopleSim(buildScene(id).people);
      let worst = 0;
      let travel = 0;
      for (let t = 0; t < 2400; t += 1) {
        const before = sim.people.map((p) => ({ x: p.x, z: p.z }));
        sim.tick(0.05);
        sim.people.forEach((person, i) => {
          const dx = person.x - before[i]!.x;
          const dz = person.z - before[i]!.z;
          const dist = Math.hypot(dx, dz);
          travel += dist;
          if (dist > 1e-6) {
            const dot = (Math.sin(person.heading) * dx + Math.cos(person.heading) * dz) / dist;
            if (dot < worst) worst = dot;
          }
        });
      }
      expect(worst).toBeGreaterThanOrEqual(-0.001);
      // …and the fix is not a freeze: the rounds still get walked.
      expect(travel).toBeGreaterThan(50);
    });
  }

  it("never snaps the heading on arrival — he turns to his facing while dwelling", () => {
    const defs: PersonDef[] = [
      {
        appearance: makeAppearance(0),
        speed: 1,
        waypoints: [
          { x: 0, z: 0, mode: "stand", dwell: [0.05, 0.05], face: 0 },
          { x: 3, z: 0, mode: "stand", dwell: [30, 30], face: Math.PI },
        ],
      },
    ];
    const sim = new PeopleSim(defs);
    const person = sim.people[0]!;
    let previousHeading = person.heading;
    let arrivalJump = 0;
    for (let t = 0; t < 200 && person.walking === false && t < 2; t += 1) sim.tick(0.05);
    expect(person.walking).toBe(true);
    previousHeading = person.heading;
    for (let t = 0; t < 400 && person.walking; t += 1) {
      sim.tick(0.05);
      if (person.walking) {
        previousHeading = person.heading;
      } else {
        arrivalJump = Math.abs(person.heading - previousHeading);
      }
    }
    expect(person.walking).toBe(false);
    // The arrival tick turns no faster than a walking turn allows —
    // the old snap jumped the full ~1.57 rad to the facing at once.
    expect(arrivalJump).toBeLessThanOrEqual(0.36);
    // Dwelling, he completes the turn to the waypoint's facing.
    for (let t = 0; t < 40; t += 1) sim.tick(0.05);
    expect(Math.abs(person.heading - Math.PI)).toBeLessThan(0.05);
  });

  it("runs the gait clock on ground covered, not wall time", () => {
    const height = 2.1;
    expect(gaitAdvance(strideCycleLength(height), height)).toBeCloseTo((Math.PI * 2) / 7, 5);
    const def: PersonDef = {
      appearance: makeAppearance(0),
      speed: 1,
      waypoints: [
        { x: 0, z: 0, mode: "stand", dwell: [0.05, 0.05] },
        { x: 4, z: 0, mode: "stand", dwell: [30, 30] },
      ],
    };
    const sim = new PeopleSim([def]);
    const person = sim.people[0]!;
    for (let t = 0; t < 400 && !person.walking; t += 1) sim.tick(0.05);
    for (let t = 0; t < 400 && person.walking; t += 1) sim.tick(0.05);
    const expected = gaitAdvance(4, def.appearance.height);
    expect(person.gaitTime).toBeGreaterThan(expected * 0.8);
    expect(person.gaitTime).toBeLessThan(expected * 1.2);
  });
});

describe("the big office — floors and portals (owner order 2026-11-21)", () => {
  it("builds three distinct floors, each inside the particle budget", () => {
    const office = buildScene("office");
    expect(office.floors).toBeDefined();
    expect(office.floors!.length).toBe(3);
    expect(office.floors!.map((floor) => floor.floor)).toEqual([1, 2, 3]);
    expect(new Set(office.floors!.map((floor) => floor.name)).size).toBe(3);
    for (const floor of office.floors!) {
      expect(floor.staticCount).toBeGreaterThan(500);
      expect(floor.totalParticles).toBeLessThanOrEqual(SCENE_PARTICLE_BUDGET);
      expect(floor.line.length).toBeGreaterThan(0);
    }
    // The scene-level roster is floor 1's crew.
    expect(office.people).toBe(office.floors![0]!.people);
    expect(office.people.length).toBe(10);
  });

  it("wires the portals: up from 1 and 2, down from 2 and 3, safe arrivals", () => {
    const office = buildScene("office");
    const kinds = (floorNumber: number) =>
      office
        .floors!.find((floor) => floor.floor === floorNumber)!
        .portals.map((p) => p.kind)
        .sort();
    expect(kinds(1)).toEqual(["up"]);
    expect(kinds(2)).toEqual(["down", "up"]);
    expect(kinds(3)).toEqual(["down"]);
    for (const floor of office.floors!) {
      for (const portal of floor.portals) {
        const destination = office.floors!.find((f) => f.floor === portal.toFloor)!;
        // He materializes outside every return ring — no instant bounce.
        for (const back of destination.portals) {
          expect(Math.hypot(portal.arriveX - back.x, portal.arriveZ - back.z)).toBeGreaterThan(
            back.radius,
          );
        }
      }
    }
  });

  it("routes the floor phrases — and leaves the scene phrases alone", () => {
    expect(parseFloorCommand("next floor")).toBe("up");
    expect(parseFloorCommand("go through the portal")).toBe("up");
    expect(parseFloorCommand("portal")).toBe("up");
    expect(parseFloorCommand("floor down")).toBe("down");
    expect(parseFloorCommand("previous floor")).toBe("down");
    expect(parseFloorCommand("take me to the beach")).toBeNull();
    expect(parseFloorCommand("beach")).toBeNull();
    expect(parseFloorCommand("")).toBeNull();
  });

  it("carries him through portals floor to floor in the stage manager", () => {
    const scene = new THREE.Scene();
    const manager = new WorldSceneManager(scene);
    manager.setScene("office");
    expect(manager.currentFloor).toBe(1);
    expect(manager.citizenCount).toBe(10);
    expect(manager.portalOfKind("up")).not.toBeNull();
    expect(manager.portalOfKind("down")).toBeNull();

    const up = manager.portalOfKind("up")!;
    const transition = manager.checkPortals(up.x, up.z);
    expect(transition?.toFloor).toBe(2);
    expect(transition?.floorName).toContain("Floor 2");
    expect(manager.currentFloor).toBe(2);
    // Standing at the arrival point does not bounce him straight back.
    expect(manager.checkPortals(transition!.arriveX, transition!.arriveZ)).toBeNull();

    // Ride out the cooldown, then take the blue portal back down.
    for (let i = 0; i < 40; i += 1) manager.tick(0.05);
    const down = manager.portalOfKind("down")!;
    const back = manager.checkPortals(down.x, down.z);
    expect(back?.toFloor).toBe(1);
    expect(manager.currentFloor).toBe(1);

    // The other scenes have no floors and no portals.
    manager.setScene("park");
    expect(manager.currentFloor).toBeNull();
    expect(manager.portalOfKind("up")).toBeNull();
    expect(manager.checkPortals(up.x, up.z)).toBeNull();
    manager.dispose();
  });
});

describe("citizens — Augie's own material family (owner refinement 2026-11-21)", () => {
  it("softens citizen colors: dimmer peak, gentler saturation, never brighter", () => {
    const raw = new Float32Array([1, 0.2, 0.1, 0.3, 0.9, 0.4]);
    const soft = softenCitizenColors(raw);
    expect(soft.length).toBe(raw.length);
    for (let i = 0; i < raw.length; i += 3) {
      const rawMax = Math.max(raw[i]!, raw[i + 1]!, raw[i + 2]!);
      const softMax = Math.max(soft[i]!, soft[i + 1]!, soft[i + 2]!);
      expect(softMax).toBeLessThan(rawMax);
      const rawSpread = rawMax - Math.min(raw[i]!, raw[i + 1]!, raw[i + 2]!);
      const softSpread = softMax - Math.min(soft[i]!, soft[i + 1]!, soft[i + 2]!);
      expect(softSpread).toBeLessThan(rawSpread);
    }
  });

  it("renders citizens as SOLID normal-blended points — depth-writing, no ghost fade (Part 18)", () => {
    const scene = new THREE.Scene();
    const manager = new WorldSceneManager(scene);
    manager.setScene("park");
    const citizens: THREE.Points[] = [];
    scene.traverse((obj) => {
      if (obj.name === "living-world-citizen") citizens.push(obj as THREE.Points);
    });
    expect(citizens.length).toBe(4);
    for (const citizen of citizens) {
      const material = citizen.material as THREE.PointsMaterial;
      expect(material.blending).toBe(THREE.NormalBlending);
      expect(material.opacity).toBe(1);
      expect(material.depthWrite).toBe(true);
      // The soft-disc rim is alpha-cut wherever a canvas texture
      // exists; in the test DOM there is no 2D canvas, so the points
      // fall back to plain opaque squares — solid either way.
      if (material.map) expect(material.alphaTest).toBeGreaterThan(0);
    }
    manager.dispose();
  });
});
