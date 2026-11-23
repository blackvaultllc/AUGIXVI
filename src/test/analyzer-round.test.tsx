import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ANNOTATION_DRAFT_LABEL,
  PLACEMENT_FALLBACK_NOTE,
  UNPLACED_NOTE,
  buildPlacementPrompt,
  parsePlacements,
  placeFindings,
  type PlacedFinding,
} from "@/avatar/analysisAnnotations";
import { AnnotatedAnalysis } from "@/avatar/AnnotatedAnalysis";
import { orientedSize, orientationPlan, readExifOrientation } from "@/avatar/imageOrientation";

/**
 * ANALYZER ROUND (owner order 2026-11-23, from his live screenshot
 * of the Picture Analysis page): three defects pinned —
 * (1) the analyzed picture rendered small beside a void: the old
 *     40vh cap is gone and the figure hugs the picture;
 * (2) the analyzer must MARK what it finds, numbered, with lines —
 *     from a real second placement pass; unplaced items stay
 *     unmarked and say so; a failed pass falls back plainly;
 * (3) an uploaded photo arrived sideways: EXIF orientation is read
 *     from the file's own bytes and honored.
 */

const BRAIN = "http://brain.test";
const FINDINGS = ["computer monitor", "desk", "a mug"];

/* ---------------- orientation fixtures ---------------- */

/** A minimal JPEG carrying one EXIF orientation tag — the shape a
 *  phone photo actually arrives in. */
function jpegWithOrientation(orientation: number, endian: "II" | "MM" = "II"): Uint8Array {
  const le = endian === "II";
  const u16 = (v: number): number[] =>
    le ? [v & 0xff, (v >> 8) & 0xff] : [(v >> 8) & 0xff, v & 0xff];
  const u32 = (v: number): number[] =>
    le
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]
      : [(v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  const tiff = [
    ...(le ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...u16(42),
    ...u32(8),
    ...u16(1),
    ...u16(0x0112),
    ...u16(3),
    ...u32(1),
    ...u16(orientation),
    ...u16(0),
    ...u32(0),
  ];
  const segment = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const len = segment.length + 2;
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    (len >> 8) & 0xff,
    len & 0xff,
    ...segment,
    0xff,
    0xd9,
  ]);
}

describe("EXIF orientation — the sideways-photo fix", () => {
  it("reads the orientation mark from a rotated phone photo (6, little-endian)", () => {
    expect(readExifOrientation(jpegWithOrientation(6))).toBe(6);
  });

  it("reads the mark big-endian too", () => {
    expect(readExifOrientation(jpegWithOrientation(3, "MM"))).toBe(3);
  });

  it("a JPEG with no EXIF and a PNG carry no mark — they pass through untouched", () => {
    expect(readExifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
    expect(
      readExifOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBeNull();
    expect(readExifOrientation(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("the plan for 6 turns a quarter turn and swaps the axes; 1 is the identity", () => {
    expect(orientationPlan(6)).toEqual({ rotateDeg: 90, flipHorizontal: false, swapsAxes: true });
    expect(orientationPlan(8)).toEqual({ rotateDeg: 270, flipHorizontal: false, swapsAxes: true });
    expect(orientationPlan(1)).toEqual({ rotateDeg: 0, flipHorizontal: false, swapsAxes: false });
    expect(orientationPlan(2)).toEqual({ rotateDeg: 0, flipHorizontal: true, swapsAxes: false });
    expect(orientedSize(orientationPlan(6), 4000, 3000)).toEqual({ width: 3000, height: 4000 });
    expect(orientedSize(orientationPlan(3), 4000, 3000)).toEqual({ width: 4000, height: 3000 });
  });
});

/* ---------------- placement parsing ---------------- */

describe("parsePlacements — the model's grid answer, split honestly", () => {
  it("matches placements to findings by number", () => {
    const items = parsePlacements(
      '[{"n":1,"x":500,"y":340},{"n":2,"x":120,"y":860},{"n":3,"x":700,"y":200}]',
      FINDINGS,
    );
    expect(items).toEqual([
      { text: "computer monitor", point: { x: 500, y: 340 } },
      { text: "desk", point: { x: 120, y: 860 } },
      { text: "a mug", point: { x: 700, y: 200 } },
    ]);
  });

  it("survives the model's habits: code fences and prose around the JSON", () => {
    const items = parsePlacements(
      'Here are the placements:\n```json\n[{"n":2,"x":300,"y":300}]\n```',
      FINDINGS,
    );
    expect(items?.[1]).toEqual({ text: "desk", point: { x: 300, y: 300 } });
    expect(items?.[0]?.point).toBeNull();
    expect(items?.[2]?.point).toBeNull();
  });

  it("an item the model leaves out stays UNPLACED — never approximated", () => {
    const items = parsePlacements('[{"n":1,"x":10,"y":10}]', FINDINGS);
    expect(items?.[0]?.point).toEqual({ x: 10, y: 10 });
    expect(items?.[1]?.point).toBeNull();
    expect(items?.[2]?.point).toBeNull();
  });

  it("drops bad entries: wrong numbers, non-numeric coordinates; clamps to the grid", () => {
    const items = parsePlacements(
      '[{"n":9,"x":1,"y":1},{"n":1,"x":"left","y":5},{"n":2,"x":1400,"y":-20}]',
      FINDINGS,
    );
    expect(items?.[0]?.point).toBeNull();
    expect(items?.[1]?.point).toEqual({ x: 1000, y: 0 });
  });

  it("an empty array is a successful pass that placed nothing — not a failure", () => {
    const items = parsePlacements("[]", FINDINGS);
    expect(items).toHaveLength(3);
    expect(items?.every((item) => item.point === null)).toBe(true);
  });

  it("no usable JSON at all means the pass failed (null) — the page falls back", () => {
    expect(parsePlacements("I could not locate the items.", FINDINGS)).toBeNull();
    expect(parsePlacements('[{"n":1,"x":]', FINDINGS)).toBeNull();
  });
});

/* ---------------- the placement pass itself ---------------- */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function routedFetch(generate: Response | Error) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(init ? { url, init } : { url });
    if (url.endsWith("/api/tags")) {
      return jsonResponse({ models: [{ name: "llama3.1:8b" }, { name: "llava:7b" }] });
    }
    if (url.endsWith("/api/generate")) {
      if (generate instanceof Error) throw generate;
      return generate;
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
  return { calls, fetchFn };
}

describe("placeFindings — the second pass over the same picture", () => {
  it("sends the same image with the numbered list and reads the grid back", async () => {
    const { calls, fetchFn } = routedFetch(
      jsonResponse({ response: '[{"n":1,"x":500,"y":340},{"n":3,"x":700,"y":200}]' }),
    );
    const outcome = await placeFindings({
      brain: BRAIN,
      base64: "QUJD",
      findings: FINDINGS,
      fetchFn,
    });
    expect(outcome.status).toBe("placed");
    if (outcome.status === "placed") {
      expect(outcome.items[0]?.point).toEqual({ x: 500, y: 340 });
      expect(outcome.items[1]?.point).toBeNull();
      expect(outcome.items[2]?.point).toEqual({ x: 700, y: 200 });
    }
    const body = JSON.parse(String(calls[1]!.init?.body)) as {
      model: string;
      images: string[];
      prompt: string;
      format?: string;
    };
    expect(body.model).toBe("llava:7b");
    expect(body.images).toEqual(["QUJD"]);
    expect(body.format).toBe("json");
    expect(body.prompt).toContain("1. computer monitor");
    expect(body.prompt).toContain("3. a mug");
  });

  it("the prompt names the grid and forbids guessing", () => {
    const prompt = buildPlacementPrompt(FINDINGS);
    expect(prompt).toContain("0 (left edge) to 1000 (right edge)");
    expect(prompt).toContain("Never guess a position");
  });

  it("a model error is a failed pass in plain words, never a throw", async () => {
    const { fetchFn } = routedFetch(new Response("boom", { status: 500 }));
    const outcome = await placeFindings({
      brain: BRAIN,
      base64: "QUJD",
      findings: FINDINGS,
      fetchFn,
    });
    expect(outcome.status).toBe("failed");
  });

  it("an answer with no usable placements is a failed pass", async () => {
    const { fetchFn } = routedFetch(jsonResponse({ response: "no placements here" }));
    const outcome = await placeFindings({
      brain: BRAIN,
      base64: "QUJD",
      findings: FINDINGS,
      fetchFn,
    });
    expect(outcome.status).toBe("failed");
  });
});

/* ---------------- the annotated rendering ---------------- */

const PLACED_ITEMS: PlacedFinding[] = [
  { text: "computer monitor", point: { x: 200, y: 300 } },
  { text: "desk", point: { x: 700, y: 600 } },
  { text: "car keys", point: null },
];

describe("AnnotatedAnalysis — numbers on the list are numbers on the picture", () => {
  it("placed findings get numbered markers + leader lines; the unplaced one gets words, no marker", () => {
    const { container } = render(
      <AnnotatedAnalysis
        src="data:image/jpeg;base64,QUJD"
        alt="fixture"
        items={PLACED_ITEMS}
        marksMode="placed"
      />,
    );
    // Two markers, numbered to match the list — and no third marker.
    expect(screen.getByRole("button", { name: "Finding 1: computer monitor" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finding 2: desk" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Finding 3/ })).toBeNull();
    // Two leader lines with their target rings.
    expect(container.querySelectorAll(".analyzer-figure__leader line")).toHaveLength(2);
    expect(container.querySelectorAll(".analyzer-figure__leader circle")).toHaveLength(2);
    // The list is numbered the same way, and the unplaced item says so.
    const nums = [...container.querySelectorAll(".analyzer-findings__num")].map(
      (el) => el.textContent,
    );
    expect(nums).toEqual(["1", "2", "3"]);
    expect(container.textContent).toContain(`car keys — ${UNPLACED_NOTE}`);
    // The whole layer carries the draft label.
    expect(container.textContent).toContain(ANNOTATION_DRAFT_LABEL);
  });

  it("hovering a list item lights its marker, and the marker lights the item", () => {
    const { container } = render(
      <AnnotatedAnalysis
        src="data:image/jpeg;base64,QUJD"
        alt="fixture"
        items={PLACED_ITEMS}
        marksMode="placed"
      />,
    );
    const firstItem = container.querySelectorAll(".analyzer-findings__item")[0]!;
    fireEvent.mouseEnter(firstItem);
    expect(
      screen
        .getByRole("button", { name: "Finding 1: computer monitor" })
        .classList.contains("analyzer-marker--active"),
    ).toBe(true);
    fireEvent.mouseLeave(firstItem);
    const secondMarker = screen.getByRole("button", { name: "Finding 2: desk" });
    fireEvent.mouseEnter(secondMarker);
    expect(
      container
        .querySelectorAll(".analyzer-findings__item")[1]!
        .classList.contains("analyzer-findings__item--active"),
    ).toBe(true);
  });

  it("a failed pass renders the plain list under the fallback note — no marks, no fake notes", () => {
    const { container } = render(
      <AnnotatedAnalysis
        src="data:image/jpeg;base64,QUJD"
        alt="fixture"
        items={PLACED_ITEMS.map((item) => ({ ...item, point: null }))}
        marksMode="failed"
        failureNote={PLACEMENT_FALLBACK_NOTE}
      />,
    );
    expect(container.textContent).toContain(PLACEMENT_FALLBACK_NOTE);
    expect(container.querySelectorAll(".analyzer-marker")).toHaveLength(0);
    expect(container.querySelectorAll(".analyzer-figure__leader")).toHaveLength(0);
    expect(container.textContent).not.toContain(UNPLACED_NOTE);
    expect(container.textContent).toContain("car keys");
  });

  it("while the pass runs, the list is plain and says it is marking", () => {
    const { container } = render(
      <AnnotatedAnalysis
        src="data:image/jpeg;base64,QUJD"
        alt="fixture"
        items={PLACED_ITEMS.map((item) => ({ ...item, point: null }))}
        marksMode="pending"
      />,
    );
    expect(container.textContent).toContain("Marking the things found on the picture…");
    expect(container.querySelectorAll(".analyzer-marker")).toHaveLength(0);
  });
});

/* ---------------- pinned copy + layout pins ---------------- */

describe("the honesty copy is pinned", () => {
  it("matches the contract word for word", () => {
    expect(ANNOTATION_DRAFT_LABEL).toBe(
      "The analyzer's marks — a draft: it can invent details and misplace a mark. Trust the picture, not the words.",
    );
    expect(UNPLACED_NOTE).toBe("couldn't place this one on the picture");
    expect(PLACEMENT_FALLBACK_NOTE).toBe(
      "The marker pass didn't answer, so nothing is marked on the picture — this is the plain list.",
    );
  });
});

describe("layout pins — the picture is the main feature, no void", () => {
  const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  const panelSource = readFileSync(
    resolve(process.cwd(), "src/avatar/PictureAnalysis.tsx"),
    "utf8",
  );

  it("the old 40vh cap that shrank the picture beside a void is gone", () => {
    expect(panelSource).not.toContain('maxHeight: "40vh"');
  });

  it("the figure hugs the picture: full-width image, aspect-capped inline width", () => {
    expect(css).toContain(".analyzer-figure {");
    expect(css).toMatch(/\.analyzer-figure__img\s*\{[^}]*width:\s*100%/);
    expect(panelSource).toContain("68 * natural.w");
    // The annotated figure uses the same hug — one figure law.
    const annotatedSource = readFileSync(
      resolve(process.cwd(), "src/avatar/AnnotatedAnalysis.tsx"),
      "utf8",
    );
    expect(annotatedSource).toContain("68 * natural.w");
  });

  it("markers and the numbered list carry real bifocal sizes", () => {
    expect(css).toMatch(/\.analyzer-marker\s*\{[^}]*font-size:\s*15px/);
    expect(css).toMatch(/\.analyzer-draft-label\s*\{[^}]*font-size:\s*0\.95rem/);
  });
});
