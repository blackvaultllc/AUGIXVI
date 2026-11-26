/**
 * SECOND LOOK (cybernetic pass, 2026-11-26 — the survey's Third
 * Eye row): the verification pass over the picture analyzer and
 * the camera analysis. The first pass reads a picture and lists
 * findings; the second look goes back and checks EACH finding on
 * its own — the vision model is asked about one finding at a
 * time, in the dossier's own words: "Is there a [finding] at
 * mark N? Answer only yes or no, and what exactly do you see
 * there?"
 *
 * THE LAW OF THE SECOND LOOK:
 *   · A finding the second look confirms is stamped VERIFIED.
 *   · A finding it does not confirm is stamped NOT CONFIRMED —
 *     the finding STAYS on the record (dimmed in the list,
 *     stamped), never deleted and never spoken of as fact. The
 *     system's oldest camera lesson stands behind this: the
 *     analyzer invents details, so its unconfirmed words are
 *     marked as exactly that.
 *   · An answer that is not a clear yes counts as NOT CONFIRMED
 *     — a non-answer confirms nothing.
 *   · If the vision model cannot be reached, the pass reports
 *     itself unavailable and the analysis is labeled FIRST PASS
 *     ONLY — no stamps are faked, ever.
 *
 * The verdicts are returned as data and saved WITH the analysis
 * record by the caller, so any later showing of that analysis
 * (the panel, History) shows the same verdicts.
 *
 * Mirrors analysisAnnotations.ts (the placement pass): same
 * brain, same model pick, never throws.
 */
import { pickVisionModel } from "./PictureAnalysis";

export type SecondLookVerdict = "verified" | "not-confirmed";

export interface FindingVerdict {
  /** The finding's own words, exactly as the first pass wrote them. */
  text: string;
  verdict: SecondLookVerdict;
  /** What the model said it sees there, when it answered. */
  seen?: string | undefined;
}

export type SecondLookOutcome =
  | { status: "done"; verdicts: FindingVerdict[] }
  | { status: "unavailable"; reason: string };

/** The per-finding question, in the dossier's words. */
export function secondLookPrompt(finding: string, mark: number): string {
  return (
    `Look at this picture again, carefully. A first reading claimed: "${finding}" (mark ${mark}).\n` +
    `Is there a ${finding} at mark ${mark}? Answer only yes or no, and what exactly do you see there.\n` +
    `Begin your answer with the single word YES or NO, then one short sentence saying exactly what you see there.`
  );
}

/**
 * Read the model's yes/no. Strict on purpose: the answer must
 * BEGIN with yes or no (the prompt demands it); anything else —
 * hedging, a paragraph, an empty answer — confirms nothing and
 * reads as not-confirmed, never as a pass.
 */
export function parseSecondLookAnswer(raw: string): { confirmed: boolean; seen: string } | null {
  const text = raw.trim();
  if (!text) return null;
  const firstWord = /^[A-Za-z]+/.exec(text)?.[0]?.toLowerCase();
  if (firstWord !== "yes" && firstWord !== "no") return null;
  const seen = text
    .replace(/^[A-Za-z]+[\s.:—-]*/, "")
    .trim()
    .slice(0, 300);
  return { confirmed: firstWord === "yes", seen };
}

const SECOND_LOOK_TIMEOUT_MS = 120_000;

/**
 * Run the second look over one analysis's findings. Never
 * throws: a model that cannot be reached at all lands as
 * `{ status: "unavailable" }` (the caller labels the analysis
 * FIRST PASS ONLY); a single finding whose check fails or
 * answers unclearly is stamped NOT CONFIRMED — it was, in fact,
 * not confirmed.
 */
export async function runSecondLook(args: {
  brain: string;
  base64: string;
  findings: string[];
  fetchFn?: typeof fetch;
}): Promise<SecondLookOutcome> {
  const fetchFn = args.fetchFn ?? fetch;
  if (args.findings.length === 0) return { status: "done", verdicts: [] };
  let installed: string[] = [];
  try {
    const res = await fetchFn(`${args.brain}/api/tags`);
    if (!res.ok) throw new Error(`Ollama answered ${res.status}`);
    const data = (await res.json()) as { models?: { name?: string }[] };
    installed = (data.models ?? []).map((m) => m.name).filter((n): n is string => Boolean(n));
  } catch {
    return { status: "unavailable", reason: `the vision model is not answering at ${args.brain}` };
  }
  const model = pickVisionModel(installed);
  if (!model) {
    return { status: "unavailable", reason: "no vision model is installed on the brain" };
  }
  const verdicts: FindingVerdict[] = [];
  for (let index = 0; index < args.findings.length; index++) {
    const finding = args.findings[index]!;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SECOND_LOOK_TIMEOUT_MS);
    try {
      const res = await fetchFn(`${args.brain}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt: secondLookPrompt(finding, index + 1),
          images: [args.base64],
          stream: false,
          options: { num_predict: 120, temperature: 0 },
        }),
      });
      if (!res.ok) throw new Error(`the vision model answered ${res.status}`);
      const data = (await res.json()) as { response?: string };
      const parsed = parseSecondLookAnswer((data.response ?? "").trim());
      if (!parsed) {
        verdicts.push({ text: finding, verdict: "not-confirmed" });
      } else {
        verdicts.push({
          text: finding,
          verdict: parsed.confirmed ? "verified" : "not-confirmed",
          seen: parsed.seen || undefined,
        });
      }
    } catch {
      // This finding's check could not complete — it stands
      // NOT CONFIRMED, which is the plain truth about it. If the
      // FIRST finding already failed this way, the model is not
      // reachable in practice: report the whole pass unavailable
      // so the analysis is labeled FIRST PASS ONLY instead.
      if (index === 0) {
        return {
          status: "unavailable",
          reason: "the vision model could not be reached for the second look",
        };
      }
      verdicts.push({ text: finding, verdict: "not-confirmed" });
    } finally {
      clearTimeout(timer);
    }
  }
  return { status: "done", verdicts };
}

/** The verdict standing on one finding, by its place in the list. */
export function verdictAt(
  verdicts: FindingVerdict[] | undefined,
  index: number,
): SecondLookVerdict | null {
  return verdicts?.[index]?.verdict ?? null;
}

/** The stamp a verdict wears in the list, in plain words. */
export function verdictLabel(verdict: SecondLookVerdict): string {
  return verdict === "verified" ? "VERIFIED" : "NOT CONFIRMED";
}
