import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DARK_HOLE_BLOCK_SIZE,
  DARK_HOLE_UNSORTED,
  addDarkHoleCategory,
  addDarkHoleSubcategory,
  deleteDarkHoleCategory,
  deleteDarkHoleSubcategory,
  emptyDarkHoleManifest,
  entriesOnShelf,
  fileDarkHoleEntry,
  renameDarkHoleCategory,
  renameDarkHoleSubcategory,
  sanitizeDarkHoleManifest,
  searchDarkHoleEntries,
  splitIntoBlocks,
  type DarkHoleManifest,
} from "@/avatar/darkHole";
import { FileDarkHoleStore } from "@/avatar/darkHoleStore.server";

/**
 * THE DARK HOLE (owner order 2026-11-26) — his library of
 * broken-down files. These pins hold its laws:
 *
 *   · BREAKDOWN, NOT DESTRUCTION — a file goes in as pieces
 *     and comes back byte-identical, at every size.
 *   · NEVER INTACT — the store holds fragments and a
 *     manifest; the whole file is nowhere in it.
 *   · VERIFIED OR NOTHING — a tampered piece fails the
 *     fingerprint check; a missing piece is reported BY
 *     POSITION; no partial file is ever served as whole.
 *   · HIS DELETE IS REAL — the entry and its unshared
 *     fragments go; a shared piece survives while another
 *     entry names it.
 *   · HIS FILING — categories/subcategories are his; a
 *     deleted category drops its entries to Unsorted and
 *     deletes none of them.
 *   · OWNER ONLY — the window stands on the operator stage;
 *     the learner surface carries no trace of it.
 */

function patternedBytes(length: number, seed = 1): Buffer {
  const bytes = Buffer.alloc(length);
  let state = (seed * 2654435761) % 4294967296;
  for (let i = 0; i < length; i += 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    bytes[i] = (state >>> 24) & 0xff;
  }
  return bytes;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function withStore<T>(fn: (store: FileDarkHoleStore, dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "augie-dark-hole-test-"));
  try {
    return await fn(new FileDarkHoleStore(fsp, dir), dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function put(store: FileDarkHoleStore, name: string, bytes: Buffer, extra: Partial<{ note: string; category: string; subcategory: string }> = {}) {
  return store.putFile({
    name,
    note: extra.note ?? "",
    category: extra.category ?? DARK_HOLE_UNSORTED,
    subcategory: extra.subcategory ?? "",
    bytes,
    at: 1_700_000_000_000,
  });
}

describe("the cut — splitIntoBlocks", () => {
  it("cuts at the block line and joins back to the same bytes", () => {
    for (const size of [0, 1, 4095, 4096, 4097, 10_000]) {
      const original = patternedBytes(size, size + 3);
      const pieces = splitIntoBlocks(original);
      const expected = size === 0 ? 0 : Math.ceil(size / DARK_HOLE_BLOCK_SIZE);
      expect(pieces).toHaveLength(expected);
      expect(Buffer.concat(pieces).equals(original)).toBe(true);
      for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(DARK_HOLE_BLOCK_SIZE);
    }
  });
});

describe("sanitizers — the manifest's shape is the law", () => {
  it("the starter manifest stands with Unsorted first and the starter shelves", () => {
    const manifest = sanitizeDarkHoleManifest(null);
    expect(manifest.categories.map((c) => c.name)).toEqual([
      "Unsorted",
      "Documents",
      "Pictures",
      "Business",
      "Personal",
    ]);
    expect(manifest.entries).toEqual([]);
  });

  it("an entry whose piece count does not fit its size is dropped; a misfilled entry falls back, never drops", () => {
    const bytes = patternedBytes(100, 5);
    const good = {
      id: "dh-1",
      name: "note.txt",
      size: 100,
      sha256: sha256Hex(bytes),
      blockSize: DARK_HOLE_BLOCK_SIZE,
      blocks: [sha256Hex(bytes)],
      addedAt: 5,
      note: "",
      category: "Vanished",
      subcategory: "Gone",
    };
    const manifest = sanitizeDarkHoleManifest({
      categories: [{ name: "Unsorted", subcategories: [] }],
      entries: [good, { ...good, id: "dh-2", blocks: [] }],
    });
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0]?.category).toBe(DARK_HOLE_UNSORTED);
    expect(manifest.entries[0]?.subcategory).toBe("");
  });
});

describe("round trip — breakdown, not destruction", () => {
  it("every size comes back byte-identical: 0, 1, block edges, multi-block", async () => {
    await withStore(async (store) => {
      for (const size of [0, 1, 4095, 4096, 4097, 100_000]) {
        const original = patternedBytes(size, size + 11);
        const entry = await put(store, `file-${size}.bin`, original);
        expect(entry.size).toBe(size);
        expect(entry.sha256).toBe(sha256Hex(original));
        expect(entry.blocks).toHaveLength(size === 0 ? 0 : Math.ceil(size / DARK_HOLE_BLOCK_SIZE));
        const back = await store.reassemble(entry.id);
        expect(back.ok).toBe(true);
        if (back.ok) expect(back.bytes.equals(original)).toBe(true);
      }
    });
  });

  it("the store never contains the intact file — only pieces and the manifest", async () => {
    await withStore(async (store, dir) => {
      const original = patternedBytes(100_000, 42);
      await put(store, "big.bin", original);
      const fragments = await readdir(join(dir, "fragments"));
      expect(fragments.length).toBeGreaterThan(1);
      for (const name of fragments) {
        const piece = await readFile(join(dir, "fragments", name));
        expect(piece.length).toBeLessThanOrEqual(DARK_HOLE_BLOCK_SIZE);
        expect(piece.equals(original)).toBe(false);
        expect(name).toBe(sha256Hex(piece));
      }
      const manifestText = await readFile(join(dir, "manifest.json"), "utf8");
      expect(manifestText).not.toContain(original.toString("base64"));
    });
  });
});

describe("verified or nothing — damage is reported, never served", () => {
  it("a tampered piece fails its fingerprint and nothing is served", async () => {
    await withStore(async (store, dir) => {
      const entry = await put(store, "proof.bin", patternedBytes(10_000, 7));
      const target = join(dir, "fragments", entry.blocks[1] as string);
      const piece = await readFile(target);
      piece[0] = (piece[0] as number) ^ 0xff;
      await writeFile(target, piece);
      const back = await store.reassemble(entry.id);
      expect(back.ok).toBe(false);
      if (!back.ok) {
        expect(back.failure).toContain("Piece 2");
        expect(back.failure).toContain("nothing was served");
      }
    });
  });

  it("a missing piece is reported by its position", async () => {
    await withStore(async (store, dir) => {
      const entry = await put(store, "proof.bin", patternedBytes(10_000, 9));
      await unlink(join(dir, "fragments", entry.blocks[2] as string));
      const back = await store.reassemble(entry.id);
      expect(back.ok).toBe(false);
      if (!back.ok) {
        expect(back.failure).toContain("Piece 3");
        expect(back.failure).toContain("missing");
      }
    });
  });

  it("an entry that is not in the hole reassembles to a refusal, not a file", async () => {
    await withStore(async (store) => {
      const back = await store.reassemble("dh-not-there");
      expect(back.ok).toBe(false);
      if (!back.ok) expect(back.failure).toContain("not in the Dark Hole");
    });
  });
});

describe("his delete — real, and only his", () => {
  it("delete removes the manifest entry and its fragments from disk", async () => {
    await withStore(async (store, dir) => {
      const a = await put(store, "a.bin", patternedBytes(9000, 21));
      const b = await put(store, "b.bin", patternedBytes(9000, 22));
      expect(await store.removeEntry(a.id)).toBe(true);
      const manifest = await store.readManifest();
      expect(manifest.entries.map((e) => e.id)).toEqual([b.id]);
      for (const fingerprint of a.blocks) {
        await expect(readFile(join(dir, "fragments", fingerprint))).rejects.toThrow();
      }
      const back = await store.reassemble(b.id);
      expect(back.ok).toBe(true);
      expect(await store.removeEntry(a.id)).toBe(false);
    });
  });

  it("a shared piece survives while another entry still names it", async () => {
    await withStore(async (store, dir) => {
      const same = patternedBytes(5000, 33);
      const one = await put(store, "one.bin", same);
      const two = await put(store, "two.bin", Buffer.from(same));
      expect(one.blocks).toEqual(two.blocks);
      const fragments = await readdir(join(dir, "fragments"));
      expect(fragments).toHaveLength(one.blocks.length);
      await store.removeEntry(one.id);
      const back = await store.reassemble(two.id);
      expect(back.ok).toBe(true);
      if (back.ok) expect(back.bytes.equals(same)).toBe(true);
    });
  });
});

describe("his filing — categories and subcategories", () => {
  it("an entry is filed at put-in, on a shelf that stands", async () => {
    await withStore(async (store) => {
      await store.updateManifest((m) => addDarkHoleSubcategory(m, "Business", "Invoices"));
      const entry = await put(store, "invoice.pdf", patternedBytes(120, 3), {
        category: "Business",
        subcategory: "Invoices",
      });
      expect(entry.category).toBe("Business");
      expect(entry.subcategory).toBe("Invoices");
    });
  });

  it("a filing that does not stand falls back to Unsorted — the file still goes in", async () => {
    await withStore(async (store) => {
      const entry = await put(store, "loose.bin", patternedBytes(50, 4), { category: "Nowhere" });
      expect(entry.category).toBe(DARK_HOLE_UNSORTED);
      expect(entry.subcategory).toBe("");
    });
  });

  it("re-filing moves an entry; a bad shelf leaves it where it stands", async () => {
    await withStore(async (store) => {
      const entry = await put(store, "move.bin", patternedBytes(50, 6));
      const moved = await store.updateEntry(entry.id, { category: "Personal", subcategory: "" });
      expect(moved?.category).toBe("Personal");
      const stayed = await store.updateEntry(entry.id, { category: "Nowhere", subcategory: "" });
      expect(stayed?.category).toBe("Personal");
      const noted = await store.updateEntry(entry.id, { note: "the truck papers" });
      expect(noted?.note).toBe("the truck papers");
    });
  });

  it("renaming a category keeps its entries — they move with the name", async () => {
    await withStore(async (store) => {
      const entry = await put(store, "keep.bin", patternedBytes(50, 8), { category: "Business" });
      await store.updateManifest((m) => renameDarkHoleCategory(m, "Business", "Company"));
      const manifest = await store.readManifest();
      expect(manifest.entries.find((e) => e.id === entry.id)?.category).toBe("Company");
      expect(entriesOnShelf(manifest, "Company")).toHaveLength(1);
    });
  });

  it("deleting a category drops its entries to Unsorted and deletes none of them", async () => {
    await withStore(async (store) => {
      const a = await put(store, "a.bin", patternedBytes(50, 12), { category: "Business" });
      const b = await put(store, "b.bin", patternedBytes(50, 13), { category: "Business" });
      await store.updateManifest((m) => deleteDarkHoleCategory(m, "Business"));
      const manifest = await store.readManifest();
      expect(manifest.entries).toHaveLength(2);
      for (const entry of manifest.entries) {
        expect(entry.category).toBe(DARK_HOLE_UNSORTED);
        expect(entry.subcategory).toBe("");
      }
      expect((await store.reassemble(a.id)).ok).toBe(true);
      expect((await store.reassemble(b.id)).ok).toBe(true);
      // Unsorted itself cannot be deleted.
      const after = deleteDarkHoleCategory(manifest, DARK_HOLE_UNSORTED);
      expect(after.categories.some((c) => c.name === DARK_HOLE_UNSORTED)).toBe(true);
    });
  });

  it("subcategory add, rename, and delete — entries follow, none are lost", () => {
    let manifest: DarkHoleManifest = emptyDarkHoleManifest();
    manifest = addDarkHoleCategory(manifest, "Land");
    manifest = addDarkHoleSubcategory(manifest, "Land", "Deeds");
    manifest = fileDarkHoleEntry(
      {
        ...manifest,
        entries: [
          {
            id: "dh-x",
            name: "deed.pdf",
            size: 1,
            sha256: sha256Hex(new Uint8Array([1])),
            blockSize: DARK_HOLE_BLOCK_SIZE,
            blocks: [sha256Hex(new Uint8Array([1]))],
            addedAt: 1,
            note: "",
            category: "Land",
            subcategory: "Deeds",
          },
        ],
      },
      "dh-x",
      "Land",
      "Deeds",
    );
    manifest = renameDarkHoleSubcategory(manifest, "Land", "Deeds", "Titles");
    expect(manifest.entries[0]?.subcategory).toBe("Titles");
    manifest = deleteDarkHoleSubcategory(manifest, "Land", "Titles");
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0]?.category).toBe("Land");
    expect(manifest.entries[0]?.subcategory).toBe("");
  });

  it("search finds an entry by its name and by its note", async () => {
    await withStore(async (store) => {
      await put(store, "passport-scan.jpg", patternedBytes(50, 15), { note: "travel papers" });
      await put(store, "lease.pdf", patternedBytes(50, 16), { note: "the apartment lease" });
      const manifest = await store.readManifest();
      expect(searchDarkHoleEntries(manifest.entries, "passport").map((e) => e.name)).toEqual([
        "passport-scan.jpg",
      ]);
      expect(searchDarkHoleEntries(manifest.entries, "LEASE").map((e) => e.name)).toEqual([
        "lease.pdf",
      ]);
      expect(searchDarkHoleEntries(manifest.entries, "travel").map((e) => e.name)).toEqual([
        "passport-scan.jpg",
      ]);
      expect(searchDarkHoleEntries(manifest.entries, "nothing matches this")).toEqual([]);
      expect(searchDarkHoleEntries(manifest.entries, "")).toHaveLength(2);
    });
  });
});

describe("wiring — the window stands on the owner's stage only", () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

  it("the stage opens the Dark Hole from Records & safety", () => {
    const stage = read("src/avatar/AvatarStage.tsx");
    expect(stage).toContain("DarkHoleWindow");
    expect(stage).toContain('label="Dark Hole"');
    const groupAt = stage.indexOf('label="Records & safety"');
    const darkHoleAt = stage.indexOf('label="Dark Hole"');
    expect(groupAt).toBeGreaterThan(-1);
    expect(darkHoleAt).toBeGreaterThan(groupAt);
  });

  it("the learner surface carries no trace of the Dark Hole", () => {
    const learnerDir = resolve(process.cwd(), "src/avatar/learner");
    const files = readdirSync(learnerDir, { recursive: true })
      .map((f) => String(f))
      .filter((f) => /\.(ts|tsx)$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(join(learnerDir, file), "utf8");
      expect(text).not.toContain("DarkHole");
      expect(text).not.toContain("darkHole");
      expect(text).not.toContain("Dark Hole");
    }
  });

  it("the manual carries the Dark Hole entry and the window its styles", () => {
    expect(read("src/avatar/manualContent.ts")).toContain('id: "dark-hole"');
    expect(read("src/styles.css")).toContain(".window-darkhole");
  });
});
