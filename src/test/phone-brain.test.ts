import { afterEach, describe, expect, it, vi } from "vitest";
import { capabilitiesBrief } from "@/avatar/capabilities";
import {
  PHONE_BRAIN_MODELS,
  PHONE_BRAIN_PROVIDER,
  PHONE_BRAIN_SYSTEM,
  askPhoneBrain,
  deletePhoneBrain,
  derivePhoneBrainStatus,
  downloadPhoneBrain,
  getPhoneBrainStatus,
  pickCachedModel,
  phoneBrainStatusLabel,
  recommendedModel,
} from "@/avatar/phoneBrain";

/**
 * ON-PHONE BRAIN — the engine is faked at the WebLLM boundary; what is
 * under test is OUR discipline: the catalog order, the earned status,
 * the model pick, and that the leg refuses (null) whenever it cannot
 * honestly answer, so the chain falls through instead of faking it.
 */
const fake = vi.hoisted(() => {
  const cached = new Set<string>();
  const createCalls: string[] = [];
  const engine = {
    chat: {
      completions: {
        create: vi.fn(async () => ({ choices: [{ message: { content: "ready" } }] })),
      },
    },
    unload: vi.fn(async () => undefined),
  };
  return { cached, createCalls, engine };
});

vi.mock("@mlc-ai/web-llm", () => ({
  hasModelInCache: vi.fn(async (id: string) => fake.cached.has(id)),
  deleteModelAllInfoInCache: vi.fn(async (id: string) => {
    fake.cached.delete(id);
  }),
  CreateMLCEngine: vi.fn(async (id: string) => {
    fake.createCalls.push(id);
    return fake.engine;
  }),
  CreateWebWorkerMLCEngine: vi.fn(async () => {
    throw new Error("worker path is exercised on real devices, not in jsdom");
  }),
}));

function stubGpu(f16: boolean) {
  Object.defineProperty(window.navigator, "gpu", {
    configurable: true,
    value: {
      requestAdapter: async () => ({
        features: new Set(f16 ? ["shader-f16"] : []),
      }),
    },
  });
}

afterEach(() => {
  fake.cached.clear();
  Reflect.deleteProperty(window.navigator, "gpu");
});

const [big, small] = PHONE_BRAIN_MODELS;

describe("phone brain catalog", () => {
  it("prefers the 3B, with the 1B as the compatibility floor", () => {
    expect(big!.id).toContain("3B");
    expect(big!.needsF16).toBe(true);
    expect(small!.id).toContain("1B");
    expect(small!.needsF16).toBe(false);
    expect(big!.sizeMB).toBeGreaterThan(small!.sizeMB);
    expect(PHONE_BRAIN_PROVIDER).toBe("On-phone brain (small)");
  });

  it("derives status from evidence only", () => {
    expect(derivePhoneBrainStatus({ webgpu: false, anyCached: true })).toBe("unsupported");
    expect(derivePhoneBrainStatus({ webgpu: true, anyCached: true })).toBe("ready");
    expect(derivePhoneBrainStatus({ webgpu: true, anyCached: false })).toBe("not-downloaded");
    expect(phoneBrainStatusLabel("ready")).toBe("ON-PHONE BRAIN READY");
    expect(phoneBrainStatusLabel("not-downloaded")).toBe("NOT DOWNLOADED");
  });

  it("picks the biggest cached model, in catalog order", () => {
    expect(pickCachedModel([])).toBeNull();
    expect(pickCachedModel([small!.id])?.id).toBe(small!.id);
    expect(pickCachedModel([small!.id, big!.id])?.id).toBe(big!.id);
  });

  it("recommends by the device's GPU facts", () => {
    expect(recommendedModel({ webgpu: true, f16: true }).id).toBe(big!.id);
    expect(recommendedModel({ webgpu: true, f16: false }).id).toBe(small!.id);
  });
});

describe("phone brain runtime (WebLLM faked at the boundary)", () => {
  it("reports NOT DOWNLOADED status when the cache is empty", async () => {
    stubGpu(true);
    await expect(getPhoneBrainStatus()).resolves.toBe("not-downloaded");
  });

  it("refuses to answer when nothing is downloaded — null, never a fake reply", async () => {
    stubGpu(true);
    await expect(askPhoneBrain("hello")).resolves.toBeNull();
    expect(fake.createCalls).toEqual([]);
  });

  it("refuses when the device has no WebGPU at all", async () => {
    fake.cached.add(small!.id);
    await expect(askPhoneBrain("hello")).resolves.toBeNull();
  });

  it("generates from the cached 1B and names its engine call", async () => {
    stubGpu(false);
    fake.cached.add(small!.id);
    await expect(askPhoneBrain("ping")).resolves.toBe("ready");
    expect(fake.createCalls).toContain(small!.id);
  });

  it("carries the addressee into its system prompt — same routing as the main brain", async () => {
    stubGpu(false);
    fake.cached.add(small!.id);
    type CreateArgs = { messages: { role: string; content: string }[] };
    const create = fake.engine.chat.completions.create as unknown as {
      mock: { calls: [CreateArgs][] };
      mockClear: () => void;
    };
    create.mockClear();
    await expect(askPhoneBrain("Osiris, report", [], "osiris")).resolves.toBe("ready");
    const request = create.mock.calls.at(-1)?.[0];
    // The compact prompt holds, and the speaker directive rides it:
    // the small brain speaks as the addressed presence, by name.
    expect(request?.messages[0]?.content).toContain(PHONE_BRAIN_SYSTEM);
    expect(request?.messages[0]?.content).toContain("You are speaking as Osiris");
    // The capability brief rides every message (owner defect
    // 2026-11-23) — ahead of the directive, which stays last.
    expect(request?.messages[0]?.content).toContain("WHAT YOU CAN ACCESS AND DO");
    expect(request?.messages[0]?.content.indexOf("WHAT YOU CAN ACCESS AND DO")).toBeLessThan(
      request?.messages[0]?.content.indexOf("You are speaking as Osiris") ?? -1,
    );
    // Without an addressee: system + the short brief, no directive —
    // the base prompt's default (Anubis) holds.
    create.mockClear();
    await expect(askPhoneBrain("ping")).resolves.toBe("ready");
    const plain = create.mock.calls.at(-1)?.[0];
    expect(plain?.messages[0]?.content).toBe(
      `${PHONE_BRAIN_SYSTEM}\n${capabilitiesBrief("short")}`,
    );
  });

  it("will not run the f16 3B on a device that reports no f16", async () => {
    stubGpu(false);
    fake.cached.add(big!.id);
    await expect(askPhoneBrain("ping")).resolves.toBeNull();
    expect(fake.createCalls).not.toContain(big!.id);
  });

  it("download builds the engine (that is what pulls the weights) and unloads it", async () => {
    stubGpu(true);
    await downloadPhoneBrain(small!.id);
    expect(fake.createCalls).toContain(small!.id);
    expect(fake.engine.unload).toHaveBeenCalled();
  });

  it("delete removes the model from the cache", async () => {
    stubGpu(true);
    fake.cached.add(small!.id);
    await deletePhoneBrain(small!.id);
    expect(fake.cached.has(small!.id)).toBe(false);
  });
});
