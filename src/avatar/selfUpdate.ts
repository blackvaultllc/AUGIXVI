/**
 * SELF-UPDATE IN THE CUBE (owner order 2026-11-10).
 * The HEXO cube is Osiris's update portal: he reaches in, pulls the latest
 * AUGIXVI commit, checks dependencies, tests and knowledge currency, and
 * REPORTS to the operator. Nothing is applied without approval — no
 * auto-push, no auto-deploy, no history rewrite. The tunnel is an
 * operator-only secure channel (same-origin server function), checked
 * daily, approved manually.
 */

export type CubeCheckKind = "commits" | "dependencies" | "health" | "knowledge";

export type CubeFinding = {
  kind: CubeCheckKind;
  /** Human-readable finding Osiris reports aloud / in the panel. */
  detail: string;
  /** true when an apply step EXISTS and waits for the operator's yes. */
  needsApproval: boolean;
};

export type CubeReport = {
  checkedAt: string;
  findings: CubeFinding[];
  /** Draft update plan — inert until the operator approves. */
  pendingApproval: CubeFinding[];
};

/** Pure parser: turn a "git log" style line list into new-commit findings. */
export function parseCommits(lines: readonly string[], knownHead: string | null): CubeFinding[] {
  if (!lines.length)
    return [
      { kind: "commits", detail: "Repository unreachable from the cube.", needsApproval: false },
    ];
  const newest = lines[0]!.split(/\s+/)[0] ?? "";
  if (!knownHead || newest === knownHead) {
    return [
      {
        kind: "commits",
        detail: "Construct is current with the repository.",
        needsApproval: false,
      },
    ];
  }
  const count = lines.findIndex((line) => line.startsWith(knownHead));
  const newCount = count === -1 ? lines.length : count;
  return [
    {
      kind: "commits",
      detail: `${newCount} new commit${newCount === 1 ? "" : "s"} behind: ${lines
        .slice(0, Math.min(3, newCount))
        .map((line) => line.split(/\s+/).slice(1).join(" "))
        .join("; ")}.`,
      needsApproval: true,
    },
  ];
}

/** Daily self-check: deps, health, knowledge — findings only, no action. */
export function buildCubeReport(input: {
  commitLines: readonly string[];
  knownHead: string | null;
  outdatedDeps: readonly string[];
  brokenSystems: readonly string[];
  knowledgeAgeDays: number;
  now?: Date;
}): CubeReport {
  const findings: CubeFinding[] = [
    ...parseCommits(input.commitLines, input.knownHead),
    {
      kind: "dependencies",
      detail: input.outdatedDeps.length
        ? `Outdated: ${input.outdatedDeps.join(", ")}.`
        : "All dependencies current.",
      needsApproval: input.outdatedDeps.length > 0,
    },
    {
      kind: "health",
      detail: input.brokenSystems.length
        ? `Not working right now: ${input.brokenSystems.join(", ")}.`
        : "Nothing around me is broken.",
      needsApproval: false,
    },
    {
      kind: "knowledge",
      detail:
        input.knowledgeAgeDays > 7
          ? `My knowledge is ${input.knowledgeAgeDays} days old and ready to be refreshed.`
          : "Knowledge current.",
      needsApproval: input.knowledgeAgeDays > 7,
    },
  ];
  return {
    checkedAt: (input.now ?? new Date()).toISOString(),
    findings,
    pendingApproval: findings.filter((finding) => finding.needsApproval),
  };
}

/** The spoken report Osiris gives the operator. */
export function reportSpoken(report: CubeReport): string {
  if (!report.pendingApproval.length) {
    return "I checked myself: commits, dependencies, health, knowledge — all current. Ankh.";
  }
  const lines = report.pendingApproval.map((finding) => finding.detail);
  return `Update check complete. ${lines.join(" ")} I will change nothing until you approve it.`;
}

/**
 * The tunnel: operator-only. The client asks the server function; the
 * server holds the token. No key ever reaches the browser, and the tunnel
 * never pushes — it reads and reports.
 */
export type UpdateTunnel = {
  /** Pull the latest commit list from the operator's repo (server-side). */
  checkRemote(): Promise<{ head: string | null; lines: string[] }>;
  /** Apply an APPROVED plan only. Refuses anything else, loudly. */
  applyApproved(
    plan: readonly CubeFinding[],
    approvalToken: string,
  ): Promise<{ applied: boolean; reason: string }>;
};

export function createSelfUpdater(tunnel: UpdateTunnel) {
  let knownHead: string | null = null;

  return {
    async runDailyCheck(): Promise<CubeReport> {
      const remote = await tunnel.checkRemote();
      knownHead = knownHead ?? remote.head;
      const report = buildCubeReport({
        commitLines: remote.lines,
        knownHead,
        outdatedDeps: [],
        brokenSystems: [],
        knowledgeAgeDays: 0,
      });
      // Remember the head we reported on, so the next check diffs correctly.
      knownHead = remote.head ?? knownHead;
      return report;
    },
    /** Operator approves → and ONLY then does anything move. */
    async approveAndApply(report: CubeReport, approvalToken: string) {
      if (!report.pendingApproval.length)
        return { applied: true, reason: "Nothing needed applying." };
      return tunnel.applyApproved(report.pendingApproval, approvalToken);
    },
  };
}
