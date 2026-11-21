import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  BEACH_WATER,
  DEFAULT_WORLD_SCENE,
  SCENE_PARTICLE_BUDGET,
  WORLD_SCENES,
  buildScene,
  parseSceneCommand,
  reshapeToPalm,
  writeWaterPoints,
  type WorldSceneId,
} from "@/avatar/worldScenes";
import {
  PeopleSim,
  buildPersonPoints,
  makeAppearance,
  type PersonDef,
} from "@/avatar/people";
import { makeObjectPoints, SceneManager } from "@/avatar/sceneManager";
import { WorldSceneManager } from "@/avatar/worldSceneRenderer";

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
    office: 8,
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
    expect(figure.count).toBeGreaterThanOrEqual(400);
    expect(figure.count).toBeLessThanOrEqual(480);
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
    expect(maxY).toBeGreaterThan(2.7); // a head up near Augie's height
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
    expect(person.gaitTime).toBeGreaterThan(0.3); // the walk cycle is turning
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
    expect(sim.people.length).toBe(8);
    const worker = sim.people[0]!;
    const seat = office.people[0]!.waypoints[0]!;
    for (let i = 0; i < 40; i += 1) sim.tick(0.05); // 2 seconds in
    expect(worker.mode).toBe("work");
    expect(worker.x).toBe(seat.x);
    expect(worker.z).toBe(seat.z);
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
    expect(manager.citizenCount).toBe(8);
    expect(manager.particleCount).toBeGreaterThan(0);
    expect(manager.particleCount).toBeLessThanOrEqual(SCENE_PARTICLE_BUDGET);
    expect(scene.getObjectByName("living-world-office")).toBeDefined();

    manager.setScene("beach");
    expect(manager.currentScene).toBe("beach");
    expect(manager.citizenCount).toBe(3);
    expect(scene.getObjectByName("living-world-water")).toBeDefined();
    expect(scene.getObjectByName("living-world-office")).toBeUndefined();
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
