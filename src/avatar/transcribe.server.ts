/**
 * Server half of /api/transcribe.
 *
 * The browser records the operator's voice and POSTs the clip to the
 * app's own origin. This forwarder hands the bytes to Augie's local
 * speech-to-text service — faster-whisper running on this same machine
 * (systemd unit augie-stt.service, 127.0.0.1:8765) — and returns the
 * words as JSON. The browser never talks to the STT service directly,
 * and nothing leaves the machine: the ear works with the internet down.
 *
 * Every failure is an honest, plain-words error with a distinct status:
 * 400 no audio · 413 too large · 503 the STT service is not running ·
 * 502 the STT service answered with an error.
 */

export const STT_SERVICE_URL_DEFAULT = "http://127.0.0.1:8765/transcribe";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const STT_TIMEOUT_MS = 120_000;

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

function defaultEnv(): Record<string, string | undefined> {
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process;
  return proc?.env ?? {};
}

/** Where the local STT service listens; AUGIE_STT_URL overrides for dev. */
export function sttServiceUrl(
  env: Record<string, string | undefined> = defaultEnv(),
): string {
  return env["AUGIE_STT_URL"]?.trim() || STT_SERVICE_URL_DEFAULT;
}

export async function forwardTranscription(
  request: Request,
  fetchFn: FetchFn = fetch,
): Promise<Response> {
  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0) {
    return Response.json({ error: "No audio was received." }, { status: 400 });
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    return Response.json(
      { error: "That recording is too large to transcribe." },
      { status: 413 },
    );
  }

  let sttResponse: Response;
  try {
    sttResponse = await fetchFn(sttServiceUrl(), {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "audio/webm",
      },
      body: audio,
      signal: AbortSignal.timeout(STT_TIMEOUT_MS),
    });
  } catch {
    return Response.json(
      {
        error:
          "Local speech service is not running. Start the augie-stt service on this machine, then click the mic again.",
      },
      { status: 503 },
    );
  }

  let payload: { text?: string; error?: string } = {};
  try {
    payload = (await sttResponse.json()) as { text?: string; error?: string };
  } catch {
    /* an unreadable body falls through to the status-based message */
  }
  if (!sttResponse.ok) {
    return Response.json(
      { error: payload.error || "The local speech service returned an error." },
      { status: 502 },
    );
  }
  return Response.json({ text: (payload.text ?? "").trim() });
}
