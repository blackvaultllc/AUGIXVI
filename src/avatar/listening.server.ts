/**
 * Server half of /api/listening/* and /api/speakers/others — Listening
 * Mode's doorway (Parts 12 + 13).
 *
 * The browser never talks to the local speech service directly: these
 * forwarders hand arm/disarm/chunk/status/recap calls to the same
 * augie-stt service that transcribes (127.0.0.1:8765, see
 * voiceprint.server.ts) and pass its answers back. Sessions and the
 * other-voices store live on that machine only; these routes carry
 * audio chunks in and recorded lines out — nothing is stored here.
 *
 * Failures keep the house style: 400 no audio · 413 too large ·
 * 503 the speech service is not running · otherwise the service's own
 * status and plain-words error pass through untouched (a 409 from the
 * service — chunk while disarmed, arm while armed — stays a 409).
 */

import { sttBaseUrl } from "./voiceprint.server";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const LISTENING_TIMEOUT_MS = 120_000;

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

function serviceDown(): Response {
  return Response.json(
    {
      error:
        "Local speech service is not running. Start the augie-stt service on this machine, then try again.",
    },
    { status: 503 },
  );
}

async function passThrough(sttResponse: Response): Promise<Response> {
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

async function callService(path: string, init: RequestInit, fetchFn: FetchFn): Promise<Response> {
  let sttResponse: Response;
  try {
    sttResponse = await fetchFn(`${sttBaseUrl()}${path}`, {
      ...init,
      signal: AbortSignal.timeout(LISTENING_TIMEOUT_MS),
    });
  } catch {
    return serviceDown();
  }
  return passThrough(sttResponse);
}

/** GET /listening/status — armed or not, line count, wake heard. */
export async function forwardListeningStatus(fetchFn: FetchFn = fetch): Promise<Response> {
  return callService("/listening/status", { method: "GET" }, fetchFn);
}

/** POST /listening/arm — start a session on the service. */
export async function forwardListeningArm(fetchFn: FetchFn = fetch): Promise<Response> {
  return callService("/listening/arm", { method: "POST" }, fetchFn);
}

/** POST /listening/disarm — stop the session; returns its final count. */
export async function forwardListeningDisarm(fetchFn: FetchFn = fetch): Promise<Response> {
  return callService("/listening/disarm", { method: "POST" }, fetchFn);
}

/**
 * GET /listening/recap — ONLY the lines actually recorded for a
 * session (the given one, or the current/most recent when omitted).
 * An empty session comes back as the service's explicit refusal.
 */
export async function forwardListeningRecap(
  request: Request,
  fetchFn: FetchFn = fetch,
): Promise<Response> {
  const session = new URL(request.url).searchParams.get("session");
  const path = session
    ? `/listening/recap?session=${encodeURIComponent(session)}`
    : "/listening/recap";
  return callService(path, { method: "GET" }, fetchFn);
}

/** POST one recorded chunk; the service transcribes it, appends the
 *  line to the armed session, and separates the speaker. */
export async function forwardListeningChunk(
  request: Request,
  fetchFn: FetchFn = fetch,
): Promise<Response> {
  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0) {
    return Response.json({ error: "No audio was received." }, { status: 400 });
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    return Response.json({ error: "That recording is too large to process." }, { status: 413 });
  }
  return callService(
    "/listening/chunk",
    {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") ?? "audio/webm" },
      body: audio,
    },
    fetchFn,
  );
}

/** GET /speakers/others — the separate other-voices store, labeled.
 *  Never carries the operator's voiceprint or operator speech. */
export async function forwardOtherVoices(fetchFn: FetchFn = fetch): Promise<Response> {
  return callService("/speakers/others", { method: "GET" }, fetchFn);
}
