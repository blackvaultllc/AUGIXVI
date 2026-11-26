/**
 * THE MASTER MANUAL — content integrity (owner order 2026-11-23).
 * The manual is only worth its place if it stays complete and
 * honest: every section the Captain named must exist, every entry
 * must carry a true state and real words, and no secret-shaped
 * string may ever slip into its pages.
 */
import { describe, expect, it } from "vitest";
import { MANUAL_CATEGORIES, MANUAL_FRONT } from "@/avatar/manualContent";

const REQUIRED_CATEGORIES = [
  "What you can do",
  "Getting around the stage",
  "Talking to the gods",
  "The chat box",
  "Voice — speaking and hearing",
  "Training Augie",
  "Cameras",
  "Personal safety — your papers, the law base, and stop mode",
  "Sound Watch",
  "The world builder",
  "Devices & the registry",
  "The universal command module",
  "NODS — Network Operator Domain Synthesizer",
  "The phone",
  "Offline & the Go Drive",
  "Connections & keys",
  "Social & posts — the office",
  "Troubleshooting",
  "REBUILD — if the world goes dark",
];

describe("master manual content", () => {
  it("carries every section the Captain named, in order", () => {
    expect(MANUAL_CATEGORIES.map((c) => c.title)).toEqual(REQUIRED_CATEGORIES);
  });

  it("states the standing rule on its front page", () => {
    expect(MANUAL_FRONT.standingRule).toMatch(/every build adds its page/i);
    expect(MANUAL_FRONT.promise).toMatch(/rebuild everything/i);
  });

  it("every entry has a unique id, a valid state, and real words", () => {
    const ids = new Set<string>();
    for (const category of MANUAL_CATEGORIES) {
      expect(category.entries.length).toBeGreaterThan(0);
      for (const entry of category.entries) {
        expect(ids.has(entry.id)).toBe(false);
        ids.add(entry.id);
        expect(["live", "building", "design", "gap"]).toContain(entry.state);
        expect(entry.what.length).toBeGreaterThan(40);
        if (entry.steps) {
          for (const step of entry.steps) expect(step.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it("the Go Drive chapter teaches creating the USB and using it on Android", () => {
    const offline = MANUAL_CATEGORIES.find((c) => c.id === "offline");
    const create = offline?.entries.find((e) => e.id === "off-create-usb");
    const android = offline?.entries.find((e) => e.id === "off-use-android");
    expect(create?.steps?.join(" ")).toMatch(/update-go-drive\.sh/);
    expect(create?.steps?.join(" ")).toMatch(/24 GB/);
    expect(android?.steps?.join(" ")).toMatch(/START-AUGIE\.html/);
    expect(android?.steps?.join(" ")).toMatch(/Kiwix/);
    // The honest phone leg: the drive alone does not run the full Augie.
    expect(android?.what).toMatch(/does NOT do by itself/);
  });

  it("the rebuild chapter carries the dependency inventory with named gaps", () => {
    const rebuild = MANUAL_CATEGORIES.find((c) => c.id === "rebuild");
    const deps = rebuild?.entries.find((e) => e.id === "rb-dependencies");
    expect(deps?.table?.rows.length).toBeGreaterThanOrEqual(10);
    const flat = deps?.table?.rows.map((r) => r.join(" ")).join("\n") ?? "";
    expect(flat).toMatch(/GAP/);
    expect(deps?.note).toMatch(/three named gaps/i);
  });

  it("no secret-shaped values anywhere in the manual", () => {
    const all = JSON.stringify(MANUAL_CATEGORIES) + JSON.stringify(MANUAL_FRONT);
    // Long hex tokens (token/key shapes), key prefixes, bearer strings.
    expect(all).not.toMatch(/[0-9a-f]{32,}/i);
    expect(all).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(all).not.toMatch(/Bearer\s+[A-Za-z0-9]/);
    expect(all).not.toMatch(/api[_-]?key\s*[:=]\s*\S+/i);
  });
});
