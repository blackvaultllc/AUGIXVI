/**
 * SANDBOX WINDOW — the attack-simulation and antivirus-design bench
 * in a small floating box (operator order 2026-11-21). Pick one of
 * four modeled attacks, step it stage by stage across a drawn
 * environment, read what the defender sees at each stage, and watch
 * the antivirus panel name the countermeasure that hooks that stage.
 * Step to the end and the bench derives the scenario's antivirus
 * blueprint — the layered defense the traced path implies.
 *
 * SIMULATION ONLY: every scenario is structured data (sandbox.ts)
 * rendered as a diagram. No real malware, no live samples, no
 * executable anything — the paths are models, traced so the defense
 * can be designed. Nothing here makes a network call.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { FloatingWindow } from "./windows/FloatingWindow";
import {
  COUNTERMEASURE_KIND_LABELS,
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
  type SimState,
} from "./sandbox";

/** Milliseconds per stage while the trace plays itself. */
const PLAY_INTERVAL_MS = 2800;

const LAYER_LABELS: Record<string, string> = {
  prevention: "Prevention — stop it before it lands",
  detection: "Detection — see it the moment it moves",
  response: "Response — cut it off and recover",
};

/** Split a node label into at most two lines for the diagram. */
function labelLines(label: string): string[] {
  if (label.length <= 14) return [label];
  const words = label.split(" ");
  const lines: string[] = [""];
  for (const word of words) {
    const current = lines[lines.length - 1]!;
    const joined = current ? `${current} ${word}` : word;
    if (joined.length <= 14 || !current) lines[lines.length - 1] = joined;
    else lines.push(word);
  }
  return lines.slice(0, 2);
}

function StageDiagram({ sim }: { sim: SimState }) {
  const scenario = getScenario(sim.scenarioId);
  const visited = visitedNodeIds(sim);
  const current = currentNodeId(sim);
  return (
    <svg
      className="window-sandbox__diagram"
      viewBox="0 0 660 320"
      role="img"
      aria-label={`Diagram of ${scenario.title}: the attack's path lights up stage by stage`}
    >
      <defs>
        <marker id="sandbox-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="window-sandbox__arrow" />
        </marker>
        <marker id="sandbox-arrow-lit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="window-sandbox__arrow-lit" />
        </marker>
      </defs>
      {/* Edges for the stages that have happened — the traced path. */}
      {scenario.stages.slice(0, sim.step).map((stage, i) => {
        const from = getNode(scenario, stage.from);
        const to = getNode(scenario, stage.to);
        if (!from || !to) return null;
        const isCurrent = i === sim.step - 1;
        const cls = isCurrent
          ? "window-sandbox__edge window-sandbox__edge--current"
          : "window-sandbox__edge";
        if (stage.from === stage.to) {
          return (
            <circle
              key={stage.id}
              className={cls}
              cx={from.x}
              cy={from.y - 40}
              r={13}
              fill="none"
              markerEnd={isCurrent ? "url(#sandbox-arrow-lit)" : "url(#sandbox-arrow)"}
            />
          );
        }
        return (
          <line
            key={stage.id}
            className={cls}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            markerEnd={isCurrent ? "url(#sandbox-arrow-lit)" : "url(#sandbox-arrow)"}
          />
        );
      })}
      {/* The environment itself — every node is on the board from the start. */}
      {scenario.nodes.map((node) => {
        const lines = labelLines(node.label);
        const state = node.id === current
          ? "window-sandbox__node window-sandbox__node--current"
          : visited.includes(node.id)
            ? "window-sandbox__node window-sandbox__node--visited"
            : "window-sandbox__node";
        return (
          <g key={node.id} className={state}>
            <title>{`${node.label} — ${node.detail}`}</title>
            <rect x={node.x - 62} y={node.y - 22} width={124} height={44} rx={9} />
            {lines.map((line, i) => (
              <text
                key={i}
                x={node.x}
                y={node.y + (lines.length === 1 ? 4 : i === 0 ? -2 : 12)}
                textAnchor="middle"
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export function SandboxPanel() {
  const [sim, setSim] = useState<SimState>(() => createSimState());
  const scenario = getScenario(sim.scenarioId);
  const stage = currentStage(sim);
  const complete = isComplete(sim);
  const blueprint = deriveBlueprint(scenario);

  useEffect(() => {
    if (!sim.playing) return;
    const timer = setInterval(() => setSim((s) => stepForward(s)), PLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [sim.playing]);

  return (
    <div className="window-sandbox">
      <div className="window-sandbox__picker" role="group" aria-label="Choose an attack scenario">
        {SANDBOX_SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="window-sandbox__scenario"
            aria-pressed={s.id === sim.scenarioId}
            onClick={() => setSim((state) => selectScenario(state, s.id))}
          >
            <span className="window-sandbox__scenario-title">{s.title}</span>
            <span className="window-sandbox__scenario-sub">{s.subtitle}</span>
          </button>
        ))}
      </div>

      <StageDiagram sim={sim} />

      <div className="window-sandbox__controls">
        <button
          type="button"
          className="window-btn"
          onClick={() => setSim((s) => resetSim(s))}
          disabled={sim.step === 0 && !sim.playing}
        >
          <RotateCcw size={15} aria-hidden="true" /> Reset
        </button>
        <button
          type="button"
          className="window-btn"
          onClick={() => setSim((s) => stepBack(s))}
          disabled={sim.step === 0}
        >
          <ChevronLeft size={15} aria-hidden="true" /> Step back
        </button>
        <button
          type="button"
          className="window-btn window-sandbox__play"
          onClick={() => setSim((s) => setPlaying(s, !s.playing))}
          disabled={complete}
        >
          {sim.playing ? (
            <>
              <Pause size={15} aria-hidden="true" /> Pause
            </>
          ) : (
            <>
              <Play size={15} aria-hidden="true" /> Play
            </>
          )}
        </button>
        <button
          type="button"
          className="window-btn"
          onClick={() => setSim((s) => stepForward(s))}
          disabled={complete}
        >
          Step forward <ChevronRight size={15} aria-hidden="true" />
        </button>
        <span className="window-sandbox__progress" role="status">
          {sim.step === 0
            ? "At rest — nothing has happened yet"
            : complete
              ? `Trace complete — ${scenario.stages.length} stages`
              : `Stage ${sim.step} of ${scenario.stages.length}`}
        </span>
      </div>

      <section className="window-sandbox__stage" aria-label="Current stage">
        {stage === null ? (
          <>
            <h3 className="window-sandbox__stage-name">{scenario.title}</h3>
            <p className="window-sandbox__stage-body">{scenario.summary}</p>
            <p className="window-sandbox__stage-body">
              Press <strong>Step forward</strong> (or Play) and walk the attack across the board,
              one stage at a time.
            </p>
          </>
        ) : (
          <>
            <h3 className="window-sandbox__stage-name">
              Stage {sim.step}: {stage.name}
            </h3>
            <p className="window-sandbox__tactic">{stage.tactic}</p>
            <p className="window-sandbox__stage-body">
              <strong>What happens:</strong> {stage.action}
            </p>
            <p className="window-sandbox__stage-body">
              <strong>What touches what:</strong> {stage.touches}
            </p>
            <p className="window-sandbox__telemetry">
              <span className="window-sandbox__telemetry-label">What the defender sees</span>
              {stage.telemetry}
            </p>
          </>
        )}
      </section>

      <section className="window-sandbox__antivirus" aria-label="Antivirus countermeasure">
        <h3 className="window-sandbox__av-title">
          <ShieldCheck size={16} aria-hidden="true" /> Antivirus — the hook for this stage
        </h3>
        {stage === null ? (
          <p className="window-sandbox__stage-body">
            Every stage of every attack has a hook — a place where a defense catches it. Step the
            attack forward and this panel names the countermeasure for the stage you are standing
            on: signature, behavior, heuristic, detonation, quarantine, and the rest of the
            antivirus toolkit.
          </p>
        ) : (
          <>
            <p className="window-sandbox__av-chips">
              <span className="window-sandbox__chip">
                {COUNTERMEASURE_KIND_LABELS[stage.countermeasure.kind]}
              </span>
              <span className="window-sandbox__chip window-sandbox__chip--layer">
                {stage.countermeasure.layer}
              </span>
            </p>
            <p className="window-sandbox__av-name">{stage.countermeasure.title}</p>
            <p className="window-sandbox__stage-body">{stage.countermeasure.detail}</p>
          </>
        )}
      </section>

      {complete ? (
        <section className="window-sandbox__blueprint" aria-label="Antivirus blueprint">
          <h3 className="window-sandbox__av-title">
            <ShieldCheck size={16} aria-hidden="true" /> Antivirus blueprint — {scenario.title}
          </h3>
          <p className="window-sandbox__stage-body">
            The layered defense this trace implies. No single layer has to be perfect — the attack
            must beat every one of them, in order, without being seen.
          </p>
          {DEFENSE_LAYERS.map((layer) => (
            <div key={layer} className="window-sandbox__layer">
              <h4 className="window-sandbox__layer-name">{LAYER_LABELS[layer]}</h4>
              {blueprint.byLayer[layer].length === 0 ? (
                <p className="window-sandbox__layer-empty">
                  No hook in this layer for this scenario — the other layers carry it.
                </p>
              ) : (
                <ul className="window-sandbox__layer-list">
                  {blueprint.byLayer[layer].map((entry) => (
                    <li key={entry.stageIndex}>
                      <strong>
                        Stage {entry.stageIndex + 1} — {entry.stageName}:
                      </strong>{" "}
                      {entry.title} ({COUNTERMEASURE_KIND_LABELS[entry.kind]})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ) : (
        <p className="window-sandbox__hint">
          Step this attack to the end and the bench derives its antivirus blueprint — the full
          layered defense, stage by stage.
        </p>
      )}

      <p className="window-sandbox__footer">
        Simulation only — no real malware runs here. Every path shown is a model, traced so the
        defense can be designed.
      </p>
    </div>
  );
}

export function SandboxWindow({ onClose }: { onClose: () => void }) {
  return (
    <FloatingWindow
      id="sandbox"
      title="Sandbox"
      onClose={onClose}
      initialWidth={520}
      initialHeight={540}
      accent="#f59e0b"
    >
      <SandboxPanel />
    </FloatingWindow>
  );
}
