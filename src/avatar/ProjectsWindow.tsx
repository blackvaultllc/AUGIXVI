/**
 * PROJECTS WINDOW — his websites, inside IEM (owner order
 * 2026-11-26: "All those projects I worked on are in there…
 * when I click on it I can go check it out and see how it looks
 * from the editor point of view, and I can also make marks on
 * them… and go ahead and saving it. Then I can say, hey, check
 * my saved area for websites").
 *
 * The registry stands on the core
 * (~/.local/share/augie/website-marks/). Clicking a project
 * opens its page IN THIS WINDOW — the editor's view of the page
 * as it stands. Mark mode: tap the place on the page, type the
 * note the way a notification is typed, save — the mark (place
 * + note) stands in the saved area for websites, on the core,
 * where the constructs read it when he says the word.
 *
 * PERFORMANCE, per his standing law: a page frame exists only
 * for the project he has open, loads only when he opens it, and
 * nothing here polls or animates on its own. Closing a project
 * takes its frame out of the page entirely.
 *
 * Owner-only: the window opens from the operator's own Tools
 * menu and every read re-verifies the operator session
 * server-side. It does not exist on Khadija's side.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getSupabaseClientConfig } from "./operatorAuth.server";
import {
  addWebsiteMarkFn,
  getWebsiteProjects,
  removeWebsiteMarkFn,
  removeWebsiteProjectFn,
  saveWebsiteProject,
  setWebsiteMarkDoneFn,
  type WebsiteProjectsView,
} from "./websiteProjects.server";
import type { WebsiteMark, WebsiteProject } from "./websiteProjects";

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
  return new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface ProjectDraft {
  id: string | null;
  name: string;
  about: string;
  url: string;
  localSource: string;
  confirmed: boolean;
}

const blankDraft: ProjectDraft = {
  id: null,
  name: "",
  about: "",
  url: "",
  localSource: "",
  confirmed: false,
};

export function ProjectsWindow({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<WebsiteProjectsView | null>(null);
  const [denied, setDenied] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [markMode, setMarkMode] = useState(false);
  const [pending, setPending] = useState<{ xPct: number; yPct: number } | null>(null);
  const [markNote, setMarkNote] = useState("");
  const [markPage, setMarkPage] = useState("");
  const frameRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    const next = await getWebsiteProjects({ data: { accessToken: token } }).catch(() => null);
    if (next && !next.authorized) {
      setDenied(true);
      return;
    }
    if (next) setView(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selected: WebsiteProject | null =
    view?.projects.find((p) => p.id === selectedId) ?? null;
  const selectedMarks: WebsiteMark[] = selected
    ? (view?.marks ?? [])
        .filter((m) => m.projectId === selected.id)
        .sort((a, b) => a.createdAt - b.createdAt)
    : [];
  const openTotal = (view?.marks ?? []).filter((m) => m.doneAt === null).length;

  const openProject = (id: string) => {
    setSelectedId(id);
    setMarkMode(false);
    setPending(null);
    setMarkNote("");
    setMarkPage("");
    setDraft(null);
  };

  const closeProject = () => {
    setSelectedId(null);
    setMarkMode(false);
    setPending(null);
  };

  const saveDraft = async () => {
    if (!draft) return;
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    setBusy(true);
    try {
      const result = await saveWebsiteProject({
        data: {
          accessToken: token,
          ...(draft.id ? { id: draft.id } : {}),
          name: draft.name,
          about: draft.about,
          url: draft.url,
          localSource: draft.localSource,
          confirmed: draft.confirmed,
        },
      });
      setNote(result.note);
      if (result.ok) setDraft(null);
    } catch {
      setNote("The core did not answer — nothing was changed.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const removeProject = async (project: WebsiteProject) => {
    const token = await accessToken().catch(() => null);
    if (!token) return;
    setBusy(true);
    try {
      const result = await removeWebsiteProjectFn({
        data: { accessToken: token, id: project.id },
      });
      setNote(result.note);
      if (result.ok && selectedId === project.id) closeProject();
    } catch {
      setNote("The core did not answer — nothing was changed.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const placeMark = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = frameRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;
    const xPct = Math.round(((e.clientX - box.left) / box.width) * 1000) / 10;
    const yPct = Math.round(((e.clientY - box.top) / box.height) * 1000) / 10;
    setPending({ xPct, yPct });
  };

  const saveMark = async () => {
    if (!selected || !pending) return;
    const token = await accessToken().catch(() => null);
    if (!token) {
      setDenied(true);
      return;
    }
    setBusy(true);
    try {
      const result = await addWebsiteMarkFn({
        data: {
          accessToken: token,
          projectId: selected.id,
          note: markNote,
          xPct: pending.xPct,
          yPct: pending.yPct,
          page: markPage,
        },
      });
      setNote(result.note);
      if (result.ok) {
        setPending(null);
        setMarkNote("");
        setMarkPage("");
      }
    } catch {
      setNote("The core did not answer — the mark was not saved.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const setMarkDone = async (mark: WebsiteMark, done: boolean) => {
    const token = await accessToken().catch(() => null);
    if (!token) return;
    setBusy(true);
    try {
      const result = await setWebsiteMarkDoneFn({
        data: { accessToken: token, markId: mark.id, done },
      });
      setNote(result.note);
    } catch {
      setNote("The core did not answer — nothing was changed.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const removeMark = async (mark: WebsiteMark) => {
    const token = await accessToken().catch(() => null);
    if (!token) return;
    setBusy(true);
    try {
      const result = await removeWebsiteMarkFn({
        data: { accessToken: token, markId: mark.id },
      });
      setNote(result.note);
    } catch {
      setNote("The core did not answer — nothing was changed.");
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  return (
    <FloatingWindow
      id="projects-websites"
      title="Projects — your websites, inside IEM"
      onClose={onClose}
      initialWidth={720}
      initialHeight={640}
    >
      <div className="window-inbox">
        {denied ? (
          <p className="window-inbox__note">
            The operator session is gone — sign in again to open your projects.
          </p>
        ) : !view ? (
          <p className="window-inbox__note">Opening your projects…</p>
        ) : !view.storageAvailable ? (
          <p className="window-inbox__note">
            The registry and the saved area for websites live on the core machine — this surface
            has no local store, so your projects can only be reached from the Parrot copy.
          </p>
        ) : selected ? (
          <>
            <div className="window-inbox__actions">
              <button type="button" className="window-btn" onClick={closeProject}>
                ← All projects
              </button>
              <strong style={{ flex: 1 }}>{selected.name}</strong>
              {selected.url && (
                <a className="window-btn" href={selected.url} target="_blank" rel="noreferrer">
                  Open in a new tab
                </a>
              )}
            </div>
            <p className="window-inbox__note">
              {selected.about}
              {selected.localSource ? ` Source: ${selected.localSource}.` : ""}
              {!selected.confirmed &&
                " This entry stands UNCONFIRMED — its address or source has not been checked yet."}
            </p>

            {selected.url ? (
              <>
                <div
                  ref={frameRef}
                  style={{
                    position: "relative",
                    height: 340,
                    border: "1px solid var(--hatch-border, #444)",
                    borderRadius: 6,
                    overflow: "hidden",
                    background: "#101014",
                  }}
                >
                  <iframe
                    src={selected.url}
                    title={`${selected.name} — editor view`}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", border: 0, display: "block" }}
                  />
                  {selectedMarks.map((m, i) => (
                    <span
                      key={m.id}
                      title={m.note}
                      style={{
                        position: "absolute",
                        left: `calc(${m.xPct}% - 10px)`,
                        top: `calc(${m.yPct}% - 10px)`,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: m.doneAt ? "#3d5a3d" : "#b8860b",
                        color: "#fff",
                        fontSize: 11,
                        lineHeight: "20px",
                        textAlign: "center",
                        pointerEvents: "none",
                        opacity: m.doneAt ? 0.65 : 1,
                      }}
                    >
                      {i + 1}
                    </span>
                  ))}
                  {pending && (
                    <span
                      style={{
                        position: "absolute",
                        left: `calc(${pending.xPct}% - 10px)`,
                        top: `calc(${pending.yPct}% - 10px)`,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#c0392b",
                        color: "#fff",
                        fontSize: 11,
                        lineHeight: "20px",
                        textAlign: "center",
                        pointerEvents: "none",
                      }}
                    >
                      +
                    </span>
                  )}
                  {markMode && (
                    <div
                      onClick={placeMark}
                      style={{
                        position: "absolute",
                        inset: 0,
                        cursor: "crosshair",
                      }}
                    />
                  )}
                </div>
                <p className="window-inbox__note">
                  The editor's view — the page as it stands. If a page ever refuses to show inside
                  a frame, open it in a new tab instead; the marks below still stand on it.
                </p>
                <div className="window-inbox__actions">
                  <button
                    type="button"
                    className="window-btn"
                    disabled={busy}
                    onClick={() => {
                      setMarkMode((on) => !on);
                      setPending(null);
                    }}
                  >
                    {markMode ? "Mark mode is ON — tap the page" : "Turn mark mode on"}
                  </button>
                </div>
                {markMode && pending && (
                  <div className="window-inbox__item">
                    <p className="window-inbox__meta">
                      The mark stands at {pending.xPct}% across, {pending.yPct}% down. Type the
                      note — what needs doing, in your words:
                    </p>
                    <div className="window-inbox__actions">
                      <input
                        type="text"
                        value={markNote}
                        onChange={(e) => setMarkNote(e.target.value)}
                        placeholder="The note for this mark"
                        disabled={busy}
                        style={{ flex: 1, minWidth: 160 }}
                      />
                      <input
                        type="text"
                        value={markPage}
                        onChange={(e) => setMarkPage(e.target.value)}
                        placeholder="Page (blank = front page)"
                        disabled={busy}
                        style={{ minWidth: 140 }}
                      />
                      <button
                        type="button"
                        className="window-btn"
                        disabled={busy || !markNote.trim()}
                        onClick={() => void saveMark()}
                      >
                        Save the mark
                      </button>
                      <button
                        type="button"
                        className="window-btn"
                        disabled={busy}
                        onClick={() => setPending(null)}
                      >
                        Not there
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="window-inbox__note">
                No live address is on record for this one yet — add it with Edit and the page opens
                here, ready to mark. Until then its marks cannot be placed on a view that is not
                here.
              </p>
            )}

            <div className="window-inbox__feed">
              <p className="window-inbox__meta">
                <strong>Marks on this project — the saved area</strong>
              </p>
              {selectedMarks.length === 0 ? (
                <p className="window-inbox__note">No marks yet on this project.</p>
              ) : (
                selectedMarks.map((m, i) => (
                  <div key={m.id} className="window-inbox__item">
                    <p className="window-inbox__meta">
                      <strong>{i + 1}.</strong> “{m.note}” · {m.xPct}% across, {m.yPct}% down ·{" "}
                      {m.page ? m.page : "front page"} · marked {dayTime(m.createdAt)} ·{" "}
                      {m.doneAt ? `done ${dayTime(m.doneAt)}` : "OPEN"}
                    </p>
                    <div className="window-inbox__actions">
                      <button
                        type="button"
                        className="window-btn"
                        disabled={busy}
                        onClick={() => void setMarkDone(m, m.doneAt === null)}
                      >
                        {m.doneAt ? "Stand it open again" : "Mark it done"}
                      </button>
                      <button
                        type="button"
                        className="window-btn"
                        disabled={busy}
                        onClick={() => void removeMark(m)}
                      >
                        Take the mark out
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <p className="window-inbox__note">
              Your projects, inside IEM. Click one to see it the way an editor sees it, and leave
              marks where the work is. The registry and every mark live only on this machine
              (~/.local/share/augie/website-marks/). Saved area:{" "}
              <strong>
                {openTotal} open mark{openTotal === 1 ? "" : "s"}
              </strong>{" "}
              across {view.projects.length} projects — say “check my saved area for websites” and
              the marks are what gets worked.
            </p>
            {draft ? (
              <div className="window-inbox__item">
                <p className="window-inbox__meta">
                  <strong>{draft.id ? "Edit the record" : "Add a project"}</strong>
                </p>
                <div className="window-inbox__actions">
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Name"
                    disabled={busy}
                    style={{ flex: 1, minWidth: 160 }}
                  />
                </div>
                <div className="window-inbox__actions">
                  <input
                    type="text"
                    value={draft.about}
                    onChange={(e) => setDraft({ ...draft, about: e.target.value })}
                    placeholder="What it is"
                    disabled={busy}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                </div>
                <div className="window-inbox__actions">
                  <input
                    type="text"
                    value={draft.url}
                    onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                    placeholder="Live address (https://…)"
                    disabled={busy}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <input
                    type="text"
                    value={draft.localSource}
                    onChange={(e) => setDraft({ ...draft, localSource: e.target.value })}
                    placeholder="Source (where it stands)"
                    disabled={busy}
                    style={{ flex: 1, minWidth: 160 }}
                  />
                </div>
                <div className="window-inbox__actions">
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.confirmed}
                      onChange={(e) => setDraft({ ...draft, confirmed: e.target.checked })}
                      disabled={busy}
                    />{" "}
                    The address and source are checked — confirmed
                  </label>
                  <button
                    type="button"
                    className="window-btn"
                    disabled={busy || !draft.name.trim()}
                    onClick={() => void saveDraft()}
                  >
                    Save the record
                  </button>
                  <button
                    type="button"
                    className="window-btn"
                    disabled={busy}
                    onClick={() => setDraft(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="window-inbox__actions">
                <button
                  type="button"
                  className="window-btn"
                  disabled={busy}
                  onClick={() => setDraft(blankDraft)}
                >
                  Add a project…
                </button>
              </div>
            )}
            {view.projects.map((project) => {
              const mine = view.marks.filter((m) => m.projectId === project.id);
              const open = mine.filter((m) => m.doneAt === null).length;
              return (
                <div key={project.id} className="window-inbox__item">
                  <p className="window-inbox__meta">
                    <strong>{project.name}</strong>
                    {!project.confirmed && " · UNCONFIRMED"}
                    {mine.length > 0 && ` · ${open} open mark${open === 1 ? "" : "s"}`}
                  </p>
                  <p className="window-inbox__text">{project.about}</p>
                  <p className="window-inbox__note">
                    {project.url ? project.url : "No live address on record"}
                    {project.localSource ? ` · source: ${project.localSource}` : ""}
                  </p>
                  <div className="window-inbox__actions">
                    <button
                      type="button"
                      className="window-btn"
                      disabled={busy}
                      onClick={() => openProject(project.id)}
                    >
                      Open it here
                    </button>
                    <button
                      type="button"
                      className="window-btn"
                      disabled={busy}
                      onClick={() =>
                        setDraft({
                          id: project.id,
                          name: project.name,
                          about: project.about,
                          url: project.url,
                          localSource: project.localSource,
                          confirmed: project.confirmed,
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="window-btn"
                      disabled={busy}
                      onClick={() => void removeProject(project)}
                    >
                      Take it out
                    </button>
                  </div>
                </div>
              );
            })}
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
