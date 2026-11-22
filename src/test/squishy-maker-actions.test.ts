import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  handleSquishyActionsRequest,
  runSquishyAction,
} from "@/avatar/learner/squishyMaker.server";

/**
 * Her Squishy Maker's six actions, Augie-side: the same shapes the
 * space runtime served the artifact (listSquishies, saveSquishy,
 * updateSquishy, deleteSquishy, getPrizeMoney, earnPrize), proven
 * against a throwaway store file.
 */

let dir: string;
let storePath: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "augie-squishy-"));
  storePath = join(dir, "squishy-maker.json");
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const DESIGN = {
  name: "Berry",
  baseType: "heart",
  color: "pink",
  eyeStyle: "happy",
  eyeColor: "brown",
  face: "smile",
  materials: ["velvet"],
  extras: ["bow"],
  glitterColor: "gold",
  glitterAmount: 2,
  size: "medium",
  scent: "none",
  cut: false,
};

describe("squishy maker actions (Augie server)", () => {
  it("starts empty, with $0 of pretend prize money", async () => {
    expect(await runSquishyAction("listSquishies", {}, storePath)).toEqual({ squishies: [] });
    expect(await runSquishyAction("getPrizeMoney", {}, storePath)).toEqual({ total: 0 });
  });

  it("saves, lists newest first, updates, and deletes", async () => {
    const first = (await runSquishyAction("saveSquishy", DESIGN, storePath)) as { id: number };
    const second = (await runSquishyAction(
      "saveSquishy",
      { ...DESIGN, name: "Melon" },
      storePath,
    )) as { id: number };
    expect(second.id).toBeGreaterThan(first.id);

    const listed = (await runSquishyAction("listSquishies", {}, storePath)) as {
      squishies: { id: number; name: string; materials: string[]; cut: boolean }[];
    };
    expect(listed.squishies.map((s) => s.name)).toEqual(["Melon", "Berry"]);
    expect(listed.squishies[1]?.materials).toEqual(["velvet"]);
    expect(listed.squishies[1]?.cut).toBe(false);

    await runSquishyAction(
      "updateSquishy",
      { id: first.id, ...DESIGN, name: "Berry Two", cut: true },
      storePath,
    );
    const afterUpdate = (await runSquishyAction("listSquishies", {}, storePath)) as {
      squishies: { id: number; name: string; cut: boolean }[];
    };
    expect(afterUpdate.squishies.find((s) => s.id === first.id)?.name).toBe("Berry Two");
    expect(afterUpdate.squishies.find((s) => s.id === first.id)?.cut).toBe(true);

    await runSquishyAction("deleteSquishy", { id: second.id }, storePath);
    const afterDelete = (await runSquishyAction("listSquishies", {}, storePath)) as {
      squishies: { name: string }[];
    };
    expect(afterDelete.squishies.map((s) => s.name)).toEqual(["Berry Two"]);
  });

  it("earnPrize adds exactly $10 of pretend money each time", async () => {
    expect(await runSquishyAction("earnPrize", {}, storePath)).toEqual({ total: 10 });
    expect(await runSquishyAction("earnPrize", {}, storePath)).toEqual({ total: 20 });
    expect(await runSquishyAction("getPrizeMoney", {}, storePath)).toEqual({ total: 20 });
  });

  it("rejects a nameless squishy and an unknown action", async () => {
    await expect(
      runSquishyAction("saveSquishy", { ...DESIGN, name: " " }, storePath),
    ).rejects.toThrow(/name/i);
    await expect(runSquishyAction("danceParty", {}, storePath)).rejects.toThrow(/Unknown action/);
  });

  it("speaks the game's wire protocol: {action, args} in, {data} out", async () => {
    const request = new Request("http://x/games/squishy-maker/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "getPrizeMoney", args: {} }),
    });
    const response = await handleSquishyActionsRequest(request);
    // The wire handler uses the default store path; only the envelope
    // shape is asserted here (the default store is the machine's own).
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data?: { total: number } };
    expect(typeof body.data?.total).toBe("number");
  });
});
