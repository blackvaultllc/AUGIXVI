/**
 * PROJECTS INSIDE IEM — the server functions (projects + mark-up
 * pass, owner order 2026-11-26). Operator-only: every function
 * re-verifies the operator session, like every door in this
 * house.
 *
 * The doors: read the registry and the marks; add or edit a
 * project (every record carries its Edit); take a project out;
 * leave a mark on a viewed page; stand a mark done, stand it
 * open again, or take it out; and READ THE SAVED AREA — the
 * construct's door, the one his words "check my saved area for
 * websites" come through. What crosses the wire is the registry
 * and the marks themselves — the pages are viewed from their
 * own addresses, never proxied or copied through the core.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { getWebsiteProjectsStore } from "./websiteProjectsStore.server";
import {
  addWebsiteMark,
  removeWebsiteMark,
  removeWebsiteProject,
  savedWebsiteArea,
  setWebsiteMarkDone,
  upsertWebsiteProject,
  WEBSITE_ABOUT_MAX,
  WEBSITE_NAME_MAX,
  WEBSITE_NOTE_MAX,
  type SavedArea,
  type WebsiteMark,
  type WebsiteProject,
} from "./websiteProjects";

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

export type WebsiteNoteResult = { authorized: boolean; ok: boolean; note: string };

const sessionGone: WebsiteNoteResult = {
  authorized: false,
  ok: false,
  note: "The operator session is gone — sign in again.",
};

const noStore: WebsiteNoteResult = {
  authorized: true,
  ok: false,
  note: "The saved area for websites lives on the core machine — no local store here.",
};

/* ------------------------------ read ------------------------------ */

export interface WebsiteProjectsView {
  authorized: boolean;
  storageAvailable: boolean;
  projects: WebsiteProject[];
  marks: WebsiteMark[];
}

export const getWebsiteProjects = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid projects request.");
    return input;
  })
  .handler(async ({ data }): Promise<WebsiteProjectsView> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, storageAvailable: false, projects: [], marks: [] };
    }
    const store = await getWebsiteProjectsStore();
    if (!store) {
      return { authorized: true, storageAvailable: false, projects: [], marks: [] };
    }
    const file = await store.read();
    return {
      authorized: true,
      storageAvailable: true,
      projects: file.projects,
      marks: file.marks,
    };
  });

/* --------------------------- the saved area --------------------------- */

export interface SavedWebsiteAreaView {
  authorized: boolean;
  storageAvailable: boolean;
  area: SavedArea | null;
}

/**
 * The construct's retrieval door: the whole saved area — every
 * project, its open marks (the work list), its finished count,
 * and the plain text account of it. When he says "check my
 * saved area for websites," this is what answers.
 */
export const getSavedWebsiteArea = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid saved area request.");
    return input;
  })
  .handler(async ({ data }): Promise<SavedWebsiteAreaView> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, storageAvailable: false, area: null };
    }
    const store = await getWebsiteProjectsStore();
    if (!store) {
      return { authorized: true, storageAvailable: false, area: null };
    }
    const file = await store.read();
    return { authorized: true, storageAvailable: true, area: savedWebsiteArea(file) };
  });

/* ------------------------------ projects ------------------------------ */

export type SaveWebsiteProjectInput = TokenInput & {
  /** Present to edit that project; absent to add a new one. */
  id?: string;
  name: string;
  about: string;
  url: string;
  localSource: string;
  confirmed: boolean;
};

export const saveWebsiteProject = createServerFn({ method: "POST" })
  .validator((input: unknown): SaveWebsiteProjectInput => {
    const v = input as SaveWebsiteProjectInput;
    if (
      !isTokenInput(input) ||
      (v.id !== undefined && typeof v.id !== "string") ||
      typeof v.name !== "string" ||
      typeof v.about !== "string" ||
      typeof v.url !== "string" ||
      typeof v.localSource !== "string" ||
      typeof v.confirmed !== "boolean"
    ) {
      throw new Error("Invalid project record.");
    }
    return v;
  })
  .handler(async ({ data }): Promise<WebsiteNoteResult> => {
    if (!(await authorized(data.accessToken))) return sessionGone;
    const name = data.name.trim().slice(0, WEBSITE_NAME_MAX);
    if (!name) return { authorized: true, ok: false, note: "Give the project a name first." };
    const url = data.url.trim();
    if (url && !url.startsWith("https://") && !url.startsWith("http://")) {
      return {
        authorized: true,
        ok: false,
        note: "That address does not read as a web address — it has to start with https:// (or http://).",
      };
    }
    const store = await getWebsiteProjectsStore();
    if (!store) return noStore;
    const now = Date.now();
    const id = data.id?.trim()
      ? data.id.trim().slice(0, 64)
      : `site-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const editing = Boolean(data.id?.trim());
    await store.update((file) =>
      upsertWebsiteProject(
        file,
        id,
        {
          name,
          about: data.about.trim().slice(0, WEBSITE_ABOUT_MAX),
          url,
          localSource: data.localSource.trim(),
          confirmed: data.confirmed,
        },
        now,
      ),
    );
    return {
      authorized: true,
      ok: true,
      note: editing
        ? `“${name}” is updated in the registry.`
        : `“${name}” stands in the registry now.`,
    };
  });

export type WebsiteProjectIdInput = TokenInput & { id: string };

function isProjectIdInput(input: unknown): input is WebsiteProjectIdInput {
  return isTokenInput(input) && typeof (input as WebsiteProjectIdInput).id === "string";
}

export const removeWebsiteProjectFn = createServerFn({ method: "POST" })
  .validator((input: unknown): WebsiteProjectIdInput => {
    if (!isProjectIdInput(input)) throw new Error("Invalid project removal request.");
    return input;
  })
  .handler(async ({ data }): Promise<WebsiteNoteResult> => {
    if (!(await authorized(data.accessToken))) return sessionGone;
    const store = await getWebsiteProjectsStore();
    if (!store) return noStore;
    const file = await store.read();
    const project = file.projects.find((p) => p.id === data.id);
    if (!project) {
      return { authorized: true, ok: false, note: "That project is not in the registry." };
    }
    await store.update((f) => removeWebsiteProject(f, data.id));
    return {
      authorized: true,
      ok: true,
      note: `“${project.name}” is out of the registry — its marks went with it.`,
    };
  });

/* ------------------------------ marks ------------------------------ */

export type AddWebsiteMarkInput = TokenInput & {
  projectId: string;
  note: string;
  xPct: number;
  yPct: number;
  page: string;
};

export const addWebsiteMarkFn = createServerFn({ method: "POST" })
  .validator((input: unknown): AddWebsiteMarkInput => {
    const v = input as AddWebsiteMarkInput;
    if (
      !isTokenInput(input) ||
      typeof v.projectId !== "string" ||
      typeof v.note !== "string" ||
      typeof v.xPct !== "number" ||
      typeof v.yPct !== "number" ||
      typeof v.page !== "string"
    ) {
      throw new Error("Invalid mark.");
    }
    return v;
  })
  .handler(async ({ data }): Promise<WebsiteNoteResult> => {
    if (!(await authorized(data.accessToken))) return sessionGone;
    const note = data.note.trim().slice(0, WEBSITE_NOTE_MAX);
    if (!note) return { authorized: true, ok: false, note: "Type the note first — a mark is its note." };
    const store = await getWebsiteProjectsStore();
    if (!store) return noStore;
    const file = await store.read();
    const project = file.projects.find((p) => p.id === data.projectId);
    if (!project) {
      return { authorized: true, ok: false, note: "That project is not in the registry." };
    }
    const now = Date.now();
    const id = `mark-${now}-${Math.random().toString(36).slice(2, 8)}`;
    await store.update((f) =>
      addWebsiteMark(
        f,
        id,
        { projectId: data.projectId, note, xPct: data.xPct, yPct: data.yPct, page: data.page },
        now,
      ),
    );
    return {
      authorized: true,
      ok: true,
      note: `The mark is saved on “${project.name}” — it stands in the saved area for websites.`,
    };
  });

export type WebsiteMarkIdInput = TokenInput & { markId: string; done?: boolean };

function isMarkIdInput(input: unknown): input is WebsiteMarkIdInput {
  const v = input as WebsiteMarkIdInput;
  return (
    isTokenInput(input) &&
    typeof v.markId === "string" &&
    (v.done === undefined || typeof v.done === "boolean")
  );
}

export const setWebsiteMarkDoneFn = createServerFn({ method: "POST" })
  .validator((input: unknown): WebsiteMarkIdInput => {
    if (!isMarkIdInput(input)) throw new Error("Invalid mark state request.");
    return input;
  })
  .handler(async ({ data }): Promise<WebsiteNoteResult> => {
    if (!(await authorized(data.accessToken))) return sessionGone;
    const store = await getWebsiteProjectsStore();
    if (!store) return noStore;
    const file = await store.read();
    if (!file.marks.some((m) => m.id === data.markId)) {
      return { authorized: true, ok: false, note: "That mark is not in the saved area." };
    }
    const done = data.done !== false;
    await store.update((f) => setWebsiteMarkDone(f, data.markId, done ? Date.now() : null));
    return {
      authorized: true,
      ok: true,
      note: done ? "The mark stands done." : "The mark stands open again.",
    };
  });

export const removeWebsiteMarkFn = createServerFn({ method: "POST" })
  .validator((input: unknown): WebsiteMarkIdInput => {
    if (!isMarkIdInput(input)) throw new Error("Invalid mark removal request.");
    return input;
  })
  .handler(async ({ data }): Promise<WebsiteNoteResult> => {
    if (!(await authorized(data.accessToken))) return sessionGone;
    const store = await getWebsiteProjectsStore();
    if (!store) return noStore;
    const file = await store.read();
    if (!file.marks.some((m) => m.id === data.markId)) {
      return { authorized: true, ok: false, note: "That mark is not in the saved area." };
    }
    await store.update((f) => removeWebsiteMark(f, data.markId));
    return { authorized: true, ok: true, note: "The mark is out of the saved area." };
  });
