/**
 * THE CAPTAIN'S LEARNING — core-side store (owner-only).
 * Two files beside the other core records in
 * ~/.local/share/augie:
 *   captains-learning.json  — his prayer text + his training
 *                             record (date, internal subject,
 *                             correct/incorrect per answer)
 *   captains-sight-log.json — his sight log entries
 * Same discipline as the notifications store: 0700 directory,
 * 0600 files, serialized updates, sanitize-on-read, and null
 * where there is no node filesystem (the online copy says so
 * honestly instead of pretending to keep his records).
 *
 * NOTHING in either file is ever shown on the learner side.
 */

import { SUBJECT_IDS, type SubjectId } from "./questionBank";
import { sanitizeSightEntries, type SightEntry } from "./sightLog";
import type { AnswerRecord } from "./training";

export interface LearningData {
  prayerText: string;
  prayerUpdatedAt: number | null;
  trainingAnswers: AnswerRecord[];
}

export interface SightData {
  entries: SightEntry[];
}

const EMPTY_LEARNING: LearningData = { prayerText: "", prayerUpdatedAt: null, trainingAnswers: [] };
const MAX_PRAYER = 8000;
const MAX_ANSWERS = 20000;

function sanitizeAnswerRecord(raw: unknown): AnswerRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const date = typeof row["date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row["date"]) ? row["date"] : null;
  const at = typeof row["at"] === "number" && Number.isFinite(row["at"]) && row["at"] > 0 ? row["at"] : null;
  const questionId =
    typeof row["questionId"] === "string" && row["questionId"].trim() ? row["questionId"].slice(0, 80) : null;
  const subject = SUBJECT_IDS.includes(row["subject"] as SubjectId) ? (row["subject"] as SubjectId) : null;
  if (!date || at === null || !questionId || !subject || typeof row["correct"] !== "boolean") return null;
  return { date, at, questionId, subject, correct: row["correct"] };
}

export function sanitizeLearningData(raw: unknown): LearningData {
  if (!raw || typeof raw !== "object") return { ...EMPTY_LEARNING, trainingAnswers: [] };
  const data = raw as Record<string, unknown>;
  const prayerText = typeof data["prayerText"] === "string" ? data["prayerText"].slice(0, MAX_PRAYER) : "";
  const prayerUpdatedAt =
    typeof data["prayerUpdatedAt"] === "number" && Number.isFinite(data["prayerUpdatedAt"])
      ? data["prayerUpdatedAt"]
      : null;
  const trainingAnswers = Array.isArray(data["trainingAnswers"])
    ? data["trainingAnswers"]
        .map(sanitizeAnswerRecord)
        .filter((r): r is AnswerRecord => r !== null)
        .slice(-MAX_ANSWERS)
    : [];
  return { prayerText, prayerUpdatedAt, trainingAnswers };
}

export function sanitizeSightData(raw: unknown): SightData {
  if (!raw || typeof raw !== "object") return { entries: [] };
  return { entries: sanitizeSightEntries((raw as Record<string, unknown>)["entries"]) };
}

type LearningFs = typeof import("node:fs/promises");

export interface LearningStore<T> {
  read(): Promise<T>;
  update(mutator: (data: T) => T): Promise<T>;
}

class FileLearningStore<T> implements LearningStore<T> {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: LearningFs,
    private readonly directory: string,
    private readonly fileName: string,
    private readonly sanitize: (raw: unknown) => T,
  ) {}

  private get filePath(): string {
    return `${this.directory}/${this.fileName}`;
  }

  async read(): Promise<T> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.filePath, "utf8"));
      return this.sanitize(parsed);
    } catch {
      return this.sanitize(null);
    }
  }

  private async writeAll(data: T): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.filePath, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  }

  update(mutator: (data: T) => T): Promise<T> {
    const job = async () => {
      const current = await this.read();
      const next = this.sanitize(mutator(current));
      await this.writeAll(next);
      return next;
    };
    const result = this.tail.then(job, job);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

let learningStorePromise: Promise<FileLearningStore<LearningData> | null> | null = null;
let sightStorePromise: Promise<FileLearningStore<SightData> | null> | null = null;

async function makeStore<T>(fileName: string, sanitize: (raw: unknown) => T): Promise<FileLearningStore<T> | null> {
  const home = process.env["HOME"]?.trim();
  if (!home) return null;
  try {
    const fs = await import("node:fs/promises");
    return new FileLearningStore(fs, `${home}/.local/share/augie`, fileName, sanitize);
  } catch {
    return null;
  }
}

export function getLearningStore(): Promise<FileLearningStore<LearningData> | null> {
  learningStorePromise ??= makeStore("captains-learning.json", sanitizeLearningData);
  return learningStorePromise;
}

export function getSightStore(): Promise<FileLearningStore<SightData> | null> {
  sightStorePromise ??= makeStore("captains-sight-log.json", sanitizeSightData);
  return sightStorePromise;
}
