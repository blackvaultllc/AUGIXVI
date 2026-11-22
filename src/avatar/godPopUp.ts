/**
 * THE GODS POP UP TO REPORT — placement + attribution (owner order
 * 2026-11-22, restated from his live screen; the same doctrine he
 * set in the AUGI COMMAND line today).
 *
 * No god stays parked on screen to deliver a report. When one has
 * something to say, he POPS UP — his face appears with the anime
 * chat bubble beside his head (the Bellwood standard: cream bubble,
 * tail at the speaker, one short line, typed slow) — he speaks, and
 * he goes. Two laws ride every pop-up:
 *
 * 1. NEVER OVERLAP: the pop-up's whole block — face plus bubble —
 *    is placed where it intersects NO other avatar's ground. The
 *    placement math here is pure and pinned by test.
 * 2. THE CENTER IS HIS TO GIVE: head-center belongs to whoever the
 *    Captain seats there (the medallion/perspective system), never
 *    to a pop-up. A pop-up visits an edge; it does not take a seat.
 *
 * Attribution: a report surfaces through the god whose department
 * it belongs to. Defense and security reports come through Montu,
 * commander of the army; everything else comes through Anubis, in
 * overall command — the face the Captain talks with day to day.
 *
 * Plain TS, no three.js, no DOM — unit-testable per the repo rules.
 */

export type PopUpGodId = "anubis" | "montu";

export interface StageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The pop-up face's diameter, px — big enough to read across the room. */
export const POPUP_FACE_SIZE = 104;
/** The bubble's width, px — one short line, wrapped. */
export const POPUP_BUBBLE_WIDTH = 300;
/** The gap between the face and its bubble, px. */
export const POPUP_GAP = 14;
/** Breathing room kept between the pop-up and any avatar, px. */
export const POPUP_CLEARANCE = 12;
/** The whole pop-up block's width: bubble + gap + face. */
export const POPUP_BLOCK_WIDTH = POPUP_BUBBLE_WIDTH + POPUP_GAP + POPUP_FACE_SIZE;
/** The block's working height (the face plus its name plate). */
export const POPUP_BLOCK_HEIGHT = 148;
/** Bellwood's typing pace: one character every 25 ms. */
export const POPUP_TYPE_MS_PER_CHAR = 25;
/** How long the finished line stays before the god goes, ms. */
export const POPUP_HOLD_MS = 4200;

/** Which god delivers a report on this topic. */
export function godForReportTopic(topic: string): PopUpGodId {
  const words = topic.toLowerCase();
  if (
    words.includes("montu") ||
    words.includes("secur") ||
    words.includes("defen") ||
    words.includes("war") ||
    words.includes("guard")
  ) {
    return "montu";
  }
  return "anubis";
}

export function rectsOverlap(a: StageRect, b: StageRect, clearance = 0): boolean {
  return (
    a.x < b.x + b.w + clearance &&
    a.x + a.w + clearance > b.x &&
    a.y < b.y + b.h + clearance &&
    a.y + a.h + clearance > b.y
  );
}

function overlapArea(a: StageRect, b: StageRect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export type PopUpPlacement = {
  /** The pop-up block's top-left on the stage. */
  x: number;
  y: number;
  /** Which side of the face the bubble sits on — the tail points back at him. */
  bubbleSide: "left" | "right";
};

/**
 * Place a pop-up block on the stage where it overlaps NO occupied
 * rect. Candidate grounds are tried in order — the lower right
 * (the reporting corner), the lower left, mid-right, mid-left, and
 * the lower center-right — each clamped inside the stage. The
 * first ground that clears every avatar wins; when every ground
 * collides (a stage crowded wall to wall), the ground with the
 * least total overlap is returned, so the pop-up still lands as
 * clear as the stage allows. The bubble sits on the side away
 * from the stage's nearer edge, its tail at the speaker.
 */
export function placePopUp(
  stage: { w: number; h: number },
  occupied: readonly StageRect[],
): PopUpPlacement {
  const bw = Math.min(POPUP_BLOCK_WIDTH, Math.max(200, stage.w - 24));
  const bh = POPUP_BLOCK_HEIGHT;
  const margin = 16;
  const clampX = (x: number) => Math.min(Math.max(margin, x), Math.max(margin, stage.w - bw - margin));
  const clampY = (y: number) => Math.min(Math.max(margin, y), Math.max(margin, stage.h - bh - margin));
  const candidates: { x: number; y: number }[] = [
    { x: stage.w - bw - margin, y: stage.h - bh - 120 }, // lower right, above the toolbar
    { x: margin, y: stage.h - bh - 120 }, // lower left
    { x: stage.w - bw - margin, y: Math.round(stage.h * 0.42) }, // mid right
    { x: margin, y: Math.round(stage.h * 0.42) }, // mid left
    { x: Math.round(stage.w * 0.55), y: stage.h - bh - margin }, // lower center-right
  ];
  let best: PopUpPlacement | null = null;
  let bestOverlap = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const rect: StageRect = { x: clampX(candidate.x), y: clampY(candidate.y), w: bw, h: bh };
    const total = occupied.reduce(
      (sum, other) => sum + (rectsOverlap(rect, other, POPUP_CLEARANCE) ? overlapArea(rect, other) + 1 : 0),
      0,
    );
    const placement: PopUpPlacement = {
      x: rect.x,
      y: rect.y,
      bubbleSide: rect.x + bw / 2 > stage.w / 2 ? "left" : "right",
    };
    if (total === 0) return placement;
    if (total < bestOverlap) {
      bestOverlap = total;
      best = placement;
    }
  }
  return best ?? { x: margin, y: margin, bubbleSide: "right" };
}
