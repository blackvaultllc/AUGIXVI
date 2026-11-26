/**
 * THE TRAINING HALL — Daily Training as a game (owner
 * orders 2026-11-26, hall spec ~12:59 CST). He picks the
 * count — 5, 10, or 20 — and how he answers: pick one, or
 * TYPE the fact from memory. Questions are drawn randomly
 * and UNTITLED: no subject is ever named during a run.
 *
 * THE LADDER: correct answers earn XP (more for harder
 * items, more again for typed answers), XP climbs the
 * level curve in hall.ts, and the ladder runs to LEVEL
 * 1000 — graduation. The Hall header always shows his
 * level, his XP, and the road to the next level.
 *
 * Typed answers are graded against the bank's verified
 * fact (grading.ts — tolerant on wording, strict on the
 * fact), and after grading the Hall shows his answer
 * calibrated to a shorter version — his words tightened —
 * beside his own words. The record keeps his verbatim
 * words; the server re-grades typed answers itself.
 *
 * THE ASSESSMENT: pattern reasoning, vocabulary, working
 * memory, processing speed — the Hall's OWN measured
 * scores, labeled true in the interface, baseline at his
 * first assessment and charted against his own line.
 * Never an "IQ" claim.
 *
 * Every number shown comes from his real recorded answers.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { FloatingWindow } from "../windows/FloatingWindow";
import { getOperatorAccessToken } from "../trustedDevice";
import { SUBJECT_LABELS, questionById, validateBank } from "./questionBank";
import {
  DEFAULT_RUN_COUNT,
  RUN_COUNTS,
  drawRunWithWeights,
  normalizeRunCount,
  scoreRun,
  trendLabel,
  weightsFromStats,
  type AnswerMode,
  type DrawnQuestion,
  type RunCount,
  type TrainingProgress,
} from "./training";
import { gradeTypedAnswer, tightenAnswer } from "./grading";
import { GRADUATION_LEVEL, cumulativeXpForLevel, xpForRecord, type HallStats } from "./hall";
import {
  ASSESSMENT_HONESTY_LINE,
  generatePatternItems,
  makeDigitSpan,
  makeSpeedRound,
  mcSectionScore,
  memoryScore,
  overallFromSections,
  pickVocabItems,
  seededRng,
  speedScore,
  type AssessmentRecord,
  type AssessmentSections,
  type PatternItem,
  type SpeedRound,
  type VocabItem,
} from "./assessment";
import { getTrainingProgress, recordAssessment, recordTrainingRun } from "./learning.server";

type Phase = "setup" | "running" | "done" | "assessment";

export function TrainingWindow({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [count, setCount] = useState<RunCount>(DEFAULT_RUN_COUNT);
  const [mode, setMode] = useState<AnswerMode>("choice");
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [hall, setHall] = useState<HallStats | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [drawn, setDrawn] = useState<DrawnQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>([]);
  const [typedAnswers, setTypedAnswers] = useState<string[]>([]);
  const [typedInput, setTypedInput] = useState("");
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [recordNote, setRecordNote] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const shownAtRef = useRef<number>(Date.now());

  const bankProblems = useMemo(() => validateBank(), []);

  async function loadProgress() {
    const token = await getOperatorAccessToken().catch(() => null);
    if (!token) return;
    const view = await getTrainingProgress({ data: { accessToken: token } }).catch(() => null);
    if (!view || !view.authorized) return;
    setProgress(view.progress);
    setHall(view.hall ?? null);
    setAssessments(view.assessments ?? []);
    setStorageAvailable(view.storageAvailable);
  }

  useEffect(() => {
    void loadProgress();
  }, []);

  function startRun() {
    if (!progress || bankProblems.length > 0) return;
    const weights = weightsFromStats(progress.subjects);
    const run = drawRunWithWeights(count, weights, Math.random);
    setDrawn(run);
    setPicks(new Array(run.length).fill(null));
    setTypedAnswers(new Array(run.length).fill(""));
    setResponseTimes(new Array(run.length).fill(0));
    setIndex(0);
    setTypedInput("");
    setRevealed(false);
    setRecordNote("");
    shownAtRef.current = Date.now();
    setPhase("running");
  }

  const current = drawn[index];
  const currentBank = current ? questionById(current.questionId) : undefined;
  const typedGrade = useMemo(() => {
    if (mode !== "typed" || !currentBank || !revealed) return null;
    return gradeTypedAnswer(currentBank, typedAnswers[index] ?? "");
  }, [mode, currentBank, revealed, typedAnswers, index]);

  const currentCorrect =
    mode === "choice"
      ? picks[index] !== null && picks[index] === current?.answerIndex
      : (typedGrade?.correct ?? false);

  function stampResponseTime() {
    const times = [...responseTimes];
    times[index] = Math.max(0, Date.now() - shownAtRef.current);
    setResponseTimes(times);
    return times;
  }

  function pick(choice: number) {
    if (revealed) return;
    const next = [...picks];
    next[index] = choice;
    setPicks(next);
    stampResponseTime();
    setRevealed(true);
  }

  function submitTyped() {
    if (revealed || !typedInput.trim()) return;
    const answers = [...typedAnswers];
    answers[index] = typedInput;
    setTypedAnswers(answers);
    stampResponseTime();
    setRevealed(true);
  }

  async function finishRun(finalPicks: (number | null)[], finalTyped: string[], finalTimes: number[]) {
    setPhase("done");
    const token = await getOperatorAccessToken().catch(() => null);
    if (!token) {
      setRecordNote("No operator session — this run could not be recorded.");
      return;
    }
    const result = await recordTrainingRun({
      data: {
        accessToken: token,
        answers: drawn.map((item, i) => {
          const bank = questionById(item.questionId);
          const correct =
            mode === "choice"
              ? finalPicks[i] !== null && finalPicks[i] === item.answerIndex
              : bank
                ? gradeTypedAnswer(bank, finalTyped[i] ?? "").correct
                : false;
          return {
            questionId: item.questionId,
            correct,
            mode,
            responseMs: finalTimes[i] ?? 0,
            ...(mode === "typed" ? { typedText: finalTyped[i] ?? "" } : {}),
          };
        }),
      },
    }).catch(() => null);
    if (result?.ok) {
      setRecordNote("Recorded in the core — your level, your statistics, and your line all stand on these answers.");
      await loadProgress();
    } else {
      setRecordNote(result?.note ?? "This run could not be recorded.");
    }
  }

  function next() {
    if (index + 1 >= drawn.length) {
      void finishRun(picks, typedAnswers, responseTimes);
      return;
    }
    setIndex(index + 1);
    setTypedInput("");
    setRevealed(false);
    shownAtRef.current = Date.now();
  }

  const score = phase === "done" && mode === "choice" ? scoreRun(drawn, picks) : null;
  const typedScore =
    phase === "done" && mode === "typed"
      ? drawn.reduce((sum, item, i) => {
          const bank = questionById(item.questionId);
          return sum + (bank && gradeTypedAnswer(bank, typedAnswers[i] ?? "").correct ? 1 : 0);
        }, 0)
      : null;
  const runXp =
    phase === "done"
      ? drawn.reduce((sum, item, i) => {
          const bank = questionById(item.questionId);
          if (!bank) return sum;
          const correct =
            mode === "choice"
              ? picks[i] !== null && picks[i] === item.answerIndex
              : gradeTypedAnswer(bank, typedAnswers[i] ?? "").correct;
          return sum + xpForRecord({ date: "", at: 0, questionId: item.questionId, subject: item.subject, correct, mode });
        }, 0)
      : 0;

  return (
    <FloatingWindow
      id="captains-training"
      title="The Training Hall — Daily Training"
      onClose={onClose}
      initialWidth={640}
      initialHeight={600}
    >
      <div className="window-learning">
        {hall && (
          <div className="window-learning__hall-head">
            <strong>Level {hall.level.level}</strong>
            <span>
              {hall.level.totalXp.toLocaleString()} XP
              {hall.level.graduated
                ? ` — GRADUATED. Level ${GRADUATION_LEVEL} reached.`
                : ` — ${hall.level.xpToNextLevel.toLocaleString()} XP to level ${hall.level.level + 1}`}
            </span>
            {hall.streaks.currentStreakDays > 0 && (
              <span> · {hall.streaks.currentStreakDays}-day streak</span>
            )}
            {!hall.level.graduated && hall.level.nextLevelAt !== null && (
              <div className="window-learning__xpbar" aria-hidden="true">
                <div
                  className="window-learning__xpbar-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (hall.level.xpIntoLevel /
                          Math.max(1, hall.level.nextLevelAt - cumulativeXpForLevel(hall.level.level))) *
                          100,
                      ),
                    )}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {bankProblems.length > 0 && (
          <p role="alert" className="window-learning__source">
            The question bank does not pass its proof check, so training will not run: {bankProblems.join("; ")}
          </p>
        )}

        {phase === "setup" && (
          <>
            <p className="window-learning__intro">
              Questions drawn from everything you are learning — mixed together, no titles. Answer by picking, or
              type the fact from memory and earn more. Right answers earn XP and climb the ladder to level{" "}
              {GRADUATION_LEVEL} — graduation. Weak areas come back more often until they are not weak.
            </p>
            <div className="window-learning__prayer-actions" role="group" aria-label="How many questions">
              {RUN_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={count === n ? "window-learning__tab is-active" : "window-learning__tab"}
                  onClick={() => setCount(normalizeRunCount(n))}
                >
                  {n} questions
                </button>
              ))}
            </div>
            <div className="window-learning__prayer-actions" role="group" aria-label="How to answer">
              <button
                type="button"
                className={mode === "choice" ? "window-learning__tab is-active" : "window-learning__tab"}
                onClick={() => setMode("choice")}
              >
                Pick the answer
              </button>
              <button
                type="button"
                className={mode === "typed" ? "window-learning__tab is-active" : "window-learning__tab"}
                onClick={() => setMode("typed")}
              >
                Type the answer (more XP)
              </button>
            </div>
            <div className="window-learning__prayer-actions">
              <button
                type="button"
                className="window-btn"
                disabled={!progress || bankProblems.length > 0}
                onClick={startRun}
              >
                Start today's training
              </button>
              <button type="button" className="window-btn" onClick={() => setShowProgress((v) => !v)}>
                {showProgress ? "Hide my progress" : "See my progress"}
              </button>
              <button type="button" className="window-btn" onClick={() => setShowStats((v) => !v)}>
                {showStats ? "Hide statistics" : "Full statistics"}
              </button>
              <button type="button" className="window-btn" onClick={() => setShowAssessment((v) => !v)}>
                {showAssessment ? "Hide assessment" : "Assessment"}
              </button>
            </div>
            {!storageAvailable && progress && (
              <p className="window-learning__source">
                The training record lives in the core. On a copy without the core store, runs are not recorded.
              </p>
            )}
            {showProgress && progress && <ProgressView progress={progress} />}
            {showStats && hall && <StatsView hall={hall} />}
            {showAssessment && (
              <AssessmentPanel
                assessments={assessments}
                onStart={() => setPhase("assessment")}
                storageAvailable={storageAvailable}
              />
            )}
          </>
        )}

        {phase === "running" && current && (
          <div>
            <p className="window-learning__source">
              Question {index + 1} of {drawn.length}
              {currentBank ? ` · worth ${currentBank.difficulty * (mode === "typed" ? 15 : 10)} XP` : ""}
            </p>
            <h4 className="window-learning__question">{current.prompt}</h4>
            {mode === "choice" && (
              <div className="window-learning__choices">
                {current.choices.map((choice, i) => {
                  const isPicked = picks[index] === i;
                  const isAnswer = current.answerIndex === i;
                  const cls = !revealed
                    ? "window-learning__choice"
                    : isAnswer
                      ? "window-learning__choice is-correct"
                      : isPicked
                        ? "window-learning__choice is-wrong"
                        : "window-learning__choice";
                  return (
                    <button key={i} type="button" className={cls} disabled={revealed} onClick={() => pick(i)}>
                      {choice}
                    </button>
                  );
                })}
              </div>
            )}
            {mode === "typed" && (
              <div className="window-learning__typed">
                <label>
                  Your answer
                  <input
                    value={typedInput}
                    onChange={(event) => setTypedInput(event.target.value)}
                    disabled={revealed}
                    placeholder="Type the fact from memory…"
                    autoComplete="off"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") submitTyped();
                    }}
                  />
                </label>
                {!revealed && (
                  <button type="button" className="window-btn" disabled={!typedInput.trim()} onClick={submitTyped}>
                    Answer
                  </button>
                )}
                {revealed && typedGrade && (
                  <div className="window-learning__calibration">
                    <p>
                      <strong>Your words:</strong> {typedAnswers[index]}
                    </p>
                    <p>
                      <strong>Calibrated — your answer, shorter:</strong> {tightenAnswer(typedAnswers[index] ?? "")}
                    </p>
                    <p className="window-learning__source">{typedGrade.note}</p>
                  </div>
                )}
              </div>
            )}
            {revealed && (
              <>
                <p role="status" className="window-learning__verdict">
                  {currentCorrect ? "Correct." : "Not this one."}
                </p>
                <p className="window-learning__fact">{current.explanation}</p>
                <button type="button" className="window-btn" onClick={next}>
                  {index + 1 >= drawn.length ? "Finish" : "Next question"}
                </button>
              </>
            )}
          </div>
        )}

        {phase === "done" && (
          <div>
            <h4>
              Run complete —{" "}
              {mode === "choice" && score ? `${score.correct} of ${score.total} correct` : `${typedScore ?? 0} of ${drawn.length} correct`}
              {runXp > 0 ? ` · +${runXp} XP` : ""}.
            </h4>
            {recordNote && <p className="window-learning__source">{recordNote}</p>}
            <div className="window-learning__prayer-actions">
              <button type="button" className="window-btn" onClick={() => setPhase("setup")}>
                Back to the Hall
              </button>
              <button type="button" className="window-btn" onClick={() => setShowProgress((v) => !v)}>
                {showProgress ? "Hide my progress" : "See my progress"}
              </button>
              <button type="button" className="window-btn" onClick={() => setShowStats((v) => !v)}>
                {showStats ? "Hide statistics" : "Full statistics"}
              </button>
            </div>
            {showProgress && progress && <ProgressView progress={progress} />}
            {showStats && hall && <StatsView hall={hall} />}
          </div>
        )}

        {phase === "assessment" && (
          <AssessmentFlow
            onDone={async () => {
              await loadProgress();
              setPhase("setup");
              setShowAssessment(true);
            }}
            onCancel={() => setPhase("setup")}
          />
        )}
      </div>
    </FloatingWindow>
  );
}

function ProgressView({ progress }: { progress: TrainingProgress }) {
  if (progress.totalAsked === 0) {
    return (
      <p className="window-learning__intro">
        No answers recorded yet. Your first run starts the line — every number here will come from your real answers.
      </p>
    );
  }
  return (
    <div className="window-learning__progress">
      <p>
        Overall: {progress.totalCorrect} of {progress.totalAsked} correct
        {progress.overallAccuracy !== null ? ` — ${Math.round(progress.overallAccuracy * 100)}%` : ""}
      </p>
      <table className="window-learning__table">
        <thead>
          <tr>
            <th>Area</th>
            <th>Asked</th>
            <th>Right</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          {progress.subjects
            .filter((s) => s.asked > 0)
            .map((s) => (
              <tr key={s.subject}>
                <td>{SUBJECT_LABELS[s.subject]}</td>
                <td>{s.asked}</td>
                <td>{s.accuracy !== null ? `${Math.round(s.accuracy * 100)}%` : "—"}</td>
                <td>{trendLabel(s.trend)}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <h4>Day to day</h4>
      <ul className="window-learning__daily">
        {progress.daily.map((day) => (
          <li key={day.date}>
            {day.date}: {day.correct} of {day.asked} — {Math.round(day.accuracy * 100)}%
          </li>
        ))}
      </ul>
    </div>
  );
}

function seconds(ms: number | null): string {
  if (ms === null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatsView({ hall }: { hall: HallStats }) {
  const { progress, response, retention, streaks, sessions, levelHistory } = hall;
  if (progress.totalAsked === 0) {
    return <p className="window-learning__intro">No statistics yet — they are built from your recorded answers, and there are none yet.</p>;
  }
  return (
    <div className="window-learning__progress">
      <h4>Full statistics — from your record only</h4>
      <p>
        Streaks: {streaks.currentStreakDays} day{streaks.currentStreakDays === 1 ? "" : "s"} current · longest{" "}
        {streaks.longestStreakDays} · {streaks.activeDays} active day{streaks.activeDays === 1 ? "" : "s"} total.
      </p>
      <p>
        Response time:{" "}
        {response.measured === 0
          ? "not measured yet — runs from here on carry it."
          : `average ${seconds(response.averageMs)}, median ${seconds(response.medianMs)}, over ${response.measured} answers.`}
      </p>
      {response.fastestSubject && (
        <p>
          Fastest area: {SUBJECT_LABELS[response.fastestSubject.subject]} ({seconds(response.fastestSubject.averageMs)})
          {response.slowestSubject
            ? ` · Slowest: ${SUBJECT_LABELS[response.slowestSubject.subject]} (${seconds(response.slowestSubject.averageMs)})`
            : ""}
        </p>
      )}
      <p>
        Retention on repeated questions:{" "}
        {retention.repeatedItems === 0
          ? "no question has come back around yet."
          : `${retention.repeatedItems} questions asked more than once — first time ${
              retention.firstAttemptAccuracy !== null ? `${Math.round(retention.firstAttemptAccuracy * 100)}%` : "—"
            } right, on repeats ${
              retention.repeatAccuracy !== null ? `${Math.round(retention.repeatAccuracy * 100)}%` : "—"
            } right.`}
      </p>
      <h4>Level road</h4>
      <ul className="window-learning__daily">
        {levelHistory.slice(-10).map((point) => (
          <li key={point.date}>
            {point.date}: {point.totalXp.toLocaleString()} XP — level {point.level}
          </li>
        ))}
      </ul>
      <h4>Sessions</h4>
      <ul className="window-learning__daily">
        {sessions.slice(0, 10).map((session) => (
          <li key={session.runId}>
            {session.date}: {session.correct} of {session.asked} — +{session.xp} XP
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssessmentPanel({
  assessments,
  onStart,
  storageAvailable,
}: {
  assessments: AssessmentRecord[];
  onStart: () => void;
  storageAvailable: boolean;
}) {
  const baseline = assessments[0];
  const latest = assessments[assessments.length - 1];
  return (
    <div className="window-learning__progress">
      <h4>The Assessment — pattern, vocabulary, memory, speed</h4>
      <p className="window-learning__source">{ASSESSMENT_HONESTY_LINE}</p>
      {!storageAvailable && (
        <p className="window-learning__source">
          Assessments are recorded in the core. On a copy without the core store, they cannot be kept.
        </p>
      )}
      {assessments.length === 0 ? (
        <p>
          No assessment taken yet. Your first one sets your <strong>baseline</strong> — every later score is measured
          against your own line from that day.
        </p>
      ) : (
        <>
          <p>
            Baseline ({baseline!.date}): <strong>{baseline!.overall}</strong>
            {latest && assessments.length > 1 ? (
              <>
                {" "}
                · Latest ({latest.date}): <strong>{latest.overall}</strong> ({latest.overall - baseline!.overall >= 0 ? "+" : ""}
                {latest.overall - baseline!.overall} from baseline)
              </>
            ) : (
              <> — take another on a later day to start the line.</>
            )}
          </p>
          <ul className="window-learning__daily">
            {assessments.slice(-10).map((a) => (
              <li key={a.at}>
                {a.date}: score {a.overall} — pattern {a.sections.pattern}, vocabulary {a.sections.vocabulary},
                memory {a.sections.memory}, speed {a.sections.speed}
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className="window-btn" onClick={onStart}>
        {assessments.length === 0 ? "Take my first assessment" : "Take an assessment"}
      </button>
    </div>
  );
}

/* ------------------------------ Assessment flow ---------------------------- */

type AssessStep = "pattern" | "vocabulary" | "memory" | "speed" | "scoring";

function AssessmentFlow({ onDone, onCancel }: { onDone: () => Promise<void>; onCancel: () => void }) {
  const [step, setStep] = useState<AssessStep>("pattern");
  const [patternItems] = useState<PatternItem[]>(() => generatePatternItems(5, seededRng(Date.now() % 1_000_000)));
  const [vocabItems] = useState<VocabItem[]>(() => pickVocabItems(5, seededRng((Date.now() + 7) % 1_000_000)));
  const [mcIndex, setMcIndex] = useState(0);
  const [mcPicks, setMcPicks] = useState<number[]>([]);
  const [spanLength, setSpanLength] = useState(4);
  const [span, setSpan] = useState(() => makeDigitSpan(4, Math.random));
  const [spanShown, setSpanShown] = useState(true);
  const [spanInput, setSpanInput] = useState("");
  const [longestSpan, setLongestSpan] = useState(0);
  const [speedRound, setSpeedRound] = useState<SpeedRound>(() => makeSpeedRound(Math.random));
  const [speedInput, setSpeedInput] = useState("");
  const [speedCorrect, setSpeedCorrect] = useState(0);
  const [speedAttempted, setSpeedAttempted] = useState(0);
  const [speedSecondsLeft, setSpeedSecondsLeft] = useState(60);
  const [sections, setSections] = useState<AssessmentSections | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState("");

  // Digit-span reveal timer.
  useEffect(() => {
    if (step !== "memory" || !spanShown) return;
    const timer = setTimeout(() => setSpanShown(false), spanLength * 900);
    return () => clearTimeout(timer);
  }, [step, spanShown, spanLength, span]);

  // Speed window countdown.
  useEffect(() => {
    if (step !== "speed") return;
    if (speedSecondsLeft <= 0) {
      setStep("scoring");
      return;
    }
    const timer = setTimeout(() => setSpeedSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, speedSecondsLeft]);

  useEffect(() => {
    if (step !== "scoring" || sections || saving) return;
    const computed: AssessmentSections = {
      pattern: mcSectionScore(
        patternItems.filter((item, i) => mcPicks[i] === item.answerIndex && i < 5).length,
        patternItems.length,
      ),
      vocabulary: mcSectionScore(
        vocabItems.filter((item, i) => mcPicks[5 + i] === item.answerIndex).length,
        vocabItems.length,
      ),
      memory: memoryScore(longestSpan),
      speed: speedScore(speedCorrect, speedAttempted),
    };
    setSections(computed);
    setSaving(true);
    void (async () => {
      const token = await getOperatorAccessToken().catch(() => null);
      if (!token) {
        setSaveNote("No operator session — this assessment could not be recorded.");
        return;
      }
      const result = await recordAssessment({ data: { accessToken: token, sections: computed } }).catch(() => null);
      setSaveNote(result?.ok ? "Recorded in the core." : (result?.note ?? "This assessment could not be recorded."));
    })();
  }, [step, sections, saving, patternItems, vocabItems, mcPicks, longestSpan, speedCorrect, speedAttempted]);

  const mcItems = step === "pattern" ? patternItems : vocabItems;
  const mcItem = (step === "pattern" || step === "vocabulary") && mcIndex < mcItems.length ? mcItems[mcIndex] : undefined;

  function answerMc(choice: number) {
    const globalIndex = step === "pattern" ? mcIndex : 5 + mcIndex;
    const next = [...mcPicks];
    next[globalIndex] = choice;
    setMcPicks(next);
    if (mcIndex + 1 >= mcItems.length) {
      setMcIndex(0);
      if (step === "pattern") setStep("vocabulary");
      else {
        setStep("memory");
        setSpanShown(true);
      }
    } else {
      setMcIndex(mcIndex + 1);
    }
  }

  function submitSpan() {
    const right = spanInput.trim() === span;
    const nextLongest = right ? Math.max(longestSpan, spanLength) : longestSpan;
    if (right) setLongestSpan(nextLongest);
    if (!right || spanLength >= 8) {
      setStep("speed");
      setSpeedSecondsLeft(60);
      return;
    }
    const nextLength = spanLength + 1;
    setSpanLength(nextLength);
    setSpan(makeDigitSpan(nextLength, Math.random));
    setSpanInput("");
    setSpanShown(true);
  }

  function submitSpeed() {
    const value = Number.parseInt(speedInput, 10);
    const right = Number.isFinite(value) && value === speedRound.count;
    setSpeedAttempted((n) => n + 1);
    if (right) setSpeedCorrect((n) => n + 1);
    setSpeedInput("");
    setSpeedRound(makeSpeedRound(Math.random));
  }

  return (
    <div>
      <p className="window-learning__source">{ASSESSMENT_HONESTY_LINE}</p>
      {(step === "pattern" || step === "vocabulary") && mcItem && (
        <div>
          <p className="window-learning__source">
            {step === "pattern" ? "Pattern reasoning" : "Vocabulary"} — {mcIndex + 1} of {mcItems.length}
          </p>
          {"sequence" in mcItem ? (
            <>
              <h4 className="window-learning__question">{mcItem.sequence.join(",  ")},  …?</h4>
              <p className="window-learning__source">What number comes next?</p>
            </>
          ) : (
            <h4 className="window-learning__question">What does “{mcItem.word}” mean?</h4>
          )}
          <div className="window-learning__choices">
            {mcItem.choices.map((choice, i) => (
              <button key={i} type="button" className="window-learning__choice" onClick={() => answerMc(i)}>
                {String(choice)}
              </button>
            ))}
          </div>
        </div>
      )}
      {step === "memory" && (
        <div>
          <p className="window-learning__source">Working memory — digit span</p>
          {spanShown ? (
            <>
              <h4 className="window-learning__question">{span.split("").join("  ")}</h4>
              <p>Hold these {spanLength} digits in your mind — they are about to hide.</p>
            </>
          ) : (
            <>
              <label>
                Type the digits you saw, in order
                <input
                  value={spanInput}
                  onChange={(event) => setSpanInput(event.target.value.replace(/[^0-9]/g, ""))}
                  autoComplete="off"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitSpan();
                  }}
                />
              </label>
              <button type="button" className="window-btn" disabled={!spanInput} onClick={submitSpan}>
                Answer
              </button>
            </>
          )}
        </div>
      )}
      {step === "speed" && (
        <div>
          <p className="window-learning__source">
            Processing speed — {speedSecondsLeft}s left · round {speedAttempted + 1}
          </p>
          <h4 className="window-learning__question">
            How many times does “{speedRound.target}” appear?
          </h4>
          <p className="window-learning__speedgrid">{speedRound.grid}</p>
          <label>
            Your count
            <input
              value={speedInput}
              onChange={(event) => setSpeedInput(event.target.value.replace(/[^0-9]/g, ""))}
              autoComplete="off"
              onKeyDown={(event) => {
                if (event.key === "Enter") submitSpeed();
              }}
            />
          </label>
          <button type="button" className="window-btn" disabled={!speedInput} onClick={submitSpeed}>
            Count it
          </button>
        </div>
      )}
      {step === "scoring" && sections && (
        <div>
          <h4>Assessment complete — score {overallFromSections(sections)}</h4>
          <p>
            Pattern {sections.pattern} · Vocabulary {sections.vocabulary} · Memory {sections.memory} · Speed{" "}
            {sections.speed}
          </p>
          <p className="window-learning__source">{saveNote}</p>
          <button type="button" className="window-btn" onClick={() => void onDone()}>
            Back to the Hall
          </button>
        </div>
      )}
      {step !== "scoring" && (
        <button type="button" className="window-btn" onClick={onCancel}>
          Leave the assessment
        </button>
      )}
    </div>
  );
}
