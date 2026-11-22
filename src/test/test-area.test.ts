import { describe, expect, it } from "vitest";
import {
  displayStatus,
  isStale,
  loadTestLedger,
  saveTestResult,
  TEST_STALE_MS,
} from "@/avatar/testArea";
import { buildCaptureBundle, captureFilename } from "@/avatar/capture";

/**
 * PARTS 24 + 15 — the ledger never claims what a run didn't prove,
 * passes go STALE with age, and the capture bundle labels every
 * section for what it is.
 */

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

describe("test ledger", () => {
  const now = 1_700_000_000_000;

  it("an unrun probe reads NOT RUN — no claim is made", () => {
    expect(displayStatus(undefined, now)).toBe("NOT RUN");
  });

  it("fresh results read WORKS / DOESN'T WORK; old ones read STALE", () => {
    const fresh = { status: "works" as const, reason: "ok", at: now - 1000 };
    const old = { status: "works" as const, reason: "ok", at: now - TEST_STALE_MS - 1 };
    const fail = { status: "fails" as const, reason: "HTTP 503", at: now - 1000 };
    expect(displayStatus(fresh, now)).toBe("WORKS");
    expect(displayStatus(fail, now)).toBe("DOESN'T WORK");
    expect(displayStatus(old, now)).toBe("STALE");
    expect(isStale(old, now)).toBe(true);
    expect(isStale(fresh, now)).toBe(false);
  });

  it("results persist through save/load, and junk in storage is dropped", () => {
    const storage = memoryStorage();
    saveTestResult("brain", { status: "fails", reason: "unreachable", at: now }, storage);
    const ledger = loadTestLedger(storage);
    expect(ledger["brain"]?.reason).toBe("unreachable");
    storage.setItem("augi.testarea.ledger.v1", JSON.stringify({ bad: { nope: 1 } }));
    expect(loadTestLedger(storage)).toEqual({});
  });
});

describe("capture bundle", () => {
  it("labels every section and stamps the capture time", () => {
    const bundle = buildCaptureBundle({
      now: 1_700_000_000_000,
      userAgent: "test-agent",
      settings: { bloom: 0 },
      scanState: { available: true },
      recentReplies: [],
      ledger: {},
      visibleError: null,
    });
    expect(bundle.kind).toBe("augie-capture");
    expect(bundle.capturedAt).toBe(new Date(1_700_000_000_000).toISOString());
    for (const section of Object.values(bundle.sections)) {
      expect(section.label.length).toBeGreaterThan(10);
    }
    expect(captureFilename(1_700_000_000_000)).toMatch(/^augie-capture-\d{8}-\d{6}\.json$/);
  });
});
