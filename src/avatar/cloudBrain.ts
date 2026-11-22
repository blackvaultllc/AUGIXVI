/**
 * CLOUD BRAIN CLIENT — calls the server pipe, shows which provider answered.
 * Failover happens server-side (Groq → Gemini → OpenRouter → Ollama →
 * simulatedAI); this surface reports the truth plainly: ONLINE/OFFLINE +
 * source. Never invents — if all providers die, says so.
 *
 * THE ON-PHONE LEG (owner order 2026-11-22): when the pipe falls
 * through every real brain to simulated — or cannot be reached at
 * all — the chain tries the brain inside this device (phoneBrain.ts)
 * before surrendering. That is its exact place in the order: below
 * Ollama, above simulated. When it answers, the provider is named
 * "On-phone brain (small)", like every other provider is named.
 */
import { askCloudBrain, getCloudKeyStatus } from "./cloud/brainPipe.server";
import { PHONE_BRAIN_PROVIDER, askPhoneBrain } from "./phoneBrain";

export type CloudKeyLight = {
  provider: string;
  secretName: string;
  light: "green" | "red";
  detail: string;
};

export async function fetchCloudKeyLights(): Promise<CloudKeyLight[]> {
  try {
    const { lights } = await getCloudKeyStatus();
    return lights;
  } catch {
    return [];
  }
}

export type CloudAnswer = {
  answer: string | null;
  provider: string;
  notice: string | null;
};

export async function askCloud(
  message: string,
  history: { role: string; content: string }[] = [],
): Promise<CloudAnswer> {
  try {
    const result = await askCloudBrain({ data: { message, history } });
    if (result.offlineNotice) {
      // Every real brain in the pipe died and it fell to simulated —
      // the on-phone brain gets its turn before we accept that.
      const phone = await askPhoneBrain(message, history);
      if (phone) return { answer: phone, provider: PHONE_BRAIN_PROVIDER, notice: null };
      return { answer: null, provider: result.provider, notice: result.offlineNotice };
    }
    return { answer: result.answer, provider: result.provider, notice: null };
  } catch {
    // The pipe itself is unreachable (the fully-offline case) — the
    // on-phone brain is exactly the leg built for this moment.
    const phone = await askPhoneBrain(message, history);
    if (phone) return { answer: phone, provider: PHONE_BRAIN_PROVIDER, notice: null };
    return { answer: null, provider: "simulatedAI", notice: "Cloud brain is unreachable." };
  }
}
