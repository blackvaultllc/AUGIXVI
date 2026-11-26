/**
 * THE DARK HOLE WINDOW (owner order 2026-11-26: "add that
 * to Augie... any file that I put in there, broken down to
 * its finite point like a shredder — but if I need to
 * reassemble it I can reassemble it").
 *
 * His library. A file put in here is cut into 4 KiB pieces
 * on the core; the pieces are stored by their fingerprints
 * and a manifest remembers the order. The whole file is
 * never stored intact — what stands in this window is the
 * manifest: his names, his notes, his filing. Reassemble
 * joins the pieces and checks the whole against the
 * fingerprint taken when the file went in; a failed check
 * serves nothing, and the window says why.
 *
 * Honest label, in the open: this is breakdown and
 * scattering — NOT encryption. The pieces are the file's
 * own bytes, cut small.
 *
 * Filing is his: categories and subcategories he creates,
 * renames, and deletes; entries filed at put-in and
 * re-filed later; a deleted category drops its entries to
 * Unsorted and deletes none of them. The only delete that
 * removes a file is the per-entry Delete, behind a confirm.
 *
 * Owner surface only — this window is opened from the
 * operator stage's Tools → Records & safety, and every call
 * re-verifies the operator session server-side. It is never
 * part of the learner (Khadija) surface.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getSupabaseClientConfig } from "./operatorAuth.server";
import {
  deleteDarkHoleEntry,
  editDarkHoleNote,
  fileDarkHoleEntry,
  getDarkHole,
  putIntoDarkHole,
  reassembleDarkHoleEntry,
  saveDarkHoleCategory,
  saveDarkHoleSubcategory,
  type DarkHoleView,
} from "./darkHole.server";
import {
  DARK_HOLE_UNSORTED,
  searchDarkHoleEntries,
  type DarkHoleEntry,
} from "./darkHole";

async function loadAuthClient(): Promise<SupabaseClient | null> {
  let url = import.meta.env["VITE_SUPABASE_URL"]?.trim();
  let publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]?.trim();
  if (!url || !publishableKey) {
    const config = (await getSupabaseClientConfig().catch(() => null)) ?? null;
    url = config?.url?.trim();
    publishableKey = config?.publishableKey?.trim();
  }
  if (!url || !publishableKey) return null;
  return createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}

async function accessToken(): Promise<string | null> {
  const client = await loadAuthClient();
  if (!client) return null;
  return (await client.auth.getSession()).data.session?.access_token ?? null;
}

function dayTime(at: number): string {
  if (!at) return "date not recorded";
  return new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function humanSize(size: number): string {
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadBase64(fileName: string, dataBase64: string) {
  const anchor = document.createElement("a");
  anchor.href = `data:application/octet-stream;base64,${dataBase64}`;
  anchor.download = fileName;
  anchor.click();
}

export function DarkHoleWindow({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<DarkHoleView | null>(null);
  const [denied, setDenied] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  /* Put-in form. */
  const [picked, setPicked] = useState<{ name: string; dataBase64: string } | null>(null);
  const [putName, setPutName] = useState("");
  const [putNote, setPutNote] = useState("");
  const [putCategory, setPutCategory] = useState(DARK_HOLE_UNSORTED);
  const [putSubcategory, setPutSubcategory] = useState("");

  /* Browse state. */
  const [shelf, setShelf] = useState<string>("All");
  const [subShelf, setSubShelf] = useState<string>("");
  const [search, setSearch] = useState("");

  /* Per-entry working state. */
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [moveDrafts, setMoveDrafts] = useState<Record<string, { category: string; subcategory: string }>>({});
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  /* Category manager working state. */
  const [newCategory, setNewCategory] = useState("");
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [newSubDrafts, setNewSubDrafts] = useState<Record<string, string>>({});
  const [renameSubDrafts, setRenameSubDrafts] = useState<Record<string, string>>({});
  const [confirmingShelf, setConfirmingShelf] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    const next = await getDarkHole({ data: { accessToken: token } }).catch(() => null);
    if (next && !next.authorized) {
      setDenied(true);
      return;
    }
    if (next) setView(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (fn: (token: string) => Promise<{ note: string }>) => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    setBusy(true);
    try {
      const result = await fn(token);
      setNote(result.note);
    } catch {
      setNote("The core did not answer — nothing was changed.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const pickFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      const base64 = url.includes(",") ? (url.split(",")[1] ?? "") : "";
      if (!base64) {
        setNote("That file could not be read — nothing went in.");
        return;
      }
      setPicked({ name: file.name, dataBase64: base64 });
      setPutName(file.name);
    };
    reader.onerror = () => setNote("That file could not be read — nothing went in.");
    reader.readAsDataURL(file);
  };

  const putIn = async () => {
    if (!picked) {
      setNote("Pick a file first — then put it in.");
      return;
    }
    await run(async (token) => {
      const result = await putIntoDarkHole({
        data: {
          accessToken: token,
          name: putName.trim() || picked.name,
          note: putNote,
          category: putCategory,
          subcategory: putSubcategory,
          dataBase64: picked.dataBase64,
        },
      });
      if (result.ok) {
        setPicked(null);
        setPutName("");
        setPutNote("");
        setPutSubcategory("");
      }
      return result;
    });
  };

  const reassemble = async (entry: DarkHoleEntry) => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    setBusy(true);
    try {
      const result = await reassembleDarkHoleEntry({
        data: { accessToken: token, entryId: entry.id },
      });
      setNote(result.note);
      if (result.ok && result.dataBase64) downloadBase64(result.fileName, result.dataBase64);
    } catch {
      setNote("The core did not answer — nothing was served.");
    } finally {
      setBusy(false);
    }
  };

  const categories = view?.categories ?? [];
  const putSubs = categories.find((c) => c.name === putCategory)?.subcategories ?? [];
  const shelfSubs = categories.find((c) => c.name === shelf)?.subcategories ?? [];

  const visibleEntries = useMemo(() => {
    const entries = view?.entries ?? [];
    const onShelf =
      shelf === "All"
        ? entries
        : entries.filter(
            (e) => e.category === shelf && (subShelf === "" || e.subcategory === subShelf),
          );
    return searchDarkHoleEntries(onShelf, search);
  }, [view, shelf, subShelf, search]);

  const countFor = (category: string, subcategory?: string) =>
    (view?.entries ?? []).filter(
      (e) => e.category === category && (subcategory === undefined || e.subcategory === subcategory),
    ).length;

  return (
    <FloatingWindow
      id="dark-hole"
      title="The Dark Hole — your library"
      onClose={onClose}
      initialWidth={560}
      initialHeight={600}
    >
      <div className="window-darkhole">
        {denied ? (
          <p className="window-darkhole__note">
            The operator session is gone — sign in again to open the Dark Hole.
          </p>
        ) : !view ? (
          <p className="window-darkhole__note">Opening the Dark Hole…</p>
        ) : !view.storageAvailable ? (
          <p className="window-darkhole__note">
            The Dark Hole lives on the core machine — this surface has no local hole, so it can
            only be opened from the Parrot copy.
          </p>
        ) : (
          <>
            <p className="window-darkhole__note">
              A file in the Dark Hole exists only as pieces on this core machine — cut into small
              pieces, each piece kept under its own fingerprint, with one manifest that remembers
              how they go back together. The whole file is never stored whole. This is breakdown
              and scattering, not encryption: the pieces are the file's own bytes, cut small.
              Only the manifest can put a file back together, and the join is checked against the
              fingerprint taken when the file went in.
            </p>

            {/* ---------------- putting a file in ---------------- */}
            <div
              className="window-darkhole__section"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                pickFile(event.dataTransfer.files?.[0] ?? null);
              }}
            >
              <p className="window-darkhole__meta">
                <strong>Put a file in</strong> — pick it or drop it here. It is broken down on
                the core the moment it goes in.
              </p>
              <input
                type="file"
                aria-label="Pick a file for the Dark Hole"
                onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
              />
              {picked && (
                <>
                  <label className="window-darkhole__field">
                    Name it
                    <input
                      type="text"
                      value={putName}
                      onChange={(event) => setPutName(event.target.value)}
                    />
                  </label>
                  <label className="window-darkhole__field">
                    Note (what it is, why it matters — searchable later)
                    <input
                      type="text"
                      value={putNote}
                      onChange={(event) => setPutNote(event.target.value)}
                    />
                  </label>
                  <div className="window-darkhole__row">
                    <label className="window-darkhole__field">
                      Category
                      <select
                        value={putCategory}
                        onChange={(event) => {
                          setPutCategory(event.target.value);
                          setPutSubcategory("");
                        }}
                      >
                        {categories.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="window-darkhole__field">
                      Subcategory
                      <select
                        value={putSubcategory}
                        onChange={(event) => setPutSubcategory(event.target.value)}
                      >
                        <option value="">— none —</option>
                        {putSubs.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="window-darkhole__actions">
                    <button type="button" className="window-btn" disabled={busy} onClick={() => void putIn()}>
                      Put it in the Dark Hole
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ---------------- finding things ---------------- */}
            <div className="window-darkhole__section">
              <p className="window-darkhole__meta">
                <strong>Find</strong> — browse the shelves, or search a name or a note.
              </p>
              <input
                type="search"
                aria-label="Search the Dark Hole by name or note"
                placeholder="Search by name or note…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="window-darkhole__actions">
                <button
                  type="button"
                  className="window-btn"
                  onClick={() => {
                    setShelf("All");
                    setSubShelf("");
                  }}
                >
                  All ({view.entries.length})
                </button>
                {categories.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    className="window-btn"
                    onClick={() => {
                      setShelf(c.name);
                      setSubShelf("");
                    }}
                  >
                    {c.name} ({countFor(c.name)})
                  </button>
                ))}
              </div>
              {shelf !== "All" && shelfSubs.length > 0 && (
                <div className="window-darkhole__actions">
                  <button type="button" className="window-btn" onClick={() => setSubShelf("")}>
                    All of {shelf}
                  </button>
                  {shelfSubs.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="window-btn"
                      onClick={() => setSubShelf(s)}
                    >
                      {s} ({countFor(shelf, s)})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ---------------- the entries ---------------- */}
            {view.entries.length === 0 ? (
              <p className="window-darkhole__note">Nothing is in the hole.</p>
            ) : visibleEntries.length === 0 ? (
              <p className="window-darkhole__note">
                Nothing stands on this shelf under that search. Try another shelf, or clear the
                search.
              </p>
            ) : (
              visibleEntries.map((entry) => {
                const move = moveDrafts[entry.id] ?? {
                  category: entry.category,
                  subcategory: entry.subcategory,
                };
                const moveSubs =
                  categories.find((c) => c.name === move.category)?.subcategories ?? [];
                return (
                  <div key={entry.id} className="window-darkhole__item">
                    <p className="window-darkhole__meta">
                      <strong>{entry.name}</strong> · {humanSize(entry.size)} ·{" "}
                      {entry.blocks.length} piece{entry.blocks.length === 1 ? "" : "s"} · went in{" "}
                      {dayTime(entry.addedAt)}
                      <br />
                      Filed under {entry.category}
                      {entry.subcategory ? ` / ${entry.subcategory}` : ""}
                    </p>
                    {entry.note && <p className="window-darkhole__text">{entry.note}</p>}
                    <div className="window-darkhole__actions">
                      <button
                        type="button"
                        className="window-btn"
                        disabled={busy}
                        onClick={() => void reassemble(entry)}
                      >
                        Reassemble (download)
                      </button>
                      {confirmingDelete === entry.id ? (
                        <>
                          <button
                            type="button"
                            className="window-btn"
                            disabled={busy}
                            onClick={() =>
                              void run(async (token) => {
                                setConfirmingDelete(null);
                                return deleteDarkHoleEntry({
                                  data: { accessToken: token, entryId: entry.id },
                                });
                              })
                            }
                          >
                            Confirm — delete it and its pieces for real
                          </button>
                          <button
                            type="button"
                            className="window-btn"
                            onClick={() => setConfirmingDelete(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="window-btn"
                          disabled={busy}
                          onClick={() => setConfirmingDelete(entry.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <label className="window-darkhole__field">
                      Note
                      <input
                        type="text"
                        value={noteDrafts[entry.id] ?? entry.note}
                        onChange={(event) =>
                          setNoteDrafts((prev) => ({ ...prev, [entry.id]: event.target.value }))
                        }
                      />
                    </label>
                    <div className="window-darkhole__actions">
                      <button
                        type="button"
                        className="window-btn"
                        disabled={busy || noteDrafts[entry.id] === undefined}
                        onClick={() =>
                          void run(async (token) => {
                            const result = await editDarkHoleNote({
                              data: {
                                accessToken: token,
                                entryId: entry.id,
                                note: noteDrafts[entry.id] ?? "",
                              },
                            });
                            if (result.ok) {
                              setNoteDrafts((prev) => {
                                const next = { ...prev };
                                delete next[entry.id];
                                return next;
                              });
                            }
                            return result;
                          })
                        }
                      >
                        Save note
                      </button>
                    </div>
                    <div className="window-darkhole__row">
                      <label className="window-darkhole__field">
                        Move to category
                        <select
                          value={move.category}
                          onChange={(event) =>
                            setMoveDrafts((prev) => ({
                              ...prev,
                              [entry.id]: { category: event.target.value, subcategory: "" },
                            }))
                          }
                        >
                          {categories.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="window-darkhole__field">
                        Subcategory
                        <select
                          value={move.subcategory}
                          onChange={(event) =>
                            setMoveDrafts((prev) => ({
                              ...prev,
                              [entry.id]: { ...move, subcategory: event.target.value },
                            }))
                          }
                        >
                          <option value="">— none —</option>
                          {moveSubs.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="window-darkhole__actions">
                      <button
                        type="button"
                        className="window-btn"
                        disabled={busy}
                        onClick={() =>
                          void run((token) =>
                            fileDarkHoleEntry({
                              data: {
                                accessToken: token,
                                entryId: entry.id,
                                category: move.category,
                                subcategory: move.subcategory,
                              },
                            }),
                          )
                        }
                      >
                        File it there
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* ---------------- the shelves themselves ---------------- */}
            <div className="window-darkhole__section">
              <p className="window-darkhole__meta">
                <strong>The shelves — your categories</strong>. Make them, rename them, clear
                them away. Deleting a shelf never deletes what stands on it: those entries fall
                back to Unsorted. “Unsorted” is the catch-all — it always stands.
              </p>
              <div className="window-darkhole__row">
                <label className="window-darkhole__field">
                  New category
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="window-btn"
                  disabled={busy || !newCategory.trim()}
                  onClick={() =>
                    void run(async (token) => {
                      const result = await saveDarkHoleCategory({
                        data: { accessToken: token, action: "add", name: newCategory },
                      });
                      if (result.ok) setNewCategory("");
                      return result;
                    })
                  }
                >
                  Add category
                </button>
              </div>
              {categories.map((category) => (
                <div key={category.name} className="window-darkhole__item">
                  <p className="window-darkhole__meta">
                    <strong>{category.name}</strong> — {countFor(category.name)} entr
                    {countFor(category.name) === 1 ? "y" : "ies"}
                  </p>
                  {category.name !== DARK_HOLE_UNSORTED && (
                    <>
                      <div className="window-darkhole__row">
                        <label className="window-darkhole__field">
                          Rename to
                          <input
                            type="text"
                            value={renameDrafts[category.name] ?? ""}
                            onChange={(event) =>
                              setRenameDrafts((prev) => ({
                                ...prev,
                                [category.name]: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="window-btn"
                          disabled={busy || !(renameDrafts[category.name] ?? "").trim()}
                          onClick={() =>
                            void run((token) =>
                              saveDarkHoleCategory({
                                data: {
                                  accessToken: token,
                                  action: "rename",
                                  name: category.name,
                                  newName: renameDrafts[category.name] ?? "",
                                },
                              }),
                            )
                          }
                        >
                          Rename
                        </button>
                      </div>
                      <div className="window-darkhole__actions">
                        {confirmingShelf === `cat:${category.name}` ? (
                          <>
                            <button
                              type="button"
                              className="window-btn"
                              disabled={busy}
                              onClick={() =>
                                void run(async (token) => {
                                  setConfirmingShelf(null);
                                  return saveDarkHoleCategory({
                                    data: {
                                      accessToken: token,
                                      action: "delete",
                                      name: category.name,
                                    },
                                  });
                                })
                              }
                            >
                              Confirm — delete the shelf (entries fall to Unsorted)
                            </button>
                            <button
                              type="button"
                              className="window-btn"
                              onClick={() => setConfirmingShelf(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="window-btn"
                            disabled={busy}
                            onClick={() => setConfirmingShelf(`cat:${category.name}`)}
                          >
                            Delete category
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {category.subcategories.map((sub) => (
                    <div key={sub} className="window-darkhole__sub">
                      <p className="window-darkhole__meta">
                        {category.name} / <strong>{sub}</strong> — {countFor(category.name, sub)}{" "}
                        entries
                      </p>
                      <div className="window-darkhole__row">
                        <label className="window-darkhole__field">
                          Rename to
                          <input
                            type="text"
                            value={renameSubDrafts[`${category.name}/${sub}`] ?? ""}
                            onChange={(event) =>
                              setRenameSubDrafts((prev) => ({
                                ...prev,
                                [`${category.name}/${sub}`]: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="window-btn"
                          disabled={busy || !(renameSubDrafts[`${category.name}/${sub}`] ?? "").trim()}
                          onClick={() =>
                            void run((token) =>
                              saveDarkHoleSubcategory({
                                data: {
                                  accessToken: token,
                                  action: "rename",
                                  category: category.name,
                                  name: sub,
                                  newName: renameSubDrafts[`${category.name}/${sub}`] ?? "",
                                },
                              }),
                            )
                          }
                        >
                          Rename
                        </button>
                        {confirmingShelf === `sub:${category.name}/${sub}` ? (
                          <>
                            <button
                              type="button"
                              className="window-btn"
                              disabled={busy}
                              onClick={() =>
                                void run(async (token) => {
                                  setConfirmingShelf(null);
                                  return saveDarkHoleSubcategory({
                                    data: {
                                      accessToken: token,
                                      action: "delete",
                                      category: category.name,
                                      name: sub,
                                    },
                                  });
                                })
                              }
                            >
                              Confirm delete
                            </button>
                            <button
                              type="button"
                              className="window-btn"
                              onClick={() => setConfirmingShelf(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="window-btn"
                            disabled={busy}
                            onClick={() => setConfirmingShelf(`sub:${category.name}/${sub}`)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="window-darkhole__row">
                    <label className="window-darkhole__field">
                      New subcategory under {category.name}
                      <input
                        type="text"
                        value={newSubDrafts[category.name] ?? ""}
                        onChange={(event) =>
                          setNewSubDrafts((prev) => ({
                            ...prev,
                            [category.name]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="window-btn"
                      disabled={busy || !(newSubDrafts[category.name] ?? "").trim()}
                      onClick={() =>
                        void run(async (token) => {
                          const result = await saveDarkHoleSubcategory({
                            data: {
                              accessToken: token,
                              action: "add",
                              category: category.name,
                              name: newSubDrafts[category.name] ?? "",
                            },
                          });
                          if (result.ok) {
                            setNewSubDrafts((prev) => ({ ...prev, [category.name]: "" }));
                          }
                          return result;
                        })
                      }
                    >
                      Add subcategory
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {note && (
          <p className="window-hint" role="status">
            {note}
          </p>
        )}
      </div>
    </FloatingWindow>
  );
}
