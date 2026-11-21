/**
 * Server half of /api/voiceprint/* — voice calibration's doorway.
 *
 * The browser never talks to the local speech service directly: these
 * forwarders hand enrollment clips, verification clips and status
 * reads to the same augie-stt service that transcribes (127.0.0.1:8765,
 * see transcribe.server.ts) and pass its answers back. The voiceprint
 * itself — an embedding — never leaves that service; these routes only
 * ever carry audio in and verdicts/status out.
 *
 * Failures keep the house style: 400 no audio · 413 too large ·
 * 503 the speech service is not running · otherwise the service's own
 * status and plain-words error pass through untouched.
 */

import { STT_SERVICE_URL_DEFAULT } from "./transcribe.server";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const VOICEPRINT_TIMEOUT_MS = 60_000;

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

function defaultEnv(): Record<string, string | undefined> {
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process;
  return proc?.env ?? {};
}

/** Base URL of the local STT service (no path); AUGIE_STT_URL overrides. */
export function sttBaseUrl(
  env: Record<string, string | undefined> = defaultEnv(),
): string {
  const raw = env["AUGIE_STT_URL"]?.trim() || STT_SERVICE_URL_DEFAULT;
  return raw.replace(/\/transcribe\/?$/, "").replace(/\/$/, "");
}

function serviceDown(): Response {
  return Response.json(
    {
      error:
        "Local speech service is not running. Start the augie-stt service on this machine, then try again.",
    },
    { status: 503 },
  );
}

async function passThrough(
  sttResponse: Response,
): Promise<Response> {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await sttResponse.json()) as Record<string, unknown>;
  } catch {
    /* an unreadable body falls through to the status-based message */
  }
  if (!sttResponse.ok) {
    return Response.json(
      {
        error:
          typeof payload["error"] === "string"
            ? payload["error"]
            : "The local speech service returned an error.",
      },
      { status: sttResponse.status },
    );
  }
  return Response.json(payload);
}

async function callService(
  path: string,
  init: RequestInit,
  fetchFn: FetchFn,
): Promise<Response> {
  let sttResponse: Response;
  try {
    sttResponse = await fetchFn(`${sttBaseUrl()}${path}`, {
      ...init,
      signal: AbortSignal.timeout(VOICEPRINT_TIMEOUT_MS),
    });
  } catch {
    return serviceDown();
  }
  return passThrough(sttResponse);
}

/** GET /voiceprint/status on the service: enrolled or not — never the embedding. */
export async function forwardVoiceprintStatus(
  fetchFn: FetchFn = fetch,
): Promise<Response> {
  return callService("/voiceprint/status", { method: "GET" }, fetchFn);
}

async function forwardAudio(
  request: Request,
  path: string,
  fetchFn: FetchFn,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0) {
    return Response.json({ error: "No audio was received." }, { status: 400 });
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    return Response.json(
      { error: "That recording is too large to process." },
      { status: 413 },
    );
  }
  return callService(
    path,
    {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "audio/webm",
        ...extraHeaders,
      },
      body: audio,
    },
    fetchFn,
  );
}

/** POST one enrollment clip; the service embeds it and discards the audio. */
export async function forwardEnrollSample(
  request: Request,
  fetchFn: FetchFn = fetch,
): Promise<Response> {
  return forwardAudio(request, "/enroll", fetchFn);
}

/** POST one clip to be checked against the stored voiceprint. */
export async function forwardVerify(
  request: Request,
  fetchFn: FetchFn = fetch,
): Promise<Response> {
  const threshold = request.headers.get("x-threshold");
  return forwardAudio(
    request,
    "/verify",
    fetchFn,
    threshold ? { "X-Threshold": threshold } : {},
  );
}

/** POST an enrollment bookkeeping action: commit, reset, or delete. */
export async function forwardEnrollAction(
  action: "commit" | "reset" | "delete",
  fetchFn: FetchFn = fetch,
): Promise<Response> {
  const path =
    action === "delete"
      ? "/voiceprint/delete"
      : action === "commit"
        ? "/enroll/commit"
        : "/enroll/reset";
  return callService(path, { method: "POST" }, fetchFn);
}
