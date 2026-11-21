import { describe, expect, it, vi } from "vitest";
import {
  forwardEnrollAction,
  forwardEnrollSample,
  forwardVerify,
  forwardVoiceprintStatus,
  sttBaseUrl,
} from "@/avatar/voiceprint.server";

/**
 * /api/voiceprint/* forwarders — the calibration doorway to the local
 * speech service. The contract: audio and verdicts pass through
 * untouched, the threshold header rides along, an empty clip is a 400
 * with words, and a down service is a 503 that says so — the ear's
 * gate depends on never mistaking silence for a verdict.
 */

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

function audioRequest(bytes: number[] = [1, 2, 3, 4], headers = {}): Request {
  return new Request("http://localhost/api/voiceprint/verify", {
    method: "POST",
    headers: { "Content-Type": "audio/webm", ...headers },
    body: new Uint8Array(bytes),
  });
}

describe("sttBaseUrl", () => {
  it("defaults to the local augie-stt service on this machine", () => {
    expect(sttBaseUrl({})).toBe("http://127.0.0.1:8765");
  });

  it("derives the base from the AUGIE_STT_URL override", () => {
    expect(sttBaseUrl({ AUGIE_STT_URL: "http://127.0.0.1:9999/transcribe" })).toBe(
      "http://127.0.0.1:9999",
    );
  });
});

describe("forwardVoiceprintStatus", () => {
  it("returns the service's status — enrolled flag, never an embedding", async () => {
    const fetchFn = vi.fn<FetchFn>(async () =>
      Response.json({
        enrolled: true,
        model: "wespeaker-voxceleb-resnet34-LM",
        model_ready: true,
        samples: 4,
      }),
    );
    const response = await forwardVoiceprintStatus(fetchFn);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload["enrolled"]).toBe(true);
    expect(payload["embedding"]).toBeUndefined();
    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8765/voiceprint/status");
  });

  it("says 503 in words when the speech service is down", async () => {
    const fetchFn = vi.fn<FetchFn>(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    const response = await forwardVoiceprintStatus(fetchFn);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: expect.stringContaining("not running"),
    });
  });
});

describe("forwardVerify", () => {
  it("forwards the clip and the operator's threshold, returns the verdict", async () => {
    const fetchFn = vi.fn<FetchFn>(async () =>
      Response.json({ enrolled: true, match: false, score: 0.21, threshold: 0.62 }),
    );
    const response = await forwardVerify(
      audioRequest([9, 8, 7], { "X-Threshold": "0.62" }),
      fetchFn,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      enrolled: true,
      match: false,
      score: 0.21,
      threshold: 0.62,
    });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("http://127.0.0.1:8765/verify");
    expect((init?.headers as Record<string, string>)["X-Threshold"]).toBe("0.62");
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("audio/webm");
  });

  it("rejects an empty clip with words and never calls the service", async () => {
    const fetchFn = vi.fn<FetchFn>();
    const response = await forwardVerify(audioRequest([]), fetchFn);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No audio was received.",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("passes the service's own refusal through with its status", async () => {
    const fetchFn = vi.fn<FetchFn>(async () =>
      Response.json({ error: "clip is too short to judge a voice" }, { status: 400 }),
    );
    const response = await forwardVerify(audioRequest(), fetchFn);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "clip is too short to judge a voice",
    });
  });
});

describe("forwardEnrollSample + forwardEnrollAction", () => {
  it("forwards an enrollment clip to /enroll", async () => {
    const fetchFn = vi.fn<FetchFn>(async () => Response.json({ samples: 2 }));
    const response = await forwardEnrollSample(audioRequest(), fetchFn);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ samples: 2 });
    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8765/enroll");
  });

  it("maps commit / reset / delete to the service's bookkeeping paths", async () => {
    const fetchFn = vi.fn<FetchFn>(async () => Response.json({ enrolled: true }));
    await forwardEnrollAction("commit", fetchFn);
    await forwardEnrollAction("reset", fetchFn);
    await forwardEnrollAction("delete", fetchFn);
    expect(fetchFn.mock.calls.map((call) => call[0])).toEqual([
      "http://127.0.0.1:8765/enroll/commit",
      "http://127.0.0.1:8765/enroll/reset",
      "http://127.0.0.1:8765/voiceprint/delete",
    ]);
  });
});
