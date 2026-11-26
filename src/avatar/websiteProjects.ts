/**
 * PROJECTS INSIDE IEM — the pure core of the projects + mark-up
 * pass (owner order 2026-11-26: "All those projects I worked on
 * are in there as well… when I click on it I can go check it out
 * and see how it looks from the editor point of view, and I can
 * also make marks on them… typing in the notification and saving
 * it. Then I can say, hey, check my saved area for websites, so
 * you can see which ones and what I need done").
 *
 * What lives here is everything that must be TRUE before any
 * byte touches the store:
 *
 *   · The registry shape — his project sites, each with its
 *     name, what it is, where it lives (a live address and/or
 *     the local source), and whether that address stands
 *     CONFIRMED against the workspace. An entry that could not
 *     be verified ships labeled unconfirmed — never invented.
 *   · The mark shape — a place on a viewed page (across/down
 *     the frame, in percent, so the mark holds whatever the
 *     screen size) with his typed note, and its done state.
 *   · The seed — the projects on record, each verified against
 *     the workspace on 2026-11-26 before it was written here.
 *   · The saved-area summary — the plain account a construct
 *     reads when he says "check my saved area for websites."
 *
 * The registry and the marks live ONLY on the core machine
 * (~/.local/share/augie/website-marks/), and nothing here (or
 * anywhere) sends them out. Plain TS, no I/O — the server
 * modules do the lifting.
 */

export interface WebsiteProject {
  id: string;
  /** His name for the project ("Ms. Rachel — Standing Up for All Children"). */
  name: string;
  /** What the project is, in one breath. */
  about: string;
  /** The live address, or "" when no live address is on record. */
  url: string;
  /** Where the source stands (a workspace path), or "" when none is on record. */
  localSource: string;
  /**
   * TRUE only when the address/source was verified against the
   * workspace or the project's own record. An unconfirmed entry
   * is shown labeled — it is never dressed up as checked fact.
   */
  confirmed: boolean;
  addedAt: number;
  updatedAt: number;
}

export interface WebsiteMark {
  id: string;
  projectId: string;
  /** His note, typed the way a notification is typed. */
  note: string;
  /** Across the viewed page frame, 0–100 percent. */
  xPct: number;
  /** Down the viewed page frame, 0–100 percent. */
  yPct: number;
  /** The page of the site the mark was made on; "" is the front page. */
  page: string;
  createdAt: number;
  /** When the work the mark asked for was finished; null while it stands open. */
  doneAt: number | null;
}

export interface WebsiteProjectsFile {
  projects: WebsiteProject[];
  marks: WebsiteMark[];
}

export const WEBSITE_MAX_PROJECTS = 40;
export const WEBSITE_MAX_MARKS = 600;
export const WEBSITE_NAME_MAX = 120;
export const WEBSITE_ABOUT_MAX = 400;
export const WEBSITE_NOTE_MAX = 1000;

export function emptyWebsiteProjectsFile(): WebsiteProjectsFile {
  return { projects: [], marks: [] };
}

/* ------------------------------------------------------------------ */
/* The seed — verified against the workspace, 2026-11-26               */
/* ------------------------------------------------------------------ */

/**
 * The projects on record, checked one by one against
 * ~/workspace/github before they were written here:
 *
 *   · Ms. Rachel — the folder standing-up-for-all-children is a
 *     single static page ("Standing Up for All Children"); its
 *     own README says it is published with GitHub Pages, under
 *     the blackvaultllc account its git remote names.
 *   · The flagship — the folder flagship is "The Infinity
 *     Engine — flagship shell | AUGI.space"; its deploy scripts
 *     name https://augi.space.
 *   · Bellwood Haven — the folder bellwood-haven-property-portal
 *     is the patrol reporting portal; its own README's brand
 *     block carries its workers.dev address.
 *   · DIJA'S Academy — the folder dejasneuroacademy stands
 *     ("Deja's Neuro Academy"), but no live address is written
 *     anywhere in it — UNCONFIRMED, no address seeded.
 *   · The I-E-M company site — the domain iemtechnology.xyz is
 *     on record, but the workspace folder named I-E-M is the
 *     Entity Vault app, not this site's source — UNCONFIRMED,
 *     no source seeded.
 */
export function seededWebsiteProjects(at: number): WebsiteProjectsFile {
  const seed: Array<Omit<WebsiteProject, "addedAt" | "updatedAt">> = [
    {
      id: "site-ms-rachel",
      name: "Ms. Rachel — Standing Up for All Children",
      about:
        "Her promotional page for global children's advocacy — Gaza, Sudan, and borderless empathy. One static page, published with GitHub Pages.",
      url: "https://blackvaultllc.github.io/standing-up-for-all-children/",
      localSource: "~/workspace/github/standing-up-for-all-children",
      confirmed: true,
    },
    {
      id: "site-flagship",
      name: "The flagship — The Infinity Engine",
      about:
        "The flagship shell at AUGI.space: the cover, the nav, member sign-in, and the public sections — Radar, Fleet, Community, Broadcast, Auctions, Translator, Repair.",
      url: "https://augi.space",
      localSource: "~/workspace/github/flagship",
      confirmed: true,
    },
    {
      id: "site-bellwood-haven",
      name: "Bellwood Haven — property portal",
      about:
        "The K9 patrol reporting portal for Bellwood Haven, built for Maddox Management — the weekly patrol reports and the incident reports.",
      url: "https://bellwood-haven-property-portal.blackhatterxvi.workers.dev",
      localSource: "~/workspace/github/bellwood-haven-property-portal",
      confirmed: true,
    },
    {
      id: "site-dijas-academy",
      name: "DIJA'S Academy — Legend of Logic",
      about:
        "Khadija's academy — Deja's Neuro Academy, presenting Legend of Logic. The source stands in the workspace; no live address is written in it yet, so this entry stands unconfirmed until the address is added.",
      url: "",
      localSource: "~/workspace/github/dejasneuroacademy",
      confirmed: false,
    },
    {
      id: "site-iem-company",
      name: "I-E-M — the company site",
      about:
        "The company site on its own domain. The domain is on record; the workspace folder named I-E-M is the Entity Vault app, not this site's source, so this entry stands unconfirmed until its source is pointed to.",
      url: "https://iemtechnology.xyz",
      localSource: "",
      confirmed: false,
    },
  ];
  return {
    projects: seed.map((p) => ({ ...p, addedAt: at, updatedAt: at })),
    marks: [],
  };
}

/* ------------------------------------------------------------------ */
/* Sanitizers — a stored claim survives only in its exact shape        */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function cleanString(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

function cleanTime(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

function cleanUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const url = v.trim().slice(0, 500);
  return url.startsWith("https://") || url.startsWith("http://") ? url : "";
}

function cleanPct(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
}

export function sanitizeWebsiteProject(v: unknown): WebsiteProject | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 64);
  const name = cleanString(v["name"], WEBSITE_NAME_MAX);
  const addedAt = cleanTime(v["addedAt"]);
  if (!id || !name || addedAt === null) return null;
  return {
    id,
    name,
    about: typeof v["about"] === "string" ? v["about"].trim().slice(0, WEBSITE_ABOUT_MAX) : "",
    url: cleanUrl(v["url"]),
    localSource:
      typeof v["localSource"] === "string" ? v["localSource"].trim().slice(0, 300) : "",
    confirmed: v["confirmed"] === true,
    addedAt,
    updatedAt: cleanTime(v["updatedAt"]) ?? addedAt,
  };
}

export function sanitizeWebsiteMark(v: unknown): WebsiteMark | null {
  if (!isRecord(v)) return null;
  const id = cleanString(v["id"], 64);
  const projectId = cleanString(v["projectId"], 64);
  const note = cleanString(v["note"], WEBSITE_NOTE_MAX);
  const xPct = cleanPct(v["xPct"]);
  const yPct = cleanPct(v["yPct"]);
  const createdAt = cleanTime(v["createdAt"]);
  if (!id || !projectId || !note || xPct === null || yPct === null || createdAt === null) {
    return null;
  }
  return {
    id,
    projectId,
    note,
    xPct,
    yPct,
    page: typeof v["page"] === "string" ? v["page"].trim().slice(0, 300) : "",
    createdAt,
    doneAt: v["doneAt"] === null ? null : cleanTime(v["doneAt"]),
  };
}

export function sanitizeWebsiteProjectsFile(v: unknown): WebsiteProjectsFile {
  if (!isRecord(v)) return emptyWebsiteProjectsFile();
  const projects = (Array.isArray(v["projects"]) ? v["projects"] : [])
    .map(sanitizeWebsiteProject)
    .filter((p): p is WebsiteProject => p !== null)
    .slice(0, WEBSITE_MAX_PROJECTS);
  const known = new Set(projects.map((p) => p.id));
  // A mark that points at no standing project is an orphan —
  // it does not survive the read.
  const marks = (Array.isArray(v["marks"]) ? v["marks"] : [])
    .map(sanitizeWebsiteMark)
    .filter((m): m is WebsiteMark => m !== null && known.has(m.projectId))
    .slice(0, WEBSITE_MAX_MARKS);
  return { projects, marks };
}

/* ------------------------------------------------------------------ */
/* Mutations — pure; the store persists what they return               */
/* ------------------------------------------------------------------ */

export interface WebsiteProjectDraft {
  name: string;
  about: string;
  url: string;
  localSource: string;
  confirmed: boolean;
}

/** Add a project (id given) or edit the one that carries the id. */
export function upsertWebsiteProject(
  file: WebsiteProjectsFile,
  id: string,
  draft: WebsiteProjectDraft,
  now: number,
): WebsiteProjectsFile {
  const clean: WebsiteProjectDraft = {
    name: draft.name.trim().slice(0, WEBSITE_NAME_MAX),
    about: draft.about.trim().slice(0, WEBSITE_ABOUT_MAX),
    url: cleanUrl(draft.url),
    localSource: draft.localSource.trim().slice(0, 300),
    confirmed: draft.confirmed === true,
  };
  const existing = file.projects.find((p) => p.id === id);
  if (existing) {
    return {
      ...file,
      projects: file.projects.map((p) =>
        p.id === id ? { ...p, ...clean, updatedAt: now } : p,
      ),
    };
  }
  if (file.projects.length >= WEBSITE_MAX_PROJECTS) return file;
  return {
    ...file,
    projects: [...file.projects, { id, ...clean, addedAt: now, updatedAt: now }],
  };
}

/** Take a project out of the registry — its marks go with it. */
export function removeWebsiteProject(
  file: WebsiteProjectsFile,
  id: string,
): WebsiteProjectsFile {
  return {
    projects: file.projects.filter((p) => p.id !== id),
    marks: file.marks.filter((m) => m.projectId !== id),
  };
}

export interface WebsiteMarkDraft {
  projectId: string;
  note: string;
  xPct: number;
  yPct: number;
  page: string;
}

export function addWebsiteMark(
  file: WebsiteProjectsFile,
  id: string,
  draft: WebsiteMarkDraft,
  now: number,
): WebsiteProjectsFile {
  if (!file.projects.some((p) => p.id === draft.projectId)) return file;
  if (file.marks.length >= WEBSITE_MAX_MARKS) return file;
  const xPct = cleanPct(draft.xPct);
  const yPct = cleanPct(draft.yPct);
  const note = draft.note.trim().slice(0, WEBSITE_NOTE_MAX);
  if (xPct === null || yPct === null || !note) return file;
  const mark: WebsiteMark = {
    id,
    projectId: draft.projectId,
    note,
    xPct,
    yPct,
    page: draft.page.trim().slice(0, 300),
    createdAt: now,
    doneAt: null,
  };
  return { ...file, marks: [mark, ...file.marks] };
}

/** Mark the work done (doneAt set) or stand it open again (null). */
export function setWebsiteMarkDone(
  file: WebsiteProjectsFile,
  markId: string,
  doneAt: number | null,
): WebsiteProjectsFile {
  return {
    ...file,
    marks: file.marks.map((m) => (m.id === markId ? { ...m, doneAt } : m)),
  };
}

export function removeWebsiteMark(
  file: WebsiteProjectsFile,
  markId: string,
): WebsiteProjectsFile {
  return { ...file, marks: file.marks.filter((m) => m.id !== markId) };
}

/* ------------------------------------------------------------------ */
/* The saved area — what a construct reads on his word                 */
/* ------------------------------------------------------------------ */

export interface SavedAreaProject {
  project: WebsiteProject;
  /** The marks still standing open, oldest first — the work list. */
  open: WebsiteMark[];
  /** How many marks on this project are finished. */
  doneCount: number;
}

export interface SavedArea {
  projects: SavedAreaProject[];
  openTotal: number;
  doneTotal: number;
  /** The plain account, the words a construct answers from. */
  text: string;
}

export function savedWebsiteArea(file: WebsiteProjectsFile): SavedArea {
  const projects: SavedAreaProject[] = file.projects.map((project) => {
    const mine = file.marks.filter((m) => m.projectId === project.id);
    return {
      project,
      open: mine
        .filter((m) => m.doneAt === null)
        .sort((a, b) => a.createdAt - b.createdAt),
      doneCount: mine.filter((m) => m.doneAt !== null).length,
    };
  });
  const openTotal = projects.reduce((n, p) => n + p.open.length, 0);
  const doneTotal = projects.reduce((n, p) => n + p.doneCount, 0);
  const lines: string[] = [];
  if (file.projects.length === 0) {
    lines.push("The saved area for websites is empty — no projects stand in the registry.");
  } else if (openTotal === 0) {
    lines.push(
      `The saved area for websites holds ${file.projects.length} project(s) and no open marks — nothing is waiting to be worked.`,
    );
  } else {
    lines.push(
      `The saved area for websites: ${openTotal} open mark(s) across ${file.projects.length} project(s), ${doneTotal} finished. The open work:`,
    );
    for (const { project, open } of projects) {
      if (open.length === 0) continue;
      lines.push(`— ${project.name}:`);
      for (const m of open) {
        lines.push(
          `  · “${m.note}” (marked ${new Date(m.createdAt).toLocaleDateString()} at ${m.xPct}% across, ${m.yPct}% down${m.page ? `, on ${m.page}` : ", on the front page"})`,
        );
      }
    }
  }
  return { projects, openTotal, doneTotal, text: lines.join("\n") };
}
