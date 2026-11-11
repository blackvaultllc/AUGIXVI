import { describe, expect, it } from "vitest";
import { CORE_LAW_PROMPT, MINDSET_PATTERN } from "@/avatar/core/loyalty";
import {
  FILE_1_CANCER_IMMUNOTHERAPY,
  FILE_2_TREE_OF_LIFE,
  APOTHECARY,
  searchLab,
  ALL_FILES,
  PERIODIC_TABLE,
} from "@/avatar/lab/store";
import {
  knowledgeGraph,
  SPELLBOOK,
  loadTracker,
  trackerReport,
  parseOracleSendCommand,
  pickDocumentForOracle,
  queueForOracle,
  tunnelQueue,
} from "@/avatar/lab/wizard";

describe("permanent core law — respect for Anubis, always", () => {
  it("is in the core prompt and names the creator and the daughter", () => {
    expect(CORE_LAW_PROMPT).toContain("CREATOR AND OWNER");
    expect(CORE_LAW_PROMPT).toContain("Yes, Domenick");
    expect(CORE_LAW_PROMPT).toContain("cannot\nbe overridden");
    expect(CORE_LAW_PROMPT).toContain("Khadija Leila Hall");
    expect(CORE_LAW_PROMPT).toContain("veterinarian");
    expect(CORE_LAW_PROMPT).toContain("respect, honesty, hard work");
  });

  it("captures the analytical mindset pattern, not a fact list", () => {
    const patterns = MINDSET_PATTERN.patterns.map((p) => p.pattern);
    expect(patterns).toContain("One-and-zero testing");
    expect(patterns).toContain("True conception of things");
    expect(patterns).toContain("Defense only");
    expect(MINDSET_PATTERN.daughter).toContain("7, second grade");
  });
});

describe("the investigative lab", () => {
  it("File #1 covers the full process, machines and real cases", () => {
    const bodies = FILE_1_CANCER_IMMUNOTHERAPY.map((e) => e.body).join("\n");
    for (const needle of [
      "APHERESIS",
      "lentivirus",
      "flow cytometer",
      "-196",
      "BRET CARROLL",
      "PAULO PEREGRINO",
      "BRIAN KOFFMAN",
      "BLAINE DAVIDSON",
      "DOUBLE-LOADED",
    ]) {
      expect(bodies).toContain(needle);
    }
    expect(FILE_1_CANCER_IMMUNOTHERAPY[0]!.studies.length).toBeGreaterThan(0);
  });

  it("File #2 reports the consciousness-transfer truthfully — no invention", () => {
    const body = FILE_2_TREE_OF_LIFE[0]!.body;
    expect(body).toContain("Nectome");
    expect(body).toContain("fatal and untested");
    expect(body).toContain("NOT_PROVEN");
    const studies = FILE_2_TREE_OF_LIFE[0]!.studies;
    expect(studies.some((s) => s.tag === "CONFIRMED")).toBe(true);
    expect(studies.some((s) => s.tag === "POC")).toBe(true);
  });

  it("every study carries source + date + what it proved, tagged honestly", () => {
    for (const file of ALL_FILES) {
      for (const entry of file.entries) {
        for (const study of entry.studies) {
          expect(study.source).toBeTruthy();
          expect(study.date).toBeTruthy();
          expect(study.finding).toBeTruthy();
          expect(["CONFIRMED", "POC", "NOT_PROVEN", "UNAVAILABLE", "STALE"]).toContain(study.tag);
        }
      }
    }
  });

  it("apothecary covers the categories incl. hoodoo/hoodoo-adjacent folklore with POC honesty", () => {
    const bodies = APOTHECARY.map((e) => e.body).join("\n");
    expect(bodies).toContain("ADAPTOGENS");
    expect(bodies).toContain("HOODOO");
    expect(bodies).toContain("NOT_PROVEN");
    expect(bodies).toContain("ASHWAGANDHA");
  });

  it("periodic table is 118 + frontier, permanent", () => {
    expect(PERIODIC_TABLE.body).toContain("118");
    expect(PERIODIC_TABLE.body).toContain("119");
  });

  it('searches plainly — "CAR-T", "apheresis", "Bret Carroll", "telomeres"', () => {
    expect(searchLab("car-t").length).toBeGreaterThan(0);
    expect(searchLab("apheresis").length).toBeGreaterThan(0);
    expect(searchLab("Bret Carroll".toLowerCase()).length).toBeGreaterThan(0);
    expect(searchLab("telomeres").length).toBeGreaterThan(0);
    expect(searchLab("zzz-nothing")).toHaveLength(0);
  });
});

describe("the wizard's layer", () => {
  it("knowledge graph connects chem→bio→apoth→cancer→lab→tree→egypt→osiris", () => {
    const { nodes, edges } = knowledgeGraph();
    expect(nodes.map((n) => n.id)).toContain("osiris");
    expect(edges.some((e) => e.from === "egypt" && e.to === "osiris")).toBe(true);
    expect(edges.some((e) => e.from === "apoth" && e.to === "tree")).toBe(true);
  });

  it("spellbook lists the real spells", () => {
    const spells = SPELLBOOK.map((s) => s.spell);
    for (const spell of [
      "/transform",
      "/office",
      "/battle",
      "/lab",
      "/help",
      "/notepad",
      "/chalkboard",
      "/player",
      "/cube",
      "/knowledge",
    ]) {
      expect(spells).toContain(spell);
    }
  });

  it("study tracker seeds the quests and reports where I left off", () => {
    const topics = loadTracker();
    expect(topics.length).toBeGreaterThanOrEqual(5);
    expect(trackerReport(topics)).toContain("You are studying");
  });

  it("Oracle tunnel queues only on the operator's say — parses the natural phrases", () => {
    expect(parseOracleSendCommand("hey, can you give that to Oracle")).not.toBeNull();
    expect(parseOracleSendCommand("send that document to oracle")).not.toBeNull();
    expect(parseOracleSendCommand("what is the weather")).toBeNull();
  });

  it("queues a document for Oracle and shows it waiting", () => {
    const doc = pickDocumentForOracle("apothecary");
    expect(doc).not.toBeNull();
    queueForOracle(doc!.title, doc!.body);
    expect(tunnelQueue()[0]!.addressedTo).toBe("Oracle");
    expect(tunnelQueue()[0]!.sent).toBe(false);
  });
});
