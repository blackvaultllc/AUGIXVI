/**
 * DRESS-UP CORNER — in Khadija's own space (the Captain's order
 * 2026-11-25): "animated characters like the animated girls that
 * she can put clothes on and create — a nice dress, magic, a lot
 * of pink. She likes pink."
 *
 * Three original girls, drawn right here as flat picture-code (no
 * Roblox or Minecraft art — those belong to their makers; these
 * girls are hers). She picks a girl, picks a dress, paints it any
 * color — pink first, pink biggest — adds a crown, a bow, a flower,
 * or a magic wand, and taps Magic for sparkles. The girls sway
 * gently, like they're alive on the page.
 *
 * Her final say governs her space: anything she doesn't like comes
 * off on her word.
 */
import { useState } from "react";
import { Crown, Flower2, Sparkles, Star, Wand2 } from "lucide-react";

interface Girl {
  id: string;
  name: string;
  skin: string;
  hair: string;
  hairStyle: "puffs" | "long" | "curly";
}

const GIRLS: Girl[] = [
  { id: "ruby", name: "Ruby", skin: "#8d5524", hair: "#191008", hairStyle: "puffs" },
  { id: "pearl", name: "Pearl", skin: "#c68642", hair: "#241207", hairStyle: "long" },
  { id: "sunny", name: "Sunny", skin: "#f1c27d", hair: "#a35b14", hairStyle: "curly" },
];

interface Outfit {
  id: string;
  name: string;
}

const OUTFITS: Outfit[] = [
  { id: "party", name: "Party Dress" },
  { id: "princess", name: "Princess Gown" },
  { id: "fairy", name: "Fairy Dress" },
  { id: "everyday", name: "Top & Skirt" },
];

/** Pink first, pink biggest — her favorite leads the row. */
const COLORS: { name: string; value: string }[] = [
  { name: "Hot pink", value: "#ff5da2" },
  { name: "Bubblegum pink", value: "#ff8fc7" },
  { name: "Raspberry pink", value: "#e93a7d" },
  { name: "Purple", value: "#b07fe8" },
  { name: "Sky blue", value: "#6ecbff" },
  { name: "Mint", value: "#7fe3c0" },
  { name: "Gold", value: "#ffd23f" },
  { name: "Coral", value: "#ff7b7b" },
];

const ACCESSORIES = [
  { id: "none", name: "None" },
  { id: "crown", name: "Crown" },
  { id: "bow", name: "Big Bow" },
  { id: "flower", name: "Flower" },
  { id: "wand", name: "Magic Wand" },
] as const;

type AccessoryId = (typeof ACCESSORIES)[number]["id"];

function HairBack({ girl }: { girl: Girl }) {
  if (girl.hairStyle === "long") {
    return (
      <path
        d="M74 66 a36 36 0 0 1 72 0 l6 92 a10 10 0 0 1 -10 10 l-64 0 a10 10 0 0 1 -10 -10 z"
        fill={girl.hair}
      />
    );
  }
  return null;
}

function HairFront({ girl }: { girl: Girl }) {
  if (girl.hairStyle === "puffs") {
    return (
      <g fill={girl.hair}>
        <circle cx="76" cy="34" r="15" />
        <circle cx="144" cy="34" r="15" />
        <path d="M78 58 a32 30 0 0 1 64 0 l0 -8 a32 26 0 0 0 -64 0 z" />
      </g>
    );
  }
  if (girl.hairStyle === "curly") {
    return (
      <g fill={girl.hair}>
        {[84, 96, 110, 124, 136].map((cx) => (
          <circle key={cx} cx={cx} cy="34" r="11" />
        ))}
        <path d="M80 56 a30 28 0 0 1 60 0 l0 -6 a30 24 0 0 0 -60 0 z" />
      </g>
    );
  }
  return <path d="M79 54 a31 29 0 0 1 62 0 l0 -4 a31 25 0 0 0 -62 0 z" fill={girl.hair} />;
}

function OutfitShape({ outfit, color }: { outfit: string; color: string }) {
  const trim = "#ffffff";
  if (outfit === "princess") {
    return (
      <g>
        <circle cx="76" cy="128" r="13" fill={color} />
        <circle cx="144" cy="128" r="13" fill={color} />
        <path d="M92 118 L128 118 L172 306 Q110 322 48 306 Z" fill={color} />
        <rect x="90" y="168" width="40" height="10" rx="5" fill={trim} opacity="0.65" />
        <path d="M52 292 Q110 308 168 292 L172 306 Q110 322 48 306 Z" fill={trim} opacity="0.5" />
      </g>
    );
  }
  if (outfit === "fairy") {
    return (
      <g>
        <path d="M92 118 L128 118 L138 176 L82 176 Z" fill={color} />
        <path d="M78 176 Q110 158 142 176 L156 224 Q110 240 64 224 Z" fill={color} opacity="0.9" />
        <path d="M70 200 Q110 186 150 200 L156 224 Q110 240 64 224 Z" fill={trim} opacity="0.45" />
      </g>
    );
  }
  if (outfit === "everyday") {
    return (
      <g>
        <rect x="88" y="118" width="44" height="58" rx="10" fill={color} />
        <path d="M86 176 L134 176 L148 232 Q110 244 72 232 Z" fill={color} opacity="0.88" />
      </g>
    );
  }
  // party
  return (
    <g>
      <path d="M92 118 L128 118 L160 300 Q110 314 60 300 Z" fill={color} />
      <rect x="90" y="164" width="40" height="9" rx="4.5" fill={trim} opacity="0.65" />
    </g>
  );
}

function AccessoryShape({ accessory }: { accessory: AccessoryId }) {
  if (accessory === "crown") {
    return (
      <g fill="#ffd23f" stroke="#d9a400" strokeWidth="2">
        <path d="M88 22 L98 6 L110 20 L122 6 L132 22 L130 32 L90 32 Z" />
      </g>
    );
  }
  if (accessory === "bow") {
    return (
      <g fill="#ff5da2">
        <path d="M138 30 L158 18 L158 44 Z" />
        <path d="M138 30 L120 18 L120 44 Z" />
        <circle cx="139" cy="31" r="6" fill="#e93a7d" />
      </g>
    );
  }
  if (accessory === "flower") {
    return (
      <g>
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse
            key={deg}
            cx="142"
            cy="24"
            rx="6"
            ry="10"
            fill="#ff8fc7"
            transform={`rotate(${deg} 142 32)`}
          />
        ))}
        <circle cx="142" cy="32" r="5" fill="#ffd23f" />
      </g>
    );
  }
  if (accessory === "wand") {
    return (
      <g>
        <line x1="176" y1="196" x2="196" y2="150" stroke="#b07fe8" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M196 132 L200 144 L212 144 L202 152 L206 164 L196 157 L186 164 L190 152 L180 144 L192 144 Z"
          fill="#ffd23f"
          stroke="#d9a400"
          strokeWidth="1.5"
        />
      </g>
    );
  }
  return null;
}

export function LearnerDressUp() {
  const [girl, setGirl] = useState<Girl>(() => GIRLS[0] as Girl);
  const [outfit, setOutfit] = useState("party");
  const [color, setColor] = useState(() => COLORS[0]?.value ?? "#ff5da2");
  const [accessory, setAccessory] = useState<AccessoryId>("none");
  const [magic, setMagic] = useState(false);

  const outfitName = OUTFITS.find((o) => o.id === outfit)?.name ?? "";
  const colorName = COLORS.find((c) => c.value === color)?.name ?? "";

  return (
    <div className="learner-dressup">
      <h2>Dress-Up Corner</h2>
      <p className="learner-dressup__line">
        Pick a girl, pick a dress, paint it your favorite color — pink is ready for you!
      </p>

      <div className="learner-dressup__stage">
        <svg
          className={magic ? "learner-dressup__girl learner-dressup__girl--magic" : "learner-dressup__girl"}
          viewBox="0 0 220 340"
          role="img"
          aria-label={`${girl.name} wearing a ${colorName} ${outfitName}`}
        >
          {outfit === "fairy" && (
            <g fill="#ffd7ec" opacity="0.8">
              <ellipse cx="52" cy="160" rx="26" ry="44" transform="rotate(-24 52 160)" />
              <ellipse cx="168" cy="160" rx="26" ry="44" transform="rotate(24 168 160)" />
            </g>
          )}
          <HairBack girl={girl} />
          {/* legs + shoes */}
          <rect x="94" y="238" width="11" height="72" rx="5" fill={girl.skin} />
          <rect x="115" y="238" width="11" height="72" rx="5" fill={girl.skin} />
          <ellipse cx="98" cy="316" rx="12" ry="6" fill={color} />
          <ellipse cx="122" cy="316" rx="12" ry="6" fill={color} />
          {/* arms */}
          <path d="M88 126 Q64 168 70 204" stroke={girl.skin} strokeWidth="11" fill="none" strokeLinecap="round" />
          <path d="M132 126 Q156 168 150 204" stroke={girl.skin} strokeWidth="11" fill="none" strokeLinecap="round" />
          {/* outfit over the body */}
          <OutfitShape outfit={outfit} color={color} />
          {/* head + face */}
          <circle cx="110" cy="62" r="31" fill={girl.skin} />
          <HairFront girl={girl} />
          <circle cx="99" cy="64" r="3.4" fill="#241a12" />
          <circle cx="121" cy="64" r="3.4" fill="#241a12" />
          <circle cx="100.5" cy="62.5" r="1.2" fill="#fff" />
          <circle cx="122.5" cy="62.5" r="1.2" fill="#fff" />
          <ellipse cx="90" cy="74" rx="5" ry="3" fill="#ff8fc7" opacity="0.65" />
          <ellipse cx="130" cy="74" rx="5" ry="3" fill="#ff8fc7" opacity="0.65" />
          <path d="M102 76 Q110 83 118 76" stroke="#241a12" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <AccessoryShape accessory={accessory} />
          {magic && (
            <g className="learner-dressup__sparkles" fill="#ffd23f">
              {(
                [
                  [30, 90],
                  [188, 80],
                  [44, 220],
                  [182, 240],
                  [110, 16],
                ] as ReadonlyArray<readonly [number, number]>
              ).map(([cx, cy]) => (
                <path
                  key={`${cx}-${cy}`}
                  d={`M${cx} ${cy - 10} L${cx + 3} ${cy - 3} L${cx + 10} ${cy} L${cx + 3} ${cy + 3} L${cx} ${cy + 10} L${cx - 3} ${cy + 3} L${cx - 10} ${cy} L${cx - 3} ${cy - 3} Z`}
                />
              ))}
            </g>
          )}
        </svg>
      </div>

      <div className="learner-dressup__groups">
      <div className="learner-dressup__group">
        <h3>Pick your girl</h3>
        <div className="learner-dressup__chips">
          {GIRLS.map((g) => (
            <button
              key={g.id}
              type="button"
              className={girl.id === g.id ? "learner-chip learner-chip--active" : "learner-chip"}
              aria-pressed={girl.id === g.id}
              onClick={() => setGirl(g)}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      <div className="learner-dressup__group">
        <h3>Pick a dress</h3>
        <div className="learner-dressup__chips">
          {OUTFITS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={outfit === o.id ? "learner-chip learner-chip--active" : "learner-chip"}
              aria-pressed={outfit === o.id}
              onClick={() => setOutfit(o.id)}
            >
              {o.name}
            </button>
          ))}
        </div>
      </div>

      <div className="learner-dressup__group">
        <h3>Paint it</h3>
        <div className="learner-dressup__chips">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              className={
                color === c.value
                  ? "learner-swatch learner-swatch--active"
                  : "learner-swatch"
              }
              style={{ background: c.value }}
              aria-pressed={color === c.value}
              aria-label={c.name}
              onClick={() => setColor(c.value)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="learner-dressup__group">
        <h3>Add something special</h3>
        <div className="learner-dressup__chips">
          {ACCESSORIES.map((a) => (
            <button
              key={a.id}
              type="button"
              className={accessory === a.id ? "learner-chip learner-chip--active" : "learner-chip"}
              aria-pressed={accessory === a.id}
              onClick={() => setAccessory(a.id)}
            >
              {a.id === "crown" && <Crown aria-hidden="true" />}
              {a.id === "flower" && <Flower2 aria-hidden="true" />}
              {a.id === "wand" && <Wand2 aria-hidden="true" />}
              {a.id === "bow" && <Star aria-hidden="true" />}
              {a.name}
            </button>
          ))}
          <button
            type="button"
            className={magic ? "learner-chip learner-chip--active" : "learner-chip"}
            aria-pressed={magic}
            onClick={() => setMagic((m) => !m)}
          >
            <Sparkles aria-hidden="true" /> Magic!
          </button>
        </div>
      </div>
      </div>

      <p className="learner-dressup__ta-daa" aria-live="polite">
        {girl.name} is wearing a {colorName.toLowerCase()} {outfitName.toLowerCase()}!
        {magic ? " And the magic is ON!" : ""}
      </p>
    </div>
  );
}
