import { describe, expect, it } from "vitest";
import {
  COUNTERMEASURE_KINDS,
  DEFENSE_LAYERS,
  SANDBOX_SCENARIOS,
  createSimState,
  currentNodeId,
  currentStage,
  deriveBlueprint,
  getNode,
  getScenario,
  isComplete,
  resetSim,
  selectScenario,
  setPlaying,
  stepBack,
  stepForward,
  visitedNodeIds,
} from "@/avatar/sandbox";

/**
 * SANDBOX (2026-11-21) — the attack-simulation + antivirus-design
 * bench. These tests pin the three guarantees the bench stands on:
 * (1) the scenario DATA is whole — every scenario traces at least
 * five stages, every stage says what the attack does, what the
 * defender sees, and which countermeasure hooks it, and every node
 * the path touches exists in the drawn environment; (2) the STEPPER
 * state machine stays in bounds and resets cleanly; (3) the antivirus
 * BLUEPRINT derivation covers every stage exactly once, grouped by
 * defense layer. The bench is simulation only — modeled data, no
 * executable anything — and these tests keep it that way by treating
 * scenarios as pure data.
 */
describe("sandbox scenario data integrity", () => {
  it("ships the four ordered scenarios", () => {
    expect(SANDBOX_SCENARIOS.length).toBeGreaterThanOrEqual(4);
    const ids = SANDBOX_SCENARIOS.map((s) => s.id);
    expect(ids).toContain("phishing-takeover");
    expect(ids).toContain("ransomware");
    expect(ids).toContain("worm");
    expect(ids).toContain("usb-drop");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(SANDBOX_SCENARIOS.map((s) => [s.id, s] as const))(
    "scenario %s is a complete, drawable trace",
    (_id, scenario) => {
      expect(scenario.title.length).toBeGreaterThan(0);
      expect(scenario.subtitle.length).toBeGreaterThan(0);
      expect(scenario.summary.length).toBeGreaterThan(0);
      expect(scenario.stages.length).toBeGreaterThanOrEqual(5);

      const nodeIds = new Set(scenario.nodes.map((n) => n.id));
      expect(nodeIds.size).toBe(scenario.nodes.length);
      for (const node of scenario.nodes) {
        expect(node.label.length).toBeGreaterThan(0);
        expect(node.detail.length).toBeGreaterThan(0);
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThanOrEqual(660);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeLessThanOrEqual(320);
      }

      const stageIds = new Set<string>();
      for (const stage of scenario.stages) {
        expect(stageIds.has(stage.id)).toBe(false);
        stageIds.add(stage.id);
        // Every stage names itself and its ATT&CK language…
        expect(stage.name.length).toBeGreaterThan(0);
        expect(stage.tactic.length).toBeGreaterThan(0);
        // …says what the attack does and what it touches…
        expect(stage.action.length).toBeGreaterThan(0);
        expect(stage.touches.length).toBeGreaterThan(0);
        // …says what the defender sees…
        expect(stage.telemetry.length).toBeGreaterThan(0);
        // …and names the countermeasure that hooks it.
        expect(COUNTERMEASURE_KINDS).toContain(stage.countermeasure.kind);
        expect(DEFENSE_LAYERS).toContain(stage.countermeasure.layer);
        expect(stage.countermeasure.title.length).toBeGreaterThan(0);
        expect(stage.countermeasure.detail.length).toBeGreaterThan(0);
        // The path only walks on nodes that exist in the environment.
        expect(nodeIds.has(stage.from)).toBe(true);
        expect(nodeIds.has(stage.to)).toBe(true);
        expect(getNode(scenario, stage.from)).toBeTruthy();
        expect(getNode(scenario, stage.to)).toBeTruthy();
      }
    },
  );
});

describe("sandbox stepper state machine", () => {
  it("starts at rest: step 0, no current stage, nothing visited", () => {
    const state = createSimState("ransomware");
    expect(state.step).toBe(0);
    expect(state.playing).toBe(false);
    expect(currentStage(state)).toBeNull();
    expect(currentNodeId(state)).toBeNull();
    expect(visitedNodeIds(state)).toEqual([]);
    expect(isComplete(state)).toBe(false);
  });

  it("steps forward stage by stage and clamps at the end", () => {
    const scenario = getScenario("usb-drop");
    let state = createSimState("usb-drop");
    state = stepForward(state);
    expect(state.step).toBe(1);
    expect(currentStage(state)?.id).toBe(scenario.stages[0]!.id);
    expect(currentNodeId(state)).toBe(scenario.stages[0]!.to);
    for (let i = 0; i < scenario.stages.length + 3; i++) state = stepForward(state);
    expect(state.step).toBe(scenario.stages.length);
    expect(isComplete(state)).toBe(true);
    expect(currentStage(state)?.id).toBe(scenario.stages[scenario.stages.length - 1]!.id);
  });

  it("steps back and clamps at zero; stepping back stops playback", () => {
    let state = createSimState("worm");
    state = stepBack(state);
    expect(state.step).toBe(0);
    state = stepForward(stepForward(state));
    state = setPlaying(state, true);
    expect(state.playing).toBe(true);
    state = stepBack(state);
    expect(state.step).toBe(1);
    expect(state.playing).toBe(false);
  });

  it("playing stops itself on the final stage", () => {
    const scenario = getScenario("phishing-takeover");
    let state = createSimState("phishing-takeover");
    state = setPlaying(state, true);
    for (let i = 0; i < scenario.stages.length; i++) state = stepForward(state);
    expect(state.step).toBe(scenario.stages.length);
    expect(state.playing).toBe(false);
    // And Play cannot restart a completed trace.
    expect(setPlaying(state, true).playing).toBe(false);
  });

  it("reset returns to rest on the same scenario", () => {
    let state = createSimState("ransomware");
    state = stepForward(stepForward(state));
    state = resetSim(state);
    expect(state.scenarioId).toBe("ransomware");
    expect(state.step).toBe(0);
    expect(state.playing).toBe(false);
    expect(currentStage(state)).toBeNull();
  });

  it("switching scenarios restarts the trace", () => {
    let state = createSimState("phishing-takeover");
    state = stepForward(stepForward(state));
    state = selectScenario(state, "worm");
    expect(state.scenarioId).toBe("worm");
    expect(state.step).toBe(0);
    expect(visitedNodeIds(state)).toEqual([]);
  });

  it("visited nodes accumulate along the traced path, in order", () => {
    const scenario = getScenario("phishing-takeover");
    let state = createSimState("phishing-takeover");
    state = stepForward(state);
    expect(visitedNodeIds(state)).toEqual([
      scenario.stages[0]!.from,
      scenario.stages[0]!.to,
    ]);
    state = stepForward(stepForward(state));
    const visited = visitedNodeIds(state);
    expect(visited).toContain(scenario.stages[2]!.to);
    expect(new Set(visited).size).toBe(visited.length);
  });
});

describe("sandbox antivirus blueprint derivation", () => {
  it.each(SANDBOX_SCENARIOS.map((s) => [s.id, s] as const))(
    "blueprint for %s covers every stage exactly once, grouped by layer",
    (_id, scenario) => {
      const blueprint = deriveBlueprint(scenario);
      expect(blueprint.scenarioId).toBe(scenario.id);
      expect(blueprint.entries.length).toBe(scenario.stages.length);
      // Every stage index appears exactly once.
      const indices = blueprint.entries.map((e) => e.stageIndex).sort((a, b) => a - b);
      expect(indices).toEqual(scenario.stages.map((_, i) => i));
      // Each entry faithfully carries its stage's hook.
      for (const entry of blueprint.entries) {
        const stage = scenario.stages[entry.stageIndex]!;
        expect(entry.stageName).toBe(stage.name);
        expect(entry.layer).toBe(stage.countermeasure.layer);
        expect(entry.kind).toBe(stage.countermeasure.kind);
        expect(entry.title).toBe(stage.countermeasure.title);
      }
      // The layer groups partition the entries, in trace order per layer.
      const grouped = DEFENSE_LAYERS.flatMap((layer) => blueprint.byLayer[layer]);
      expect(grouped.length).toBe(blueprint.entries.length);
      for (const layer of DEFENSE_LAYERS) {
        const inLayer = blueprint.byLayer[layer];
        expect(inLayer.every((e) => e.layer === layer)).toBe(true);
        const order = inLayer.map((e) => e.stageIndex);
        expect(order).toEqual([...order].sort((a, b) => a - b));
      }
      // Every scenario's blueprint uses at least two layers — a single
      // layer is not a defense, and the bench must not teach one.
      const usedLayers = DEFENSE_LAYERS.filter((l) => blueprint.byLayer[l].length > 0);
      expect(usedLayers.length).toBeGreaterThanOrEqual(2);
    },
  );
});
