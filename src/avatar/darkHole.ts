/**
 * THE DARK HOLE — the pure core (owner order 2026-11-26
 * ~12:41 CST: "that dark hole I want you to add that to
 * Augie... like a shredder. But if I need to reassemble it I
 * can reassemble it. But make sure it's broken down to its
 * finite point." He meant black hole; the name is DARK HOLE,
 * his correction stands).
 *
 * What the Dark Hole is, in plain words: his library. A file
 * he puts in is broken down to its finite point — split into
 * small fixed-size pieces (4 KiB) on the core. Each piece is
 * stored as its own fragment, named by its own SHA-256
 * fingerprint, so no fragment carries the file's name or its
 * place in the file. A manifest remembers how the pieces go
 * back together: the display name, the size, the whole-file
 * SHA-256, and the ordered list of piece fingerprints. The
 * whole file is NEVER stored intact in the hole — only the
 * pieces and the manifest exist. Reassembly joins the pieces
 * in manifest order and checks the result against the
 * whole-file fingerprint: byte-identical, or nothing is
 * served.
 *
 * THE HONEST LABEL (truth doctrine): this is breakdown and
 * scattering, NOT encryption. The pieces are the file's own
 * bytes, cut small. Say so wherever it is described.
 *
 * Categories are his filing system inside the hole: each
 * entry carries a category and an optional subcategory, can
 * be filed at put-in and re-filed later, and categories and
 * subcategories can be created, renamed, and deleted by him.
 * Deleting a category NEVER deletes entries — they fall back
 * to "Unsorted". The only delete that removes a file is his
 * explicit per-entry Delete.
 *
 * Plain TS, no I/O — the server store does the reading,
 * writing, and hashing.
 */

export const DARK_HOLE_BLOCK_SIZE = 4096;
export const DARK_HOLE_UNSORTED = "Unsorted";

const MAX_NAME = 200;
const MAX_NOTE = 2000;
const MAX_LABEL = 80;
const MAX_ID = 128;
const SHA256_HEX = /^[0-9a-f]{64}$/;

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

export interface DarkHoleEntry {
  id: string;
  /** His display name / label for the entry. */
  name: string;
  /** The original file's size in bytes. */
  size: number;
  /** The whole file's SHA-256, hex — the reassembly check. */
  sha256: string;
  /** The piece size the file was broken into (4096). */
  blockSize: number;
  /**
   * The pieces, in order. Each element is that piece's
   * SHA-256 hex — it is at once the fragment's file name in
   * the store and the piece's own hash, checked at
   * reassembly before the join is trusted.
   */
  blocks: string[];
  /** When the file went in, epoch ms. */
  addedAt: number;
  /** His editable note. */
  note: string;
  /** His category — always a category on the manifest. */
  category: string;
  /** His subcategory within the category, or "" for none. */
  subcategory: string;
}

export interface DarkHoleCategory {
  name: string;
  subcategories: string[];
}

export interface DarkHoleManifest {
  version: 1;
  categories: DarkHoleCategory[];
  entries: DarkHoleEntry[];
}

/** The starter set — his to edit from the first day. */
export const STARTER_DARK_HOLE_CATEGORIES: DarkHoleCategory[] = [
  { name: DARK_HOLE_UNSORTED, subcategories: [] },
  { name: "Documents", subcategories: [] },
  { name: "Pictures", subcategories: [] },
  { name: "Business", subcategories: [] },
  { name: "Personal", subcategories: [] },
];

export function emptyDarkHoleManifest(): DarkHoleManifest {
  return {
    version: 1,
    categories: STARTER_DARK_HOLE_CATEGORIES.map((c) => ({
      name: c.name,
      subcategories: [...c.subcategories],
    })),
    entries: [],
  };
}

/* ------------------------------------------------------------------ */
/* Sanitizers — a claim survives only in its exact shape               */
/* ------------------------------------------------------------------ */

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeDarkHoleCategory(input: unknown): DarkHoleCategory | null {
  if (!isRecord(input)) return null;
  const name = cleanText(input["name"], MAX_LABEL);
  if (!name) return null;
  const subs: string[] = [];
  if (Array.isArray(input["subcategories"])) {
    for (const raw of input["subcategories"]) {
      const sub = cleanText(raw, MAX_LABEL);
      if (sub && !subs.includes(sub)) subs.push(sub);
    }
  }
  return { name, subcategories: subs.slice(0, 100) };
}

export function sanitizeDarkHoleEntry(input: unknown): DarkHoleEntry | null {
  if (!isRecord(input)) return null;
  const id = cleanText(input["id"], MAX_ID);
  const name = cleanText(input["name"], MAX_NAME);
  const sha256 = typeof input["sha256"] === "string" ? input["sha256"] : "";
  if (!id || !name || !SHA256_HEX.test(sha256)) return null;
  const size = input["size"];
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) return null;
  const blockSize = input["blockSize"];
  if (blockSize !== DARK_HOLE_BLOCK_SIZE) return null;
  if (!Array.isArray(input["blocks"])) return null;
  const blocks: string[] = [];
  for (const raw of input["blocks"]) {
    if (typeof raw !== "string" || !SHA256_HEX.test(raw)) return null;
    blocks.push(raw);
  }
  // The piece count must fit the size: ceil(size / blockSize),
  // with an empty file holding zero pieces.
  const expected = size === 0 ? 0 : Math.ceil(size / DARK_HOLE_BLOCK_SIZE);
  if (blocks.length !== expected) return null;
  const addedAt = input["addedAt"];
  return {
    id,
    name,
    size,
    sha256,
    blockSize: DARK_HOLE_BLOCK_SIZE,
    blocks,
    addedAt: typeof addedAt === "number" && Number.isFinite(addedAt) && addedAt > 0 ? addedAt : 0,
    note: cleanText(input["note"], MAX_NOTE),
    category: cleanText(input["category"], MAX_LABEL) || DARK_HOLE_UNSORTED,
    subcategory: cleanText(input["subcategory"], MAX_LABEL),
  };
}

export function sanitizeDarkHoleManifest(input: unknown): DarkHoleManifest {
  const manifest = emptyDarkHoleManifest();
  if (!isRecord(input)) return manifest;
  const categories: DarkHoleCategory[] = [];
  if (Array.isArray(input["categories"])) {
    for (const raw of input["categories"]) {
      const category = sanitizeDarkHoleCategory(raw);
      if (category && !categories.some((c) => c.name === category.name)) {
        categories.push(category);
      }
    }
  }
  if (categories.length > 0) {
    // "Unsorted" is the catch-all — it always stands, first.
    const unsorted = categories.find((c) => c.name === DARK_HOLE_UNSORTED);
    manifest.categories = [
      unsorted ?? { name: DARK_HOLE_UNSORTED, subcategories: [] },
      ...categories.filter((c) => c.name !== DARK_HOLE_UNSORTED),
    ];
  }
  const entries: DarkHoleEntry[] = [];
  if (Array.isArray(input["entries"])) {
    for (const raw of input["entries"]) {
      const entry = sanitizeDarkHoleEntry(raw);
      if (!entry || entries.some((e) => e.id === entry.id)) continue;
      // Filing must point at a real shelf: an entry filed
      // under a category that no longer stands falls back to
      // Unsorted, and a subcategory that no longer stands
      // under its category is cleared — the entry itself is
      // never dropped for a filing problem.
      const shelf = manifest.categories.find((c) => c.name === entry.category);
      if (!shelf) {
        entry.category = DARK_HOLE_UNSORTED;
        entry.subcategory = "";
      } else if (entry.subcategory && !shelf.subcategories.includes(entry.subcategory)) {
        entry.subcategory = "";
      }
      entries.push(entry);
    }
  }
  manifest.entries = entries;
  return manifest;
}

/* ------------------------------------------------------------------ */
/* Breakdown — the cut itself (hashing lives in the store)             */
/* ------------------------------------------------------------------ */

/** Split bytes into fixed-size pieces, in order. Pure. */
export function splitIntoBlocks(bytes: Uint8Array, blockSize: number = DARK_HOLE_BLOCK_SIZE): Uint8Array[] {
  const blocks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += blockSize) {
    blocks.push(bytes.slice(offset, offset + blockSize));
  }
  return blocks;
}

/* ------------------------------------------------------------------ */
/* Filing — categories, subcategories, moving entries                  */
/* ------------------------------------------------------------------ */

export function categoryNamed(manifest: DarkHoleManifest, name: string): DarkHoleCategory | null {
  return manifest.categories.find((c) => c.name === name) ?? null;
}

/** True when (category, subcategory) is a shelf that stands on the manifest. */
export function filingStands(manifest: DarkHoleManifest, category: string, subcategory: string): boolean {
  const shelf = categoryNamed(manifest, category);
  if (!shelf) return false;
  return subcategory === "" || shelf.subcategories.includes(subcategory);
}

/** File (or re-file) one entry. A filing that does not stand changes nothing. */
export function fileDarkHoleEntry(
  manifest: DarkHoleManifest,
  entryId: string,
  category: string,
  subcategory: string,
): DarkHoleManifest {
  if (!filingStands(manifest, category, subcategory)) return manifest;
  return {
    ...manifest,
    entries: manifest.entries.map((e) => (e.id === entryId ? { ...e, category, subcategory } : e)),
  };
}

export function addDarkHoleCategory(manifest: DarkHoleManifest, name: string): DarkHoleManifest {
  const clean = name.trim().slice(0, MAX_LABEL);
  if (!clean || categoryNamed(manifest, clean)) return manifest;
  return { ...manifest, categories: [...manifest.categories, { name: clean, subcategories: [] }] };
}

export function renameDarkHoleCategory(
  manifest: DarkHoleManifest,
  from: string,
  to: string,
): DarkHoleManifest {
  const clean = to.trim().slice(0, MAX_LABEL);
  if (from === DARK_HOLE_UNSORTED || !clean || clean === from) return manifest;
  if (!categoryNamed(manifest, from) || categoryNamed(manifest, clean)) return manifest;
  return {
    ...manifest,
    categories: manifest.categories.map((c) => (c.name === from ? { ...c, name: clean } : c)),
    entries: manifest.entries.map((e) => (e.category === from ? { ...e, category: clean } : e)),
  };
}

/**
 * Delete a category. The entries are NEVER deleted with it —
 * they fall back to Unsorted, unsubcategorized. "Unsorted"
 * itself cannot be deleted: it is the catch-all.
 */
export function deleteDarkHoleCategory(manifest: DarkHoleManifest, name: string): DarkHoleManifest {
  if (name === DARK_HOLE_UNSORTED || !categoryNamed(manifest, name)) return manifest;
  return {
    ...manifest,
    categories: manifest.categories.filter((c) => c.name !== name),
    entries: manifest.entries.map((e) =>
      e.category === name ? { ...e, category: DARK_HOLE_UNSORTED, subcategory: "" } : e,
    ),
  };
}

export function addDarkHoleSubcategory(
  manifest: DarkHoleManifest,
  category: string,
  subcategory: string,
): DarkHoleManifest {
  const clean = subcategory.trim().slice(0, MAX_LABEL);
  const shelf = categoryNamed(manifest, category);
  if (!clean || !shelf || shelf.subcategories.includes(clean)) return manifest;
  return {
    ...manifest,
    categories: manifest.categories.map((c) =>
      c.name === category ? { ...c, subcategories: [...c.subcategories, clean] } : c,
    ),
  };
}

export function renameDarkHoleSubcategory(
  manifest: DarkHoleManifest,
  category: string,
  from: string,
  to: string,
): DarkHoleManifest {
  const clean = to.trim().slice(0, MAX_LABEL);
  const shelf = categoryNamed(manifest, category);
  if (!shelf || !clean || clean === from) return manifest;
  if (!shelf.subcategories.includes(from) || shelf.subcategories.includes(clean)) return manifest;
  return {
    ...manifest,
    categories: manifest.categories.map((c) =>
      c.name === category
        ? { ...c, subcategories: c.subcategories.map((s) => (s === from ? clean : s)) }
        : c,
    ),
    entries: manifest.entries.map((e) =>
      e.category === category && e.subcategory === from ? { ...e, subcategory: clean } : e,
    ),
  };
}

/** Delete a subcategory. Entries keep their category; only the sub label is cleared. */
export function deleteDarkHoleSubcategory(
  manifest: DarkHoleManifest,
  category: string,
  subcategory: string,
): DarkHoleManifest {
  const shelf = categoryNamed(manifest, category);
  if (!shelf || !shelf.subcategories.includes(subcategory)) return manifest;
  return {
    ...manifest,
    categories: manifest.categories.map((c) =>
      c.name === category
        ? { ...c, subcategories: c.subcategories.filter((s) => s !== subcategory) }
        : c,
    ),
    entries: manifest.entries.map((e) =>
      e.category === category && e.subcategory === subcategory ? { ...e, subcategory: "" } : e,
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Finding things                                                      */
/* ------------------------------------------------------------------ */

/** Entries on one shelf — a category, or one subcategory of it when named. */
export function entriesOnShelf(
  manifest: DarkHoleManifest,
  category: string,
  subcategory?: string,
): DarkHoleEntry[] {
  return manifest.entries.filter(
    (e) => e.category === category && (subcategory === undefined || e.subcategory === subcategory),
  );
}

/** Find by name or note — case-insensitive, partial. An empty search returns all. */
export function searchDarkHoleEntries(entries: DarkHoleEntry[], query: string): DarkHoleEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter(
    (e) => e.name.toLowerCase().includes(needle) || e.note.toLowerCase().includes(needle),
  );
}
