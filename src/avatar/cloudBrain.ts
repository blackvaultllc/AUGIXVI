/**
 * CLOUD BRAIN CLIENT — calls the server pipe, shows which provider answered.
 * Failover happens server-side (Groq → Gemini → OpenRouter → Ollama →
 * simulatedAI); this surface reports the truth plainly: ONLINE/OFFLINE +
 * source. Never invents — if all providers die, says so.
 */
import { askCloudBrain, getCloudKeyStatus } from "./cloud/brainPipe.server";

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
      return { answer: null, provider: result.provider, notice: result.offlineNotice };
    }
    return { answer: result.answer, provider: result.provider, notice: null };
  } catch {
    return { answer: null, provider: "simulatedAI", notice: "Cloud brain is unreachable." };
  }
}
