import { describe, expect, it, vi } from "vitest";
import { forwardTranscription, sttServiceUrl } from "@/avatar/transcribe.server";

/**
 * /api/transcribe forwards one recorded clip to the local faster-whisper
 * service on this machine and returns its words. The contract that
 * matters to the operator: success returns text, and every failure is a
 * distinct status with a plain-words reason — most importantly 503
 * "Local speech service is not running" when augie-stt is down, so the
 * mic can never fail silently again.
 */

function audioRequest(bytes: number[] = [1, 2, 3, 4]): Request {
  return new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "audio/webm" },
    body: new Uint8Array(bytes),
  });
}

describe("sttServiceUrl", () => {
  it("defaults to the local augie-stt service on this machine", () => {
    expect(sttServiceUrl({})).toBe("http://127.0.0.1:8765/transcribe");
  });

  it("honors the AUGIE_STT_URL override", () => {
    expect(sttServiceUrl({ AUGIE_STT_URL: "http://127.0.0.1:9999/t" })).toBe(
      "http://127.0.0.1:9999/t",
    );
  });
});

describe("forwardTranscription", () => {
  it("returns the local service's transcript", async () => {
    const fetchFn = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(
      async () => Response.json({ text: "Osiris, open the cube.", latency_ms: 812 }),
    );
    const response = await forwardTranscription(audioRequest(), fetchFn);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ text: "Osiris, open the cube." });
    // The clip is forwarded untouched, with its content type, to localhost.
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("http://127.0.0.1:8765/transcribe");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("audio/webm");
  });

  it("rejects an empty recording with words, not silence", async () => {
    const fetchFn = vi.fn();
    const response = await forwardTranscription(audioRequest([]), fetchFn);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No audio was received." });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects an oversized recording", async () => {
    const big = new Request("http://localhost/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
      body: new Uint8Array(25 * 1024 * 1024 + 1),
    });
    const response = await forwardTranscription(big, vi.fn());
    expect(response.status).toBe(413);
  });

  it("says the speech service is not running when it cannot be reached", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:8765");
    });
    const response = await forwardTranscription(audioRequest(), fetchFn);
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("Local speech service is not running");
  });

  it("passes through the service's own error as a 502", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ error: "transcription failed: bad audio" }, { status: 500 }),
    );
    const response = await forwardTranscription(audioRequest(), fetchFn);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "transcription failed: bad audio",
    });
  });
});
