/**
 * PROJECTS INSIDE IEM — the registry, the marks, and the saved
 * area (owner order 2026-11-26: his projects inside IEM, marks
 * on the pages, and "check my saved area for websites" as the
 * work order).
 *
 * What these tests hold:
 *   · The seed carries the five projects on record — the three
 *     whose address and source were verified against the
 *     workspace stand CONFIRMED with the real addresses; the
 *     two that could not be verified stand UNCONFIRMED with
 *     their gaps in the open (no invented address, no invented
 *     source).
 *   · The sanitizers drop what is malformed, clamp a mark's
 *     place to the page, and drop a mark whose project is gone.
 *   · The mutations behave: edit lands, a mark is added, done
 *     stands and reopens, removal takes the project's marks
 *     with it.
 *   · The saved area counts and speaks the open work plainly.
 *   · The store seeds once in a scratch HOME and never writes
 *     the seed over a copy that already stands.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addWebsiteMark,
  removeWebsiteMark,
  removeWebsiteProject,
  sanitizeWebsiteProjectsFile,
  savedWebsiteArea,
  seededWebsiteProjects,
  setWebsiteMarkDone,
  upsertWebsiteProject,
  type WebsiteProjectsFile,
} from "@/avatar/websiteProjects";

describe("the seed — the projects on record, honestly labeled", () => {
  const seed = seededWebsiteProjects(1000);

  it("carries the five projects he named", () => {
    expect(seed.projects.map((p) => p.id)).toEqual([
      "site-ms-rachel",
      "site-flagship",
      "site-bellwood-haven",
      "site-dijas-academy",
      "site-iem-company",
    ]);
    expect(seed.marks).toEqual([]);
  });

  it("the verified three stand confirmed, with the addresses their own records carry", () => {
    const byId = new Map(seed.projects.map((p) => [p.id, p]));
    expect(byId.get("site-ms-rachel")?.confirmed).toBe(true);
    expect(byId.get("site-ms-rachel")?.url).toBe(
      "https://blackvaultllc.github.io/standing-up-for-all-children/",
    );
    expect(byId.get("site-flagship")?.confirmed).toBe(true);
    expect(byId.get("site-flagship")?.url).toBe("https://augi.space");
    expect(byId.get("site-bellwood-haven")?.confirmed).toBe(true);
    expect(byId.get("site-bellwood-haven")?.url).toBe(
      "https://bellwood-haven-property-portal.blackhatterxvi.workers.dev",
    );
  });

  it("the unverified two stand unconfirmed, with their gaps in the open — nothing invented", () => {
    const byId = new Map(seed.projects.map((p) => [p.id, p]));
    const academy = byId.get("site-dijas-academy");
    expect(academy?.confirmed).toBe(false);
    // No live address was on record in its source — none is seeded.
    expect(academy?.url).toBe("");
    expect(academy?.localSource).toContain("dejasneuroacademy");
    const iem = byId.get("site-iem-company");
    expect(iem?.confirmed).toBe(false);
    expect(iem?.url).toBe("https://iemtechnology.xyz");
    // The workspace folder named I-E-M is the Entity Vault app,
    // not this site's source — no source is seeded for it.
    expect(iem?.localSource).toBe("");
  });
});

describe("the sanitizers — a stored claim survives only in its exact shape", () => {
  it("drops malformed projects and marks, and any mark whose project is gone", () => {
    const file = sanitizeWebsiteProjectsFile({
      projects: [
        { id: "p1", name: "One", addedAt: 5 },
        { id: "", name: "No id", addedAt: 5 },
        { name: "No id at all", addedAt: 5 },
        "junk",
      ],
      marks: [
        { id: "m1", projectId: "p1", note: "Fix the header", xPct: 10, yPct: 20, createdAt: 7 },
        { id: "m2", projectId: "gone", note: "Orphan", xPct: 1, yPct: 1, createdAt: 7 },
        { id: "m3", projectId: "p1", note: "", xPct: 1, yPct: 1, createdAt: 7 },
        { id: "m4", projectId: "p1", note: "No place", createdAt: 7 },
      ],
    });
    expect(file.projects.map((p) => p.id)).toEqual(["p1"]);
    expect(file.marks.map((m) => m.id)).toEqual(["m1"]);
  });

  it("clamps a mark's place to the page and refuses a non-web address", () => {
    const file = sanitizeWebsiteProjectsFile({
      projects: [{ id: "p1", name: "One", url: "javascript:alert(1)", addedAt: 5 }],
      marks: [
        { id: "m1", projectId: "p1", note: "Edge", xPct: 140, yPct: -3, createdAt: 7 },
      ],
    });
    expect(file.projects[0]?.url).toBe("");
    expect(file.marks[0]?.xPct).toBe(100);
    expect(file.marks[0]?.yPct).toBe(0);
  });

  it("a non-record reads as an empty registry", () => {
    expect(sanitizeWebsiteProjectsFile(null)).toEqual({ projects: [], marks: [] });
    expect(sanitizeWebsiteProjectsFile("junk")).toEqual({ projects: [], marks: [] });
  });
});

describe("the mutations — registry and marks behave", () => {
  const base = (): WebsiteProjectsFile => seededWebsiteProjects(1000);

  it("an edit lands on the record and moves its updated time", () => {
    const next = upsertWebsiteProject(
      base(),
      "site-flagship",
      {
        name: "The flagship — The Infinity Engine",
        about: "Edited.",
        url: "https://augi.space",
        localSource: "~/workspace/github/flagship",
        confirmed: true,
      },
      2000,
    );
    const flagship = next.projects.find((p) => p.id === "site-flagship");
    expect(flagship?.about).toBe("Edited.");
    expect(flagship?.addedAt).toBe(1000);
    expect(flagship?.updatedAt).toBe(2000);
    expect(next.projects).toHaveLength(5);
  });

  it("a new project is added; a mark lands on it; done stands and reopens", () => {
    let file = upsertWebsiteProject(
      base(),
      "site-new",
      { name: "New", about: "", url: "https://example.com", localSource: "", confirmed: false },
      2000,
    );
    expect(file.projects).toHaveLength(6);
    file = addWebsiteMark(
      file,
      "mark-1",
      { projectId: "site-new", note: "Move the title up", xPct: 50, yPct: 12.34, page: "" },
      3000,
    );
    expect(file.marks).toHaveLength(1);
    expect(file.marks[0]?.yPct).toBe(12.3);
    expect(file.marks[0]?.doneAt).toBeNull();
    file = setWebsiteMarkDone(file, "mark-1", 4000);
    expect(file.marks[0]?.doneAt).toBe(4000);
    file = setWebsiteMarkDone(file, "mark-1", null);
    expect(file.marks[0]?.doneAt).toBeNull();
    file = removeWebsiteMark(file, "mark-1");
    expect(file.marks).toHaveLength(0);
  });

  it("a mark on a project that does not stand is refused", () => {
    const file = addWebsiteMark(
      base(),
      "mark-x",
      { projectId: "nope", note: "Nowhere", xPct: 1, yPct: 1, page: "" },
      3000,
    );
    expect(file.marks).toHaveLength(0);
  });

  it("taking a project out takes its marks with it", () => {
    let file = addWebsiteMark(
      base(),
      "mark-1",
      { projectId: "site-flagship", note: "Check the cover", xPct: 10, yPct: 10, page: "" },
      3000,
    );
    file = removeWebsiteProject(file, "site-flagship");
    expect(file.projects.map((p) => p.id)).not.toContain("site-flagship");
    expect(file.marks).toHaveLength(0);
  });
});

describe("the saved area — what 'check my saved area for websites' reads", () => {
  it("counts the open work and speaks it, project by project", () => {
    let file = seededWebsiteProjects(1000);
    file = addWebsiteMark(
      file,
      "mark-1",
      { projectId: "site-ms-rachel", note: "Title trim stands approved", xPct: 50, yPct: 5, page: "" },
      2000,
    );
    file = addWebsiteMark(
      file,
      "mark-2",
      { projectId: "site-ms-rachel", note: "Check the sign-up words", xPct: 50, yPct: 80, page: "" },
      3000,
    );
    file = addWebsiteMark(
      file,
      "mark-3",
      { projectId: "site-flagship", note: "Radar is next", xPct: 20, yPct: 30, page: "" },
      4000,
    );
    file = setWebsiteMarkDone(file, "mark-3", 5000);
    const area = savedWebsiteArea(file);
    expect(area.openTotal).toBe(2);
    expect(area.doneTotal).toBe(1);
    expect(area.text).toContain("Ms. Rachel");
    expect(area.text).toContain("Title trim stands approved");
    // The finished mark is counted, not listed as open work.
    expect(area.text).not.toContain("Radar is next");
    const rachel = area.projects.find((p) => p.project.id === "site-ms-rachel");
    expect(rachel?.open.map((m) => m.id)).toEqual(["mark-1", "mark-2"]);
  });

  it("an empty registry says so plainly", () => {
    const area = savedWebsiteArea({ projects: [], marks: [] });
    expect(area.openTotal).toBe(0);
    expect(area.text).toMatch(/empty/i);
  });
});

describe("the store — seeds once, never over his copy", () => {
  let home: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    originalHome = process.env["HOME"];
    home = mkdtempSync(join(tmpdir(), "website-projects-"));
    process.env["HOME"] = home;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env["HOME"];
    else process.env["HOME"] = originalHome;
    vi.resetModules();
    rmSync(home, { recursive: true, force: true });
  });

  it("the first read seeds the registry and keeps the seeded copy", async () => {
    const { getWebsiteProjectsStore } = await import("@/avatar/websiteProjectsStore.server");
    const store = await getWebsiteProjectsStore();
    if (!store) throw new Error("the website projects store should exist under a node HOME");
    const seeded = await store.read();
    expect(seeded.projects).toHaveLength(5);
    const path = join(home, ".local/share/augie/website-marks/website-marks.json");
    expect(existsSync(path)).toBe(true);
    const before = readFileSync(path, "utf8");
    const again = await store.read();
    expect(again.projects).toHaveLength(5);
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  it("an update round-trips, and the seed never comes back over it", async () => {
    const { getWebsiteProjectsStore } = await import("@/avatar/websiteProjectsStore.server");
    const store = await getWebsiteProjectsStore();
    if (!store) throw new Error("the website projects store should exist under a node HOME");
    await store.update((file) => ({ projects: file.projects.slice(0, 1), marks: [] }));
    const after = await store.read();
    expect(after.projects).toHaveLength(1);
    expect(after.projects[0]?.id).toBe("site-ms-rachel");
  });

  it("a copy that stands but does not parse reads empty — the seed does not resurrect over it", async () => {
    const dir = join(home, ".local/share/augie/website-marks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "website-marks.json"), "{ not json", "utf8");
    const { getWebsiteProjectsStore } = await import("@/avatar/websiteProjectsStore.server");
    const store = await getWebsiteProjectsStore();
    if (!store) throw new Error("the website projects store should exist under a node HOME");
    const file = await store.read();
    expect(file.projects).toHaveLength(0);
  });
});
