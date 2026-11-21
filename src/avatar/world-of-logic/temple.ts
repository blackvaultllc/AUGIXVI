/**
 * WORLD OF LOGIC — ported from the VoiceWave Command Deck
 * (blackvaultllc/voicewave-command-deck @ 7653d36, src/lib/temple.ts).
 * The monster definitions and the Captain's sword math the battle
 * engine (battles.ts) imports — the defs, the type, and the damage
 * functions, verbatim. The temple's own arena combat stays in the deck;
 * only what the outside battles name crosses over.
 */
import type { Tile } from "./office-layout";

// ---- Monsters --------------------------------------------------------

export type TempleMonsterKind =
  | "virus-mite"
  | "hardcore-virus"
  | "social-engineer"
  | "spam-caller"
  | "scam-caller"
  | "gang-member";

export interface MonsterDef {
  kind: TempleMonsterKind;
  name: string;
  /** Plain words: what it is, in the company's work. */
  blurb: string;
  /** What it says when the Captain talks to it (F). */
  talk: string;
  /** The lesson it teaches — the company skill + rule. */
  lesson: string;
  /** Base HP; the floor adds (floor - 1) * 3. */
  baseHp: number;
  /** Body colour on the canvas. */
  color: string;
}

export const MONSTER_DEFS: Record<TempleMonsterKind, MonsterDef> = {
  "virus-mite": {
    kind: "virus-mite",
    name: "VIRUS MITE",
    blurb: "A regular virus — a mite that chews through files while you sleep.",
    talk: "Tick… tick… I only chew what nobody watches.",
    lesson:
      "Viruses — patch the door before the mite finds it: update, scan, and never run a file you did not ask for.",
    baseHp: 20,
    color: "#65a30d",
  },
  "hardcore-virus": {
    kind: "hardcore-virus",
    name: "HARDCORE VIRUS",
    blurb: "A hardcore virus — it locks the whole floor and demands payment.",
    talk: "Pay up, or the floor stays locked. Your move, Captain.",
    lesson:
      "Hardcore virus — backups first, payment never: a locked machine is restored from backup, never ransomed.",
    baseHp: 50,
    color: "#dc2626",
  },
  "social-engineer": {
    kind: "social-engineer",
    name: "SMOOTH TALKER",
    blurb: "Social engineering — a smooth talker who knows your name and your boss's.",
    talk: "Relax — your boss sent me. You can trust me with that password.",
    lesson:
      "Social engineering — a smooth talker who knows your name is still a stranger: verify through a channel you already know.",
    baseHp: 30,
    color: "#7c3aed",
  },
  "spam-caller": {
    kind: "spam-caller",
    name: "SPAM CALLER",
    blurb: "Spam — a caller who rings and rings, pretending to be someone you know.",
    talk: "Hello? Hello? Is this the Captain? I have a wonderful offer…",
    lesson: "Spam — never trust a caller ID: hang up, look the number up yourself, and log it.",
    baseHp: 25,
    color: "#ea580c",
  },
  "scam-caller": {
    kind: "scam-caller",
    name: "SCAM CALLER",
    blurb: "Scam calling — a caller who wants your money, your codes, your trust.",
    talk: "Your account is in danger! Read me the code on your screen — quickly!",
    lesson:
      "Scam calls — no real company ever asks for your code over the phone: hang up and call them back on a number you trust.",
    baseHp: 35,
    color: "#991b1b",
  },
  "gang-member": {
    kind: "gang-member",
    name: "GANG MEMBER",
    blurb:
      "A worker who left the company and started a gang outside. They cannot break through the buildings — but outside, be ready.",
    talk: "This is our turf now, Captain. Walk on by — or don't.",
    lesson:
      "Gangs outside — they cannot break through the buildings. Outside, be ready to fight, and use your powers.",
    baseHp: 40,
    color: "#57534e",
  },
};

export interface TempleMonster {
  id: string;
  kind: TempleMonsterKind;
  /** Gang members carry the worker's name; the rest carry the kind's name. */
  name: string;
  tile: Tile;
  hp: number;
  maxHp: number;
  /** Date.now() of the last hit — the canvas flashes the clash. */
  hitAt?: number;
  /** A boss holds the floor — bigger, tougher, named. */
  boss?: boolean;
  /** A super boss holds Floor 100, the top. */
  superBoss?: boolean;
}

// ---- The Captain's sword --------------------------------------------

/** Sword damage — the Captain's class sharpens it. */
export const SWORD_DAMAGE = 12;
/** Super attack damage — the whole room feels it. */
export const SUPER_DAMAGE = 30;

/** Sword damage for a class — the class he chose in the
 * inventory sharpens the blade. No class, no bonus. */
export function swordDamageFor(classId: string | null): number {
  switch (classId) {
    case "warrior":
      return SWORD_DAMAGE + 4;
    case "dark-knight":
      return SWORD_DAMAGE + 3;
    case "warlock":
      return SWORD_DAMAGE + 3;
    case "wizard":
      return SWORD_DAMAGE + 2;
    case "paladin":
      return SWORD_DAMAGE + 2;
    case "cleric":
      return SWORD_DAMAGE + 1;
    case "bard":
      return SWORD_DAMAGE + 1;
    default:
      return SWORD_DAMAGE;
  }
}
