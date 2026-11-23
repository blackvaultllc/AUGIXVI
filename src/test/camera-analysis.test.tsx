import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CAMERA_ANALYSIS_DRAFT_LABEL,
  analyzeCameraView,
  cameraSnapshotUrl,
} from "@/avatar/cameras/cameraAnalysis";
import { CameraAnalysisBlock } from "@/avatar/cameras/CameraAnalysisBlock";

/**
 * Camera view analysis (owner order 2026-11-23, run-3 follow-up):
 * a lens's CURRENT snapshot goes through the existing snapshot
 * route first and the existing vision path second; the reading
 * renders only under the draft label (run 3 proved the model can
 * invent details); a failure is plain words, never a reading.
 */

const BRAIN = "http://brain.test";
const SNAPSHOT_URL = cameraSnapshotUrl("tok", "cam-1", "lens-1");
const FRAME_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 10, 20, 30, 40]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function tagsResponse(): Response {
  return jsonResponse({ models: [{ name: "llama3.1:8b" }, { name: "llava:7b" }] });
}

function generateResponse(): Response {
  const line = JSON.stringify({
    response: "A desk with a monitor.\nFINDINGS:\n- monitor\n- desk",
  });
  return new Response(`${line}\n`, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

/** A fetch that routes by URL and records the call order. */
function routedFetch(overrides: { snapshot?: Response; tags?: Response; generate?: Response }) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(init ? { url, init } : { url });
    if (url.startsWith("/api/cameras/snapshot")) {
      return (
        overrides.snapshot ??
        new Response(new Uint8Array(FRAME_BYTES), {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        })
      );
    }
    if (url.endsWith("/api/tags")) return overrides.tags ?? tagsResponse();
    if (url.endsWith("/api/generate")) return overrides.generate ?? generateResponse();
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
  return { calls, fetchFn };
}

describe("analyzeCameraView — snapshot first, then the vision path", () => {
  it("calls the snapshot route, then /api/tags, then /api/generate — with the snapshot's own bytes", async () => {
    const { calls, fetchFn } = routedFetch({});
    const outcome = await analyzeCameraView({
      snapshotUrl: SNAPSHOT_URL,
      brain: BRAIN,
      fetchFn,
    });
    expect(outcome.ok).toBe(true);
    expect(calls.map((c) => c.url)).toEqual([
      SNAPSHOT_URL,
      `${BRAIN}/api/tags`,
      `${BRAIN}/api/generate`,
    ]);
    const body = JSON.parse(String(calls[2]!.init?.body)) as {
      model: string;
      images: string[];
    };
    expect(body.model).toBe("llava:7b");
    expect(body.images).toEqual([Buffer.from(FRAME_BYTES).toString("base64")]);
    if (outcome.ok) {
      expect(outcome.reading.text).toBe("A desk with a monitor.");
      expect(outcome.reading.findings).toEqual(["monitor", "desk"]);
      expect(outcome.reading.model).toBe("llava:7b");
    }
  });

  it("a silent lens is plain words and the vision path is never called", async () => {
    const { calls, fetchFn } = routedFetch({
      snapshot: new Response("no frame from that lens", { status: 502 }),
    });
    const outcome = await analyzeCameraView({
      snapshotUrl: SNAPSHOT_URL,
      brain: BRAIN,
      fetchFn,
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.note).toContain("No frame came back");
      expect(outcome).not.toHaveProperty("reading");
    }
    expect(calls).toHaveLength(1);
  });

  it("a vision failure is plain words, not a reading", async () => {
    const { fetchFn } = routedFetch({
      generate: new Response("boom", { status: 500 }),
    });
    const outcome = await analyzeCameraView({
      snapshotUrl: SNAPSHOT_URL,
      brain: BRAIN,
      fetchFn,
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.note).toContain("could not read this view");
      expect(outcome.note).toContain("No reading was made up");
      expect(outcome).not.toHaveProperty("reading");
    }
  });

  it("no vision model installed is plain words, not a reading", async () => {
    const { fetchFn } = routedFetch({
      tags: jsonResponse({ models: [{ name: "llama3.1:8b" }] }),
    });
    const outcome = await analyzeCameraView({
      snapshotUrl: SNAPSHOT_URL,
      brain: BRAIN,
      fetchFn,
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.note).toContain("no vision model is installed");
  });
});

describe("the draft label — the honesty contract", () => {
  it("is the exact pinned copy", () => {
    expect(CAMERA_ANALYSIS_DRAFT_LABEL).toBe(
      "Analyzer's reading — a draft: it can invent details; trust the picture, not the words.",
    );
  });

  it("renders with the result — label first, then the reading", () => {
    const { container } = render(
      <CameraAnalysisBlock
        state={{
          kind: "done",
          reading: { text: "A desk with a monitor.", findings: ["monitor"], model: "llava:7b" },
          at: Date.now(),
        }}
      />,
    );
    const label = container.querySelector(".window-cameras__draft-label");
    expect(label?.textContent).toBe(CAMERA_ANALYSIS_DRAFT_LABEL);
    expect(container.querySelector(".window-cameras__reading")?.textContent).toBe(
      "A desk with a monitor.",
    );
    expect(container.textContent).toContain("monitor");
  });

  it("a failure renders words and NO reading, NO draft label", () => {
    const { container } = render(
      <CameraAnalysisBlock
        state={{ kind: "failed", note: "The analyzer could not read this view: offline." }}
      />,
    );
    expect(container.textContent).toContain("could not read this view");
    expect(container.querySelector(".window-cameras__draft-label")).toBeNull();
    expect(container.querySelector(".window-cameras__reading")).toBeNull();
  });

  it("working state says it is working, with the seconds on the clock", () => {
    const { container } = render(
      <CameraAnalysisBlock state={{ kind: "working", elapsed: 23, partial: "" }} />,
    );
    expect(container.textContent).toContain("23s");
    expect(container.textContent).toContain("20 seconds or more");
  });
});
