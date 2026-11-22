import { describe, expect, it, vi } from "vitest";
import {
  forwardListeningArm,
  forwardListeningChunk,
  forwardListeningDisarm,
  forwardListeningRecap,
  forwardListeningStatus,
  forwardOtherVoices,
} from "@/avatar/listening.server";

/**
 * /api/listening/* + /api/speakers/others forwarders — the doorway to
 * the local speech service's Listening Mode (Parts 12 + 13). The
 * contract: calls land on the service's real paths, audio passes
 * through untouched, an empty chunk is a 400 with words and never
 * reaches the service, the service's 409 (chunk while disarmed) stays
 * a 409, and a down service is a 503 that says so.
 */

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

function chunkRequest(bytes: number[] = [1, 2, 3, 4]): Request {
  return new Request("http://localhost/api/listening/chunk", {
    method: "POST",
    headers: { "Content-Type": "audio/webm" },
    body: new Uint8Array(bytes),
  });
}

describe("forwardListeningStatus / arm / disarm", () => {
  it("reads the armed status from the service", async () => {
    const fetchFn = vi.fn<FetchFn>(async () =>
      Response.json({ armed: true, sessionId: "listen-1", lineCount: 2, wakeHeard: false }),
    );
    const response = await forwardListeningStatus(fetchFn);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ armed: true, lineCount: 2 });
    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8765/listening/status");
  });

  it("arms and disarms on the service's own paths", async () => {
    const fetchFn = vi.fn<FetchFn>(async () => Response.json({ armed: true }));
    await forwardListeningArm(fetchFn);
    await forwardListeningDisarm(fetchFn);
    expect(fetchFn.mock.calls.map((call) => call[0])).toEqual([
      "http://127.0.0.1:8765/listening/arm",
      "http://127.0.0.1:8765/listening/disarm",
    ]);
    expect(fetchFn.mock.calls.map((call) => call[1]?.method)).toEqual(["POST", "POST"]);
  });

  it("says 503 in words when the speech service is down", async () => {
    const fetchFn = vi.fn<FetchFn>(async () => {
      throw new Error("connect ECONNREFUSED");
    });
    const response = await forwardListeningArm(fetchFn);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: expect.stringContaining("not running"),
    });
  });
});

describe("forwardListeningRecap", () => {
  it("asks for the current session when no id is given", async () => {
    const fetchFn = vi.fn<FetchFn>(async () =>
      Response.json({
        recorded: false,
        lines: [],
        message: "Nothing was recorded in this session.",
      }),
    );
    const response = await forwardListeningRecap(
      new Request("http://localhost/api/listening/recap"),
      fetchFn,
    );
    expect(response.status).toBe(200);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8765/listening/recap");
  });

  it("passes a session id through, encoded", async () => {
    const fetchFn = vi.fn<FetchFn>(async () => Response.json({ recorded: true, lines: [] }));
    await forwardListeningRecap(
      new Request("http://localhost/api/listening/recap?session=listen-1%202"),
      fetchFn,
    );
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:8765/listening/recap?session=listen-1%202",
    );
  });
});

describe("forwardListeningChunk", () => {
  it("forwards the chunk with its content type and returns the verdict", async () => {
    const fetchFn = vi.fn<FetchFn>(async () =>
      Response.json({ recorded: true, text: "hello", speaker: "Speaker 2", separation: "other" }),
    );
    const response = await forwardListeningChunk(chunkRequest(), fetchFn);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ recorded: true, speaker: "Speaker 2" });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("http://127.0.0.1:8765/listening/chunk");
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("audio/webm");
  });

  it("rejects an empty chunk with words and never calls the service", async () => {
    const fetchFn = vi.fn<FetchFn>();
    const response = await forwardListeningChunk(chunkRequest([]), fetchFn);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No audio was received." });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("keeps the service's 409 — a chunk while disarmed records nothing", async () => {
    const fetchFn = vi.fn<FetchFn>(async () =>
      Response.json(
        { error: "no listening session is armed — chunk not recorded" },
        { status: 409 },
      ),
    );
    const response = await forwardListeningChunk(chunkRequest(), fetchFn);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "no listening session is armed — chunk not recorded",
    });
  });
});

describe("forwardOtherVoices", () => {
  it("reads the separate store from /speakers/others", async () => {
    const fetchFn = vi.fn<FetchFn>(async () =>
      Response.json({
        enrolled: false,
        separationAvailable: false,
        state: "not-enrolled",
        entries: [],
        speakers: [],
      }),
    );
    const response = await forwardOtherVoices(fetchFn);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ state: "not-enrolled" });
    expect(fetchFn.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8765/speakers/others");
  });
});
