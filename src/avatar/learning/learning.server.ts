/**
 * THE CAPTAIN'S LEARNING — the server functions (owner
 * orders 2026-11-26). Operator-only, like the rest of his
 * surfaces: every function re-verifies the operator session.
 * What crosses the wire: his prayer text (his own record),
 * his training progress (computed from his real answers),
 * and his sight log. Nothing here is reachable from the
 * learner side.
 *
 * The training record's subject is re-derived HERE from the
 * question bank by question id — the client never gets to
 * name a subject, so the calibration record cannot be
 * written wrong by a buggy or tampered window.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "../operatorAuth.server";
import { getLearningStore, getSightStore } from "./learningStore.server";
import { questionById, validateBank } from "./questionBank";
import { progressFromHistory, type AnswerRecord, type TrainingProgress } from "./training";
import { gradeTypedAnswer } from "./grading";
import { hallStatsFromHistory, type HallStats } from "./hall";
import {
  overallFromSections,
  type AssessmentRecord,
  type AssessmentSections,
} from "./assessment";
import { isSightOutcome, type SightEntry } from "./sightLog";
import { chicagoDateISO } from "./time";

type TokenInput = { accessToken: string };

function isTokenInput(input: unknown): input is TokenInput {
  return (
    typeof input === "object" &&
    input !== null &&
    typeof (input as TokenInput).accessToken === "string" &&
    (input as TokenInput).accessToken.length > 0 &&
    (input as TokenInput).accessToken.length <= 16_384
  );
}

async function authorized(accessToken: string): Promise<boolean> {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return verification.authorized;
}

/* --------------------------------- Prayer -------------------------------- */

export type PrayerView = {
  authorized: boolean;
  storageAvailable: boolean;
  /** His prayer, verbatim from the core record. Empty until he adds it. */
  text: string;
  updatedAt: number | null;
  /** The question bank's POC validation — problems listed, never hidden. */
  bankProblems: string[];
};

const emptyPrayer: PrayerView = {
  authorized: false,
  storageAvailable: false,
  text: "",
  updatedAt: null,
  bankProblems: [],
};

export const getPrayer = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid prayer request.");
    return input;
  })
  .handler(async ({ data }): Promise<PrayerView> => {
    if (!(await authorized(data.accessToken))) return emptyPrayer;
    const bankProblems = validateBank();
    const store = await getLearningStore();
    if (!store) return { ...emptyPrayer, authorized: true, bankProblems };
    const file = await store.read();
    return {
      authorized: true,
      storageAvailable: true,
      text: file.prayerText,
      updatedAt: file.prayerUpdatedAt,
      bankProblems,
    };
  });

export type SavePrayerInput = TokenInput & { text: string };
export type SaveResult = { authorized: boolean; ok: boolean; note: string };

export const savePrayer = createServerFn({ method: "POST" })
  .validator((input: unknown): SavePrayerInput => {
    if (!isTokenInput(input) || typeof (input as SavePrayerInput).text !== "string") {
      throw new Error("Invalid save-prayer request.");
    }
    return input as SavePrayerInput;
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    if (!(await authorized(data.accessToken))) return { authorized: false, ok: false, note: "Not authorized." };
    const store = await getLearningStore();
    if (!store) return { authorized: true, ok: false, note: "The core store is not available on this copy." };
    const text = data.text.slice(0, 8000);
    await store.update((file) => ({ ...file, prayerText: text, prayerUpdatedAt: Date.now() }));
    return {
      authorized: true,
      ok: true,
      note: text.trim() ? "Your prayer is saved in the core." : "Your prayer is cleared.",
    };
  });

/* -------------------------------- Training ------------------------------- */

export type TrainingView = {
  authorized: boolean;
  storageAvailable: boolean;
  progress: TrainingProgress;
  /** The Training Hall: level, XP, sessions, streaks, retention, response times. */
  hall: HallStats;
  /** His assessment records, oldest first — the baseline is the first one. */
  assessments: AssessmentRecord[];
};

const emptyProgress = progressFromHistory([]);
const emptyHall = hallStatsFromHistory([], chicagoDateISO(new Date()));

export const getTrainingProgress = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid training request.");
    return input;
  })
  .handler(async ({ data }): Promise<TrainingView> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, storageAvailable: false, progress: emptyProgress, hall: emptyHall, assessments: [] };
    }
    const store = await getLearningStore();
    if (!store) {
      return { authorized: true, storageAvailable: false, progress: emptyProgress, hall: emptyHall, assessments: [] };
    }
    const file = await store.read();
    return {
      authorized: true,
      storageAvailable: true,
      progress: progressFromHistory(file.trainingAnswers),
      hall: hallStatsFromHistory(file.trainingAnswers, chicagoDateISO(new Date())),
      assessments: file.assessments,
    };
  });

export type RecordRunAnswer = {
  questionId: string;
  correct: boolean;
  mode?: "choice" | "typed";
  responseMs?: number;
  typedText?: string;
};
export type RecordRunInput = TokenInput & { answers: RecordRunAnswer[] };

export const recordTrainingRun = createServerFn({ method: "POST" })
  .validator((input: unknown): RecordRunInput => {
    const row = input as RecordRunInput;
    if (
      !isTokenInput(input) ||
      !Array.isArray(row.answers) ||
      row.answers.length === 0 ||
      row.answers.length > 40 ||
      row.answers.some(
        (a) => !a || typeof a.questionId !== "string" || typeof a.correct !== "boolean",
      )
    ) {
      throw new Error("Invalid record-run request.");
    }
    return row;
  })
  .handler(async ({ data }): Promise<SaveResult & { recorded: number }> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: "Not authorized.", recorded: 0 };
    }
    const store = await getLearningStore();
    if (!store) {
      return { authorized: true, ok: false, note: "The core store is not available on this copy.", recorded: 0 };
    }
    const now = Date.now();
    const date = chicagoDateISO(new Date(now));
    const runId = `run-${now.toString(36)}`;
    const records: AnswerRecord[] = [];
    data.answers.forEach((answer, index) => {
      const question = questionById(answer.questionId);
      if (!question || question.retired) return; // unknown or retired ids are never recorded against
      const record: AnswerRecord = {
        date,
        at: now + index, // preserve answer order within the run
        questionId: question.id,
        subject: question.subject, // re-derived here — never trusted from the client
        correct: answer.correct,
        runId,
      };
      if (answer.mode === "typed" && typeof answer.typedText === "string") {
        // Typed answers are RE-GRADED here from his verbatim
        // words against the bank's verified fact — the
        // client's verdict is never taken for them.
        record.mode = "typed";
        record.typedText = answer.typedText.slice(0, 500);
        record.correct = gradeTypedAnswer(question, answer.typedText).correct;
      } else if (answer.mode === "choice") {
        record.mode = "choice";
      }
      if (typeof answer.responseMs === "number" && Number.isFinite(answer.responseMs) && answer.responseMs >= 0) {
        record.responseMs = Math.min(600_000, Math.round(answer.responseMs));
      }
      records.push(record);
    });
    if (records.length === 0) {
      return { authorized: true, ok: false, note: "Nothing recognizable to record.", recorded: 0 };
    }
    await store.update((file) => ({ ...file, trainingAnswers: [...file.trainingAnswers, ...records] }));
    return { authorized: true, ok: true, note: "Recorded.", recorded: records.length };
  });

/* ------------------------------- Assessment ------------------------------ */

export type AssessmentView = { authorized: boolean; storageAvailable: boolean; assessments: AssessmentRecord[] };

export const getAssessments = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid assessment request.");
    return input;
  })
  .handler(async ({ data }): Promise<AssessmentView> => {
    if (!(await authorized(data.accessToken))) return { authorized: false, storageAvailable: false, assessments: [] };
    const store = await getLearningStore();
    if (!store) return { authorized: true, storageAvailable: false, assessments: [] };
    const file = await store.read();
    return { authorized: true, storageAvailable: true, assessments: file.assessments };
  });

export type RecordAssessmentInput = TokenInput & { sections: AssessmentSections };

export const recordAssessment = createServerFn({ method: "POST" })
  .validator((input: unknown): RecordAssessmentInput => {
    const row = input as RecordAssessmentInput;
    const s = row.sections as AssessmentSections | undefined;
    const valid =
      isTokenInput(input) &&
      !!s &&
      (["pattern", "vocabulary", "memory", "speed"] as const).every(
        (key) => typeof s[key] === "number" && Number.isFinite(s[key]) && s[key] >= 0 && s[key] <= 100,
      );
    if (!valid) throw new Error("Invalid record-assessment request.");
    return row;
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    if (!(await authorized(data.accessToken))) return { authorized: false, ok: false, note: "Not authorized." };
    const store = await getLearningStore();
    if (!store) return { authorized: true, ok: false, note: "The core store is not available on this copy." };
    const now = Date.now();
    const record: AssessmentRecord = {
      date: chicagoDateISO(new Date(now)),
      at: now,
      sections: {
        pattern: Math.round(data.sections.pattern),
        vocabulary: Math.round(data.sections.vocabulary),
        memory: Math.round(data.sections.memory),
        speed: Math.round(data.sections.speed),
      },
      overall: 0, // recomputed by the sanitizer's rule below
    };
    record.overall = overallFromSections(record.sections);
    await store.update((file) => ({ ...file, assessments: [...file.assessments, record].slice(-365) }));
    return { authorized: true, ok: true, note: "Assessment recorded." };
  });

/* -------------------------------- Sight log ------------------------------ */

export type SightView = { authorized: boolean; storageAvailable: boolean; entries: SightEntry[] };

export const getSightLog = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid sight log request.");
    return input;
  })
  .handler(async ({ data }): Promise<SightView> => {
    if (!(await authorized(data.accessToken))) return { authorized: false, storageAvailable: false, entries: [] };
    const store = await getSightStore();
    if (!store) return { authorized: true, storageAvailable: false, entries: [] };
    const file = await store.read();
    return { authorized: true, storageAvailable: true, entries: file.entries };
  });

export type AddSightInput = TokenInput & { text: string };

export const addSightEntry = createServerFn({ method: "POST" })
  .validator((input: unknown): AddSightInput => {
    if (!isTokenInput(input) || typeof (input as AddSightInput).text !== "string" || !(input as AddSightInput).text.trim()) {
      throw new Error("Invalid sight entry request.");
    }
    return input as AddSightInput;
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    if (!(await authorized(data.accessToken))) return { authorized: false, ok: false, note: "Not authorized." };
    const store = await getSightStore();
    if (!store) return { authorized: true, ok: false, note: "The core store is not available on this copy." };
    const entry: SightEntry = {
      id: `sight-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`,
      at: Date.now(),
      text: data.text.slice(0, 4000),
      outcome: "not-yet-known",
    };
    await store.update((file) => ({ entries: [entry, ...file.entries] }));
    return { authorized: true, ok: true, note: "Recorded." };
  });

export type SetSightOutcomeInput = TokenInput & { entryId: string; outcome: string };

export const setSightOutcome = createServerFn({ method: "POST" })
  .validator((input: unknown): SetSightOutcomeInput => {
    const row = input as SetSightOutcomeInput;
    if (!isTokenInput(input) || typeof row.entryId !== "string" || !isSightOutcome(row.outcome)) {
      throw new Error("Invalid sight outcome request.");
    }
    return row;
  })
  .handler(async ({ data }): Promise<SaveResult> => {
    if (!(await authorized(data.accessToken))) return { authorized: false, ok: false, note: "Not authorized." };
    const store = await getSightStore();
    if (!store) return { authorized: true, ok: false, note: "The core store is not available on this copy." };
    let found = false;
    await store.update((file) => ({
      entries: file.entries.map((entry) => {
        if (entry.id !== data.entryId) return entry;
        found = true;
        return { ...entry, outcome: data.outcome as SightEntry["outcome"] };
      }),
    }));
    return found
      ? { authorized: true, ok: true, note: "Outcome marked." }
      : { authorized: true, ok: false, note: "That entry was not found." };
  });
