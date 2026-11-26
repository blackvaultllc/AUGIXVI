import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  deriveNotifications,
  mergeDerivedEntries,
  sanitizeInboxFile,
  sanitizeNotification,
  unreadNotifications,
  type CoreEventRef,
  type InboxSources,
} from "@/avatar/cameras/anubisInbox";
import {
  derivePropertyFeed,
  mergeFeedEntries,
  partitionFeedEntries,
  propertyFeedExportText,
  propertyFeedRefusal,
  sanitizePropertyFeedFile,
  type PropertyFeedEntry,
} from "@/avatar/cameras/propertyFeed";
import {
  captureReasoningForEvent,
  evidenceStillReasoning,
  judgmentReasoning,
  sanitizeSectorWatchFile,
  type SectorWatchFile,
} from "@/avatar/cameras/sectorWatch";
import { FilePropertyFeedStore } from "@/avatar/propertyFeedStore.server";

/**
 * THE NOTIFICATIONS PASS (owner orders 2026-11-26) — Anubis
 * speaks up through an inbox, every kept picture carries its
 * reasoning, and the outside camera feeds the Bellwood Haven
 * property record. These pins hold the three laws:
 *
 *   · NO EVENT, NO ENTRY — derivation from empty records is
 *     empty; every entry cites the record it came from.
 *   · REASONING TRAVELS — a capture's why is stamped at
 *     capture time, survives sanitizers, and rides into the
 *     inbox and the feed.
 *   · THE WALL — the property feed writer refuses any zone
 *     but the outside (front) zone, in code: the bedroom
 *     camera's events can never be written into the feed.
 */

const HOUR = 60 * 60_000;
const T0 = 1_700_000_000_000;

function sectorFile(partial: Record<string, unknown>): SectorWatchFile {
  return sanitizeSectorWatchFile(partial);
}

function frontEvent(id: string, at: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    at,
    cameraId: "command-front-window",
    cameraName: "Command",
    zone: "front",
    kind: "front-threat",
    summary: `Possible break-in at the front (${id}).`,
    reading: "both looks agreed",
    reasoning: "stamped reasoning for " + id,
    frames: [`${id}-a.jpg`],
    evidence: [],
    personReading: "",
    crossExam: [],
    acknowledged: false,
    ...extra,
  };
}

function sources(partial: Partial<InboxSources> = {}): InboxSources {
  return {
    sector: sectorFile({}),
    householdCount: 0,
    coreEvents: [],
    ...partial,
  };
}

describe("inbox sanitizers — a claim survives only in its exact shape", () => {
  it("drops entries missing their source, and keeps the read mark", () => {
    const ok = sanitizeNotification({
      id: "n1",
      at: 5,
      kind: "capture",
      title: "t",
      text: "x",
      sourceEventId: "e1",
      still: "a.jpg",
      read: true,
    });
    expect(ok?.read).toBe(true);
    expect(ok?.still).toBe("a.jpg");
    expect(
      sanitizeNotification({ id: "n2", at: 5, kind: "capture", title: "t", text: "x" }),
    ).toBeNull();
  });

  it("a path in the still name never survives", () => {
    const entry = sanitizeNotification({
      id: "n1",
      at: 5,
      kind: "capture",
      title: "t",
      text: "x",
      sourceEventId: "e1",
      still: "../secret.jpg",
    });
    expect(entry?.still).toBe("");
  });

  it("unread count reads the record, nothing else", () => {
    const file = sanitizeInboxFile({
      entries: [
        { id: "a", at: 1, kind: "system", title: "t", text: "x", sourceEventId: "s1", read: false },
        { id: "b", at: 2, kind: "system", title: "t", text: "x", sourceEventId: "s2", read: true },
      ],
    });
    expect(unreadNotifications(file)).toHaveLength(1);
  });
});

describe("no event, no entry — derivation never fabricates", () => {
  it("empty records derive an empty inbox and an empty feed", () => {
    expect(deriveNotifications(sources())).toEqual([]);
    expect(derivePropertyFeed(sectorFile({}))).toEqual([]);
  });

  it("an event with no kept picture makes no capture entry", () => {
    const sector = sectorFile({ events: [frontEvent("e1", T0, { frames: [], evidence: [] })] });
    const derived = deriveNotifications(sources({ sector }));
    expect(derived.filter((e) => e.kind === "capture")).toEqual([]);
  });
});

describe("capture entries — the picture and its reasoning travel together", () => {
  it("an event's capture entry carries its stamped reasoning and cites the event", () => {
    const sector = sectorFile({ events: [frontEvent("e1", T0)] });
    const [entry] = deriveNotifications(sources({ sector }));
    expect(entry?.kind).toBe("capture");
    expect(entry?.sourceEventId).toBe("e1");
    expect(entry?.still).toBe("e1-a.jpg");
    expect(entry?.reasoning).toBe("stamped reasoning for e1");
  });

  it("an evidence still outranks the trigger frame as the capture picture", () => {
    const sector = sectorFile({
      events: [
        frontEvent("e1", T0, {
          evidence: [{ file: "e1-ev1.jpg", at: T0, plate: null, plateNote: "n", reasoning: "r" }],
        }),
      ],
    });
    const [entry] = deriveNotifications(sources({ sector }));
    expect(entry?.still).toBe("e1-ev1.jpg");
  });

  it("a judgment with a kept picture makes a capture entry; without one, none", () => {
    const sector = sectorFile({
      judgments: [
        { id: "j1", at: T0, cameraId: "bedroom", cameraName: "Bedroom", zone: "bedroom", text: "look", reasoning: "judged", still: "j1.jpg", crossExam: [], acknowledged: false },
        { id: "j2", at: T0, cameraId: "bedroom", cameraName: "Bedroom", zone: "bedroom", text: "look", reasoning: "", still: "", crossExam: [], acknowledged: false },
      ],
    });
    const captures = deriveNotifications(sources({ sector })).filter((e) => e.kind === "capture");
    expect(captures).toHaveLength(1);
    expect(captures[0]?.sourceEventId).toBe("j1");
    expect(captures[0]?.reasoning).toBe("judged");
  });

  it("an unstamped capture gets its reasoning built from its own record — and says so", () => {
    const sector = sectorFile({ events: [frontEvent("e1", T0, { reasoning: "" })] });
    const [entry] = deriveNotifications(sources({ sector }));
    expect(entry?.reasoning).toContain("Both looks agreed");
    expect(entry?.reasoning).toContain("before reasoning was stamped");
  });
});

describe("the suggestion rule set — explicit, and the whole of it", () => {
  it("S1: three confirmed events at one camera inside 24 hours suggest a closer look, citing the newest", () => {
    const sector = sectorFile({
      events: [frontEvent("e3", T0), frontEvent("e2", T0 - 2 * HOUR), frontEvent("e1", T0 - 5 * HOUR)],
    });
    const suggestions = deriveNotifications(sources({ sector })).filter(
      (e) => e.kind === "suggestion",
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.sourceEventId).toBe("e3");
    expect(suggestions[0]?.text).toContain("3 confirmed events");
    expect(suggestions[0]?.text).toContain("Sir");
  });

  it("S1: two events, or three spread past 24 hours, suggest nothing", () => {
    const two = sectorFile({ events: [frontEvent("e2", T0), frontEvent("e1", T0 - HOUR)] });
    expect(
      deriveNotifications(sources({ sector: two })).filter((e) => e.kind === "suggestion"),
    ).toEqual([]);
    const spread = sectorFile({
      events: [frontEvent("e3", T0), frontEvent("e2", T0 - 20 * HOUR), frontEvent("e1", T0 - 30 * HOUR)],
    });
    expect(
      deriveNotifications(sources({ sector: spread })).filter((e) => e.kind === "suggestion"),
    ).toEqual([]);
  });

  it("S2: four NOT CONFIRMED drafts at one camera suggest checking its view", () => {
    const log = [0, 1, 2, 3].map((i) => ({
      id: `watch-${i}`,
      at: T0 - i * HOUR,
      cameraId: "command-front-window",
      cameraName: "Command",
      zone: "front",
      kind: "draft",
      text: "not confirmed",
    }));
    const sector = sectorFile({ log });
    const suggestions = deriveNotifications(sources({ sector })).filter(
      (e) => e.kind === "suggestion",
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.title).toContain("camera's view");
    expect(suggestions[0]?.sourceEventId).toBe("watch-0");
  });

  it("S3: a bedroom event with nobody enrolled suggests enrolling — and only then", () => {
    const sector = sectorFile({
      events: [
        {
          id: "b1",
          at: T0,
          cameraId: "bedroom",
          cameraName: "Bedroom",
          zone: "bedroom",
          kind: "bedroom-no-access",
          summary: "NO ACCESS.",
          reading: "r",
          frames: [],
          acknowledged: false,
        },
      ],
    });
    const withNone = deriveNotifications(sources({ sector, householdCount: 0 })).filter(
      (e) => e.kind === "suggestion",
    );
    expect(withNone).toHaveLength(1);
    expect(withNone[0]?.sourceEventId).toBe("b1");
    const withFaces = deriveNotifications(sources({ sector, householdCount: 2 })).filter(
      (e) => e.kind === "suggestion",
    );
    expect(withFaces).toEqual([]);
  });
});

describe("system entries — the core's own activity, from its own log", () => {
  it("the four system types land; a note never does", () => {
    const coreEvents: CoreEventRef[] = [
      { id: "core-1-a", at: T0, type: "update-check", summary: "Up to date.", detail: "checked" },
      { id: "core-2-b", at: T0, type: "note", summary: "Sector Watch: something", detail: "" },
      { id: "core-3-c", at: T0, type: "test-result", summary: "Watch: WORKS", detail: "reason" },
    ];
    const system = deriveNotifications(sources({ coreEvents })).filter((e) => e.kind === "system");
    expect(system).toHaveLength(2);
    expect(system.map((e) => e.sourceEventId).sort()).toEqual(["core-1-a", "core-3-c"]);
  });

  it("re-derivation merges without duplicates and read marks survive", () => {
    const sector = sectorFile({ events: [frontEvent("e1", T0)] });
    const first = mergeDerivedEntries(sanitizeInboxFile(null), deriveNotifications(sources({ sector })));
    expect(first.entries).toHaveLength(1);
    const marked = { entries: first.entries.map((e) => ({ ...e, read: true })) };
    const second = mergeDerivedEntries(marked, deriveNotifications(sources({ sector })));
    expect(second.entries).toHaveLength(1);
    expect(second.entries[0]?.read).toBe(true);
  });
});

describe("reasoning — stamped at capture, kept by the sanitizers", () => {
  it("the builders speak of the trigger and the two looks, never free-form", () => {
    expect(captureReasoningForEvent("weapon", "Command")).toContain("answered yes twice");
    expect(captureReasoningForEvent("bedroom-no-access", "Bedroom")).toContain("Captain's room");
    expect(captureReasoningForEvent("front-truck", "Command")).toContain("only one who gets in that truck");
    expect(evidenceStillReasoning("front-threat", 0)).toContain("Evidence still 1");
    expect(evidenceStillReasoning("front-threat", 0)).toContain("delivery person in plain clothes");
    expect(judgmentReasoning("Command")).toContain("judgment");
  });

  it("reasoning round-trips through the sector sanitizers", () => {
    const file = sectorFile({
      events: [
        frontEvent("e1", T0, {
          evidence: [{ file: "e1-ev1.jpg", at: T0, plate: null, plateNote: "n", reasoning: "burst why" }],
        }),
      ],
      judgments: [
        { id: "j1", at: T0, cameraId: "c", cameraName: "C", zone: "front", text: "t", reasoning: "judge why", still: "j1.jpg" },
      ],
    });
    expect(file.events[0]?.reasoning).toBe("stamped reasoning for e1");
    expect(file.events[0]?.evidence[0]?.reasoning).toBe("burst why");
    expect(file.judgments[0]?.reasoning).toBe("judge why");
  });
});

describe("the property feed — derivation and THE WALL", () => {
  const feedEntry = (partial: Partial<PropertyFeedEntry>): PropertyFeedEntry => ({
    id: "feed-x",
    at: T0,
    cameraId: "command-front-window",
    cameraName: "Command",
    zone: "front",
    kind: "suspicious",
    capture: null,
    reasoning: "why",
    sourceEventId: "x",
    draft: false,
    ...partial,
  });

  it("the refusal: front passes; bedroom and common are refused in words", () => {
    expect(propertyFeedRefusal(feedEntry({}))).toBeNull();
    expect(propertyFeedRefusal(feedEntry({ zone: "bedroom", cameraName: "Bedroom" }))).toContain(
      "inside the house",
    );
    expect(propertyFeedRefusal(feedEntry({ zone: "common" }))).toContain("outside (front) zone only");
  });

  it("derivation maps front records honestly and never derives an interior one", () => {
    const sector = sectorFile({
      events: [
        frontEvent("e1", T0, { kind: "front-truck" }),
        frontEvent("e2", T0 - HOUR, { kind: "front-threat" }),
        {
          id: "b1",
          at: T0,
          cameraId: "bedroom",
          cameraName: "Bedroom",
          zone: "bedroom",
          kind: "bedroom-no-access",
          summary: "NO ACCESS.",
          reading: "r",
          frames: ["b1-a.jpg"],
          acknowledged: false,
        },
      ],
      judgments: [
        { id: "j1", at: T0, cameraId: "command-front-window", cameraName: "Command", zone: "front", text: "look", reasoning: "judged", still: "j1.jpg" },
      ],
    });
    const feed = derivePropertyFeed(sector);
    expect(feed).toHaveLength(3);
    expect(feed.find((e) => e.sourceEventId === "e1")?.kind).toBe("vehicle");
    expect(feed.find((e) => e.sourceEventId === "e2")?.kind).toBe("suspicious");
    expect(feed.find((e) => e.sourceEventId === "j1")?.draft).toBe(true);
    expect(feed.some((e) => e.zone !== "front")).toBe(false);
  });

  it("the store's only write door refuses the bedroom camera — pinned at the writer", async () => {
    const dir = await mkdtemp(join(tmpdir(), "augie-feed-test-"));
    try {
      const store = new FilePropertyFeedStore(fsp, dir);
      const bedroom = feedEntry({
        id: "feed-b1",
        cameraId: "bedroom",
        cameraName: "Bedroom",
        zone: "bedroom",
        sourceEventId: "b1",
        capture: "b1-a.jpg",
      });
      const refusedResult = await store.append([bedroom]);
      expect(refusedResult.written).toBe(0);
      expect(refusedResult.refused).toHaveLength(1);
      expect(refusedResult.refused[0]?.reason).toContain("inside the house");
      expect((await store.read()).entries).toEqual([]);
      const onDisk = await readFile(join(dir, "property-feed.json"), "utf8").catch(() => "");
      expect(onDisk).not.toContain("bedroom");

      const front = feedEntry({ id: "feed-e1", sourceEventId: "e1", capture: "e1-a.jpg" });
      const writtenResult = await store.append([front]);
      expect(writtenResult.written).toBe(1);
      expect((await store.read()).entries).toHaveLength(1);
      const again = await store.append([front]);
      expect(again.written).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("partition splits a mixed batch at the wall", () => {
    const { accepted, refused } = partitionFeedEntries([
      feedEntry({ id: "feed-a" }),
      feedEntry({ id: "feed-b", zone: "common", cameraId: "agagmoss-v1" }),
    ]);
    expect(accepted).toHaveLength(1);
    expect(refused).toHaveLength(1);
  });

  it("the export names the source, lists the images, and keeps draft labels", () => {
    const file = mergeFeedEntries(sanitizePropertyFeedFile(null), [
      feedEntry({ id: "feed-e1", sourceEventId: "e1", capture: "e1-a.jpg" }),
      feedEntry({ id: "feed-j1", sourceEventId: "j1", capture: "j1.jpg", draft: true }),
    ]);
    const text = propertyFeedExportText(file, T0);
    const parsed = JSON.parse(text) as { source: string; images: string[]; entries: PropertyFeedEntry[] };
    expect(parsed.source).toContain("Anubis security");
    expect(parsed.images.sort()).toEqual(["e1-a.jpg", "j1.jpg"]);
    expect(parsed.entries.find((e) => e.id === "feed-j1")?.draft).toBe(true);
  });
});

describe("stage wiring — the button and the window exist", () => {
  it("the stage carries the notifications badge with its count class", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    expect(css).toContain(".notifications-stage-badge");
    expect(css).toContain(".notifications-stage-badge__count");
    expect(css).toContain(".window-inbox");
    const stage = readFileSync(resolve(process.cwd(), "src/avatar/AvatarStage.tsx"), "utf8");
    expect(stage).toContain("notifications-stage-badge");
    expect(stage).toContain("getInboxState");
    expect(stage).toContain("NotificationsWindow");
  });
});
