/**
 * THE DARK HOLE — the server functions (owner order
 * 2026-11-26). Operator-only, like the camera system itself:
 * every function re-verifies the operator session. What
 * crosses the wire is the manifest (his names, notes, and
 * filing — never a fragment), a file's bytes on their way IN
 * (to be cut on the core, never stored intact), and a
 * reassembled file on its way OUT — only after the store has
 * verified the join against the whole-file fingerprint.
 *
 * The hole itself lives in darkHoleStore.server.ts, on the
 * core. These functions are the door, not the room.
 */
import { createServerFn } from "@tanstack/react-start";
import { verifySupabaseOperatorSession } from "./operatorAuth.server";
import { getDarkHoleStore } from "./darkHoleStore.server";
import {
  addDarkHoleCategory,
  addDarkHoleSubcategory,
  deleteDarkHoleCategory,
  deleteDarkHoleSubcategory,
  renameDarkHoleCategory,
  renameDarkHoleSubcategory,
  type DarkHoleCategory,
  type DarkHoleEntry,
} from "./darkHole";

type TokenInput = { accessToken: string };

function isTokenInput(input: unknown): input is TokenInput {
  return (
    typeof input === "object" &&
    input !== null &&
    typeof (input as TokenInput).accessToken === "string" &&
    (input as TokenInput).accessToken.length > 0 &&
    (input as TokenInput).accessToken.length <= 16_384
  );
}

async function authorized(accessToken: string): Promise<boolean> {
  const verification = await verifySupabaseOperatorSession({ data: { accessToken } });
  return verification.authorized;
}

export type DarkHoleNoteResult = { authorized: boolean; ok: boolean; note: string };

const GONE = "The operator session is gone — sign in again.";
const NO_STORE = "The Dark Hole lives on the core machine — no local hole here.";

/* ------------------------------ the view ------------------------------ */

export type DarkHoleView = {
  authorized: boolean;
  storageAvailable: boolean;
  categories: DarkHoleCategory[];
  entries: DarkHoleEntry[];
};

const emptyView: DarkHoleView = {
  authorized: false,
  storageAvailable: false,
  categories: [],
  entries: [],
};

export const getDarkHole = createServerFn({ method: "POST" })
  .validator((input: unknown): TokenInput => {
    if (!isTokenInput(input)) throw new Error("Invalid Dark Hole request.");
    return input;
  })
  .handler(async ({ data }): Promise<DarkHoleView> => {
    if (!(await authorized(data.accessToken))) return emptyView;
    const store = await getDarkHoleStore();
    if (!store) return { ...emptyView, authorized: true };
    const manifest = await store.readManifest();
    return {
      authorized: true,
      storageAvailable: true,
      categories: manifest.categories,
      entries: manifest.entries,
    };
  });

/* ------------------------------ putting in ------------------------------ */

/** The largest file the door will carry in one put — 24 MB of file. */
const MAX_PUT_BASE64 = 33_600_000;

export type PutDarkHoleInput = TokenInput & {
  name: string;
  note: string;
  category: string;
  subcategory: string;
  dataBase64: string;
};

function isPutInput(input: unknown): input is PutDarkHoleInput {
  if (!isTokenInput(input)) return false;
  const put = input as PutDarkHoleInput;
  return (
    typeof put.name === "string" &&
    put.name.trim().length > 0 &&
    put.name.length <= 200 &&
    typeof put.note === "string" &&
    put.note.length <= 2000 &&
    typeof put.category === "string" &&
    put.category.length <= 80 &&
    typeof put.subcategory === "string" &&
    put.subcategory.length <= 80 &&
    typeof put.dataBase64 === "string" &&
    put.dataBase64.length <= MAX_PUT_BASE64 &&
    /^[A-Za-z0-9+/=\s]+$/.test(put.dataBase64)
  );
}

export const putIntoDarkHole = createServerFn({ method: "POST" })
  .validator((input: unknown): PutDarkHoleInput => {
    if (!isPutInput(input)) throw new Error("Invalid Dark Hole put request.");
    return input;
  })
  .handler(async ({ data }): Promise<DarkHoleNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: GONE };
    }
    const store = await getDarkHoleStore();
    if (!store) return { authorized: true, ok: false, note: NO_STORE };
    let bytes: Buffer;
    try {
      bytes = Buffer.from(data.dataBase64.replace(/\s+/g, ""), "base64");
    } catch {
      return { authorized: true, ok: false, note: "That file did not arrive whole — nothing went in." };
    }
    const entry = await store.putFile({
      name: data.name.trim(),
      note: data.note.trim(),
      category: data.category.trim(),
      subcategory: data.subcategory.trim(),
      bytes,
      at: Date.now(),
    });
    return {
      authorized: true,
      ok: true,
      note: `“${entry.name}” is in the Dark Hole — broken into ${entry.blocks.length} piece${entry.blocks.length === 1 ? "" : "s"}, filed under ${entry.category}${entry.subcategory ? ` / ${entry.subcategory}` : ""}.`,
    };
  });

/* ------------------------------ getting back ------------------------------ */

export type DarkHoleEntryInput = TokenInput & { entryId: string };

function isEntryInput(input: unknown): input is DarkHoleEntryInput {
  return (
    isTokenInput(input) &&
    typeof (input as DarkHoleEntryInput).entryId === "string" &&
    (input as DarkHoleEntryInput).entryId.length > 0 &&
    (input as DarkHoleEntryInput).entryId.length <= 128
  );
}

export type ReassembleResult = {
  authorized: boolean;
  ok: boolean;
  note: string;
  fileName: string;
  /** The verified file, base64 — null unless the join checked out whole. */
  dataBase64: string | null;
};

export const reassembleDarkHoleEntry = createServerFn({ method: "POST" })
  .validator((input: unknown): DarkHoleEntryInput => {
    if (!isEntryInput(input)) throw new Error("Invalid reassembly request.");
    return input;
  })
  .handler(async ({ data }): Promise<ReassembleResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: GONE, fileName: "", dataBase64: null };
    }
    const store = await getDarkHoleStore();
    if (!store) {
      return { authorized: true, ok: false, note: NO_STORE, fileName: "", dataBase64: null };
    }
    // The record check: the entry must stand on the manifest,
    // and the store serves bytes only when the join verifies
    // against the whole-file fingerprint.
    const result = await store.reassemble(data.entryId);
    if (!result.ok) {
      return {
        authorized: true,
        ok: false,
        note: result.failure,
        fileName: result.entry?.name ?? "",
        dataBase64: null,
      };
    }
    return {
      authorized: true,
      ok: true,
      note: `“${result.entry.name}” is back together — checked whole against its fingerprint.`,
      fileName: result.entry.name,
      dataBase64: result.bytes.toString("base64"),
    };
  });

/* ------------------------------ entry edits ------------------------------ */

export type EditDarkHoleNoteInput = TokenInput & { entryId: string; note: string };

export const editDarkHoleNote = createServerFn({ method: "POST" })
  .validator((input: unknown): EditDarkHoleNoteInput => {
    if (
      !isEntryInput(input) ||
      typeof (input as EditDarkHoleNoteInput).note !== "string" ||
      (input as EditDarkHoleNoteInput).note.length > 2000
    ) {
      throw new Error("Invalid Dark Hole note request.");
    }
    return input as EditDarkHoleNoteInput;
  })
  .handler(async ({ data }): Promise<DarkHoleNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: GONE };
    }
    const store = await getDarkHoleStore();
    if (!store) return { authorized: true, ok: false, note: NO_STORE };
    const entry = await store.updateEntry(data.entryId, { note: data.note.trim() });
    return entry
      ? { authorized: true, ok: true, note: `The note on “${entry.name}” is saved.` }
      : { authorized: true, ok: false, note: "That entry is not in the Dark Hole." };
  });

export type FileDarkHoleEntryInput = TokenInput & {
  entryId: string;
  category: string;
  subcategory: string;
};

export const fileDarkHoleEntry = createServerFn({ method: "POST" })
  .validator((input: unknown): FileDarkHoleEntryInput => {
    if (
      !isEntryInput(input) ||
      typeof (input as FileDarkHoleEntryInput).category !== "string" ||
      (input as FileDarkHoleEntryInput).category.length > 80 ||
      typeof (input as FileDarkHoleEntryInput).subcategory !== "string" ||
      (input as FileDarkHoleEntryInput).subcategory.length > 80
    ) {
      throw new Error("Invalid Dark Hole filing request.");
    }
    return input as FileDarkHoleEntryInput;
  })
  .handler(async ({ data }): Promise<DarkHoleNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: GONE };
    }
    const store = await getDarkHoleStore();
    if (!store) return { authorized: true, ok: false, note: NO_STORE };
    const before = (await store.readManifest()).entries.find((e) => e.id === data.entryId);
    if (!before) return { authorized: true, ok: false, note: "That entry is not in the Dark Hole." };
    const entry = await store.updateEntry(data.entryId, {
      category: data.category.trim(),
      subcategory: data.subcategory.trim(),
    });
    if (!entry) return { authorized: true, ok: false, note: "That entry is not in the Dark Hole." };
    if (entry.category === before.category && entry.subcategory === before.subcategory) {
      return {
        authorized: true,
        ok: false,
        note: "That shelf does not stand in the Dark Hole — make the category first, then file it.",
      };
    }
    return {
      authorized: true,
      ok: true,
      note: `“${entry.name}” is filed under ${entry.category}${entry.subcategory ? ` / ${entry.subcategory}` : ""}.`,
    };
  });

export const deleteDarkHoleEntry = createServerFn({ method: "POST" })
  .validator((input: unknown): DarkHoleEntryInput => {
    if (!isEntryInput(input)) throw new Error("Invalid Dark Hole delete request.");
    return input;
  })
  .handler(async ({ data }): Promise<DarkHoleNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: GONE };
    }
    const store = await getDarkHoleStore();
    if (!store) return { authorized: true, ok: false, note: NO_STORE };
    const removed = await store.removeEntry(data.entryId);
    return removed
      ? {
          authorized: true,
          ok: true,
          note: "Deleted — the entry and its pieces are gone from the Dark Hole.",
        }
      : { authorized: true, ok: false, note: "That entry is not in the Dark Hole." };
  });

/* ------------------------------ categories ------------------------------ */

export type DarkHoleCategoryInput = TokenInput & {
  action: "add" | "rename" | "delete";
  name: string;
  newName?: string;
};

function isCategoryInput(input: unknown): input is DarkHoleCategoryInput {
  if (!isTokenInput(input)) return false;
  const cat = input as DarkHoleCategoryInput;
  return (
    (cat.action === "add" || cat.action === "rename" || cat.action === "delete") &&
    typeof cat.name === "string" &&
    cat.name.trim().length > 0 &&
    cat.name.length <= 80 &&
    (cat.newName === undefined || (typeof cat.newName === "string" && cat.newName.length <= 80))
  );
}

export const saveDarkHoleCategory = createServerFn({ method: "POST" })
  .validator((input: unknown): DarkHoleCategoryInput => {
    if (!isCategoryInput(input)) throw new Error("Invalid Dark Hole category request.");
    return input;
  })
  .handler(async ({ data }): Promise<DarkHoleNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: GONE };
    }
    const store = await getDarkHoleStore();
    if (!store) return { authorized: true, ok: false, note: NO_STORE };
    const name = data.name.trim();
    const before = await store.readManifest();
    const mutator =
      data.action === "add"
        ? (m: Parameters<typeof addDarkHoleCategory>[0]) => addDarkHoleCategory(m, name)
        : data.action === "rename"
          ? (m: Parameters<typeof renameDarkHoleCategory>[0]) =>
              renameDarkHoleCategory(m, name, (data.newName ?? "").trim())
          : (m: Parameters<typeof deleteDarkHoleCategory>[0]) => deleteDarkHoleCategory(m, name);
    const next = await store.updateManifest(mutator);
    const changed = JSON.stringify(next.categories) !== JSON.stringify(before.categories);
    if (!changed) {
      return {
        authorized: true,
        ok: false,
        note:
          data.action === "delete" && name === "Unsorted"
            ? "“Unsorted” is the catch-all — it always stands, so it cannot be deleted."
            : "Nothing changed — the name may already stand, or the shelf named does not.",
      };
    }
    return {
      authorized: true,
      ok: true,
      note:
        data.action === "add"
          ? `Category “${name}” now stands in the Dark Hole.`
          : data.action === "rename"
            ? `Category “${name}” is now “${(data.newName ?? "").trim()}” — its entries moved with it.`
            : `Category “${name}” is gone — its entries fell back to Unsorted, none were deleted.`,
    };
  });

export type DarkHoleSubcategoryInput = TokenInput & {
  action: "add" | "rename" | "delete";
  category: string;
  name: string;
  newName?: string;
};

function isSubcategoryInput(input: unknown): input is DarkHoleSubcategoryInput {
  if (!isTokenInput(input)) return false;
  const sub = input as DarkHoleSubcategoryInput;
  return (
    (sub.action === "add" || sub.action === "rename" || sub.action === "delete") &&
    typeof sub.category === "string" &&
    sub.category.trim().length > 0 &&
    sub.category.length <= 80 &&
    typeof sub.name === "string" &&
    sub.name.trim().length > 0 &&
    sub.name.length <= 80 &&
    (sub.newName === undefined || (typeof sub.newName === "string" && sub.newName.length <= 80))
  );
}

export const saveDarkHoleSubcategory = createServerFn({ method: "POST" })
  .validator((input: unknown): DarkHoleSubcategoryInput => {
    if (!isSubcategoryInput(input)) throw new Error("Invalid Dark Hole subcategory request.");
    return input;
  })
  .handler(async ({ data }): Promise<DarkHoleNoteResult> => {
    if (!(await authorized(data.accessToken))) {
      return { authorized: false, ok: false, note: GONE };
    }
    const store = await getDarkHoleStore();
    if (!store) return { authorized: true, ok: false, note: NO_STORE };
    const category = data.category.trim();
    const name = data.name.trim();
    const before = await store.readManifest();
    const mutator =
      data.action === "add"
        ? (m: Parameters<typeof addDarkHoleSubcategory>[0]) => addDarkHoleSubcategory(m, category, name)
        : data.action === "rename"
          ? (m: Parameters<typeof renameDarkHoleSubcategory>[0]) =>
              renameDarkHoleSubcategory(m, category, name, (data.newName ?? "").trim())
          : (m: Parameters<typeof deleteDarkHoleSubcategory>[0]) =>
              deleteDarkHoleSubcategory(m, category, name);
    const next = await store.updateManifest(mutator);
    const changed = JSON.stringify(next.categories) !== JSON.stringify(before.categories);
    if (!changed) {
      return {
        authorized: true,
        ok: false,
        note: "Nothing changed — the name may already stand, or the shelf named does not.",
      };
    }
    return {
      authorized: true,
      ok: true,
      note:
        data.action === "add"
          ? `Subcategory “${name}” now stands under ${category}.`
          : data.action === "rename"
            ? `Subcategory “${name}” under ${category} is now “${(data.newName ?? "").trim()}” — its entries moved with it.`
            : `Subcategory “${name}” under ${category} is gone — its entries keep the category, none were deleted.`,
    };
  });
