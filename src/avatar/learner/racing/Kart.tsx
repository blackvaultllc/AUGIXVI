/**
 * THE KART — a cute movie-style kart drawn in pure SVG (no external
 * assets): big windshield eyes like the Cars movies, a little driver
 * behind the glass, and chunky kart wheels like a Mario kart. Pit
 * stop upgrades are VISIBLE on the car: spoiler, turbo pod, engine
 * scoop, golden wheels. When the car is boosting (or on NOS), the
 * exhaust flame shows; when it is slowed after a wrong answer,
 * soft gray puffs roll out instead.
 */

export interface CarStyle {
  id: string;
  name: string;
}

export interface CarColor {
  id: string;
  name: string;
  hex: string;
}

export interface Driver {
  id: string;
  name: string;
  skin: string;
  helmet: string;
}

export const CAR_STYLES: CarStyle[] = [
  { id: "kart", name: "Speedy Kart" },
  { id: "truck", name: "Tiny Truck" },
  { id: "buggy", name: "Bubble Buggy" },
  { id: "rocket", name: "Rocket Racer" },
];

export const CAR_COLORS: CarColor[] = [
  { id: "red", name: "Red", hex: "#ef476f" },
  { id: "blue", name: "Blue", hex: "#118ab2" },
  { id: "green", name: "Green", hex: "#06d6a0" },
  { id: "purple", name: "Purple", hex: "#9b5de5" },
  { id: "orange", name: "Orange", hex: "#f4842c" },
  { id: "pink", name: "Pink", hex: "#ff8fab" },
];

export const DRIVERS: Driver[] = [
  { id: "star", name: "Star", skin: "#8d5524", helmet: "#ffb703" },
  { id: "comet", name: "Comet", skin: "#f1c27d", helmet: "#4361ee" },
  { id: "ruby", name: "Ruby", skin: "#ffdbac", helmet: "#ef476f" },
  { id: "bolt", name: "Bolt", skin: "#6b4423", helmet: "#06d6a0" },
];

export interface KartUpgrades {
  turbo: boolean;
  engine: boolean;
  spoiler: boolean;
  goldenWheels: boolean;
}

export const NO_UPGRADES: KartUpgrades = {
  turbo: false,
  engine: false,
  spoiler: false,
  goldenWheels: false,
};

function BodyPath({ style }: { style: string }) {
  switch (style) {
    case "truck":
      // Little pickup: hood, cab, and a bed at the back.
      return (
        <path
          d="M6 58 L6 44 Q6 38 12 37 L30 35 L38 20 Q39 16 44 16 L62 16 Q66 16 68 20 L74 33 L106 33 Q112 33 112 40 L112 58 Q112 63 106 63 L12 63 Q6 63 6 58 Z"
          fill="currentColor"
        />
      );
    case "buggy":
      // Round bubble buggy.
      return (
        <path
          d="M8 56 Q4 34 30 28 Q40 12 62 12 Q88 12 96 30 Q114 36 112 54 Q111 63 102 63 L16 63 Q9 63 8 56 Z"
          fill="currentColor"
        />
      );
    case "rocket":
      // Sleek pointed rocket racer.
      return (
        <path
          d="M4 52 L26 46 Q52 26 84 24 L104 22 Q114 22 112 34 L108 52 Q107 63 98 63 L14 63 Q5 63 4 52 Z"
          fill="currentColor"
        />
      );
    default:
      // Classic chunky kart.
      return (
        <path
          d="M6 56 L10 40 Q12 33 20 32 L34 30 L42 18 Q44 14 50 14 L66 14 Q71 14 73 18 L80 30 L100 34 Q110 36 111 46 L111 56 Q111 63 103 63 L14 63 Q6 63 6 56 Z"
          fill="currentColor"
        />
      );
  }
}

export function Kart({
  style,
  color,
  driver,
  upgrades = NO_UPGRADES,
  boosting = false,
  slowing = false,
  title,
}: {
  style: string;
  color: string;
  driver: Driver;
  upgrades?: KartUpgrades;
  boosting?: boolean;
  /** Slowed after a wrong answer: soft gray puffs at the exhaust,
   *  the gentle opposite of the boost flame. */
  slowing?: boolean;
  title: string;
}) {
  const wheelFill = upgrades.goldenWheels ? "#ffb703" : "#2b2320";
  const wheelR = upgrades.goldenWheels ? 11 : 10;
  return (
    <svg viewBox="0 0 120 84" role="img" aria-label={title} className="racing-kart">
      {/* exhaust flame when boosting / on NOS */}
      {boosting && (
        <g aria-hidden="true">
          <path
            d="M2 56 L-14 50 L-6 58 L-14 64 L3 62 Z"
            fill="#ff8500"
            transform="translate(8 0)"
          />
          <path d="M4 57 L-6 53 L-2 58 L-6 62 L5 61 Z" fill="#ffd60a" transform="translate(6 0)" />
        </g>
      )}
      {/* soft gray puffs when slowed — the car is rolling slower */}
      {slowing && !boosting && (
        <g aria-hidden="true" fill="#adb5bd">
          <circle cx="0" cy="58" r="5" opacity="0.85" />
          <circle cx="-9" cy="53" r="7" opacity="0.55" />
          <circle cx="-19" cy="58" r="9" opacity="0.32" />
        </g>
      )}
      {/* ground shadow */}
      <ellipse cx="60" cy="76" rx="50" ry="5" fill="rgb(0 0 0 / 18%)" />
      {/* spoiler */}
      {upgrades.spoiler && (
        <g aria-hidden="true">
          <rect x="8" y="30" width="5" height="16" fill="#3a2b20" />
          <rect x="0" y="22" width="22" height="8" rx="3" fill="#3a2b20" />
        </g>
      )}
      {/* body */}
      <g style={{ color }}>
        <BodyPath style={style} />
      </g>
      {/* body shading + nose highlight */}
      <path
        d="M10 58 Q60 48 110 56 L110 58 Q110 63 103 63 L16 63 Q9 63 10 58 Z"
        fill="rgb(0 0 0 / 14%)"
      />
      {/* engine scoop */}
      {upgrades.engine && <rect x="88" y="26" width="16" height="8" rx="3" fill="#3a2b20" />}
      {/* turbo pod */}
      {upgrades.turbo && (
        <g aria-hidden="true">
          <rect
            x="16"
            y="38"
            width="14"
            height="9"
            rx="4"
            fill="#adb5bd"
            stroke="#3a2b20"
            strokeWidth="1.5"
          />
          <circle cx="23" cy="42.5" r="3" fill="#4361ee" />
        </g>
      )}
      {/* driver: head + helmet behind the windshield */}
      <circle cx="52" cy="18" r="9" fill={driver.skin} />
      <path d="M43 18 A9 9 0 0 1 61 18 L61 15 A9 9 0 0 0 43 15 Z" fill={driver.helmet} />
      {/* windshield with big Cars-style eyes */}
      <g aria-hidden="true">
        <rect
          x="62"
          y="14"
          width="30"
          height="17"
          rx="7"
          fill="#bde0fe"
          stroke="#3a2b20"
          strokeWidth="1.5"
        />
        <ellipse cx="71" cy="22" rx="4.6" ry="5.4" fill="#fff" />
        <ellipse cx="83" cy="22" rx="4.6" ry="5.4" fill="#fff" />
        <circle cx="72" cy="23" r="2.4" fill="#3a2b20" />
        <circle cx="84" cy="23" r="2.4" fill="#3a2b20" />
      </g>
      {/* smile grille */}
      <path
        d="M96 48 Q102 52 108 48"
        stroke="#3a2b20"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* wheels */}
      <circle cx="32" cy="64" r={wheelR} fill={wheelFill} stroke="#3a2b20" strokeWidth="2" />
      <circle cx="32" cy="64" r="4" fill="#e9ecef" />
      <circle cx="90" cy="64" r={wheelR} fill={wheelFill} stroke="#3a2b20" strokeWidth="2" />
      <circle cx="90" cy="64" r="4" fill="#e9ecef" />
    </svg>
  );
}

/** Just the driver's head, for the setup picker. */
export function DriverFace({ driver, title }: { driver: Driver; title: string }) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label={title} className="racing-driver-face">
      <circle cx="24" cy="26" r="14" fill={driver.skin} />
      <path d="M10 26 A14 14 0 0 1 38 26 L38 21 A14 14 0 0 0 10 21 Z" fill={driver.helmet} />
      <circle cx="19" cy="27" r="1.8" fill="#3a2b20" />
      <circle cx="29" cy="27" r="1.8" fill="#3a2b20" />
      <path
        d="M20 33 Q24 36 28 33"
        stroke="#3a2b20"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
