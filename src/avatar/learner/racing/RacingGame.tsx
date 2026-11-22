import { useEffect, useRef, useState } from "react";
import {
  CAR_COLORS,
  CAR_STYLES,
  DRIVERS,
  DriverFace,
  Kart,
  NO_UPGRADES,
  type Driver,
  type KartUpgrades,
} from "./Kart";
import {
  pitProblems,
  questionKey,
  raceQuestion,
  type MathQuestion,
} from "./questions";
import {
  playFinish,
  playSlowDown,
  playSpeedUp,
  racingMuted,
  setRacingMuted,
} from "./racingSounds";

/**
 * MULTIPLICATION RACING GAME — a TEST feature for DIJA'S Academy
 * (operator order 2026-11-21, modeled on a 10-year-old learner).
 *
 * THE GAME LOOP, exactly as Domenick specced it on 2026-11-21 after
 * watching Khadija play: a real TRACK with CARS RACING on it — four
 * karts on one track, racing the whole way to the finish line. The
 * question pops up in the middle of the screen, right UNDER the
 * race, with FOUR answer options. RIGHT answer — her car SPEEDS UP.
 * WRONG answer — her car SLOWS DOWN. That speed loop is the game.
 *
 * There is NO timer on a question: it waits until she answers
 * (kids' rules — no pressuring countdowns, no flashing). A wrong
 * answer never stops her car or sends it backward; it just slows
 * for a few seconds, the right fact is shown kindly, and the next
 * right answer speeds her right back up. The speedometer in the
 * HUD shows her speed so she can SEE the loop working.
 *
 * Pick a car, a color, a driver. 3, 2, 1, GO: four karts race
 * three laps. At the end of laps 1 and 2 her kart pulls into a
 * PIT STOP: no timer, no rush, problems that teach the strategy
 * trick behind the facts, and every solved problem bolts a real
 * upgrade onto her kart. Solve all three and the next lap gets a
 * NOS button — one tap, big zoom.
 *
 * There is NO timed mode anywhere in this game: the 1-Minute
 * Sprint drill was removed entirely by Domenick's order
 * (2026-11-21) — a 60-second clock is a pressuring timer, and
 * her games have none.
 */

const TOTAL_LAPS = 3;
const LAP_LENGTH = 100;
const TOTAL_DISTANCE = TOTAL_LAPS * LAP_LENGTH;
const GAP_SECONDS = 1.1;
const PLAYER_BASE_SPEED = 7.2;
const BOOST_AMOUNT = 4.4;
const BOOST_DECAY = 1.9;
const SLOW_AMOUNT = 3.4;
const SLOW_DECAY = 1.4;
const MIN_PLAYER_SPEED = 3;
const UPGRADE_BONUS = 0.35;
const NOS_BONUS = 9;
const NOS_SECONDS = 3;

/**
 * Part 16 — THE CIRCUIT (owner order 2026-11-21): a real racing
 * circuit with turns, not a straight drag strip. One shared loop;
 * every kart drives the same road, offset by its lane, turning with
 * the road (the kart rotates to the track's tangent). Three laps of
 * THIS is a much longer race than the old straight lanes.
 */
const CIRCUIT_D =
  "M 120 380 L 560 380 Q 680 380 680 300 L 680 252 Q 680 192 608 187 L 472 181 Q 402 178 402 112 L 402 108 Q 402 46 322 46 L 202 46 Q 122 46 122 128 L 122 380 Z";
const CIRCUIT_TREES: readonly (readonly [number, number])[] = [
  [250, 130], [330, 250], [560, 120], [90, 60], [730, 420], [60, 420],
  [520, 300], [250, 320], [740, 90], [180, 210],
];

const PIT_UPGRADES: { id: string; name: string }[][] = [
  [
    { id: "turbo", name: "Turbo" },
    { id: "wheels1", name: "Super Wheels" },
    { id: "spoiler", name: "Spoiler" },
  ],
  [
    { id: "engine", name: "Big Engine" },
    { id: "wheels2", name: "Golden Wheels" },
    { id: "rocket", name: "Rocket Boost" },
  ],
];

const PRAISE = ["Zoom! That's right!", "Yes! Faster!", "Great job!", "You got it — go go go!"];

type Phase = "setup" | "countdown" | "racing" | "pit" | "finished";

interface Racer {
  id: string;
  name: string;
  isPlayer: boolean;
  style: string;
  color: string;
  driver: Driver;
  baseSpeed: number;
  wobblePhase: number;
  wobbleRate: number;
  progress: number;
  finishedOrder: number | null;
}

interface Engine {
  racers: Racer[];
  boost: number;
  slow: number;
  nosTimeLeft: number;
  question: MathQuestion | null;
  gapLeft: number;
  feedback: string | null;
  correctCount: number;
  elapsed: number;
  lastKey: string | undefined;
}

function emptyEngine(): Engine {
  return {
    racers: [],
    boost: 0,
    slow: 0,
    nosTimeLeft: 0,
    question: null,
    gapLeft: 0.4,
    feedback: "Answer questions to speed up!",
    correctCount: 0,
    elapsed: 0,
    lastKey: undefined,
  };
}

function ordinal(n: number): string {
  return ["1st", "2nd", "3rd", "4th"][n - 1] ?? `${n}th`;
}

function standingsOf(racers: Racer[]): Racer[] {
  return [...racers].sort((x, y) => {
    if (x.finishedOrder != null && y.finishedOrder != null) {
      return x.finishedOrder - y.finishedOrder;
    }
    if (x.finishedOrder != null) return -1;
    if (y.finishedOrder != null) return 1;
    return y.progress - x.progress;
  });
}

export function RacingGame() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [carStyle, setCarStyle] = useState(CAR_STYLES[0]!.id);
  const [colorId, setColorId] = useState(CAR_COLORS[0]!.id);
  const [driverId, setDriverId] = useState(DRIVERS[0]!.id);
  const [count, setCount] = useState(3);
  const [upgrades, setUpgrades] = useState<string[]>([]);
  const [nosCharges, setNosCharges] = useState(0);
  const [, setFrame] = useState(0);

  // Pit stop state.
  const [pitIndex, setPitIndex] = useState(0);
  const [pitList, setPitList] = useState<MathQuestion[]>([]);
  const [pitStep, setPitStep] = useState(0);
  const [pitSolved, setPitSolved] = useState(0);
  const [pitFeedback, setPitFeedback] = useState<string | null>(null);
  const [pitEarnedNos, setPitEarnedNos] = useState(false);

  const engineRef = useRef<Engine>(emptyEngine());
  const upgradeBonusRef = useRef(0);
  const finishSoundRef = useRef(false);
  const [circuitPath, setCircuitPath] = useState<SVGPathElement | null>(null);
  const [muted, setMutedState] = useState<boolean>(() =>
    typeof window !== "undefined" ? racingMuted() : false,
  );

  function toggleMute() {
    const next = !muted;
    setRacingMuted(next);
    setMutedState(next);
  }

  useEffect(() => {
    upgradeBonusRef.current = upgrades.length * UPGRADE_BONUS;
  }, [upgrades]);

  const color = CAR_COLORS.find((c) => c.id === colorId) ?? CAR_COLORS[0]!;
  const driver = DRIVERS.find((d) => d.id === driverId) ?? DRIVERS[0]!;

  /* ---------- race setup ---------- */

  function startRace() {
    const player: Racer = {
      id: "you",
      name: `You (${driver.name})`,
      isPlayer: true,
      style: carStyle,
      color: color.hex,
      driver,
      baseSpeed: PLAYER_BASE_SPEED,
      wobblePhase: 0,
      wobbleRate: 0,
      progress: 0,
      finishedOrder: null,
    };
    const cpus: Racer[] = [
      {
        id: "cpu-milo",
        name: "Milo",
        isPlayer: false,
        style: "truck",
        color: CAR_COLORS[2]!.hex,
        driver: DRIVERS[1]!,
        baseSpeed: 8.6,
        wobblePhase: 1.3,
        wobbleRate: 0.9,
        progress: 0,
        finishedOrder: null,
      },
      {
        id: "cpu-zoe",
        name: "Zoe",
        isPlayer: false,
        style: "buggy",
        color: CAR_COLORS[3]!.hex,
        driver: DRIVERS[2]!,
        baseSpeed: 8.0,
        wobblePhase: 4.1,
        wobbleRate: 0.7,
        progress: 0,
        finishedOrder: null,
      },
      {
        id: "cpu-max",
        name: "Max",
        isPlayer: false,
        style: "rocket",
        color: CAR_COLORS[1]!.hex,
        driver: DRIVERS[3]!,
        baseSpeed: 7.5,
        wobblePhase: 2.6,
        wobbleRate: 1.1,
        progress: 0,
        finishedOrder: null,
      },
    ];
    const eng = emptyEngine();
    eng.racers = [player, ...cpus];
    engineRef.current = eng;
    finishSoundRef.current = false;
    setUpgrades([]);
    setNosCharges(0);
    setPitEarnedNos(false);
    setCount(3);
    setPhase("countdown");
  }

  /* ---------- countdown ---------- */

  useEffect(() => {
    if (phase !== "countdown") return;
    setCount(3);
    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      if (step <= 3) {
        setCount(3 - step);
      } else {
        window.clearInterval(id);
        setPhase("racing");
      }
    }, 750);
    return () => window.clearInterval(id);
  }, [phase]);

  /* ---------- race engine tick ---------- */

  useEffect(() => {
    if (phase !== "racing") return;
    const id = window.setInterval(() => {
      stepEngine(0.1);
      setFrame((f) => f + 1);
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function enterPit(completedLap: number) {
    const index = completedLap - 1;
    const eng = engineRef.current;
    eng.question = null;
    eng.boost = 0;
    eng.slow = 0;
    setPitIndex(index);
    setPitList(pitProblems(index));
    setPitStep(0);
    setPitSolved(0);
    setPitFeedback(null);
    setPitEarnedNos(false);
    setPhase("pit");
  }

  function stepEngine(dt: number) {
    const eng = engineRef.current;
    if (eng.racers.length === 0) return;
    eng.elapsed += dt;
    const player = eng.racers[0]!;
    const playerBefore = player.progress;

    let finishCounter = eng.racers.filter((r) => r.finishedOrder != null).length;
    for (const racer of eng.racers) {
      if (racer.finishedOrder != null) continue;
      let speed: number;
      if (racer.isPlayer) {
        // THE SPEED LOOP: right answers add boost, wrong answers add
        // slow. The floor means a miss never stops her or sends her
        // backward — she just rolls slower for a few seconds.
        speed = Math.max(
          MIN_PLAYER_SPEED,
          PLAYER_BASE_SPEED +
            eng.boost +
            upgradeBonusRef.current +
            (eng.nosTimeLeft > 0 ? NOS_BONUS : 0) -
            eng.slow,
        );
      } else {
        speed =
          racer.baseSpeed *
          (1 + 0.22 * Math.sin(eng.elapsed * racer.wobbleRate + racer.wobblePhase));
      }
      racer.progress = Math.min(TOTAL_DISTANCE, racer.progress + speed * dt);
      if (racer.progress >= TOTAL_DISTANCE && racer.finishedOrder == null) {
        finishCounter += 1;
        racer.finishedOrder = finishCounter;
      }
    }

    eng.boost = Math.max(0, eng.boost - BOOST_DECAY * dt);
    eng.slow = Math.max(0, eng.slow - SLOW_DECAY * dt);
    if (eng.nosTimeLeft > 0) eng.nosTimeLeft = Math.max(0, eng.nosTimeLeft - dt);

    const lapBefore = Math.floor(playerBefore / LAP_LENGTH);
    const lapAfter = Math.floor(player.progress / LAP_LENGTH);
    if (lapAfter > lapBefore) {
      if (lapAfter >= TOTAL_LAPS) {
        eng.question = null;
        if (!finishSoundRef.current) {
          finishSoundRef.current = true;
          playFinish();
        }
        setPhase("finished");
        return;
      }
      enterPit(lapAfter);
      return;
    }

    // Question cadence. NO TIMER: once a question pops up it waits
    // until she answers — nothing counts down, nothing times out.
    if (!eng.question) {
      eng.gapLeft -= dt;
      if (eng.gapLeft <= 0) {
        const lap = Math.min(TOTAL_LAPS, Math.floor(player.progress / LAP_LENGTH) + 1);
        eng.question = raceQuestion(lap, Math.random, eng.lastKey);
        eng.lastKey = questionKey(eng.question);
      }
    }
  }

  function answerRaceQuestion(choice: number) {
    const eng = engineRef.current;
    const q = eng.question;
    if (!q || phase !== "racing") return;
    if (choice === q.answer) {
      // RIGHT — the car SPEEDS UP, and any slow-down shakes off.
      eng.boost = BOOST_AMOUNT;
      eng.slow = 0;
      eng.correctCount += 1;
      eng.feedback = PRAISE[Math.floor(Math.random() * PRAISE.length)]!;
      playSpeedUp();
    } else {
      // WRONG — the car SLOWS DOWN for a few seconds. The right
      // fact is shown kindly, and the next right answer speeds
      // her right back up.
      eng.boost = 0;
      eng.slow = SLOW_AMOUNT;
      eng.feedback = `Good try! ${q.a} × ${q.b} = ${q.answer}. Your car slows down a little — the next right answer speeds it back up!`;
      playSlowDown();
    }
    eng.question = null;
    eng.gapLeft = GAP_SECONDS;
    setFrame((f) => f + 1);
  }

  function useNos() {
    const eng = engineRef.current;
    if (phase !== "racing" || nosCharges <= 0 || eng.nosTimeLeft > 0) return;
    setNosCharges((c) => c - 1);
    eng.nosTimeLeft = NOS_SECONDS;
    eng.feedback = "NOS! ZOOM!";
    playSpeedUp();
    setFrame((f) => f + 1);
  }

  /* ---------- pit stop ---------- */

  function answerPitQuestion(choice: number) {
    const problem = pitList[pitStep];
    if (!problem) return;
    if (choice !== problem.answer) {
      setPitFeedback("Not that one — use the trick and try again!");
      return;
    }
    const upgrade = PIT_UPGRADES[pitIndex]?.[pitStep];
    const solvedNow = pitSolved + 1;
    setPitSolved(solvedNow);
    if (upgrade) {
      setUpgrades((prev) => [...prev, upgrade.id]);
    }
    if (pitStep >= pitList.length - 1) {
      if (solvedNow >= pitList.length) {
        setNosCharges((c) => c + 1);
        setPitEarnedNos(true);
        setPitFeedback("You solved them all! You earned NOS for the next lap!");
      } else {
        setPitFeedback("Pit stop done! Your car is faster now.");
      }
      setPitStep(pitList.length); // summary view
    } else {
      setPitFeedback(upgrade ? `${upgrade.name} added to your car!` : "Fixed!");
      setPitStep(pitStep + 1);
    }
  }

  function leavePit() {
    const eng = engineRef.current;
    eng.question = null;
    eng.gapLeft = 0.8;
    eng.feedback = "Go go go!";
    setPhase("racing");
  }

  /* ---------- derived render values ---------- */

  const eng = engineRef.current;
  const racers = eng.racers;
  const player = racers[0];
  const standings = racers.length > 0 ? standingsOf(racers) : [];
  const playerPlace = player ? standings.findIndex((r) => r.isPlayer) + 1 : 1;
  const playerLap = player ? Math.min(TOTAL_LAPS, Math.floor(player.progress / LAP_LENGTH) + 1) : 1;
  const kartUpgrades: KartUpgrades = {
    turbo: upgrades.includes("turbo") || upgrades.includes("rocket"),
    engine: upgrades.includes("engine"),
    spoiler: upgrades.includes("spoiler"),
    goldenWheels: upgrades.includes("wheels1") || upgrades.includes("wheels2"),
  };
  const upgradeNames = PIT_UPGRADES.flat().filter((u) => upgrades.includes(u.id));

  function renderKart(r: Racer) {
    return (
      <Kart
        style={r.style}
        color={r.color}
        driver={r.driver}
        upgrades={r.isPlayer ? kartUpgrades : NO_UPGRADES}
        boosting={r.isPlayer && (eng.boost > 0.5 || eng.nosTimeLeft > 0)}
        slowing={r.isPlayer && eng.slow > 0.3}
        title={`${r.name}'s kart`}
      />
    );
  }

  /** Her car's speed right now — the number the speedometer shows
   *  and the same math the engine moves her car with. */
  const playerSpeed = player
    ? Math.max(
        MIN_PLAYER_SPEED,
        PLAYER_BASE_SPEED +
          eng.boost +
          upgrades.length * UPGRADE_BONUS +
          (eng.nosTimeLeft > 0 ? NOS_BONUS : 0) -
          eng.slow,
      )
    : PLAYER_BASE_SPEED;

  /** Where a kart sits on the circuit: its lap fraction along the
   *  shared loop, offset sideways by lane, turned to the road. */
  function kartPose(r: Racer, index: number): { left: string; top: string; angle: number } {
    if (!circuitPath || typeof circuitPath.getTotalLength !== "function") {
      // No SVG geometry (test DOMs): karts wait on the start grid.
      return { left: `${15 + index * 3}%`, top: "82%", angle: 0 };
    }
    const len = circuitPath.getTotalLength();
    const frac =
      r.finishedOrder != null ? 0.999 : (r.progress % LAP_LENGTH) / LAP_LENGTH;
    const d = frac * len;
    const p = circuitPath.getPointAtLength(d);
    const ahead = circuitPath.getPointAtLength((d + 3) % len);
    const angle = Math.atan2(ahead.y - p.y, ahead.x - p.x);
    const off = (index - 1.5) * 14;
    const x = p.x - Math.sin(angle) * off;
    const y = p.y + Math.cos(angle) * off;
    return {
      left: `${(x / 800) * 100}%`,
      top: `${(y / 460) * 100}%`,
      angle: (angle * 180) / Math.PI,
    };
  }

  function track() {
    return (
      <div className="racing-circuit" aria-label="Race track — a big circuit with turns">
        <svg className="racing-circuit__svg" viewBox="0 0 800 460" aria-hidden="true">
          <path d={CIRCUIT_D} fill="#8fd45f" stroke="none" />
          <path
            ref={setCircuitPath}
            d={CIRCUIT_D}
            fill="none"
            stroke="#4a4a52"
            strokeWidth={46}
            strokeLinejoin="round"
          />
          <path
            d={CIRCUIT_D}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2.5}
            strokeDasharray="14 12"
            opacity={0.7}
          />
          {/* Start/finish checkers at the path's start point. */}
          <g transform="translate(120 380) rotate(90)">
            {Array.from({ length: 8 }, (_, i) => (
              <rect
                key={i}
                x={-23 + (i % 4) * 11.5}
                y={i < 4 ? -6 : 5}
                width={11.5}
                height={11}
                fill={(i + (i < 4 ? 0 : 1)) % 2 === 0 ? "#222" : "#fff"}
              />
            ))}
          </g>
          {CIRCUIT_TREES.map(([tx, ty], i) => (
            <g key={i}>
              <circle cx={tx} cy={ty} r={13} fill="#3e9e4f" />
              <circle cx={tx - 8} cy={ty + 5} r={9} fill="#55b765" />
              <circle cx={tx + 8} cy={ty + 5} r={9} fill="#2f8a42" />
            </g>
          ))}
        </svg>
        {racers.map((r, i) => {
          const pose = kartPose(r, i);
          return (
            <div
              key={r.id}
              className="racing-car racing-car--circuit"
              style={{
                left: pose.left,
                top: pose.top,
                transform: `translate(-50%, -50%) rotate(${pose.angle}deg)`,
              }}
            >
              {renderKart(r)}
              <span className="racing-car__name">{r.name}</span>
              {r.finishedOrder != null && <span className="racing-lane__flag">Finished!</span>}
            </div>
          );
        })}
      </div>
    );
  }

  /* ---------- screens ---------- */

  if (phase === "setup") {
    return (
      <div className="racing">
        <div className="racing-setup">
          <h2>Multiplication Racing Game</h2>
          <p className="racing-test-tag">TEST — a brand new game we are trying out!</p>

          <h3>1. Pick your car</h3>
          <div className="racing-pick-row">
            {CAR_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="racing-pick"
                aria-pressed={carStyle === s.id}
                onClick={() => setCarStyle(s.id)}
              >
                <Kart style={s.id} color={color.hex} driver={driver} title={s.name} />
                <span>{s.name}</span>
              </button>
            ))}
          </div>

          <h3>2. Pick your color</h3>
          <div className="racing-pick-row">
            {CAR_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className="racing-swatch"
                style={{ background: c.hex }}
                aria-label={`Color ${c.name}`}
                aria-pressed={colorId === c.id}
                onClick={() => setColorId(c.id)}
              />
            ))}
          </div>

          <h3>3. Pick your driver</h3>
          <div className="racing-pick-row">
            {DRIVERS.map((d) => (
              <button
                key={d.id}
                type="button"
                className="racing-pick racing-pick--driver"
                aria-pressed={driverId === d.id}
                onClick={() => setDriverId(d.id)}
              >
                <DriverFace driver={d} title={d.name} />
                <span>{d.name}</span>
              </button>
            ))}
          </div>

          <div className="racing-start-row">
            <button type="button" className="racing-start" onClick={startRace}>
              Start the Race!
            </button>
            <button
              type="button"
              className="racing-mute"
              aria-pressed={muted}
              onClick={toggleMute}
            >
              {muted ? "Sound: Off" : "Sound: On"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="racing">
        <div className="racing-results">
          <h2>Race Results</h2>
          <ol className="racing-results__list">
            {standings.map((r, i) => (
              <li key={r.id} className={r.isPlayer ? "racing-results__you" : undefined}>
                <span className="racing-results__place">
                  {ordinal(i + 1)} — {r.name}
                </span>
                <span className="racing-results__kart">{renderKart(r)}</span>
                {r.isPlayer && <span className="racing-results__tag">That&apos;s you!</span>}
              </li>
            ))}
          </ol>
          <p className="racing-results__sub">
            You answered {eng.correctCount} questions right
            {upgradeNames.length > 0
              ? ` and earned ${upgradeNames.length} upgrades: ${upgradeNames.map((u) => u.name).join(", ")}`
              : ""}
            !
          </p>
          <button type="button" className="racing-start" onClick={() => setPhase("setup")}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // countdown / racing / pit share the track.
  return (
    <div className="racing">
      <div className="racing-hud">
        <span>
          Lap {playerLap} of {TOTAL_LAPS}
        </span>
        <span aria-live="polite">You are in {ordinal(playerPlace)} place!</span>
        <span className="racing-hud__speed" data-testid="player-speed">
          Your speed: {Math.round(playerSpeed)}
        </span>
        {upgradeNames.length > 0 && (
          <span className="racing-hud__upgrades">
            {upgradeNames.map((u) => u.name).join(" · ")}
          </span>
        )}
        <button
          type="button"
          className="racing-mute"
          aria-pressed={muted}
          onClick={toggleMute}
        >
          {muted ? "Sound: Off" : "Sound: On"}
        </button>
      </div>

      {track()}

      {phase === "countdown" && (
        <div className="racing-countdown" aria-live="assertive">
          {count === 0 ? "GO!" : count}
        </div>
      )}

      {phase === "racing" && (
        <div className="racing-question">
          {eng.question ? (
            <>
              <p className="racing-question__label">
                {eng.slow > 0.3 ? "Answer to speed back up!" : "Answer to speed up!"}
              </p>
              <p className="racing-question__prompt">{eng.question.prompt}</p>
              <div className="racing-answers">
                {eng.question.choices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className="racing-answer"
                    onClick={() => answerRaceQuestion(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="racing-question__label">Get ready for the next question…</p>
          )}
          <div className="racing-question__foot">
            {eng.feedback && <p className="racing-feedback">{eng.feedback}</p>}
            {nosCharges > 0 && (
              <button type="button" className="racing-nos" onClick={useNos}>
                NOS! ({nosCharges})
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "pit" && (
        <div className="racing-pit">
          <h2>Pit Stop!</h2>
          <p className="racing-pit__note">
            No rush here. Solve problems to fix up your car — every one adds a part!
          </p>
          {pitStep < pitList.length ? (
            <>
              <p className="racing-pit__trick">Pit Crew Trick: {pitList[pitStep]!.strategy}</p>
              <p className="racing-question__prompt">{pitList[pitStep]!.prompt}</p>
              <div className="racing-answers">
                {pitList[pitStep]!.choices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className="racing-answer"
                    onClick={() => answerPitQuestion(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="racing-pit__trick">
              {pitEarnedNos
                ? "All fixed up — and you earned NOS for the next lap!"
                : "All fixed up! Your car is faster now."}
            </p>
          )}
          {pitFeedback && <p className="racing-feedback">{pitFeedback}</p>}
          <p className="racing-pit__parts">
            On your car:{" "}
            {upgradeNames.length > 0 ? upgradeNames.map((u) => u.name).join(", ") : "nothing yet"}
          </p>
          <button type="button" className="racing-go" onClick={leavePit}>
            GO!
          </button>
        </div>
      )}
    </div>
  );
}
