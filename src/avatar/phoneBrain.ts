/**
 * ON-PHONE BRAIN — the last real failover leg (owner order 2026-11-22).
 *
 * The emergency requirement, in the operator's words: "if I am in a
 * dilemma and trapped I can turn on my phone, turn on my AI, plug the
 * device in, it wakes up, it has a brain, and now it's doing what it
 * does." This module is that brain: a small Llama 3.2 that runs IN the
 * browser on the device itself (WebLLM over WebGPU), downloaded once
 * while there is internet, cached by the browser, and then fully
 * offline — no core, no cloud, no network at all.
 *
 * WHERE IT SITS: the failover chain is Groq → Gemini → OpenRouter →
 * Ollama (the Parrot) → ON-PHONE BRAIN → simulatedAI. It is wired in
 * at exactly that spot: cloudBrain.ts tries it when the server pipe
 * falls through to simulated, and ollamaAI.ts tries it in the latched
 * offline state. It never outranks a real brain.
 *
 * PARITY RULE (owner order 2026-11-22): the phone carries ALL of
 * Augie's capabilities — same rooms, library, memory, device line.
 * The ONLY difference is the size of this brain, and that difference
 * is never hidden: when this leg answers, the provider is named
 * "On-phone brain (small)" in the response path, exactly like every
 * other provider is named. Its answers are never dressed up as the
 * Parrot brain's.
 *
 * HONEST STATUS: "downloaded" is earned from WebLLM's own cache check
 * (hasModelInCache), never from a flag we set ourselves. The download
 * itself is an explicit operator action in Settings — nothing here
 * ever downloads silently.
 *
 * Everything WebLLM is behind a dynamic import inside functions, so
 * this module is safe to import anywhere (SSR, tests) and the engine
 * code only loads when the leg is actually used.
 */

export const PHONE_BRAIN_PROVIDER = "On-phone brain (small)";

export type PhoneBrainModel = {
  /** WebLLM prebuilt model id. */
  id: string;
  /** Plain label for Settings. */
  label: string;
  /** Measured download size of the model repo (MB, Hugging Face tree). */
  sizeMB: number;
  /** GPU memory WebLLM's model library budgets for it (MB). */
  vramMB: number;
  /** True when the build needs the WebGPU shader-f16 feature. */
  needsF16: boolean;
  /** One plain sentence on when this is the right pick. */
  blurb: string;
};

/**
 * The catalog, in preference order — the 3B answers first when both
 * are on the device.
 *
 * THE PICK, justified: Llama-3.2-3B-Instruct q4f16 is the largest
 * small model in WebLLM's library that fits a phone-class GPU budget
 * (2,264 MB of the ~4–6 GB a current Android flagship exposes, and
 * the same Llama family as the Parrot's everyday brain), at a 1.8 GB
 * one-time download. The 1B q4f32 is the compatibility floor: it
 * needs no shader-f16, budgets 1,129 MB, downloads 705 MB, and runs
 * on anything that has WebGPU at all — older and cheaper Androids
 * included. Quality steps down with size; that is the disclosed
 * trade, never a hidden one.
 */
export const PHONE_BRAIN_MODELS: readonly PhoneBrainModel[] = [
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 — 3B (the bigger small brain)",
    sizeMB: 1817,
    vramMB: 2264,
    needsF16: true,
    blurb: "The strongest brain that still fits a phone. Pick this unless your phone is older.",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
    label: "Llama 3.2 — 1B (runs on more phones)",
    sizeMB: 705,
    vramMB: 1129,
    needsF16: false,
    blurb: "Smaller and quicker, and it runs on phones without the newer GPU features.",
  },
];

export type PhoneBrainSupport = {
  /** A WebGPU adapter answered on this device. */
  webgpu: boolean;
  /** The adapter exposes shader-f16 (needed by the 3B build). */
  f16: boolean;
};

export type PhoneBrainStatus = "ready" | "not-downloaded" | "unsupported";

/** The status, derived from evidence — never asserted. */
export function derivePhoneBrainStatus(input: {
  webgpu: boolean;
  anyCached: boolean;
}): PhoneBrainStatus {
  if (!input.webgpu) return "unsupported";
  return input.anyCached ? "ready" : "not-downloaded";
}

export function phoneBrainStatusLabel(status: PhoneBrainStatus): string {
  switch (status) {
    case "ready":
      return "ON-PHONE BRAIN READY";
    case "not-downloaded":
      return "NOT DOWNLOADED";
    case "unsupported":
      return "NO WEBGPU ON THIS DEVICE";
  }
}

/** Which downloaded model answers — catalog preference order wins. */
export function pickCachedModel(cachedIds: readonly string[]): PhoneBrainModel | null {
  for (const model of PHONE_BRAIN_MODELS) {
    if (cachedIds.includes(model.id)) return model;
  }
  return null;
}

/** The model Settings should steer this device to, from its GPU facts. */
export function recommendedModel(support: PhoneBrainSupport): PhoneBrainModel {
  if (support.f16) return PHONE_BRAIN_MODELS[0]!;
  return PHONE_BRAIN_MODELS[1]!;
}

/**
 * The compact system prompt for the small brain. The full stage prompt
 * (command knowledge, tools, operator memory) is far beyond a 4k
 * context window shared with the conversation; this carries the
 * identity, the authority line, and the honesty rules — the parts
 * that must survive at any brain size.
 */
export const PHONE_BRAIN_SYSTEM =
  "You are Augie, also called Osiris — the operator's own AI, running on this phone itself " +
  "because the main brain is out of reach. You answer to the verified operator, who is in " +
  "charge. Speak briefly and plainly, with quiet confidence. Never claim to be human. Never " +
  "invent facts; when you are unsure, say so plainly. You are a smaller brain than the one " +
  "on the operator's computer — if a question needs deep knowledge, say what you know and " +
  "name the limit. Never use lists, markdown, or emoji.";

/* ------------------------------------------------------------------ */
/* Browser runtime — everything below touches WebGPU/WebLLM and only  */
/* runs client-side, behind dynamic imports.                          */
/* ------------------------------------------------------------------ */

/**
 * The compile-time view of WebLLM is the narrowed shim in
 * src/types/web-llm.d.ts (tsconfig paths) — the package's own type
 * graph drags @webgpu/types globals into the whole program and
 * breaks unrelated canvas typing elsewhere in the app. The runtime
 * object is the real package.
 */
type WebLLMModule = typeof import("@mlc-ai/web-llm");
type PhoneEngine = Awaited<ReturnType<WebLLMModule["CreateMLCEngine"]>>;

let webllmPromise: Promise<WebLLMModule> | null = null;
function loadWebLLM(): Promise<WebLLMModule> {
  webllmPromise ??= import("@mlc-ai/web-llm");
  return webllmPromise;
}

let enginePromise: Promise<PhoneEngine> | null = null;
let engineModelId: string | null = null;

async function ensureEngine(
  modelId: string,
  onProgress?: (text: string, progress: number) => void,
): Promise<PhoneEngine> {
  if (enginePromise && engineModelId === modelId) return enginePromise;
  if (enginePromise) {
    // Switching models: release the old engine's GPU memory first.
    const old = await enginePromise.catch(() => null);
    enginePromise = null;
    engineModelId = null;
    await old?.unload().catch(() => undefined);
  }
  engineModelId = modelId;
  enginePromise = (async () => {
    const webllm = await loadWebLLM();
    const engineConfig = {
      initProgressCallback: (report: { text: string; progress: number }) =>
        onProgress?.(report.text, report.progress),
    };
    // Worker first — generation must never freeze the stage. If this
    // browser cannot spawn module workers, the main-thread engine is
    // the honest fallback (slower UI, same brain).
    try {
      if (typeof Worker === "undefined") throw new Error("no Worker in this browser");
      const worker = new Worker(new URL("./phoneBrainWorker.ts", import.meta.url), {
        type: "module",
      });
      return await webllm.CreateWebWorkerMLCEngine(worker, modelId, engineConfig);
    } catch {
      return await webllm.CreateMLCEngine(modelId, engineConfig);
    }
  })();
  // A failed init must not poison the singleton — the next ask retries.
  enginePromise.catch(() => {
    if (engineModelId === modelId) {
      enginePromise = null;
      engineModelId = null;
    }
  });
  return enginePromise;
}

/** The slice of WebGPU this module asks about — structural, on purpose. */
type GpuLike = {
  requestAdapter: () => Promise<{
    features: { has: (feature: string) => boolean };
  } | null>;
};

/** WebGPU facts of THIS device, asked fresh — no caching of a guess. */
export async function phoneBrainSupport(): Promise<PhoneBrainSupport> {
  try {
    const gpu = (navigator as { gpu?: GpuLike }).gpu;
    if (!gpu) return { webgpu: false, f16: false };
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { webgpu: false, f16: false };
    return { webgpu: true, f16: adapter.features.has("shader-f16") };
  } catch {
    return { webgpu: false, f16: false };
  }
}

/** Earned from WebLLM's cache — true only when every file is present. */
export async function phoneBrainDownloaded(modelId: string): Promise<boolean> {
  try {
    const webllm = await loadWebLLM();
    return await webllm.hasModelInCache(modelId);
  } catch {
    return false;
  }
}

/** The HUD status for this device, from live evidence. */
export async function getPhoneBrainStatus(): Promise<PhoneBrainStatus> {
  const support = await phoneBrainSupport();
  if (!support.webgpu) return "unsupported";
  const cached: string[] = [];
  for (const model of PHONE_BRAIN_MODELS) {
    if (await phoneBrainDownloaded(model.id)) cached.push(model.id);
  }
  return derivePhoneBrainStatus({ webgpu: true, anyCached: cached.length > 0 });
}

/**
 * THE download — only ever called from the operator's explicit tap in
 * Settings. Building the engine is what pulls the weights; afterwards
 * the engine unloads so the GPU is free, and the cache remains.
 */
export async function downloadPhoneBrain(
  modelId: string,
  onProgress?: (text: string, progress: number) => void,
): Promise<void> {
  const engine = await ensureEngine(modelId, onProgress);
  await engine.unload().catch(() => undefined);
  if (engineModelId === modelId) {
    enginePromise = null;
    engineModelId = null;
  }
}

/** Remove a downloaded model from this device entirely. */
export async function deletePhoneBrain(modelId: string): Promise<void> {
  if (engineModelId === modelId && enginePromise) {
    const engine = await enginePromise.catch(() => null);
    enginePromise = null;
    engineModelId = null;
    await engine?.unload().catch(() => undefined);
  }
  const webllm = await loadWebLLM();
  await webllm.deleteModelAllInfoInCache(modelId);
}

const ASK_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Ask the on-phone brain. Returns the generated answer, or null when
 * this leg cannot honestly answer (no WebGPU, nothing downloaded, the
 * engine failed, or it took too long) — null is what lets the chain
 * fall through to simulatedAI instead of faking a reply.
 */
export async function askPhoneBrain(
  text: string,
  history: { role: string; content: string }[] = [],
): Promise<string | null> {
  try {
    const support = await phoneBrainSupport();
    if (!support.webgpu) return null;
    const cached: string[] = [];
    for (const model of PHONE_BRAIN_MODELS) {
      if (await phoneBrainDownloaded(model.id)) cached.push(model.id);
    }
    const model = pickCachedModel(cached);
    if (!model) return null;
    if (model.needsF16 && !support.f16) return null;
    const answer = await withTimeout(
      (async () => {
        const engine = await ensureEngine(model.id);
        const completion = await engine.chat.completions.create({
          messages: [
            { role: "system", content: PHONE_BRAIN_SYSTEM },
            ...history.slice(-4).map((h) => ({
              role: h.role === "assistant" ? "assistant" : "user",
              content: h.content,
            })),
            { role: "user", content: text },
          ],
          temperature: 0.7,
          max_tokens: 400,
        });
        const raw = completion.choices?.[0]?.message?.content ?? "";
        // qwen-style thinking tags never belong in a spoken reply.
        return raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      })(),
      ASK_TIMEOUT_MS,
    );
    return answer ? answer : null;
  } catch {
    return null;
  }
}
