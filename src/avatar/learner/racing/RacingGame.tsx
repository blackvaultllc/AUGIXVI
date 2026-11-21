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
  sprintQuestion,
  type MathQuestion,
} from "./questions";

/**
 * MULTIPLICATION RACING GAME — a TEST feature for DIJA'S Academy
 * (operator order 2026-11-21, modeled on a 10-year-old learner).
 *
 * Pick a car, a color, a driver. 3, 2, 1, GO: four karts race three
 * laps by themselves, and the player's kart speeds up for every
 * multiplication question he answers (10 seconds each, no punishment
 * for a miss — it just doesn't speed up). At the end of laps 1 and 2
 * his kart pulls into a PIT STOP: no timer, no rush, problems that
 * teach the strategy trick behind the facts, and every solved
 * problem bolts a real upgrade onto his kart. Solve all three and
 * the next lap gets a NOS button — one tap, big zoom. A separate
 * 1-Minute Sprint (Eureka-style) is on the start screen for beating
 * his own best score.
 */

const TOTAL_LAPS = 3;
const LAP_LENGTH = 100;
const TOTAL_DISTANCE = TOTAL_LAPS * LAP_LENGTH;
const QUESTION_SECONDS = 10;
const GAP_SECONDS = 1.1;
const PLAYER_BASE_SPEED = 7.2;
const BOOST_AMOUNT = 4.4;
const BOOST_DECAY = 1.9;
const UPGRADE_BONUS = 0.35;
const NOS_BONUS = 9;
const NOS_SECONDS = 3;
const SPRINT_SECONDS = 60;
const SPRINT_BEST_KEY = "dija.racing.sprintBest";

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

type Phase = "setup" | "countdown" | "racing" | "pit" | "finished" | "sprint" | "sprintDone";

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
  nosTimeLeft: number;
  question: MathQuestion | null;
  questionTimeLeft: number;
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
    nosTimeLeft: 0,
    question: null,
    questionTimeLeft: QUESTION_SECONDS,
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

function readSprintBest(): number {
  try {
    const raw = window.localStorage.getItem(SPRINT_BEST_KEY);
    const value = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
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

  // Sprint state.
  const [sprintTimeLeft, setSprintTimeLeft] = useState(SPRINT_SECONDS);
  const [sprintScore, setSprintScore] = useState(0);
  const [sprintQ, setSprintQ] = useState<MathQuestion | null>(null);
  const [sprintMsg, setSprintMsg] = useState<string | null>(null);
  const [sprintBest, setSprintBest] = useState(readSprintBest);

  const engineRef = useRef<Engine>(emptyEngine());
  const upgradeBonusRef = useRef(0);

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
        speed =
          PLAYER_BASE_SPEED +
          eng.boost +
          upgradeBonusRef.current +
          (eng.nosTimeLeft > 0 ? NOS_BONUS : 0);
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
    if (eng.nosTimeLeft > 0) eng.nosTimeLeft = Math.max(0, eng.nosTimeLeft - dt);

    const lapBefore = Math.floor(playerBefore / LAP_LENGTH);
    const lapAfter = Math.floor(player.progress / LAP_LENGTH);
    if (lapAfter > lapBefore) {
      if (lapAfter >= TOTAL_LAPS) {
        eng.question = null;
        setPhase("finished");
        return;
      }
      enterPit(lapAfter);
      return;
    }

    // Question cadence.
    if (eng.question) {
      eng.questionTimeLeft -= dt;
      if (eng.questionTimeLeft <= 0) {
        eng.feedback = "Time's up! Here comes the next one.";
        eng.question = null;
        eng.gapLeft = GAP_SECONDS;
      }
    } else {
      eng.gapLeft -= dt;
      if (eng.gapLeft <= 0) {
        const lap = Math.min(TOTAL_LAPS, Math.floor(player.progress / LAP_LENGTH) + 1);
        eng.question = raceQuestion(lap, Math.random, eng.lastKey);
        eng.lastKey = questionKey(eng.question);
        eng.questionTimeLeft = QUESTION_SECONDS;
      }
    }
  }

  function answerRaceQuestion(choice: number) {
    const eng = engineRef.current;
    const q = eng.question;
    if (!q || phase !== "racing") return;
    if (choice === q.answer) {
      eng.boost = BOOST_AMOUNT;
      eng.correctCount += 1;
      eng.feedback = PRAISE[Math.floor(Math.random() * PRAISE.length)]!;
    } else {
      eng.feedback = `Good try! ${q.a} × ${q.b} = ${q.answer}.`;
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

  /* ---------- sprint ---------- */

  function startSprint() {
    setSprintScore(0);
    setSprintTimeLeft(SPRINT_SECONDS);
    setSprintMsg("Answer as fast as you can!");
    setSprintQ(sprintQuestion());
    setPhase("sprint");
  }

  useEffect(() => {
    if (phase !== "sprint") return;
    const id = window.setInterval(() => {
      setSprintTimeLeft((t) => {
        if (t <= 0.1) {
          window.clearInterval(id);
          setPhase("sprintDone");
          return 0;
        }
        return Math.max(0, t - 0.1);
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "sprintDone") return;
    if (sprintScore > sprintBest) {
      setSprintBest(sprintScore);
      try {
        window.localStorage.setItem(SPRINT_BEST_KEY, String(sprintScore));
      } catch {
        // Best score just won't persist on this device.
      }
    }
  }, [phase, sprintScore, sprintBest]);

  function answerSprint(choice: number) {
    if (!sprintQ || phase !== "sprint") return;
    if (choice === sprintQ.answer) {
      setSprintScore((s) => s + 1);
      setSprintMsg("Yes!");
    } else {
      setSprintMsg(`That one was ${sprintQ.answer}.`);
    }
    setSprintQ(sprintQuestion(Math.random, questionKey(sprintQ)));
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
        title={`${r.name}'s kart`}
      />
    );
  }

  function track() {
    return (
      <div className="racing-track" aria-label="Race track">
        {racers.map((r) => {
          const inLap = r.progress % LAP_LENGTH;
          const leftPct = r.finishedOrder != null ? 96 : Math.min(88, (inLap / LAP_LENGTH) * 88);
          return (
            <div className="racing-lane" key={r.id}>
              <span className="racing-lane__name">{r.name}</span>
              <div className="racing-lane__road">
                <div className="racing-car" style={{ left: `${leftPct}%` }}>
                  {renderKart(r)}
                </div>
                <span className="racing-lane__flag">
                  {r.finishedOrder != null ? "Finished!" : ""}
                </span>
              </div>
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
            <button type="button" className="racing-sprint-start" onClick={startSprint}>
              1-Minute Sprint
            </button>
          </div>
          <p className="learner-note">
            Sprint: answer as many as you can in 1 minute and beat your best
            {sprintBest > 0 ? ` (${sprintBest})` : ""}!
          </p>
        </div>
      </div>
    );
  }

  if (phase === "sprint") {
    return (
      <div className="racing">
        <div className="racing-sprint">
          <div className="racing-sprint__hud">
            <span>Time: {Math.ceil(sprintTimeLeft)}</span>
            <span>Score: {sprintScore}</span>
          </div>
          {sprintQ && (
            <>
              <p className="racing-question__prompt">{sprintQ.prompt}</p>
              <div className="racing-answers">
                {sprintQ.choices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className="racing-answer"
                    onClick={() => answerSprint(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </>
          )}
          {sprintMsg && <p className="racing-feedback">{sprintMsg}</p>}
        </div>
      </div>
    );
  }

  if (phase === "sprintDone") {
    return (
      <div className="racing">
        <div className="racing-results">
          <h2>Time! Sprint over</h2>
          <p className="racing-results__big">You answered {sprintScore} right!</p>
          <p className="racing-results__sub">
            {sprintScore >= sprintBest && sprintScore > 0
              ? "That's your best score yet!"
              : `Your best is ${sprintBest}.`}
          </p>
          <div className="racing-start-row">
            <button type="button" className="racing-start" onClick={startSprint}>
              Sprint Again
            </button>
            <button type="button" className="racing-sprint-start" onClick={() => setPhase("setup")}>
              Back
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
        {upgradeNames.length > 0 && (
          <span className="racing-hud__upgrades">
            {upgradeNames.map((u) => u.name).join(" · ")}
          </span>
        )}
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
              <p className="racing-question__label">Answer to speed up!</p>
              <p className="racing-question__prompt">{eng.question.prompt}</p>
              <div
                className="racing-timer"
                role="progressbar"
                aria-label="Time left for this question"
                aria-valuemin={0}
                aria-valuemax={QUESTION_SECONDS}
                aria-valuenow={Math.max(0, Math.ceil(eng.questionTimeLeft))}
              >
                <div
                  className="racing-timer__fill"
                  style={{
                    width: `${Math.max(0, (eng.questionTimeLeft / QUESTION_SECONDS) * 100)}%`,
                  }}
                />
              </div>
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
