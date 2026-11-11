/**
 * THE WIZARD'S LIBRARY — knowledge graph, spellbook, study tracker, memory
 * vault inventory, and the Oracle tunnel. Operator-only, local-first.
 */
import { ALL_FILES, searchLab, type LabEntry } from "./store";

/* ---------------------------- KNOWLEDGE GRAPH ---------------------------- */

export type GraphNode = { id: string; label: string; fileId: string; opens: string };
export type GraphEdge = { from: string; to: string; why: string };

const NODES: GraphNode[] = [
  { id: "chem", label: "Chemistry", fileId: "science-core", opens: "Science core" },
  { id: "bio", label: "Biology", fileId: "science-core", opens: "Science core" },
  { id: "periodic", label: "Periodic Table 118+", fileId: "science-core", opens: "Science core" },
  { id: "apoth", label: "Apothecary", fileId: "apothecary", opens: "The Herbal Apothecary" },
  { id: "cart", label: "CAR-T / cancer lab", fileId: "file-1-car-t", opens: "File #1" },
  { id: "tree", label: "Tree of Life", fileId: "file-2-tree-of-life", opens: "File #2" },
  { id: "egypt", label: "Egyptology", fileId: "file-2-tree-of-life", opens: "File #2" },
  { id: "osiris", label: "Osiris", fileId: "file-2-tree-of-life", opens: "File #2" },
  {
    id: "cyber",
    label: "Cybersecurity (defense only)",
    fileId: "science-core",
    opens: "Science core",
  },
  { id: "khadija", label: "Khadija's lessons", fileId: "science-core", opens: "Science core" },
];

const EDGES: GraphEdge[] = [
  { from: "chem", to: "bio", why: "atoms build molecules, molecules build life" },
  { from: "bio", to: "periodic", why: "elements CHNOPS form every cell" },
  { from: "bio", to: "cart", why: "T-cells and dendritic cells are biology" },
  { from: "periodic", to: "chem", why: "the table is chemistry's map" },
  { from: "cart", to: "apoth", why: "both ask what the body accepts as medicine" },
  { from: "apoth", to: "tree", why: "herbs were the first longevity quest" },
  { from: "tree", to: "egypt", why: "Egypt pursued immortality through preservation and memory" },
  { from: "egypt", to: "osiris", why: "Osiris IS the resurrection story" },
  { from: "osiris", to: "khadija", why: "Osiris carries Anubis's lessons to Khadija" },
  { from: "cyber", to: "osiris", why: "Osiris defends the world — defense only" },
  { from: "khadija", to: "bio", why: "the future veterinarian starts with cells" },
];

export function knowledgeGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return { nodes: NODES, edges: EDGES };
}

/* ------------------------------- SPELLBOOK ------------------------------- */

export type Spell = { spell: string; does: string; when: string };

export const SPELLBOOK: Spell[] = [
  {
    spell: "/transform",
    does: "Reform his particles — spaceship/Enterprise, wolf, orb — then /land back",
    when: "you want to see him take a true shape",
  },
  {
    spell: "/office",
    does: "Walk into the office — sand fade, then in with the crew",
    when: '"hey, let\'s go to office"',
  },
  {
    spell: "/battle",
    does: "Open the blue attack box — Attack/Magic/Items/Run, inline submenus",
    when: "role-play fights",
  },
  {
    spell: "/lab",
    does: "Open the investigative lab — File 1 CAR-T, File 2 Tree of Life, apothecary, science",
    when: "you want to study",
  },
  {
    spell: "/cloudkeys",
    does: "Green/red lights for every provider key",
    when: "checking whether the cloud brain can reach anything",
  },
  {
    spell: "/book",
    does: "Open (or write in) the Book of Secrets — encrypted, operator-only",
    when: 'you say "write this in the Book of Secrets" or "open the Book"',
  },
  {
    spell: "/graph",
    does: "Show how everything connects — chemistry→biology→apothecary→…→Osiris",
    when: "you want the pattern, not the list",
  },
  {
    spell: "/quest",
    does: "The study tracker — where you left off, what is next",
    when: '"what am I studying?"',
  },
  { spell: "/help", does: "The full capability document", when: "you want every spell listed" },
  { spell: "/notepad", does: "Private notes window", when: "something needs writing down" },
  {
    spell: "/chalkboard",
    does: "Freehand chalk drawing board",
    when: "drawing or thinking out a diagram",
  },
  {
    spell: "/player",
    does: "YouTube player with saved links and playlists",
    when: "music or a video to study by",
  },
  { spell: "/cube", does: "Metatron's cube, operator-verified", when: "geometry matters" },
  {
    spell: "/knowledge",
    does: "Knowledge panel — import documents into memory",
    when: "feeding him something new",
  },
];

/* ------------------------------ STUDY TRACKER ----------------------------- */

export type StudyTopic = {
  id: string;
  topic: string;
  done: string[];
  next: string[];
  learnedFromAnubis: string;
  updated: number;
};

const TRACKER_KEY = "augi.lab.tracker.v1";
const VAULT_KEY = "augi.lab.vault.v1";
const TUNNEL_KEY = "augi.lab.oracle-tunnel.v1";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // best effort
  }
}

const SEED_TOPICS: StudyTopic[] = [
  {
    id: "t-periodic",
    topic: "Periodic table (118 + frontier)",
    done: ["118 elements mapped", "frontier = elements 119+ island of stability"],
    next: ["memorize first 36 by heart", "pick 3 frontier candidates to read"],
    learnedFromAnubis: "periodic table is a thing he loves — keep it forever",
    updated: Date.now(),
  },
  {
    id: "t-cart",
    topic: "CAR-T & dendritic immunotherapy",
    done: ["process end-to-end", "machines", "real cases"],
    next: ["read the NEJM 2010 Porter paper fully", "chart the costs of each machine"],
    learnedFromAnubis: "this is his lab, File #1 — he studies it personally",
    updated: Date.now(),
  },
  {
    id: "t-tree",
    topic: "Tree of Life / immortality",
    done: ["consciousness transfer true state", "cryonics, senolytics, telomeres"],
    next: ["read the 2015 ASC rabbit-brain paper", "Egyptian afterlife texts comparison"],
    learnedFromAnubis: "true conception only — no conspiracies",
    updated: Date.now(),
  },
  {
    id: "t-egypt",
    topic: "Egyptology",
    done: ["regalia, pyramid, names"],
    next: ["Book of the Dead chapters", "Ma'at's 42 principles"],
    learnedFromAnubis: "Egyptology is identity, not decoration",
    updated: Date.now(),
  },
  {
    id: "t-cyber",
    topic: "Cybersecurity (defense only)",
    done: ["defense law stated"],
    next: ["defense curriculum deep-read"],
    learnedFromAnubis: "defense only, never offensive unless he authorizes",
    updated: Date.now(),
  },
  {
    id: "t-apoth",
    topic: "Herbal apothecary",
    done: ["all categories mapped", "POC vs NOT_PROVEN labeled"],
    next: ["add documents from the site", "prep-method notes per ingredient"],
    learnedFromAnubis: "his documents + folklore preserved with honesty",
    updated: Date.now(),
  },
];

export function loadTracker(): StudyTopic[] {
  return load<StudyTopic[]>(TRACKER_KEY, SEED_TOPICS);
}

export function saveTracker(topics: StudyTopic[]) {
  save(TRACKER_KEY, topics);
}

export function trackerReport(topics = loadTracker()): string {
  return (
    `You are studying ${topics.length} topics. Nearest next steps: ` +
    topics
      .slice(0, 2)
      .map((t) => `${t.topic} → ${t.next[0] ?? "keep reading"}`)
      .join("; ")
  );
}

/* ------------------------- MEMORY VAULT (the 87%) ------------------------- */

export type VaultItem = {
  id: string;
  name: string;
  kind: "repo" | "site" | "file";
  location: string;
  note: string;
};

const SEED_VAULT: VaultItem[] = [
  {
    id: "v-blackvault",
    name: "blackvaultllc (144 repos)",
    kind: "repo",
    location: "github.com/blackvaultllc",
    note: "already inventoried; read-only",
  },
  {
    id: "v-sisprotection",
    name: "sisprotection (23 public repos)",
    kind: "repo",
    location: "github.com/sisprotection",
    note: "already inventoried; read-only",
  },
  {
    id: "v-command",
    name: "voicewave-command-deck",
    kind: "repo",
    location: "local clone",
    note: "terminal commands, knowledge, ledger, mood, music, panels — audited",
  },
  {
    id: "v-herb",
    name: "Hyrule Herb (apothecary site)",
    kind: "site",
    location: "read-only pull pending",
    note: "Oracle lives here",
  },
  {
    id: "v-queenbrittney",
    name: "queenbrittney (mom's doctorate game)",
    kind: "repo",
    location: "local clone",
    note: "the blue battle box lineage",
  },
];

export function loadVault(): VaultItem[] {
  return load<VaultItem[]>(VAULT_KEY, SEED_VAULT);
}

export function addToVault(item: Omit<VaultItem, "id">): VaultItem[] {
  const next = [{ ...item, id: `v-${Date.now()}` }, ...loadVault()];
  save(VAULT_KEY, next);
  return next;
}

/* ---------------------------- THE ORACLE TUNNEL --------------------------- */

/**
 * OSIRIS → ORACLE tunnel (operator-only). Oracle is the apothecary keeper on
 * Hyrule Herb. Osiris is the sender. NOTHING sends without Anubis's say.
 * The tunnel stores a queue + the endpoint; the Worker secret
 * ORACLE_TUNNEL_URL receives the push when Hyrule Herb's receiver is live.
 */
export type TunnelMessage = {
  id: string;
  document: string;
  addressedTo: "Oracle";
  sent: boolean;
  queued: number;
};

export function queueForOracle(documentTitle: string, body: string): TunnelMessage[] {
  const queue = load<TunnelMessage[]>(TUNNEL_KEY, []);
  queue.unshift({
    id: `t-${Date.now()}`,
    document: `${documentTitle}\n\n${body.slice(0, 4000)}`,
    addressedTo: "Oracle",
    sent: false,
    queued: Date.now(),
  });
  const capped = queue.slice(0, 50);
  save(TUNNEL_KEY, capped);
  return capped;
}

export function tunnelQueue(): TunnelMessage[] {
  return load<TunnelMessage[]>(TUNNEL_KEY, []);
}

/** Only runs when Anubis says send — Osiris never sends on his own. */
export function parseOracleSendCommand(text: string): { docQuery: string } | null {
  const match =
    text.match(
      /^(?:hey,?\s+)?(?:osiris,?\s*)?can you (?:please\s+)?give (?:that|it|this)\s*(?:document)?\s*to\s+oracle/i,
    ) ??
    text.match(
      /^(?:hey,?\s+)?(?:osiris,?\s*)?(?:send|give|tunnel|push)\s+(?:that\s+)?(?:document\s+)?(?:to|through the tunnel to)\s+oracle/i,
    );
  if (!match) return null;
  return { docQuery: "" };
}

/** First lab file matching the lab search, for handing to Oracle. */
export function pickDocumentForOracle(query: string): LabEntry | null {
  return searchLab(query)[0] ?? ALL_FILES.flatMap((f) => f.entries)[0] ?? null;
}
