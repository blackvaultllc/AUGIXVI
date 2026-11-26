/**
 * THE DARK HOLE STORE — node-only, server-side.
 *
 * The durable half of the Dark Hole (owner order 2026-11-26):
 * a folder of the core's own, ~/.local/share/augie/dark-hole/
 * (0700), holding exactly two kinds of thing:
 *
 *   · fragments/ — the pieces. Each file is one 4 KiB block
 *     of some file he put in, named by its own SHA-256
 *     fingerprint (0600). No fragment carries a file's name
 *     or its place — the name IS the hash, nothing more.
 *   · manifest.json — the one map (0600): his categories and,
 *     per entry, the display name, the size, the whole-file
 *     SHA-256, and the ordered list of piece fingerprints.
 *
 * The whole file is never written here intact — putFile cuts
 * before it stores, and only the cut pieces land. Reassembly
 * reads the pieces in manifest order, checks every piece
 * against its fingerprint, joins them, and checks the join
 * against the whole-file fingerprint: byte-identical or it
 * reports the failure and serves nothing. A missing piece is
 * reported BY POSITION ("piece 17 is missing") — never a
 * partial file dressed as whole.
 *
 * Delete is his and it is real: the manifest entry goes, and
 * every fragment no surviving entry still names goes with
 * it. (Two entries can share a piece — identical blocks —
 * so a fragment is removed only when nothing left in the
 * hole names it.)
 *
 * Where there is no node filesystem (the Cloudflare Worker)
 * the store is unavailable and says so — the Dark Hole is a
 * capability of the core machine, like the cameras.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  DARK_HOLE_BLOCK_SIZE,
  DARK_HOLE_UNSORTED,
  filingStands,
  sanitizeDarkHoleManifest,
  splitIntoBlocks,
  type DarkHoleEntry,
  type DarkHoleManifest,
} from "./darkHole";

type HoleFs = typeof import("node:fs/promises");

const MANIFEST_FILE = "manifest.json";
const FRAGMENTS_DIR = "fragments";

export type DarkHoleReassembly =
  | { ok: true; entry: DarkHoleEntry; bytes: Buffer }
  | { ok: false; entry: DarkHoleEntry | null; failure: string };

export interface DarkHolePutInput {
  name: string;
  note: string;
  category: string;
  subcategory: string;
  bytes: Buffer;
  at: number;
}

export interface DarkHoleStore {
  readManifest(): Promise<DarkHoleManifest>;
  /** Cut a file to pieces and file it. The intact bytes are never written. */
  putFile(input: DarkHolePutInput): Promise<DarkHoleEntry>;
  /** Join an entry's pieces back together — verified, or nothing. */
  reassemble(entryId: string): Promise<DarkHoleReassembly>;
  /** Edit an entry's note and/or filing. Returns the entry, or null if absent. */
  updateEntry(
    entryId: string,
    patch: { note?: string; category?: string; subcategory?: string },
  ): Promise<DarkHoleEntry | null>;
  /** His delete: manifest entry + its unshared fragments, gone. */
  removeEntry(entryId: string): Promise<boolean>;
  /** Serialized manifest transform — category management goes through here. */
  updateManifest(
    mutator: (manifest: DarkHoleManifest) => DarkHoleManifest,
  ): Promise<DarkHoleManifest>;
  readonly dataDirectory: string;
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export class FileDarkHoleStore implements DarkHoleStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: HoleFs,
    private readonly directory: string,
  ) {}

  private get manifestPath(): string {
    return `${this.directory}/${MANIFEST_FILE}`;
  }

  private get fragmentsPath(): string {
    return `${this.directory}/${FRAGMENTS_DIR}`;
  }

  private fragmentPath(fingerprint: string): string {
    return `${this.fragmentsPath}/${fingerprint}`;
  }

  get dataDirectory(): string {
    return this.directory;
  }

  async readManifest(): Promise<DarkHoleManifest> {
    try {
      const parsed: unknown = JSON.parse(await this.fs.readFile(this.manifestPath, "utf8"));
      return sanitizeDarkHoleManifest(parsed);
    } catch {
      return sanitizeDarkHoleManifest(null);
    }
  }

  private async writeManifest(manifest: DarkHoleManifest): Promise<void> {
    await this.fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    await this.fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  updateManifest(
    mutator: (manifest: DarkHoleManifest) => DarkHoleManifest,
  ): Promise<DarkHoleManifest> {
    const job = async () => {
      const current = await this.readManifest();
      const next = sanitizeDarkHoleManifest(mutator(current));
      await this.writeManifest(next);
      return next;
    };
    const result = this.tail.then(job, job);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async putFile(input: DarkHolePutInput): Promise<DarkHoleEntry> {
    // The cut happens first, before anything is stored: the
    // intact file is never written to the hole, not even for
    // a moment on the way in.
    const pieces = splitIntoBlocks(input.bytes, DARK_HOLE_BLOCK_SIZE);
    const fingerprints = pieces.map((piece) => sha256Hex(piece));
    await this.fs.mkdir(this.fragmentsPath, { recursive: true, mode: 0o700 });
    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i] as Uint8Array;
      const fingerprint = fingerprints[i] as string;
      try {
        // "wx": a piece already in the hole (an identical
        // block from another file) is kept, not rewritten.
        await this.fs.writeFile(this.fragmentPath(fingerprint), piece, {
          flag: "wx",
          mode: 0o600,
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    const entry: DarkHoleEntry = {
      id: `dh-${randomUUID()}`,
      name: input.name,
      size: input.bytes.length,
      sha256: sha256Hex(input.bytes),
      blockSize: DARK_HOLE_BLOCK_SIZE,
      blocks: fingerprints,
      addedAt: input.at,
      note: input.note,
      category: input.category,
      subcategory: input.subcategory,
    };
    await this.updateManifest((manifest) => {
      // A filing that does not stand on the manifest falls
      // back to the catch-all — the file still goes in.
      const filed = filingStands(manifest, entry.category, entry.subcategory)
        ? entry
        : { ...entry, category: DARK_HOLE_UNSORTED, subcategory: "" };
      return { ...manifest, entries: [filed, ...manifest.entries] };
    });
    const saved = await this.readManifest();
    return saved.entries.find((e) => e.id === entry.id) ?? entry;
  }

  async reassemble(entryId: string): Promise<DarkHoleReassembly> {
    const manifest = await this.readManifest();
    const entry = manifest.entries.find((e) => e.id === entryId) ?? null;
    if (!entry) return { ok: false, entry: null, failure: "That entry is not in the Dark Hole." };
    const pieces: Buffer[] = [];
    for (let i = 0; i < entry.blocks.length; i += 1) {
      const fingerprint = entry.blocks[i] as string;
      let piece: Buffer;
      try {
        piece = await this.fs.readFile(this.fragmentPath(fingerprint));
      } catch {
        return {
          ok: false,
          entry,
          failure: `Piece ${i + 1} of ${entry.blocks.length} is missing — the file cannot be put back together, and nothing was served.`,
        };
      }
      if (sha256Hex(piece) !== fingerprint) {
        return {
          ok: false,
          entry,
          failure: `Piece ${i + 1} of ${entry.blocks.length} does not match its fingerprint — it has been damaged or changed, and nothing was served.`,
        };
      }
      pieces.push(piece);
    }
    const joined = Buffer.concat(pieces);
    if (joined.length !== entry.size || sha256Hex(joined) !== entry.sha256) {
      return {
        ok: false,
        entry,
        failure:
          "The pieces joined but the whole does not match the fingerprint taken when the file went in — nothing was served.",
      };
    }
    return { ok: true, entry, bytes: joined };
  }

  async updateEntry(
    entryId: string,
    patch: { note?: string; category?: string; subcategory?: string },
  ): Promise<DarkHoleEntry | null> {
    let updated: DarkHoleEntry | null = null;
    await this.updateManifest((manifest) => ({
      ...manifest,
      entries: manifest.entries.map((e) => {
        if (e.id !== entryId) return e;
        const wantsFiling = patch.category !== undefined || patch.subcategory !== undefined;
        const category = patch.category ?? e.category;
        const subcategory = patch.subcategory ?? e.subcategory;
        const filed = !wantsFiling || filingStands(manifest, category, subcategory);
        updated = {
          ...e,
          note: patch.note !== undefined ? patch.note : e.note,
          category: filed ? category : e.category,
          subcategory: filed ? subcategory : e.subcategory,
        };
        return updated;
      }),
    }));
    return updated;
  }

  async removeEntry(entryId: string): Promise<boolean> {
    const before = await this.readManifest();
    const entry = before.entries.find((e) => e.id === entryId);
    if (!entry) return false;
    const next = await this.updateManifest((manifest) => ({
      ...manifest,
      entries: manifest.entries.filter((e) => e.id !== entryId),
    }));
    // Fragments another surviving entry still names are
    // shared pieces — they stay. The rest go for real.
    const stillNamed = new Set(next.entries.flatMap((e) => e.blocks));
    for (const fingerprint of new Set(entry.blocks)) {
      if (stillNamed.has(fingerprint)) continue;
      try {
        await this.fs.unlink(this.fragmentPath(fingerprint));
      } catch {
        // Already gone — the delete still stands.
      }
    }
    return true;
  }
}

let storePromise: Promise<FileDarkHoleStore | null> | null = null;

export function getDarkHoleStore(): Promise<FileDarkHoleStore | null> {
  storePromise ??= (async () => {
    const home = process.env["HOME"]?.trim();
    if (!home) return null;
    try {
      const fs = await import("node:fs/promises");
      return new FileDarkHoleStore(fs, `${home}/.local/share/augie/dark-hole`);
    } catch {
      return null;
    }
  })();
  return storePromise;
}
