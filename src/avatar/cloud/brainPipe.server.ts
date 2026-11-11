/**
 * SERVER-ONLY BRAIN PIPE + CLOUD KEY STATUS (owner order).
 * Keys NEVER leave the server: providers are called here, keyed from the
 * Worker env secrets. Failover order: Groq → Gemini → OpenRouter → Ollama →
 * simulatedAI. If one dies, the next answers. Status names only — no values.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

type RequestWithCloudflareEnv = Request & {
  runtime?: { cloudflare?: { env?: Record<string, unknown> } };
};

/** Secret NAMES (not values). The owner sets values in the Cloudflare dashboard. */
export const PROVIDER_SECRETS = [
  {
    provider: "Groq",
    secret: "GROQ_API_KEY",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.1-8b-instant",
  },
  {
    provider: "Gemini",
    secret: "GEMINI_API_KEY",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    defaultModel: "gemini-2.0-flash",
  },
  {
    provider: "OpenRouter",
    secret: "OPENROUTER_API_KEY",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "meta-llama/llama-3.1-8b-instruct",
  },
  {
    provider: "Ollama",
    secret: "OLLAMA_URL",
    endpoint: "http://localhost:11434/api/chat",
    defaultModel: "llama3.1:8b",
  },
] as const;

export const SIMULATED_PROVIDER = "simulatedAI";

export type ProviderStatus = {
  provider: string;
  secretName: string;
  /** green: key present and probe answered; red: missing or failed. */
  light: "green" | "red";
  /** Plain-words reason — never a key value. */
  detail: string;
};

function readEnv(name: string): string | undefined {
  const request = getRequest() as RequestWithCloudflareEnv;
  const runtimeEnv = request.runtime?.cloudflare?.env ?? {};
  const value = runtimeEnv[name] ?? process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getOperatorAccessToken(): string | null {
  const header = getRequest().headers.get("authorization");
  return header?.replace(/^Bearer\s+/i, "").trim() || null;
}

/** Probe one provider with a trivial completion. Returns ok/error — no values. */
async function probe(
  entry: (typeof PROVIDER_SECRETS)[number],
): Promise<{ ok: boolean; detail: string }> {
  const key = readEnv(entry.secret);
  if (!key) return { ok: false, detail: `${entry.secret} is not set in the Worker secrets` };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    let url: string;
    let init: RequestInit;
    if (entry.provider === "Gemini") {
      // Key injected server-side via header, never echoed.
      url = `${entry.endpoint}/${entry.defaultModel}:generateContent`;
      init = {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        signal: controller.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
      };
    } else if (entry.provider === "Ollama") {
      url = entry.endpoint;
      init = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: entry.defaultModel,
          stream: false,
          messages: [{ role: "user", content: "ping" }],
        }),
      };
    } else {
      url = entry.endpoint;
      init = {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        signal: controller.signal,
        body: JSON.stringify({
          model: entry.defaultModel,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 4,
        }),
      };
    }
    const res = await fetch(url, init);
    clearTimeout(timer);
    if (res.status === 429)
      return { ok: false, detail: `${entry.provider} is rate-limited right now` };
    if (!res.ok) return { ok: false, detail: `${entry.provider} answered ${res.status}` };
    return { ok: true, detail: `${entry.provider} answered` };
  } catch {
    clearTimeout(timer);
    return { ok: false, detail: `${entry.provider} is unreachable` };
  }
}

/** Key status lights — names and lights only, never values. */
export const getCloudKeyStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ lights: ProviderStatus[] }> => {
    const lights: ProviderStatus[] = [];
    for (const entry of PROVIDER_SECRETS) {
      const result = await probe(entry);
      lights.push({
        provider: entry.provider,
        secretName: entry.secret,
        light: result.ok ? "green" : "red",
        detail: result.detail,
      });
    }
    lights.push({
      provider: SIMULATED_PROVIDER,
      secretName: "(built in)",
      light: "green",
      detail: "Always available — the simulated fallback",
    });
    return { lights };
  },
);

export type BrainAskInput = { message: string; history?: { role: string; content: string }[] };

export type BrainAnswer = {
  answer: string;
  provider: string;
  offlineNotice: string | null;
};

/**
 * THE FAILOVER PIPE: try each cloud provider in order; first green light
 * answers. If all fail, return the offline notice so the client falls back
 * to Ollama-local, then simulatedAI.
 */
export const askCloudBrain = createServerFn({ method: "POST" })
  .validator((input: unknown): BrainAskInput => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as BrainAskInput).message !== "string"
    ) {
      throw new Error("Invalid brain request");
    }
    const input_ = input as BrainAskInput;
    return {
      message: input_.message.slice(0, 4000),
      history: Array.isArray(input_.history) ? input_.history.slice(-8) : [],
    };
  })
  .handler(async ({ data }): Promise<BrainAnswer> => {
    const deaths: string[] = [];
    for (const entry of PROVIDER_SECRETS) {
      const key = readEnv(entry.secret);
      if (!key) {
        deaths.push(`${entry.provider}: ${entry.secret} not set`);
        continue;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      try {
        let answer: string | null = null;
        if (entry.provider === "Gemini") {
          const res = await fetch(`${entry.endpoint}/${entry.defaultModel}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [
                ...(data.history ?? []).map((h) => ({
                  role: h.role === "assistant" ? "model" : "user",
                  parts: [{ text: h.content }],
                })),
                { role: "user", parts: [{ text: data.message }] },
              ],
            }),
          });
          if (res.status === 429) throw new Error("rate-limited");
          if (!res.ok) throw new Error(`status ${res.status}`);
          const payload = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          answer = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
        } else if (entry.provider === "Ollama") {
          const res = await fetch(entry.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              model: entry.defaultModel,
              stream: false,
              messages: [...(data.history ?? []), { role: "user", content: data.message }],
            }),
          });
          if (!res.ok) throw new Error(`status ${res.status}`);
          const payload = (await res.json()) as { message?: { content?: string } };
          answer = payload.message?.content?.trim() ?? null;
        } else {
          const res = await fetch(entry.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            signal: controller.signal,
            body: JSON.stringify({
              model: entry.defaultModel,
              messages: [...(data.history ?? []), { role: "user", content: data.message }],
              max_tokens: 400,
            }),
          });
          if (res.status === 429) throw new Error("rate-limited");
          if (!res.ok) throw new Error(`status ${res.status}`);
          const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          answer = payload.choices?.[0]?.message?.content?.trim() ?? null;
        }
        clearTimeout(timer);
        if (answer) return { answer, provider: entry.provider, offlineNotice: null };
        deaths.push(`${entry.provider}: empty answer`);
      } catch (error) {
        clearTimeout(timer);
        deaths.push(`${entry.provider}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }
    return {
      answer: "",
      provider: SIMULATED_PROVIDER,
      offlineNotice: `All cloud brains are down. ${deaths.join("; ")}`,
    };
  });

/* ---------------------------- ELEVENLABS TTS ----------------------------- */

export type TtsInput = { text: string };
export type TtsResult = { audio: string | null; provider: string; error: string | null };

const ttsBuckets = new Map<string, number[]>();

/** Token-bucket rate limit: operator key hashes, 20 requests / minute. */
function rateLimited(clientHash: string): boolean {
  const now = Date.now();
  const window_ = now - 60_000;
  const hits = (ttsBuckets.get(clientHash) ?? []).filter((t) => t > window_);
  if (hits.length >= 20) return true;
  hits.push(now);
  ttsBuckets.set(clientHash, hits);
  return false;
}

/** Deep-voice server TTS. Voice ID + key live in Worker secrets only. */
export const speakServer = createServerFn({ method: "POST" })
  .validator((input: unknown): TtsInput => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as TtsInput).text !== "string"
    ) {
      throw new Error("Invalid tts request");
    }
    return { text: (input as TtsInput).text.slice(0, 1000) };
  })
  .handler(async ({ data }): Promise<TtsResult> => {
    // AUTH: only requests carrying the operator bearer token may spend the key.
    const token = getOperatorAccessToken();
    if (!token)
      return {
        audio: null,
        provider: "ElevenLabs",
        error: "Operator authentication required for server voice",
      };
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const clientHash = Array.from(new Uint8Array(hash)).slice(0, 12).join(",");
    if (rateLimited(clientHash)) {
      return {
        audio: null,
        provider: "ElevenLabs",
        error: "Voice rate limit reached — try again in a minute",
      };
    }
    const key = readEnv("ELEVENLABS_API_KEY");
    const voiceId = readEnv("ELEVENLABS_VOICE_ID");
    if (!key || !voiceId) {
      return {
        audio: null,
        provider: "ElevenLabs",
        error: "ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID not set in Worker secrets",
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.4, similarity_boost: 0.8 },
        }),
      });
      clearTimeout(timer);
      if (!res.ok) {
        return { audio: null, provider: "ElevenLabs", error: `ElevenLabs answered ${res.status}` };
      }
      const buffer = await res.arrayBuffer();
      const binary = String.fromCharCode(...new Uint8Array(buffer));
      return { audio: btoa(binary), provider: "ElevenLabs", error: null };
    } catch {
      clearTimeout(timer);
      return { audio: null, provider: "ElevenLabs", error: "ElevenLabs is unreachable" };
    }
  });
