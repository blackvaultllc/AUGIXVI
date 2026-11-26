/**
 * DAILY TRAINING — the Captain's daily questionnaire (owner
 * orders 2026-11-26). He picks the count — 5, 10, or 20.
 * Questions are drawn randomly and UNTITLED: no subject is
 * ever named or labeled during a run; the subjects ride
 * along inside the record only, where they drive the
 * calibration (weak areas resurface more often) and the
 * progress view.
 *
 * Every question in the bank is POC: confirmed fact, named
 * source, "confirmed as of" date. After each answer the
 * fact and its source are stated plainly. When the run
 * ends, the answers are recorded in the core — date,
 * subject (internal), correct/incorrect — and the progress
 * view shows honest numbers from those records only.
 */
import { useEffect, useMemo, useState } from "react";
import { FloatingWindow } from "../windows/FloatingWindow";
import { getOperatorAccessToken } from "../trustedDevice";
import { SUBJECT_LABELS, validateBank } from "./questionBank";
import {
  DEFAULT_RUN_COUNT,
  RUN_COUNTS,
  drawRunWithWeights,
  normalizeRunCount,
  scoreRun,
  trendLabel,
  weightsFromStats,
  type DrawnQuestion,
  type RunCount,
  type TrainingProgress,
} from "./training";
import { getTrainingProgress, recordTrainingRun } from "./learning.server";

type Phase = "setup" | "running" | "done";

export function TrainingWindow({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [count, setCount] = useState<RunCount>(DEFAULT_RUN_COUNT);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [drawn, setDrawn] = useState<DrawnQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [recordNote, setRecordNote] = useState("");
  const [showProgress, setShowProgress] = useState(false);

  const bankProblems = useMemo(() => validateBank(), []);

  async function loadProgress() {
    const token = await getOperatorAccessToken().catch(() => null);
    if (!token) return;
    const view = await getTrainingProgress({ data: { accessToken: token } }).catch(() => null);
    if (!view || !view.authorized) return;
    setProgress(view.progress);
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
    setIndex(0);
    setRevealed(false);
    setRecordNote("");
    setPhase("running");
  }

  async function finishRun(finalPicks: (number | null)[]) {
    setPhase("done");
    const token = await getOperatorAccessToken().catch(() => null);
    if (!token) {
      setRecordNote("No operator session — this run could not be recorded.");
      return;
    }
    const result = await recordTrainingRun({
      data: {
        accessToken: token,
        answers: drawn.map((item, i) => ({
          questionId: item.questionId,
          correct: finalPicks[i] !== null && finalPicks[i] === item.answerIndex,
        })),
      },
    }).catch(() => null);
    if (result?.ok) {
      setRecordNote("Recorded in the core — your progress below is built from these answers.");
      await loadProgress();
    } else {
      setRecordNote(result?.note ?? "This run could not be recorded.");
    }
  }

  function pick(choice: number) {
    if (revealed) return;
    const next = [...picks];
    next[index] = choice;
    setPicks(next);
    setRevealed(true);
  }

  function next() {
    if (index + 1 >= drawn.length) {
      void finishRun(picks);
      return;
    }
    setIndex(index + 1);
    setRevealed(false);
  }

  const current = drawn[index];
  const score = phase === "done" ? scoreRun(drawn, picks) : null;

  return (
    <FloatingWindow
      id="captains-training"
      title="Daily Training"
      onClose={onClose}
      initialWidth={620}
      initialHeight={560}
    >
      <div className="window-learning">
        {bankProblems.length > 0 && (
          <p role="alert" className="window-learning__source">
            The question bank does not pass its proof check, so training will not run: {bankProblems.join("; ")}
          </p>
        )}

        {phase === "setup" && (
          <>
            <p className="window-learning__intro">
              A set of questions drawn from everything you are learning — mixed together, no titles, no warning of
              what is coming. Answer, see the fact and where it stands, and the record keeps your day-to-day line.
              Weak areas come back more often until they are not weak.
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
            </div>
            {!storageAvailable && progress && (
              <p className="window-learning__source">
                The training record lives in the core. On a copy without the core store, runs are not recorded.
              </p>
            )}
            {showProgress && progress && <ProgressView progress={progress} />}
          </>
        )}

        {phase === "running" && current && (
          <div>
            <p className="window-learning__source">
              Question {index + 1} of {drawn.length}
            </p>
            <h4 className="window-learning__question">{current.prompt}</h4>
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
            {revealed && (
              <>
                <p role="status" className="window-learning__verdict">
                  {picks[index] === current.answerIndex ? "Correct." : "Not this one."}
                </p>
                <p className="window-learning__fact">{current.explanation}</p>
                <button type="button" className="window-btn" onClick={next}>
                  {index + 1 >= drawn.length ? "Finish" : "Next question"}
                </button>
              </>
            )}
          </div>
        )}

        {phase === "done" && score && (
          <div>
            <h4>
              Run complete — {score.correct} of {score.total} correct.
            </h4>
            {recordNote && <p className="window-learning__source">{recordNote}</p>}
            <div className="window-learning__prayer-actions">
              <button type="button" className="window-btn" onClick={() => setPhase("setup")}>
                Back to training
              </button>
              <button type="button" className="window-btn" onClick={() => setShowProgress((v) => !v)}>
                {showProgress ? "Hide my progress" : "See my progress"}
              </button>
            </div>
            {showProgress && progress && <ProgressView progress={progress} />}
          </div>
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
