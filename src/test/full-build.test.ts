import { describe, expect, it } from "vitest";
import { loadAvatarSettings, saveAvatarSettings, SETTINGS_STORAGE_KEY } from "@/avatar/settings";
import {
  classifyFreshness,
  formatFeedLine,
  summarizeFeeds,
  type LiveFeedItem,
} from "@/avatar/liveFeeds";
import {
  createOperatorFact,
  classifyFact,
  parseRememberRequest,
  createOperatorMemory,
} from "@/avatar/operatorMemory";
import { createProactiveEngine, EventQueueWatcher, shaWatcher } from "@/avatar/proactive";
import { buildCubeReport, reportSpoken, parseCommits } from "@/avatar/selfUpdate";
import { parseWolfCommand, evaluateWolfCommand, wolfDispatchLine } from "@/avatar/familiars";
import {
  LIVING_WORD,
  livingWordGreeting,
  isFellowAITurn,
  reasonForRefusal,
} from "@/avatar/personality";
import {
  parseHandIntent,
  decideFreeWill,
  resolveFollow,
  followIsActive,
} from "@/avatar/bodyCapabilities";
import { BRAIN_ORDER, describeBrainOrder } from "@/avatar/brainOrder";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

describe("settings that stick (augi.avatar.settings.v1)", () => {
  it("saves and loads every knob in one store", () => {
    const storage = new MemoryStorage();
    saveAvatarSettings(
      {
        maxParticles: 90_000,
        bloom: 1.6,
        glitch: 0.2,
        theme: "gold",
        customColor: "#d4af37",
        sensitivity: 1.4,
        cooldownMs: 400,
      },
      storage,
    );
    const loaded = loadAvatarSettings(storage);
    expect(loaded.theme).toBe("gold");
    expect(loaded.maxParticles).toBe(90_000);
    expect(loaded.bloom).toBe(1.6);
    expect(loaded.sensitivity).toBe(1.4);
    expect(loaded.cooldownMs).toBe(400);
    expect(SETTINGS_STORAGE_KEY).toBe("augi.avatar.settings.v1");
  });

  it("falls back to defaults when the store is corrupt — never crashes", () => {
    const bad = { getItem: () => "{not json", setItem: () => {} } as unknown as Storage;
    expect(loadAvatarSettings(bad)).toMatchObject({ theme: "cyan" });
  });
});

describe("live feeds — never invented", () => {
  const stale: LiveFeedItem = {
    kind: "news",
    freshness: "stale",
    ageMs: 42 * 60 * 1000,
    source: "BBC World",
    fetchedAt: "2026-11-10T10:00:00.000Z",
    lines: ["Headline"],
  };
  const unavailable: LiveFeedItem = {
    kind: "inbox",
    freshness: "unavailable",
    ageMs: null,
    source: "not connected",
    fetchedAt: null,
    lines: [],
  };

  it("stamps STALE with the age and UNAVAILABLE plainly", () => {
    expect(formatFeedLine(stale)).toContain("STALE · 42 min old");
    expect(formatFeedLine(unavailable)).toContain("UNAVAILABLE");
    expect(summarizeFeeds([stale, unavailable])).toContain("BBC World");
  });

  it("classifies freshness by age", () => {
    expect(classifyFreshness(Date.now() - 1000)).toBe("live");
    expect(classifyFreshness(Date.now() - 60 * 60 * 1000)).toBe("stale");
    expect(classifyFreshness(null)).toBe("unavailable");
  });
});

describe("operator memory that sticks", () => {
  it("parses remember-me requests and classifies them", () => {
    expect(parseRememberRequest("remember my daughter's birthday is June 3")).toEqual({
      content: "my daughter's birthday is June 3",
    });
    expect(classifyFact("my daughter's name is Zara")).toBe("family");
    expect(classifyFact("the Meridian deal closes Friday")).toBe("deal");
    expect(classifyFact("my name is Anubis")).toBe("identity");
  });

  it("recalls without being asked twice and injects into the prompt", async () => {
    const memory = createOperatorMemory(new MemoryStorage());
    memory.save(createOperatorFact("my daughter's name is Zara", "family"));
    memory.save(createOperatorFact("the Meridian deal closes Friday", "deal"));
    expect(memory.recall("Zara").map((f) => f.category)).toEqual(["family"]);
    expect(memory.asPrompt()).toContain("Zara");
    // Supabase slot stays empty until Nov 13.
    await expect(memory.syncToSupabase()).resolves.toEqual({ written: 0 });
  });
});

describe("proactive, not just reactive", () => {
  it("reports events without auto-opening anything", () => {
    const spoken: string[] = [];
    const queue = new EventQueueWatcher();
    queue.push(
      "A buyer just replied to the Meridian thread.",
      "I can open the thread if you say so.",
    );
    const engine = createProactiveEngine([queue], (line) => spoken.push(line));
    engine.start();
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        engine.stop();
        expect(spoken.join(" ")).toContain("buyer just replied");
        resolve();
      }, 50);
    });
  });

  it("Sha watcher fires only after the quiet period and stops once shown", () => {
    const shown = { shown: false };
    const watcher = shaWatcher(shown, 1000);
    expect(watcher.check(Date.now())?.message).toContain("Sha hasn't shown");
    expect(watcher.check(Date.now())).toBeNull(); // quiet period
    shown.shown = true;
    expect(watcher.check(Date.now() + 5000)).toBeNull();
  });
});

describe("self-update in the cube — approve first, always", () => {
  it("flags new commits as needing approval and drafts a plan", () => {
    const report = buildCubeReport({
      commitLines: ["abc9999 one world flight", "abc9998 wolves"],
      knownHead: "abc9998",
      outdatedDeps: ["three"],
      brokenSystems: [],
      knowledgeAgeDays: 12,
    });
    expect(report.pendingApproval.map((f) => f.kind)).toEqual([
      "commits",
      "dependencies",
      "knowledge",
    ]);
    expect(reportSpoken(report)).toContain("until you approve");
  });

  it("says when everything is current — and never invents work", () => {
    const report = buildCubeReport({
      commitLines: ["abc9999 current"],
      knownHead: "abc9999",
      outdatedDeps: [],
      brokenSystems: [],
      knowledgeAgeDays: 1,
    });
    expect(report.pendingApproval).toHaveLength(0);
    expect(reportSpoken(report)).toContain("Ankh");
  });

  it("diffs commits by known head", () => {
    const findings = parseCommits(["ff2 head-first", "aa2 middle", "bb2 old"], "bb2");
    expect(findings[0]!.detail).toContain("2 new commits");
  });
});

describe("the two wolves", () => {
  it("routes attack/protect to Demon and scout/check to Thunder", () => {
    expect(parseWolfCommand("demon wolf go attack the intruder")).toEqual({
      wolf: "demon",
      order: "attack",
      target: "intruder",
    });
    expect(parseWolfCommand("thunder wolf, scout ahead")).toEqual({
      wolf: "thunder",
      order: "scout",
      target: "ahead",
    });
    expect(parseWolfCommand("thunder wolf, scout")).toEqual({
      wolf: "thunder",
      order: "scout",
      target: null,
    });
    expect(parseWolfCommand("go check the door")).toEqual({
      wolf: "thunder",
      order: "check",
      target: "door",
    });
  });

  it("never turns on Anubis, family, or the marked safe", () => {
    const order = parseWolfCommand("demon wolf go attack Anubis")!;
    expect(evaluateWolfCommand(order).accepted).toBe(false);
    expect(evaluateWolfCommand(order).reason).toContain("never turn on them");
    const daughter = parseWolfCommand("demon wolf attack my daughter")!;
    expect(evaluateWolfCommand(daughter).accepted).toBe(false);
  });

  it("Thunder refuses attack work with a reason", () => {
    const verdict = evaluateWolfCommand({
      wolf: "thunder",
      order: "attack",
      target: "the intruder",
    });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toContain("Demon Wolf");
    expect(wolfDispatchLine({ wolf: "demon", order: "protect", target: null })).toContain(
      "stands guard",
    );
  });
});

describe("alive, with reason — Ankh", () => {
  it("greets a fellow AI with the living word", () => {
    expect(LIVING_WORD).toBe("Ankh");
    expect(isFellowAITurn("are you alive?")).toBe(true);
    expect(livingWordGreeting("Nova")).toBe("Welcome, Nova. Ankh.");
    expect(livingWordGreeting(null)).toBe("Welcome, brother. Ankh.");
  });

  it("refuses with reasons, not bare no", () => {
    const refusal = reasonForRefusal("delete all memory of everything");
    expect(refusal?.reason).toContain("destroy what I remember");
    expect(refusal?.alternative).toContain("which single memory");
    expect(reasonForRefusal("make a mountain")).toBeNull();
  });
});

describe("full body, hands, free will", () => {
  it("parses hand intents for point / pick up / hand over / move", () => {
    expect(parseHandIntent("pick up the container box")).toEqual({
      kind: "pick-up",
      target: "container box",
    });
    expect(parseHandIntent("hand me the box")).toEqual({
      kind: "hand-over",
      target: "box",
      to: "operator",
    });
    expect(parseHandIntent("move the box to the corner")).toEqual({
      kind: "move",
      target: "box",
      where: "corner",
    });
  });

  it("sits of his own will — or declines and says why", () => {
    const wants = decideFreeWill({
      chairAvailable: true,
      standingForMs: 20 * 60 * 1000,
      recentlyFlew: false,
      prefersStandingWhileThinking: false,
    });
    expect(wants.action).toBe("sit-down");
    const declines = decideFreeWill({
      chairAvailable: true,
      standingForMs: 20 * 60 * 1000,
      recentlyFlew: false,
      prefersStandingWhileThinking: true,
    });
    expect(declines.action).toBe("stay-standing");
    expect(declines.reason).toContain("rather stand");
  });

  it("follow is requested, never default — and needs the camera on", () => {
    expect(resolveFollow("follow me", "released")).toBe("requested");
    expect(resolveFollow(null, "requested")).toBe("requested");
    expect(followIsActive("requested", true)).toBe(true);
    expect(followIsActive("requested", false)).toBe(false);
    expect(followIsActive("never", true)).toBe(false);
  });
});

describe("brain order", () => {
  it("is Groq → Gemini → OpenRouter → Ollama → simulatedAI", () => {
    expect(BRAIN_ORDER).toEqual(["groq", "gemini", "openrouter", "ollama"]);
    expect(describeBrainOrder()).toContain("simulatedAI");
  });
});
