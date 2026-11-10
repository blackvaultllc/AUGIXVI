/**
 * BRAIN ORDER — cloud first, offline always (owner order 2026-11-10).
 * Order: Groq → Gemini → OpenRouter → Ollama → simulatedAI.
 * Keys live SERVER-ONLY (process.env) — never shipped in client code.
 * When the internet drops or Cloudflare is down, Ollama on the operator's
 * PC keeps Osiris working from the knowledge stored on this device.
 */

export type BrainName = "groq" | "gemini" | "openrouter" | "ollama" | "simulated";

export type BrainAttempt = {
  brain: BrainName;
  ok: boolean;
  status?: number;
};

/** The strict order, evaluated top to bottom. */
export const BRAIN_ORDER: readonly Exclude<BrainName, "simulated">[] = [
  "groq",
  "gemini",
  "openrouter",
  "ollama",
];

export function cloudEndpoint(brain: Exclude<BrainName, "simulated">): string | null {
  switch (brain) {
    case "groq":
      return process.env["GROQ_API_BASE_URL"] ?? "https://api.groq.com/openai/v1";
    case "gemini":
      return (
        process.env["GEMINI_API_BASE_URL"] ?? "https://generativelanguage.googleapis.com/v1beta"
      );
    case "openrouter":
      return process.env["OPENROUTER_API_BASE_URL"] ?? "https://openrouter.ai/api/v1";
    case "ollama":
      return process.env["OLLAMA_API_BASE_URL"] ?? null; // operator PC, no public default
  }
}

export function cloudApiKey(brain: Exclude<BrainName, "simulated">): string | null {
  switch (brain) {
    case "groq":
      return process.env["GROQ_API_KEY"] ?? null;
    case "gemini":
      return process.env["GEMINI_API_KEY"] ?? null;
    case "openrouter":
      return process.env["OPENROUTER_API_KEY"] ?? null;
    case "ollama":
      return null; // local, keyless
  }
}

/** Chat-completions shape shared by Groq/OpenRouter; Gemini translated below. */
export function buildRequestBody(
  brain: Exclude<BrainName, "simulated">,
  model: string,
  messages: Array<{ role: string; content: string }>,
): { url: string; headers: Record<string, string>; body: string } | null {
  const endpoint = cloudEndpoint(brain);
  if (!endpoint) return null;
  const key = cloudApiKey(brain);
  if (brain !== "ollama" && !key) return null;
  if (brain === "gemini") {
    return {
      url: `${endpoint}/models/${encodeURIComponent(model)}:generateContent`,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key ?? "" },
      body: JSON.stringify({
        contents: messages
          .filter((message) => message.role !== "system")
          .map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
        systemInstruction: {
          parts: [{ text: messages.find((message) => message.role === "system")?.content ?? "" }],
        },
      }),
    };
  }
  return {
    url: brain === "ollama" ? `${endpoint}/api/chat` : `${endpoint}/chat/completions`,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({ model, messages, stream: false }),
  };
}

/** Which brain answered, in order — for the HUD source label. */
export function describeBrainOrder(): string {
  return `${BRAIN_ORDER.join(" → ")} → simulatedAI`;
}
