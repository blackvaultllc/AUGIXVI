/**
 * ANNOTATED ANALYSIS — the analyzed picture WITH its findings
 * marked on it, and the numbered list beside it (owner order,
 * 2026-11-23: "draw lines where the things it's talking about is
 * at and number them").
 *
 * Every placed finding gets a numbered disc on the picture, offset
 * from the item itself with a leader line drawn to the item's
 * point and a ring on the point — the disc never covers the thing
 * it names. The list carries the same numbers; hovering or
 * focusing either side lights up both. An unplaced finding draws
 * NOTHING and says so in the list — no marker is ever faked. When
 * the marker pass failed, the list renders plain under a plain
 * note saying so. The whole layer renders under the draft label:
 * the marks are the analyzer's best placement, not ground truth.
 *
 * The figure hugs the picture exactly: its width is capped by the
 * panel AND by a height cap converted through the picture's own
 * aspect (set from the real natural size on load), so there is no
 * void beside or below the picture — the No Empty Gaps law.
 */
import { useState } from "react";
import { ANNOTATION_DRAFT_LABEL, UNPLACED_NOTE, type PlacedFinding } from "./analysisAnnotations";
import { verdictAt, verdictLabel, type FindingVerdict } from "./secondLook";

export type MarksMode =
  /** The placement pass answered; placed items carry points. */
  | "placed"
  /** The placement pass failed — plain list, said plainly. */
  | "failed"
  /** The placement pass is still running. */
  | "pending";

/** Grid-space offset from an item's point to its number disc —
 *  pushed toward the picture's middle so the disc stays in frame
 *  and off the item. In 0–1000 grid units. */
function discPosition(point: { x: number; y: number }): { cx: number; cy: number } {
  const dx = point.x <= 500 ? 110 : -110;
  const dy = point.y <= 500 ? 110 : -110;
  return {
    cx: Math.min(960, Math.max(40, point.x + dx)),
    cy: Math.min(960, Math.max(40, point.y + dy)),
  };
}

export function AnnotatedAnalysis({
  src,
  alt,
  items,
  marksMode,
  failureNote,
  verdicts,
  secondLookNote,
}: {
  src: string;
  alt: string;
  /** Findings with placements (points null in failed/pending mode). */
  items: PlacedFinding[];
  marksMode: MarksMode;
  /** The plain-words note for failed mode (fallback or partial). */
  failureNote?: string;
  /** THE SECOND LOOK's verdicts (cybernetic pass, 2026-11-26),
   *  aligned with items by index — saved with the analysis, so
   *  the stamps here are the stamps the pass earned. */
  verdicts?: FindingVerdict[] | undefined;
  /** The second look's standing line: checking…, or the
   *  FIRST PASS ONLY label when the pass could not run. */
  secondLookNote?: string | undefined;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const placedCount = items.filter((item) => item.point !== null).length;
  const showMarks = marksMode === "placed" && placedCount > 0;

  const figureStyle: React.CSSProperties = natural
    ? { width: `min(100%, ${(68 * natural.w) / natural.h}vh)` }
    : { width: "100%" };

  return (
    <div className="analyzer-annotated">
      <figure className="analyzer-figure" style={figureStyle}>
        <img
          className="analyzer-figure__img"
          src={src}
          alt={alt}
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              setNatural({ w: img.naturalWidth, h: img.naturalHeight });
            }
          }}
        />
        {showMarks && (
          <>
            <svg
              className="analyzer-figure__lines"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {items.map((item, index) => {
                if (!item.point) return null;
                const { cx, cy } = discPosition(item.point);
                return (
                  <g
                    key={`line-${index}`}
                    className={
                      active === index
                        ? "analyzer-figure__leader analyzer-figure__leader--active"
                        : "analyzer-figure__leader"
                    }
                  >
                    <line x1={item.point.x} y1={item.point.y} x2={cx} y2={cy} />
                    <circle cx={item.point.x} cy={item.point.y} r="14" />
                  </g>
                );
              })}
            </svg>
            {items.map((item, index) => {
              if (!item.point) return null;
              const { cx, cy } = discPosition(item.point);
              return (
                <button
                  key={`mark-${index}`}
                  type="button"
                  className={
                    active === index ? "analyzer-marker analyzer-marker--active" : "analyzer-marker"
                  }
                  style={{ left: `${cx / 10}%`, top: `${cy / 10}%` }}
                  aria-label={`Finding ${index + 1}: ${item.text}`}
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                >
                  {index + 1}
                </button>
              );
            })}
          </>
        )}
      </figure>

      <div className="analyzer-findings">
        {showMarks && <p className="analyzer-draft-label">{ANNOTATION_DRAFT_LABEL}</p>}
        {marksMode === "failed" && failureNote && (
          <p className="analyzer-draft-label">{failureNote}</p>
        )}
        {marksMode === "pending" && (
          <p className="analyzer-draft-label" role="status">
            Marking the things found on the picture…
          </p>
        )}
        {secondLookNote && (
          <p className="analyzer-draft-label" role="status">
            {secondLookNote}
          </p>
        )}
        {verdicts && (
          <p className="analyzer-draft-label">
            Second look: VERIFIED means the check confirmed the finding; NOT CONFIRMED stays on
            the record, dimmed — it is not a fact.
          </p>
        )}
        <ol className="analyzer-findings__list">
          {items.map((item, index) => {
            const verdict = verdicts ? verdictAt(verdicts, index) : null;
            return (
              <li
                key={`${index}-${item.text}`}
                className={
                  (active === index
                    ? "analyzer-findings__item analyzer-findings__item--active"
                    : "analyzer-findings__item") +
                  (verdict === "not-confirmed" ? " analyzer-findings__item--not-confirmed" : "")
                }
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
              >
                <span className="analyzer-findings__num" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="analyzer-findings__text">
                  {item.text}
                  {marksMode === "placed" && item.point === null && (
                    <span className="analyzer-findings__unplaced"> — {UNPLACED_NOTE}</span>
                  )}
                  {verdict && (
                    <span className="analyzer-findings__stamp"> — {verdictLabel(verdict)}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
