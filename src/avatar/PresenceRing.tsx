/**
 * THE PRESENCE RING (owner order 2026-11-26, the circuit-ring
 * theme): the segmented ring gauge that stands around the front
 * god's medallion — picture 4's circular ring, made ours. It is
 * drawn here as plain SVG arcs, our own geometry; the readings
 * it shows come from presenceRing.ts, which derives them from
 * the god's REAL state and nothing else. The ring is a gauge of
 * presence, never a meter: it says which state he is in, and it
 * invents no numbers.
 *
 * The ring renders as a SIBLING of the medallion's face, never
 * inside it — the face is the god's own portrait raster, and no
 * SVG ever stands in for it (the standing test pin).
 */
import { RING_SEGMENT_COUNT, ringPresenceState, ringSegments, type RingSignals } from "./presenceRing";

const CENTER = 50;
const RADIUS = 45.5;
const SEGMENT_STEP = 360 / RING_SEGMENT_COUNT;
/** Each segment's arc, with the gap between segments left open. */
const SEGMENT_ARC = SEGMENT_STEP - 3;

function polar(angleDeg: number, radius: number): readonly [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)];
}

function arcPath(startDeg: number, endDeg: number, radius: number): string {
  const [x1, y1] = polar(startDeg, radius);
  const [x2, y2] = polar(endDeg, radius);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function PresenceRing({ ready, speaking, listening, acting }: RingSignals) {
  const state = ringPresenceState({ ready, speaking, listening, acting });
  const segments = ringSegments(state);
  return (
    <svg
      className="presence-ring"
      viewBox="0 0 100 100"
      data-ring-state={state}
      aria-hidden="true"
      focusable="false"
    >
      {/* The tunnel track the segments stand on — the ring's own
          ground, always drawn, carrying no reading. */}
      <circle className="presence-ring__track" cx={CENTER} cy={CENTER} r={RADIUS} />
      {segments.map((segment) => {
        const start = segment.index * SEGMENT_STEP + (SEGMENT_STEP - SEGMENT_ARC) / 2;
        return (
          <path
            key={segment.index}
            className={`presence-ring__seg presence-ring__seg--${segment.tone}`}
            data-tone={segment.tone}
            d={arcPath(start, start + SEGMENT_ARC, RADIUS)}
          />
        );
      })}
    </svg>
  );
}
