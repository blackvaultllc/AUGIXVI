/**
 * AUGIE'S OWN EVENT LOG (Part 22, owner order 2026-11-21) — the
 * append-only record behind the Logs window: update checks, update
 * requests, repair proposals, test results, notes. His rule: "even if
 * it coughs I want to know the reason why" — every entry carries its
 * reason. Nothing in this file EXECUTES an update or a repair:
 * applying updates and changing code follow his doctrine (fix only
 * with his say) — this log records checks, requests, and proposals.
 */
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { readGateLog } from "./gateLogStore.server";

export type AugieEventType =
  | "update-check"
  | "update-apply-request"
  | "repair-proposal"
  | "test-result"
  | "note";

export interface AugieEvent {
  at: string;
  type: AugieEventType;
  summary: string;
  detail?: string;
}

export function eventsLogPath(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env["AUGIE_EVENTS_PATH"] ??
    join(homedir(), ".local", "share", "augie", "augie-events.jsonl")
  );
}

let writeChain: Promise<void> = Promise.resolve();

export async function appendAugieEvent(
  event: Omit<AugieEvent, "at"> & { at?: string },
  env: NodeJS.ProcessEnv = process.env,
): Promise<AugieEvent> {
  const full: AugieEvent = { ...event, at: event.at ?? new Date().toISOString() };
  const path = eventsLogPath(env);
  writeChain = writeChain.then(async () => {
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.appendFile(path, `${JSON.stringify(full)}\n`, "utf8");
  });
  await writeChain;
  return full;
}

export async function readAugieEvents(
  limit = 120,
  env: NodeJS.ProcessEnv = process.env,
): Promise<AugieEvent[]> {
  try {
    const text = await fs.readFile(eventsLogPath(env), "utf8");
    const events: AugieEvent[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as AugieEvent;
        if (parsed && typeof parsed.summary === "string") events.push(parsed);
      } catch {
        // A torn line is skipped, never fatal.
      }
    }
    return events.slice(-limit).reverse();
  } catch {
    return [];
  }
}

/** The service journal — only where journalctl can actually run. */
export async function readServiceLog(lines = 80): Promise<{ available: boolean; reason?: string; lines: string[] }> {
  try {
    const { execFile } = await import("node:child_process");
    const out = await new Promise<string>((resolve, reject) => {
      execFile(
        "journalctl",
        ["--user", "-u", "augie.service", "-n", String(lines), "--no-pager", "-o", "short-iso"],
        { timeout: 6000 },
        (err, stdout) => (err ? reject(err) : resolve(stdout)),
      );
    });
    return { available: true, lines: out.split("\n").filter(Boolean) };
  } catch (err) {
    return {
      available: false,
      reason: `The service journal is not readable from this build (${err instanceof Error ? err.message : "unknown error"}). On the Parrot it is: journalctl --user -u augie.service.`,
      lines: [],
    };
  }
}

/**
 * The updater's CHECK half: real where a git repo exists (the
 * workspace build), honest where it doesn't (the Parrot copy is
 * deployed by sync and has no .git — updates are checked in the
 * workspace repo and arrive by the deploy path).
 */
export async function checkForUpdates(
  cwd = process.cwd(),
): Promise<{ repoPresent: boolean; summary: string; detail: string }> {
  try {
    const { execFile } = await import("node:child_process");
    const git = (args: string[]) =>
      new Promise<string>((resolve, reject) => {
        execFile("git", args, { cwd, timeout: 20000 }, (err, stdout) =>
          err ? reject(err) : resolve(stdout.trim()),
        );
      });
    const head = await git(["rev-parse", "--short", "HEAD"]);
    await git(["fetch", "--quiet", "origin", "main"]).catch(() => "");
    const behind = await git(["rev-list", "--count", "HEAD..origin/main"]).catch(() => "0");
    const behindCount = Number.parseInt(behind, 10) || 0;
    return {
      repoPresent: true,
      summary:
        behindCount > 0
          ? `Update available: origin/main is ${behindCount} commit(s) ahead of this copy (${head}).`
          : `Up to date: this copy is at ${head}, matching origin/main.`,
      detail: `Checked with git fetch at ${new Date().toISOString()}. Applying an update is a separate, operator-confirmed step — nothing was pulled.`,
    };
  } catch {
    return {
      repoPresent: false,
      summary:
        "This copy has no git repo (it is deployed by sync), so there is nothing to check here — updates are checked in the workspace repo and arrive by the deploy path (sync → rebuild → restart).",
      detail: "git rev-parse failed in the app directory; that is expected on the Parrot's synced copy.",
    };
  }
}

async function requireOperator(accessToken: string) {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return verification.authorized ? verification : null;
}

export interface LogsPayload {
  authorized: boolean;
  gate: { available: boolean; total: number; recent: { ts: string; ip: string; path: string }[] };
  events: AugieEvent[];
  service: { available: boolean; reason?: string; lines: string[] };
}

export const getLogs = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => input)
  .handler(async ({ data }): Promise<LogsPayload> => {
    const empty: LogsPayload = {
      authorized: false,
      gate: { available: false, total: 0, recent: [] },
      events: [],
      service: { available: false, lines: [] },
    };
    if (!(await requireOperator(data.accessToken))) return empty;
    const gate = await readGateLog().catch(() => null);
    const [events, service] = await Promise.all([readAugieEvents(), readServiceLog()]);
    return {
      authorized: true,
      gate: {
        available: Boolean(gate),
        total: gate?.total ?? 0,
        recent: (gate?.entries ?? []).slice(0, 12).map((e) => ({ ts: e.ts, ip: e.ip, path: e.path })),
      },
      events,
      service,
    };
  });

export const runUpdateCheck = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => input)
  .handler(async ({ data }) => {
    if (!(await requireOperator(data.accessToken))) {
      return { authorized: false, summary: "", detail: "" };
    }
    const result = await checkForUpdates();
    await appendAugieEvent({ type: "update-check", summary: result.summary, detail: result.detail });
    return { authorized: true, ...result };
  });

/**
 * Applying an update / a code repair is NEVER executed from here —
 * his doctrine is fix-only-with-his-say, and a web button is not the
 * deploy path. These record his confirmed request/proposal in the
 * log with its reason; the deploy/repair then happens through the
 * documented path and its result is logged as a note.
 */
export const recordUpdateRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; note: string }) => input)
  .handler(async ({ data }) => {
    if (!(await requireOperator(data.accessToken))) return { recorded: false };
    await appendAugieEvent({
      type: "update-apply-request",
      summary: "Operator confirmed an update apply request.",
      detail: `${data.note} — Recorded only: the apply itself runs through the deploy path (sync → rebuild → restart), never silently from this window.`,
    });
    return { recorded: true };
  });

export const recordRepairProposal = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; summary: string; detail: string }) => input)
  .handler(async ({ data }) => {
    if (!(await requireOperator(data.accessToken))) return { recorded: false };
    await appendAugieEvent({
      type: "repair-proposal",
      summary: data.summary,
      detail: `${data.detail} — Proposal only: no code was changed. Crash recovery is automatic (systemd Restart=on-failure); code-changing fixes wait for the operator's say.`,
    });
    return { recorded: true };
  });

/**
 * THE SUMMONS' LOG LINE (cybernetic pass, 2026-11-26): when a
 * registered device carrying the Captain's Summons flag appears
 * or vanishes on a real presence check, the stage writes the
 * line here — the append-only events record the Logs window
 * reads (the Gate Log proper stays the trap-path knock log; it
 * is not a general record and is not bent into one). Operator-
 * gated like every write; the summary is length-fenced.
 */
export const logSummonsEvent = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; line: string }) => input)
  .handler(async ({ data }) => {
    if (!(await requireOperator(data.accessToken))) return { recorded: false };
    const line = typeof data.line === "string" ? data.line.slice(0, 300) : "";
    if (!line) return { recorded: false };
    await appendAugieEvent({
      type: "note",
      summary: line,
      detail: "The Summons — a flagged device's signal transition, seen by a real presence check.",
    });
    return { recorded: true };
  });

export const recordTestResult = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; testName: string; works: boolean; reason: string }) => input,
  )
  .handler(async ({ data }) => {
    if (!(await requireOperator(data.accessToken))) return { recorded: false };
    await appendAugieEvent({
      type: "test-result",
      summary: `${data.testName}: ${data.works ? "WORKS" : "DOESN'T WORK"}`,
      detail: data.reason,
    });
    return { recorded: true };
  });
