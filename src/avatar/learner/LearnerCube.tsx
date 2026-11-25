/**
 * HER CUBE — Khadija's own cube, in her own space (the Captain's
 * order 2026-11-25: "in her area give her a cube as well — she can
 * go ahead and decipher the cube and let her have that logical
 * aspect").
 *
 * Not Daddy's HEXO — hers. A friendly cube she can turn with big
 * buttons, with a picture on every face. She can just explore it,
 * mix it up, or play Find That Face: the page names a face, she
 * turns the cube until that face is looking at her, and taps it.
 * No timers, no points to lose, no wrong answers — turning the cube
 * and working out which way to turn IS the logic, and every find
 * earns a star because she figured it out.
 *
 * Her final say governs her space: if she doesn't like it, it comes
 * off on her word.
 */
import { useMemo, useState } from "react";
import {
  Bird,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Flower2,
  Gem,
  Heart,
  Rainbow,
  Shuffle,
  Sparkles,
  Star,
} from "lucide-react";

export interface CubeFace {
  name: string;
  color: string;
  /** Cube-local normal in CSS coordinates (y points down). */
  normal: [number, number, number];
  /** The face's own placement on the cube. */
  placement: string;
  Icon: typeof Star;
}

const HALF = 90; // px — the cube is 180px wide

export const CUBE_FACES: CubeFace[] = [
  {
    name: "Star",
    color: "#ffd23f",
    normal: [0, 0, 1],
    placement: `translateZ(${HALF}px)`,
    Icon: Star,
  },
  {
    name: "Flower",
    color: "#ff8fc7",
    normal: [1, 0, 0],
    placement: `rotateY(90deg) translateZ(${HALF}px)`,
    Icon: Flower2,
  },
  {
    name: "Bird",
    color: "#b79cff",
    normal: [0, 0, -1],
    placement: `rotateY(180deg) translateZ(${HALF}px)`,
    Icon: Bird,
  },
  {
    name: "Rainbow",
    color: "#6ecbff",
    normal: [-1, 0, 0],
    placement: `rotateY(-90deg) translateZ(${HALF}px)`,
    Icon: Rainbow,
  },
  {
    name: "Gem",
    color: "#7fe3c0",
    normal: [0, -1, 0],
    placement: `rotateX(90deg) translateZ(${HALF}px)`,
    Icon: Gem,
  },
  {
    name: "Heart",
    color: "#ff7b7b",
    normal: [0, 1, 0],
    placement: `rotateX(-90deg) translateZ(${HALF}px)`,
    Icon: Heart,
  },
];

/**
 * Which face is looking at her, for a cube shown with
 * `rotateX(rx) rotateY(ry)` — the same math the browser applies
 * (matrix Rx·Ry, normals in CSS coordinates). Exported for tests.
 */
export function frontFaceIndex(rxDeg: number, ryDeg: number): number {
  const rx = (rxDeg * Math.PI) / 180;
  const ry = (ryDeg * Math.PI) / 180;
  let best = 0;
  let bestZ = -Infinity;
  CUBE_FACES.forEach((face, index) => {
    const [x, y, z] = face.normal;
    // Ry first (rightmost in the CSS transform list)…
    const x1 = x * Math.cos(ry) + z * Math.sin(ry);
    const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
    // …then Rx.
    const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
    const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
    void x1;
    void y2;
    if (z2 > bestZ) {
      bestZ = z2;
      best = index;
    }
  });
  return best;
}

export function LearnerCube() {
  const [rx, setRx] = useState(0);
  const [ry, setRy] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const [stars, setStars] = useState(0);
  const [line, setLine] = useState("Turn the cube and see every face. Tap a face to learn its name!");

  const front = useMemo(() => frontFaceIndex(rx, ry), [rx, ry]);

  function tapFace(index: number) {
    const face = CUBE_FACES[index];
    if (!face) return;
    if (target !== null && index === target && index === front) {
      setStars((n) => n + 1);
      setTarget(null);
      setLine(`You found the ${face.name}! You turned the cube just right. Pick "Find a face" to play again!`);
      return;
    }
    setLine(`That's the ${face.name} face!`);
  }

  function startFind() {
    let pick = Math.floor(Math.random() * CUBE_FACES.length);
    if (pick === front) pick = (pick + 1) % CUBE_FACES.length;
    const face = CUBE_FACES[pick];
    if (!face) return;
    setTarget(pick);
    setLine(`Can you find the ${face.name}? Turn the cube until the ${face.name} is looking at you, then tap it!`);
  }

  function mixUp() {
    setRx((v) => v + 360 + 90 * Math.floor(Math.random() * 4));
    setRy((v) => v + 360 + 90 * Math.floor(Math.random() * 4));
    setLine("Mixed up! Turn it and explore — every face is hiding somewhere.");
  }

  return (
    <div className="learner-cube">
      <h2>My Cube</h2>
      <p className="learner-cube__line" aria-live="polite">
        {line}
      </p>

      <div className="learner-cube__stage">
        <div
          className="learner-cube__cube"
          style={{ transform: `rotateX(${rx}deg) rotateY(${ry}deg)` }}
        >
          {CUBE_FACES.map((face, index) => (
            <button
              key={face.name}
              type="button"
              className="learner-cube__face"
              style={{ transform: face.placement, background: face.color }}
              onClick={() => tapFace(index)}
              aria-label={`${face.name} face`}
            >
              <face.Icon aria-hidden="true" />
              <span>{face.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="learner-cube__turns">
        <button type="button" className="learner-big-button" onClick={() => setRy((v) => v + 90)}>
          <ChevronLeft aria-hidden="true" /> Turn left
        </button>
        <button type="button" className="learner-big-button" onClick={() => setRx((v) => v - 90)}>
          <ChevronUp aria-hidden="true" /> Tip up
        </button>
        <button type="button" className="learner-big-button" onClick={() => setRx((v) => v + 90)}>
          <ChevronDown aria-hidden="true" /> Tip down
        </button>
        <button type="button" className="learner-big-button" onClick={() => setRy((v) => v - 90)}>
          <ChevronRight aria-hidden="true" /> Turn right
        </button>
      </div>

      <div className="learner-cube__play">
        <button type="button" className="learner-big-button" onClick={startFind}>
          <Sparkles aria-hidden="true" /> Find a face
        </button>
        <button type="button" className="learner-big-button" onClick={mixUp}>
          <Shuffle aria-hidden="true" /> Mix it up
        </button>
        <p className="learner-cube__stars">
          <Star aria-hidden="true" fill="currentColor" /> Stars you found: {stars}
        </p>
      </div>
    </div>
  );
}
