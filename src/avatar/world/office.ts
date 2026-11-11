/**
 * THE OFFICE — Osiris's city, his building (owner order).
 * "Hey, let's go to office": Osiris walks in — screen fades to black with a
 * sparkle of sand splashing — then he walks in looking around. The operator
 * spawns in as the Black Hatter, a wolf-type character, and can walk, fly,
 * sit, talk to the workers, open panels, work.
 *
 * Pure scene logic + transitions, no DOM — testable like avatar rules.
 */

export type OfficePhase =
  | "outside" // in the world, pre-transition
  | "fade-out" // screen fades to black, sand sparkles
  | "entering" // black holds; sand settles; footsteps
  | "inside"; // office revealed, Osiris walking around

export const FADE_MS = 1400;
export const HOLD_MS = 900;
export const REVEAL_MS = 1100;

export const TOTAL_ENTERING_MS = FADE_MS + HOLD_MS + REVEAL_MS;

const FADE_PHRASES = [
  "Lead the way — I'll walk in with you.",
  "Office it is. Sand over the door; give me a beat.",
  "Walking in. Look around with me when the sand clears.",
];

export function isOfficeWalkInRequest(text: string): boolean {
  return (
    /\b(?:let'?s go to|go to|take me to|enter)\s+(?:the\s+)?office\b/i.test(text) ||
    /^office[,!.]?\s*$/i.test(text.trim())
  );
}

export function fadePhrase(random: () => number = Math.random): string {
  return FADE_PHRASES[Math.floor(random() * FADE_PHRASES.length)] ?? FADE_PHRASES[0]!;
}

/** Progression of the transition timeline from a start timestamp. */
export function phaseAt(elapsedMs: number): OfficePhase {
  if (elapsedMs < FADE_MS) return "fade-out";
  if (elapsedMs < FADE_MS + HOLD_MS) return "entering";
  return "inside";
}

/** Sand sparkle density 0..1 across the fade — peaks mid-fade, sparks settle. */
export function sandSparkle(elapsedMs: number): number {
  if (elapsedMs < 0) return 0;
  const total = FADE_MS + HOLD_MS;
  if (elapsedMs >= total) return 0.15; // a last dust settles inside
  const p = elapsedMs / total;
  return Math.sin(Math.PI * p) * (1 - p * 0.35);
}

/* ------------------------- THE BLACK HATTER ------------------------------ */

export type CharacterForm = "osiris-pov" | "black-hatter";

export const BLACK_HATTER = {
  id: "black-hatter",
  name: "The Black Hatter",
  /** Wolf-type, like his familiars — same family of build. */
  build: "wolf",
  fur: "black",
  accent: "gold",
} as const;

/* ---------------------- THE OFFICE ITSELF -------------------------------- */

export type OfficeRoom = {
  id: string;
  name: string;
  floor: number;
  purpose: string;
  /** Which department holds this room, when one does. */
  departmentId?: string;
};

export const OFFICE_ROOMS: readonly OfficeRoom[] = [
  {
    id: "lobby",
    name: "Front Lobby",
    floor: 1,
    purpose: "welcome desk, visitor routing",
    departmentId: "front",
  },
  {
    id: "war-room",
    name: "War Room",
    floor: 2,
    purpose: "defense watch, radar and feeds",
    departmentId: "defense",
  },
  {
    id: "dev-hall",
    name: "Build Hall",
    floor: 2,
    purpose: "code benches, repair stations",
    departmentId: "code",
  },
  {
    id: "brief-room",
    name: "Brief Room",
    floor: 1,
    purpose: "intelligence desk, briefs and odds",
    departmentId: "intel",
  },
  {
    id: "studio",
    name: "Media Studio",
    floor: 3,
    purpose: "music, art and clip benches",
    departmentId: "media",
  },
  {
    id: "ops-floor",
    name: "Operations Floor",
    floor: 3,
    purpose: "scheduling and logistics",
    departmentId: "ops",
  },
  {
    id: "vault",
    name: "Records Vault",
    floor: 4,
    purpose: "files and repositories",
    departmentId: "records",
  },
  {
    id: "lore-hall",
    name: "Lore Hall",
    floor: 4,
    purpose: "Egyptology and the old names",
    departmentId: "lore",
  },
  {
    id: "office-top",
    name: "Osiris's Office",
    floor: 5,
    purpose: "his corner office — chalkboard, cube, view of the city",
  },
] as const;

/** The city outside — streets and buildings Osiris owns. */
export type CityBuilding = { id: string; name: string; height: number; hue: string };

export const CITY_STREETS = ["Ankh Boulevard", "Sphinx Row", "Nile Way", "Scarab Street"] as const;

export const CITY_BUILDINGS: readonly CityBuilding[] = [
  { id: "tower", name: "AUGIXVI Tower", height: 5, hue: "cyan" },
  { id: "archive", name: "Archive Annex", height: 4, hue: "blue" },
  { id: "foundry", name: "Media Foundry", height: 3, hue: "gold" },
  { id: "bastion", name: "Defense Bastion", height: 4, hue: "red" },
  { id: "market", name: "Trade Market", height: 2, hue: "green" },
] as const;

/** Sit-down spots — "sit" lands him somewhere sensible. */
export const SIT_SPOTS: readonly string[] = [
  "the lobby bench",
  "the war-room chair",
  "the brief-room stool",
  "the studio couch",
  "his office chair",
];
