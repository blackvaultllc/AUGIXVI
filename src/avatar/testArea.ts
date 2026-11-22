/**
 * TEST AREA — the ledger core (Part 24, operator order 2026-11-21).
 *
 * Every ability gets a runnable end-to-end probe; each run records
 * WORKS / DOESN'T WORK + the reason in a persistent ledger (the
 * compare-and-contrast board). Rules:
 *
 * - Nothing shows WORKS without a real run — a probe that has never
 *   run reads NOT RUN, and a pass older than STALE_MS reads STALE.
 * - A failure records the reason the probe actually hit (the HTTP
 *   status, the error message), never a dressed-up guess.
 *
 * This module is the pure part: types, the ledger's load/save, and
 * staleness. The probes themselves live in TestAreaWindow.tsx where
 * the browser APIs are.
 */

export type TestStatus = "works" | "fails";

export type TestResult = {
  status: TestStatus;
  /** What the probe actually found — the evidence, in plain words. */
  reason: string;
  /** Epoch ms of the run. */
  at: number;
};

export type TestLedger = Record<string, TestResult>;

export const TEST_LEDGER_KEY = "augi.testarea.ledger.v1";

/** A pass older than this is history, not a current claim. */
export const TEST_STALE_MS = 24 * 60 * 60 * 1000;

export function isStale(result: TestResult, now: number): boolean {
  return now - result.at > TEST_STALE_MS;
}

/** How one ledger row reads, honestly, at `now`. */
export function displayStatus(
  result: TestResult | undefined,
  now: number,
): "NOT RUN" | "WORKS" | "DOESN'T WORK" | "STALE" {
  if (!result) return "NOT RUN";
  if (isStale(result, now)) return "STALE";
  return result.status === "works" ? "WORKS" : "DOESN'T WORK";
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadTestLedger(storage?: StorageLike): TestLedger {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(TEST_LEDGER_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: TestLedger = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        typeof value === "object" &&
        value !== null &&
        "status" in value &&
        "reason" in value &&
        "at" in value &&
        ((value as TestResult).status === "works" || (value as TestResult).status === "fails") &&
        typeof (value as TestResult).reason === "string" &&
        typeof (value as TestResult).at === "number"
      ) {
        out[id] = value as TestResult;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveTestResult(id: string, result: TestResult, storage?: StorageLike): TestLedger {
  const ledger = loadTestLedger(storage);
  ledger[id] = result;
  try {
    (storage ?? globalThis.localStorage)?.setItem(TEST_LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // A failed save never blocks the run itself.
  }
  return ledger;
}
