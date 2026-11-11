/**
 * UNIVERSAL SLASH-COMMAND CATALOG (owner order 2026-11-11).
 * One authoritative list of EVERY command Osiris can act on — nothing
 * hidden. It backs three surfaces at once:
 *   1. the "/" pop-up menu while typing in the chat box,
 *   2. the /help full document,
 *   3. the Commands tab inside the Command box.
 * Pure data + filtering — unit-testable, no DOM.
 */

export type SlashCommand = {
  /** Canonical slash form, e.g. "/fly". */
  command: string;
  /** Plain-words one-liner shown in the menu, the doc and the Commands tab. */
  description: string;
  /** Which Command-box tab the capability belongs to. */
  category: "movement" | "scene" | "interface" | "tools" | "comms" | "memory" | "system";
  /** Also usable by speaking it aloud (most can). */
  voice?: boolean;
  /** Example the operator can say/type, when it differs from the slash form. */
  example?: string;
};

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  // MOVEMENT — Osiris's body in the live world
  {
    command: "/walk",
    description: "Walk around and explore on foot.",
    category: "movement",
    voice: true,
    example: "walk around",
  },
  {
    command: "/run",
    description: "Switch to running speed.",
    category: "movement",
    voice: true,
    example: "run",
  },
  {
    command: "/fly",
    description: "Take flight — superman flight through the world.",
    category: "movement",
    voice: true,
    example: "fly",
  },
  {
    command: "/jump",
    description: "Jump once, right where he stands.",
    category: "movement",
    voice: true,
    example: "jump",
  },
  {
    command: "/stop",
    description: "Stop moving and hold position.",
    category: "movement",
    voice: true,
    example: "stop",
  },
  {
    command: "/come back",
    description: "Return to the operator and hold nearby.",
    category: "movement",
    voice: true,
    example: "come back",
  },
  {
    command: "/idle",
    description: "Relax into idle standing.",
    category: "movement",
    voice: true,
    example: "idle",
  },
  {
    command: "/speed",
    description: "Set movement speed, e.g. /speed 1.5.",
    category: "movement",
    voice: true,
    example: "speed 1.5",
  },

  // SCENE — size, shaping, world material
  {
    command: "/go home",
    description: "Fly down from orbit into the live world (his house).",
    category: "scene",
    voice: true,
    example: "go home",
  },
  {
    command: "/go to your house",
    description: "Same as /go home — enter the live world.",
    category: "scene",
    voice: true,
    example: "go to your house",
  },
  {
    command: "/go to space",
    description: "Fly back up to the Earth orbital view.",
    category: "scene",
    voice: true,
    example: "go to space",
  },
  {
    command: "/shrink",
    description: "Shrink to compact form — small enough to walk anywhere.",
    category: "scene",
    voice: true,
    example: "shrink",
  },
  {
    command: "/grow",
    description: "Return to full size.",
    category: "scene",
    voice: true,
    example: "full size",
  },
  {
    command: "/look around",
    description: "Look around the surroundings.",
    category: "scene",
    voice: true,
    example: "look around",
  },
  {
    command: "/make <thing>",
    description: "Materialize an object in the world (water, mountain, wall…).",
    category: "scene",
    voice: true,
    example: "make a wall",
  },
  {
    command: "/reshape <thing> into <thing>",
    description: "Reshape an existing object into something else.",
    category: "scene",
    voice: true,
    example: "reshape the water into a wall",
  },

  // INTERFACE — the screen itself
  {
    command: "/clear screen",
    description:
      "Hide the interface — only Osiris and the world remain. Hot key: C (or Ctrl+Shift+C); Esc brings it back.",
    category: "interface",
    voice: true,
    example: "clear screen",
  },
  {
    command: "/show screen",
    description: "Bring the Command box and HUD back.",
    category: "interface",
    voice: true,
    example: "show screen",
  },
  {
    command: "/minimize",
    description: "Collapse the Command box to just the chat bar.",
    category: "interface",
    voice: false,
  },
  {
    command: "/restore",
    description: "Expand the Command box again.",
    category: "interface",
    voice: false,
  },
  {
    command: "/help",
    description: "Open the full capability document — every command, tab and setting.",
    category: "interface",
    voice: false,
  },

  // WINDOWS — movable windows he can open himself or on order
  {
    command: "/notepad",
    description: "Open the Notepad window — private notes, only you see them.",
    category: "interface",
    voice: true,
    example: "open notepad",
  },
  {
    command: "/chalkboard",
    description: "Open the Chalkboard — write on it, or have Osiris write on it.",
    category: "interface",
    voice: true,
    example: "open chalkboard",
  },
  {
    command: "/player",
    description:
      "Open the YouTube player — paste a link or type a song name. Links and playlists are saved.",
    category: "interface",
    voice: true,
    example: "open player",
  },
  {
    command: "/cube",
    description: "Open My Cube — Metatron's cube, operator-verified.",
    category: "interface",
    voice: true,
    example: "open the cube",
  },
  {
    command: "/knowledge",
    description: "Open the Knowledge panel — import documents, review saved memory.",
    category: "interface",
    voice: true,
    example: "open knowledge",
  },

  // TOOLS — senses and analysis
  {
    command: "/analyze room",
    description: "Analyze the live camera frame and open the Room Analyzer.",
    category: "tools",
    voice: true,
    example: "analyze the room",
  },
  {
    command: "/what do you see",
    description: "Describe what the camera sees right now.",
    category: "tools",
    voice: true,
    example: "what do you see",
  },
  {
    command: "/odds <question>",
    description: "Probability odds on a question (Command terminal).",
    category: "tools",
    voice: true,
    example: "/odds will it rain tomorrow",
  },
  {
    command: "/theory <question>",
    description: "Deep theory reasoning on a question (Command terminal).",
    category: "tools",
    voice: true,
    example: "/theory why is the sky blue",
  },
  {
    command: "/report list",
    description: "List security reports (Command terminal).",
    category: "tools",
    voice: false,
  },

  // COMMS — voice and silence
  {
    command: "/osiris",
    description: "Wake word — get his attention (also: Usir).",
    category: "comms",
    voice: true,
    example: "Hey Osiris",
  },
  {
    command: "/mute",
    description: "Silence mode: he stops talking until called by name.",
    category: "comms",
    voice: true,
    example: "don't talk",
  },
  {
    command: "/unmute",
    description: "End silence mode — he talks again.",
    category: "comms",
    voice: true,
    example: "Osiris",
  },

  // MEMORY — remembering things for the operator
  {
    command: "/remember <fact>",
    description: "Remember something permanently, e.g. /remember my daughter's birthday is May 3.",
    category: "memory",
    voice: true,
    example: "remember I prefer the dark theme",
  },

  // SYSTEM — knowledge and the familiars
  {
    command: "/summon",
    description: "Call Osiris to full attention.",
    category: "system",
    voice: true,
    example: "Osiris, attend",
  },
  {
    command: "/present",
    description: "Have him present the file board.",
    category: "system",
    voice: true,
    example: "front the file",
  },
  {
    command: "/demon wolf <order>",
    description: "Demon Wolf (attack/protect) takes an order.",
    category: "system",
    voice: true,
    example: "demon wolf, protect the house",
  },
  {
    command: "/thunder wolf <order>",
    description: "Thunder Wolf (scout/speed) takes an order.",
    category: "system",
    voice: true,
    example: "thunder wolf, scout ahead",
  },
] as const;

export const CATEGORY_LABELS: Readonly<Record<SlashCommand["category"], string>> = {
  movement: "Movement",
  scene: "Scene & world",
  interface: "Interface",
  tools: "Tools & analysis",
  comms: "Voice & silence",
  memory: "Memory",
  system: "System & familiars",
};

export const CATEGORY_ORDER: readonly SlashCommand["category"][] = [
  "movement",
  "scene",
  "interface",
  "tools",
  "comms",
  "memory",
  "system",
];

/** Commands matching what the operator has typed after "/" (empty → all). */
export function filterSlashCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase().replace(/^\//, "");
  if (!q) return [...SLASH_COMMANDS];
  return SLASH_COMMANDS.filter(
    (c) => c.command.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
  );
}

/** True when the last token of the draft starts with "/" (menu should show). */
export function isSlashMenuActive(draft: string): boolean {
  return /(?:^|\s)\/[^\s]*$/.test(draft);
}

/** The typed token after the last "/", without the slash, or null. */
export function slashQuery(draft: string): string | null {
  const match = draft.match(/(?:^|\s)\/([^\s]*)$/);
  return match ? match[1]! : null;
}
