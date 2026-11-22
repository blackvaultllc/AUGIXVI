/**
 * OFFICE ANALYTICS — Part 10 (Domenick's order 2026-11-21): every
 * department's real status, reachable from the command window.
 *
 * Each department reads a REAL source inside this app:
 *  - Security: the gate log (knocks recorded by the honeypot).
 *  - Knowledge: the live Kiwix catalog (books actually serving).
 *  - Brain: the local Ollama model list.
 *  - Academy: Khadija's Squishy Maker store on this machine.
 *  - Systems: the trusted-device registry (Part 8).
 *  - Finance / Social Media: NO source inside Augie — reported
 *    UNAVAILABLE, plainly, never dressed up as activity.
 *
 * Operator-only: the caller's session is verified with the same
 * check as the gate log before a single number is returned.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { readGateLog } from "./gateLogStore.server";
import { forwardLibraryCatalog } from "./library.server";
import { listTrustedDevices } from "./trustedDevices.server";
import { runSquishyAction } from "./learner/squishyMaker.server";
import { DEPARTMENTS, type DepartmentSignal } from "./departments";

type AccessInput = { accessToken: string };

function isAccessInput(input: unknown): input is AccessInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "accessToken" in input &&
    typeof input.accessToken === "string" &&
    input.accessToken.length > 0 &&
    input.accessToken.length <= 16_384
  );
}

export interface OfficeAnalyticsView {
  authorized: boolean;
  generatedAt: string;
  departments: DepartmentSignal[];
}

async function securitySignal(): Promise<DepartmentSignal> {
  const def = DEPARTMENTS[0]!;
  try {
    const log = await readGateLog();
    if (!log.available) {
      return {
        ...pick(def),
        status: "unavailable",
        detail: "The gate log store does not exist on this build, so knock counts cannot be read.",
        stats: [],
      };
    }
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const last24 = log.entries.filter((entry) => {
      const at = Date.parse(entry.ts);
      return Number.isFinite(at) && at >= dayAgo;
    }).length;
    return {
      ...pick(def),
      status: "working",
      detail:
        log.total === 0
          ? "The gate log is readable and quiet — no knocks recorded yet."
          : `The gate log is recording. ${log.total} knock${log.total === 1 ? "" : "s"} on file.`,
      stats: [
        { label: "Knocks recorded", value: String(log.total) },
        { label: "Knocks, last 24h", value: String(last24) },
      ],
    };
  } catch {
    return {
      ...pick(def),
      status: "unavailable",
      detail: "The gate log could not be read from this build.",
      stats: [],
    };
  }
}

async function knowledgeSignal(fetchFn: typeof fetch = fetch): Promise<DepartmentSignal> {
  const def = DEPARTMENTS[1]!;
  try {
    const response = await forwardLibraryCatalog(fetchFn);
    if (!response.ok) {
      return {
        ...pick(def),
        status: "unavailable",
        detail: "The library is not answering (kiwix-serve) — book counts are unavailable.",
        stats: [],
      };
    }
    const body = (await response.json()) as { books?: { title?: string; name?: string }[] };
    const books = body.books ?? [];
    return {
      ...pick(def),
      status: books.length > 0 ? "working" : "problem",
      detail:
        books.length > 0
          ? `${books.length} book${books.length === 1 ? "" : "s"} serving from this machine's library.`
          : "The library answers but serves no books — that is a problem state, not a quiet day.",
      stats: [{ label: "Books serving", value: String(books.length) }],
    };
  } catch {
    return {
      ...pick(def),
      status: "unavailable",
      detail: "The library catalog could not be reached from this build.",
      stats: [],
    };
  }
}

async function brainSignal(fetchFn: typeof fetch = fetch): Promise<DepartmentSignal> {
  const def = DEPARTMENTS[2]!;
  try {
    const response = await fetchFn("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw new Error("ollama not ok");
    const body = (await response.json()) as { models?: { name?: string }[] };
    const models = body.models ?? [];
    return {
      ...pick(def),
      status: models.length > 0 ? "working" : "problem",
      detail:
        models.length > 0
          ? `Ollama is up with ${models.length} local model${models.length === 1 ? "" : "s"} on this machine.`
          : "Ollama answers but has no models — Augie's local brain has nothing to think with.",
      stats: [{ label: "Local models", value: String(models.length) }],
    };
  } catch {
    return {
      ...pick(def),
      status: "unavailable",
      detail: "Ollama is not answering on this machine — model counts are unavailable.",
      stats: [],
    };
  }
}

async function academySignal(): Promise<DepartmentSignal> {
  const def = DEPARTMENTS[3]!;
  try {
    const result = (await runSquishyAction("listSquishies", {})) as {
      squishies?: unknown[];
    };
    const count = result.squishies?.length ?? 0;
    const money = (await runSquishyAction("getPrizeMoney", {})) as { total?: number };
    return {
      ...pick(def),
      status: count > 0 ? "working" : "problem",
      detail:
        count > 0
          ? `Khadija's Squishy Maker store holds ${count} saved squish${count === 1 ? "y" : "ies"}.`
          : "Her Squishy Maker store is empty — no saved work yet. Shown as a problem state, per the rule: a department with no work is a problem, never fake busyness.",
      stats: [
        { label: "Saved squishies", value: String(count) },
        { label: "Pretend prize money", value: `$${money.total ?? 0}` },
      ],
    };
  } catch {
    return {
      ...pick(def),
      status: "unavailable",
      detail: "Her Squishy Maker store could not be read from this build.",
      stats: [],
    };
  }
}

async function systemsSignal(): Promise<DepartmentSignal> {
  const def = DEPARTMENTS[4]!;
  try {
    const devices = await listTrustedDevices();
    return {
      ...pick(def),
      status: "working",
      detail:
        devices.length > 0
          ? `${devices.length} device${devices.length === 1 ? "" : "s"} confirmed by full sign-in.`
          : "No devices confirmed yet — the next full sign-in confirms this one.",
      stats: [{ label: "Trusted devices", value: String(devices.length) }],
    };
  } catch {
    return {
      ...pick(def),
      status: "unavailable",
      detail: "The trusted-device registry could not be read from this build.",
      stats: [],
    };
  }
}

function unavailableSignal(index: number, detail: string): DepartmentSignal {
  const def = DEPARTMENTS[index]!;
  return { ...pick(def), status: "unavailable", detail, stats: [] };
}

function pick(def: { id: string; label: string }): { id: string; label: string } {
  return { id: def.id, label: def.label };
}

/** Gather every department's signal. Pure composition — each reader
 *  fails into its own honest UNAVAILABLE, never into a thrown error. */
export async function gatherOfficeAnalytics(
  fetchFn: typeof fetch = fetch,
): Promise<DepartmentSignal[]> {
  const [security, knowledge, brain, academy, systems] = await Promise.all([
    securitySignal(),
    knowledgeSignal(fetchFn),
    brainSignal(fetchFn),
    academySignal(),
    systemsSignal(),
  ]);
  return [
    security,
    knowledge,
    brain,
    academy,
    systems,
    unavailableSignal(
      5,
      "No finance data source lives inside Augie — I-E-M's finance (Violet's desk) is outside this app, so no numbers are shown rather than invented ones.",
    ),
    unavailableSignal(
      6,
      "No social accounts are connected inside Augie — posting and stats live on the platforms, so this department reports UNAVAILABLE instead of fake activity.",
    ),
  ];
}

export const getOfficeAnalytics = createServerFn({ method: "POST" })
  .validator((input: unknown): AccessInput => {
    if (!isAccessInput(input)) {
      throw new Error("Invalid office analytics request.");
    }
    return input;
  })
  .handler(async ({ data }): Promise<OfficeAnalyticsView> => {
    const verification = await verifySupabaseOperatorSession({
      data: { accessToken: data.accessToken },
    });
    if (!verification.authorized) {
      return { authorized: false, generatedAt: new Date().toISOString(), departments: [] };
    }
    return {
      authorized: true,
      generatedAt: new Date().toISOString(),
      departments: await gatherOfficeAnalytics(),
    };
  });
