/**
 * VOICE CALIBRATION — client half.
 *
 * The operator enrolls his voice once (a few short readings, embedded
 * by the local speech service on this machine; the raw audio is
 * discarded there) and flips calibration on. From then on, every
 * voice command is checked against that voiceprint at the ear's gate
 * (see localEar.ts) before it may run. Typed commands are never
 * gated — typing already sits behind his sign-in.
 *
 * This module holds the operator's preferences (on/off + threshold,
 * in localStorage like the other interface preferences) and the small
 * client for the /api/voiceprint/* routes. The voiceprint itself is
 * never here — only the service's status and verdicts cross the wire.
 */

import type { VoiceVerdict } from "./localEar";

export interface VoiceCalibrationPrefs {
  enabled: boolean;
  threshold: number;
}

export const VOICE_CALIBRATION_KEY = "augi.avatar.voice-calibration.v1";
export const DEFAULT_VOICE_THRESHOLD = 0.5;
export const VOICE_THRESHOLD_MIN = 0.3;
export const VOICE_THRESHOLD_MAX = 0.8;

export function defaultVoiceCalibrationPrefs(): VoiceCalibrationPrefs {
  return { enabled: false, threshold: DEFAULT_VOICE_THRESHOLD };
}

export function clampVoiceThreshold(value: unknown): number {
  const numeric =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : DEFAULT_VOICE_THRESHOLD;
  return Math.min(VOICE_THRESHOLD_MAX, Math.max(VOICE_THRESHOLD_MIN, numeric));
}

export function loadVoiceCalibrationPrefs(
  storage?: Pick<Storage, "getItem">,
): VoiceCalibrationPrefs {
  const raw = (() => {
    try {
      return (storage ?? globalThis.localStorage)?.getItem(VOICE_CALIBRATION_KEY) ?? null;
    } catch {
      return null;
    }
  })();
  if (!raw) return defaultVoiceCalibrationPrefs();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return defaultVoiceCalibrationPrefs();
    }
    const p = parsed as Record<string, unknown>;
    return {
      enabled: p["enabled"] === true,
      threshold: clampVoiceThreshold(p["threshold"]),
    };
  } catch {
    return defaultVoiceCalibrationPrefs();
  }
}

export function saveVoiceCalibrationPrefs(
  prefs: VoiceCalibrationPrefs,
  storage?: Pick<Storage, "setItem">,
): void {
  try {
    (storage ?? globalThis.localStorage)?.setItem(
      VOICE_CALIBRATION_KEY,
      JSON.stringify({
        enabled: prefs.enabled,
        threshold: clampVoiceThreshold(prefs.threshold),
      }),
    );
  } catch {
    /* a preference that cannot save must never break the stage */
  }
}

/** The readings he speaks to enroll — short, varied, in his own world. */
export const ENROLL_SENTENCES = [
  "Osiris, open the cube.",
  "I am Domenick, and this is my voice.",
  "Augie, show me the gate log.",
  "My voice is the key to this house.",
] as const;

/** Status as the speech service reports it (embedding never included). */
export interface VoiceprintStatus {
  enrolled: boolean;
  model: string;
  modelReady: boolean;
  defaultThreshold: number;
  minSamples: number;
  maxSamples: number;
  pendingSamples: number;
  samples: number | null;
}

export interface VerifyResponse {
  enrolled: boolean;
  match: boolean;
  score: number | null;
  threshold: number;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

async function readJson<T>(response: Response): Promise<T> {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    /* an unreadable body falls through to the status-based message */
  }
  if (!response.ok) {
    throw new Error(
      typeof payload["error"] === "string"
        ? payload["error"]
        : `Voiceprint service answered with HTTP ${response.status}.`,
    );
  }
  return payload as T;
}

export async function fetchVoiceprintStatus(
  fetchFn: FetchFn = fetch,
): Promise<VoiceprintStatus> {
  const payload = await readJson<Record<string, unknown>>(
    await fetchFn("/api/voiceprint/status"),
  );
  return {
    enrolled: payload["enrolled"] === true,
    model: typeof payload["model"] === "string" ? payload["model"] : "",
    modelReady: payload["model_ready"] === true,
    defaultThreshold:
      typeof payload["default_threshold"] === "number"
        ? payload["default_threshold"]
        : DEFAULT_VOICE_THRESHOLD,
    minSamples: typeof payload["min_samples"] === "number" ? payload["min_samples"] : 3,
    maxSamples: typeof payload["max_samples"] === "number" ? payload["max_samples"] : 8,
    pendingSamples:
      typeof payload["pending_samples"] === "number" ? payload["pending_samples"] : 0,
    samples: typeof payload["samples"] === "number" ? payload["samples"] : null,
  };
}

export async function enrollVoiceSample(
  audio: Blob,
  fetchFn: FetchFn = fetch,
): Promise<{ samples: number }> {
  const payload = await readJson<Record<string, unknown>>(
    await fetchFn("/api/voiceprint/enroll", {
      method: "POST",
      headers: { "Content-Type": audio.type || "audio/webm" },
      body: audio,
    }),
  );
  return { samples: typeof payload["samples"] === "number" ? payload["samples"] : 0 };
}

export async function commitVoiceEnrollment(
  fetchFn: FetchFn = fetch,
): Promise<{ samples: number }> {
  const payload = await readJson<Record<string, unknown>>(
    await fetchFn("/api/voiceprint/commit", { method: "POST" }),
  );
  return { samples: typeof payload["samples"] === "number" ? payload["samples"] : 0 };
}

export async function resetVoiceEnrollment(fetchFn: FetchFn = fetch): Promise<void> {
  await readJson(await fetchFn("/api/voiceprint/reset", { method: "POST" }));
}

export async function deleteVoiceprint(fetchFn: FetchFn = fetch): Promise<void> {
  await readJson(await fetchFn("/api/voiceprint/delete", { method: "POST" }));
}

export async function verifyVoice(
  audio: Blob,
  threshold: number,
  fetchFn: FetchFn = fetch,
): Promise<VerifyResponse> {
  const payload = await readJson<Record<string, unknown>>(
    await fetchFn("/api/voiceprint/verify", {
      method: "POST",
      headers: {
        "Content-Type": audio.type || "audio/webm",
        "X-Threshold": String(threshold),
      },
      body: audio,
    }),
  );
  return {
    enrolled: payload["enrolled"] === true,
    match: payload["match"] === true,
    score: typeof payload["score"] === "number" ? payload["score"] : null,
    threshold:
      typeof payload["threshold"] === "number" ? payload["threshold"] : threshold,
  };
}

/**
 * The verifier the stage installs in the ear while calibration is on.
 * A "not enrolled" answer from the service is a failed check, not a
 * pass — the gate fails closed, always.
 */
export function createVoiceGateVerifier(
  getThreshold: () => number,
  fetchFn: FetchFn = fetch,
): (audio: Blob) => Promise<VoiceVerdict> {
  return async (audio: Blob) => {
    const verdict = await verifyVoice(audio, getThreshold(), fetchFn);
    if (!verdict.enrolled) {
      throw new Error("No voiceprint is enrolled on this machine.");
    }
    return { match: verdict.match, score: verdict.score };
  };
}
