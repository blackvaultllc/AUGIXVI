/**
 * ANALYSIS ANNOTATIONS — the analyzer must MARK what it finds
 * (owner order, 2026-11-23: "it's supposed to draw lines where the
 * things it's talking about is at and number them").
 *
 * The first pass returns words, not coordinates — llava has no
 * built-in pointing. So placement is a REAL second pass: the same
 * vision model is shown the same picture again with the numbered
 * findings list and asked for each item's approximate location on
 * a 0–1000 relative grid (x right, y down), answering with JSON
 * only. The parser is tolerant of the model's habits (code fences,
 * prose around the JSON) but strict about the numbers: an entry
 * counts only when its item number matches a finding and both
 * coordinates are real numbers in range.
 *
 * HONESTY LAW: an item the model does not place stays UNPLACED —
 * the page lists it with a plain "couldn't place this one on the
 * picture" note and draws NO marker. A fake marker would be an
 * invented fact about the room. And when the placement pass itself
 * fails (no answer, no usable JSON), the caller falls back to the
 * plain list and says so — the marks are the analyzer's best
 * placement from its own second look, never ground truth.
 */
import { pickVisionModel } from "./PictureAnalysis";

/** The label the annotation layer renders under. Pinned by test —
 *  the words are the honesty contract for the marks. */
export const ANNOTATION_DRAFT_LABEL =
  "The analyzer's marks — a draft: it can invent details and misplace a mark. Trust the picture, not the words.";

/** The note on a finding the model could not place. Pinned by test. */
export const UNPLACED_NOTE = "couldn't place this one on the picture";

/** The note shown when the placement pass failed outright and the
 *  page fell back to the plain list. Pinned by test. */
export const PLACEMENT_FALLBACK_NOTE =
  "The marker pass didn't answer, so nothing is marked on the picture — this is the plain list.";

/** One finding and where the model placed it, on the 0–1000 grid.
 *  `point: null` is the honest unplaced state — never a guess. */
export type PlacedFinding = {
  text: string;
  point: { x: number; y: number } | null;
};

export type PlacementOutcome =
  { status: "placed"; items: PlacedFinding[] } | { status: "failed"; reason: string };

/** The structured placement prompt: the numbered list goes in, a
 *  JSON array of {n, x, y} comes out — nothing else is asked for. */
export function buildPlacementPrompt(findings: string[]): string {
  const list = findings.map((finding, index) => `${index + 1}. ${finding}`).join("\n");
  return [
    "You are placing items on a picture for Augie's analytic window.",
    "Below is a numbered list of things that were found in this picture.",
    "For each item you can locate, give its approximate center as x and y on a grid",
    "where x runs 0 (left edge) to 1000 (right edge) and y runs 0 (top edge) to 1000 (bottom edge).",
    "Answer with ONLY a JSON array, no other words, like this:",
    '[{"n":1,"x":500,"y":340},{"n":2,"x":120,"y":860}]',
    "Include an item ONLY when you can actually see where it is in the picture.",
    "If you cannot locate an item, leave it out of the array. Never guess a position.",
    "The numbered list:",
    list,
  ].join("\n");
}

function clampGrid(value: number): number {
  return Math.min(1000, Math.max(0, Math.round(value)));
}

/**
 * Split the model's placement answer into per-finding points.
 * Returns null when the answer carries no usable JSON array at all
 * (the pass failed — the caller falls back and says so). Entries
 * with a wrong item number, missing or non-numeric coordinates are
 * dropped; a finding with no surviving entry is unplaced (null),
 * never approximated here.
 */
export function parsePlacements(raw: string, findings: string[]): PlacedFinding[] | null {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const byNumber = new Map<number, { x: number; y: number }>();
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const { n, x, y } = entry as { n?: unknown; x?: unknown; y?: unknown };
    if (typeof n !== "number" || typeof x !== "number" || typeof y !== "number") continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const index = Math.round(n) - 1;
    if (index < 0 || index >= findings.length) continue;
    if (!byNumber.has(index)) byNumber.set(index, { x: clampGrid(x), y: clampGrid(y) });
  }
  return findings.map((text, index) => ({ text, point: byNumber.get(index) ?? null }));
}

/** Placement inference is short-output but the model is CPU-bound;
 *  give it the same honest room as the reading pass. */
const PLACEMENT_TIMEOUT_MS = 120_000;

/**
 * Run the placement pass against the local brain. Never throws:
 * every failure lands as `{ status: "failed", reason }` in plain
 * words so the page can fall back to the plain list and say so.
 */
export async function placeFindings(args: {
  brain: string;
  base64: string;
  findings: string[];
  fetchFn?: typeof fetch;
}): Promise<PlacementOutcome> {
  const fetchFn = args.fetchFn ?? fetch;
  if (args.findings.length === 0) return { status: "placed", items: [] };
  let installed: string[] = [];
  try {
    const res = await fetchFn(`${args.brain}/api/tags`);
    if (!res.ok) throw new Error(`Ollama answered ${res.status}`);
    const data = (await res.json()) as { models?: { name?: string }[] };
    installed = (data.models ?? []).map((m) => m.name).filter((n): n is string => Boolean(n));
  } catch {
    return { status: "failed", reason: `the vision model is not answering at ${args.brain}` };
  }
  const model = pickVisionModel(installed);
  if (!model) return { status: "failed", reason: "no vision model is installed on the brain" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLACEMENT_TIMEOUT_MS);
  try {
    const res = await fetchFn(`${args.brain}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt: buildPlacementPrompt(args.findings),
        images: [args.base64],
        stream: false,
        format: "json",
        options: { num_predict: 400, temperature: 0 },
      }),
    });
    if (!res.ok) {
      return { status: "failed", reason: `the vision model answered ${res.status}` };
    }
    const data = (await res.json()) as { response?: string };
    const raw = (data.response ?? "").trim();
    if (!raw) return { status: "failed", reason: "the vision model returned an empty answer" };
    const items = parsePlacements(raw, args.findings);
    if (!items) {
      return { status: "failed", reason: "the vision model's answer carried no usable placements" };
    }
    return { status: "placed", items };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        status: "failed",
        reason: `the vision model did not finish within ${Math.round(PLACEMENT_TIMEOUT_MS / 1000)} seconds`,
      };
    }
    return {
      status: "failed",
      reason: err instanceof Error ? err.message : "the placement request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
