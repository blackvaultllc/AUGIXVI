/**
 * LOGS + UPDATER — operator read/act endpoints (Part 22).
 *
 * The owner's rule: "even if it coughs I want to know the reason
 * why." Three sources, all operator-only behind the same session
 * verification the Gate Log uses:
 *
 * - SERVICE JOURNAL: the local augie.service journal (the app's own
 *   stdout/stderr and crash reasons), read with journalctl on the
 *   machine itself. Local desktop server only — on the hosted Worker
 *   there is no journal and the view says so.
 * - UPDATE STATUS: the version stamp of the running build
 *   (.augie-version, written at deploy time) against the repo's
 *   current HEAD (git ls-remote). Checks are automatic and read-only.
 * - APPLY: operator-confirmed ONLY. Spawns the one fixed script
 *   (~/augie-app/update.sh — scripts/parrot-update.sh in the repo),
 *   detached, and logs the request. The app never edits its own code
 *   by any other path: crash recovery is the service manager's
 *   Restart=on-failure, and every code change arrives through this
 *   confirmed, logged update or not at all.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { deriveUpdateRun, type UpdateRunPhase } from "./updateRunStatus";

type TokenInput = { accessToken: string };

function isTokenInput(input: unknown): input is TokenInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "accessToken" in input &&
    typeof (input as { accessToken: unknown }).accessToken === "string" &&
    (input as { accessToken: string }).accessToken.length > 0 &&
    (input as { accessToken: string }).accessToken.length <= 16_384
  );
}

const validator = (input: unknown): TokenInput => {
  if (!isTokenInput(input)) throw new Error("Invalid logs request.");
  return input;
};

async function authorized(accessToken: string): Promise<boolean> {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return verification.authorized;
}

type ExecResult = { ok: boolean; stdout: string };

async function execFileSafe(
  file: string,
  args: string[],
  timeoutMs: number,
): Promise<ExecResult> {
  try {
    const { execFile } = await import("node:child_process");
    return await new Promise<ExecResult>((resolve) => {
      execFile(file, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout) => {
        resolve({ ok: !err, stdout: typeof stdout === "string" ? stdout : "" });
      });
    });
  } catch {
    return { ok: false, stdout: "" };
  }
}

async function readTextFile(path: string): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function augieHome(): Promise<string | null> {
  try {
    const { homedir } = await import("node:os");
    return homedir();
  } catch {
    return null;
  }
}

export interface ServiceJournalView {
  authorized: boolean;
  available: boolean;
  lines: string[];
}

export const getServiceJournal = createServerFn({ method: "POST" })
  .validator(validator)
  .handler(async ({ data }): Promise<ServiceJournalView> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, available: false, lines: [] };
    }
    const res = await execFileSafe(
      "journalctl",
      ["--user", "-u", "augie.service", "-n", "120", "--no-pager", "-o", "short-iso"],
      6_000,
    );
    if (!res.ok && !res.stdout) return { authorized: true, available: false, lines: [] };
    return {
      authorized: true,
      available: true,
      lines: res.stdout.split("\n").filter((l) => l.trim().length > 0).slice(-120),
    };
  });

export interface UpdateView {
  authorized: boolean;
  available: boolean;
  /** Commit the running build was deployed from, or null if unstamped. */
  current: string | null;
  /** The repo's current HEAD, or null when the check could not run. */
  latest: string | null;
  updateAvailable: boolean | null;
  /** Tail of the updater's own run log. */
  logTail: string[];
  /**
   * The last update run's state, read from the WHOLE run log's marker
   * lines (started / failed at step / complete) — the tail alone can
   * scroll past the start marker while a build is running.
   */
  run: UpdateRunPhase;
}

export const getUpdateView = createServerFn({ method: "POST" })
  .validator(validator)
  .handler(async ({ data }): Promise<UpdateView> => {
    const empty: UpdateView = {
      authorized: false,
      available: false,
      current: null,
      latest: null,
      updateAvailable: null,
      logTail: [],
      run: { phase: "idle" },
    };
    if (!(await authorized(data.accessToken))) return empty;
    const home = await augieHome();
    if (!home) return { ...empty, authorized: true };
    const stamp = await readTextFile(`${home}/augie-app/.augie-version`);
    const current = stamp?.trim().split("\n")[0]?.trim() || null;
    const remote = await execFileSafe(
      "git",
      ["ls-remote", "https://github.com/blackvaultllc/AUGIXVI.git", "HEAD"],
      15_000,
    );
    const latest = remote.ok ? (remote.stdout.trim().split(/\s+/)[0] ?? null) : null;
    const logRaw = await readTextFile(`${home}/.local/share/augie/update-run.log`);
    const logLines = logRaw ? logRaw.split("\n").filter((l) => l.trim()) : [];
    const logTail = logLines.slice(-40);
    return {
      authorized: true,
      available: true,
      current,
      latest,
      updateAvailable:
        current && latest ? !latest.startsWith(current) && !current.startsWith(latest) : null,
      logTail,
      run: deriveUpdateRun(logLines),
    };
  });

export interface UpdateRequestResult {
  authorized: boolean;
  started: boolean;
  reason?: string;
}

export const requestUpdate = createServerFn({ method: "POST" })
  .validator(validator)
  .handler(async ({ data }): Promise<UpdateRequestResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, started: false, reason: "operator session not verified" };
    }
    const home = await augieHome();
    if (!home) return { authorized: true, started: false, reason: "not on the local server" };
    const script = `${home}/augie-app/update.sh`;
    const scriptBody = await readTextFile(script);
    if (!scriptBody) {
      return {
        authorized: true,
        started: false,
        reason: "the update script (~/augie-app/update.sh) is not installed on this machine",
      };
    }
    // One run at a time: a run whose start marker is the log's last
    // word and whose log is still fresh is a run in progress — a
    // second spawn would race it over the same tree. A stale marker
    // (a run cut off by a power loss, hours old) does not block: the
    // new run's own start line supersedes it in the log.
    const runLogPath = `${home}/.local/share/augie/update-run.log`;
    const runLogRaw = await readTextFile(runLogPath);
    if (runLogRaw && deriveUpdateRun(runLogRaw.split("\n")).phase === "running") {
      let fresh = false;
      try {
        const { stat } = await import("node:fs/promises");
        fresh = Date.now() - (await stat(runLogPath)).mtimeMs < 30 * 60 * 1000;
      } catch {
        fresh = false;
      }
      if (fresh) {
        return {
          authorized: true,
          started: false,
          reason: "an update is already running — let it finish and read its result",
        };
      }
    }
    try {
      const { spawn } = await import("node:child_process");
      const { appendFile, mkdir } = await import("node:fs/promises");
      await mkdir(`${home}/.local/share/augie`, { recursive: true });
      await appendFile(
        `${home}/.local/share/augie/update-log.jsonl`,
        JSON.stringify({ ts: new Date().toISOString(), event: "apply-requested" }) + "\n",
        "utf8",
      );
      const child = spawn("bash", [script], { detached: true, stdio: "ignore" });
      child.unref();
      return { authorized: true, started: true };
    } catch {
      return { authorized: true, started: false, reason: "the update could not be started" };
    }
  });
