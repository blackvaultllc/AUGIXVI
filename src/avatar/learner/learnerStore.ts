/**
 * KHADIJA'S OWN STORAGE — squishy pictures and homework/test projects.
 *
 * Everything lives on this device in localStorage under learner-only
 * keys (augi.learner.*), in the same local-first spirit as the rest of
 * Augie: nothing is uploaded, nothing calls out, and no operator code
 * reads these keys. Pictures are kept as data URLs so they survive a
 * reload with no server at all. (Honest limit: localStorage space is
 * shared and finite — a few dozen phone photos fit comfortably; if a
 * save ever fails for space, the error is shown to her in plain words
 * by the caller, never silently dropped.)
 */

export const SQUISHIES_STORAGE_KEY = "augi.learner.squishies.v1";
export const PROJECTS_STORAGE_KEY = "augi.learner.projects.v1";

export type SquishyPhoto = {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
};

export type LearnerProject = {
  id: string;
  kind: "homework" | "test";
  title: string;
  createdAt: string;
  /** Front-of-paper photo (data URL), homework only. */
  frontDataUrl?: string;
  /** Back-of-paper photo (data URL), homework only. */
  backDataUrl?: string;
  /** The paper's words, pasted — the path that works today. */
  pastedText?: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function store(override?: StorageLike): StorageLike {
  return override ?? globalThis.localStorage;
}

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `learner-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function readList<T>(key: string, storageOverride?: StorageLike): T[] {
  try {
    const raw = store(storageOverride).getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[], storageOverride?: StorageLike): void {
  store(storageOverride).setItem(key, JSON.stringify(list));
}

/* ---------------- Squishy projects ---------------- */

export function loadSquishies(storageOverride?: StorageLike): SquishyPhoto[] {
  return readList<SquishyPhoto>(SQUISHIES_STORAGE_KEY, storageOverride).filter(
    (photo) =>
      photo &&
      typeof photo.id === "string" &&
      typeof photo.name === "string" &&
      typeof photo.dataUrl === "string" &&
      photo.dataUrl.startsWith("data:image/"),
  );
}

export function saveSquishy(
  input: { name: string; dataUrl: string },
  storageOverride?: StorageLike,
  now: Date = new Date(),
): SquishyPhoto {
  if (!input.dataUrl.startsWith("data:image/")) {
    throw new TypeError("That file is not a picture.");
  }
  const photo: SquishyPhoto = {
    id: createId(),
    name: input.name.trim() || "My Squishy",
    dataUrl: input.dataUrl,
    createdAt: now.toISOString(),
  };
  writeList(SQUISHIES_STORAGE_KEY, [photo, ...loadSquishies(storageOverride)], storageOverride);
  return photo;
}

export function deleteSquishy(id: string, storageOverride?: StorageLike): SquishyPhoto[] {
  const next = loadSquishies(storageOverride).filter((photo) => photo.id !== id);
  writeList(SQUISHIES_STORAGE_KEY, next, storageOverride);
  return next;
}

/* ---------------- Homework + tests ---------------- */

export function loadProjects(storageOverride?: StorageLike): LearnerProject[] {
  return readList<LearnerProject>(PROJECTS_STORAGE_KEY, storageOverride).filter(
    (project) =>
      project &&
      typeof project.id === "string" &&
      (project.kind === "homework" || project.kind === "test") &&
      typeof project.title === "string",
  );
}

export function saveProject(
  input: Omit<LearnerProject, "id" | "createdAt">,
  storageOverride?: StorageLike,
  now: Date = new Date(),
): LearnerProject {
  if (!input.title.trim()) throw new TypeError("Give it a title first.");
  const project: LearnerProject = {
    kind: input.kind,
    title: input.title.trim(),
    id: createId(),
    createdAt: now.toISOString(),
    ...(input.pastedText?.trim() ? { pastedText: input.pastedText } : {}),
    ...(input.frontDataUrl ? { frontDataUrl: input.frontDataUrl } : {}),
    ...(input.backDataUrl ? { backDataUrl: input.backDataUrl } : {}),
  };
  writeList(PROJECTS_STORAGE_KEY, [project, ...loadProjects(storageOverride)], storageOverride);
  return project;
}

export function deleteProject(id: string, storageOverride?: StorageLike): LearnerProject[] {
  const next = loadProjects(storageOverride).filter((project) => project.id !== id);
  writeList(PROJECTS_STORAGE_KEY, next, storageOverride);
  return next;
}

/** Read a picked photo file into a data URL for on-device storage. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("That picture could not be read."));
    reader.readAsDataURL(file);
  });
}
