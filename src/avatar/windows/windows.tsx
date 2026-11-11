/**
 * OPERATOR WINDOWS — Notepad, Chalkboard, YouTube player (owner order
 * 2026-11-11). Each is a FloatingWindow; notes persist locally and privately
 * (operator-only storage, never synced anywhere). The player stores links,
 * history and named playlists in localStorage — private to this browser.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Pencil, Play, Plus, Save, Trash2 } from "lucide-react";
import { FloatingWindow } from "./FloatingWindow";

/* ----------------------------- NOTEPAD ---------------------------------- */

type Note = { id: string; title: string; body: string; updated: number };
const NOTES_KEY = "augi.notepad.notes.v1";

function loadNotes(): Note[] {
  try {
    const raw = globalThis.localStorage?.getItem(NOTES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (n): n is Note => typeof n === "object" && n !== null && typeof (n as Note).id === "string",
    );
  } catch {
    return [];
  }
}

export function NotepadWindow({ onClose }: { onClose: () => void }) {
  const [notes, setNotes] = useState(loadNotes);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = notes.find((n) => n.id === activeId) ?? null;

  const persist = useCallback((next: Note[]) => {
    setNotes(next);
    try {
      globalThis.localStorage?.setItem(NOTES_KEY, JSON.stringify(next));
    } catch {
      // storage full — keep working in memory
    }
  }, []);

  const createNote = () => {
    const note: Note = {
      id: `note-${Date.now()}`,
      title: "Untitled note",
      body: "",
      updated: Date.now(),
    };
    persist([note, ...notes]);
    setActiveId(note.id);
  };

  const updateActive = (patch: Partial<Note>) => {
    if (!active) return;
    persist(notes.map((n) => (n.id === active.id ? { ...n, ...patch, updated: Date.now() } : n)));
  };

  const deleteActive = () => {
    if (!active) return;
    const rest = notes.filter((n) => n.id !== active.id);
    persist(rest);
    setActiveId(rest[0]?.id ?? null);
  };

  return (
    <FloatingWindow id="notepad" title="Notepad — private" onClose={onClose} initialWidth={520}>
      <div className="window-notepad">
        <div className="window-notepad__sidebar">
          <button type="button" className="window-btn" onClick={createNote}>
            <Plus aria-hidden="true" /> New note
          </button>
          <ul>
            {[...notes]
              .sort((a, b) => b.updated - a.updated)
              .map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={n.id === activeId ? "is-active" : undefined}
                    onClick={() => setActiveId(n.id)}
                  >
                    {n.title || "Untitled"}
                  </button>
                </li>
              ))}
          </ul>
        </div>
        <div className="window-notepad__editor">
          {active ? (
            <>
              <input
                className="window-notepad__title"
                value={active.title}
                onChange={(e) => updateActive({ title: e.target.value })}
                aria-label="Note title"
              />
              <textarea
                className="window-notepad__body"
                value={active.body}
                onChange={(e) => updateActive({ body: e.target.value })}
                placeholder="Only you can read this — it stays in this browser."
                aria-label="Note body"
              />
              <div className="window-notepad__actions">
                <button type="button" className="window-btn" onClick={deleteActive}>
                  <Trash2 aria-hidden="true" /> Delete
                </button>
                <span className="window-hint">
                  Saved automatically — <Save aria-hidden="true" /> private to this browser.
                </span>
              </div>
            </>
          ) : (
            <p className="window-hint">Pick a note on the left, or create one.</p>
          )}
        </div>
      </div>
    </FloatingWindow>
  );
}

/* ---------------------------- CHALKBOARD -------------------------------- */

const CHALK_KEY = "augi.chalkboard.drawing.v1";

export function ChalkboardWindow({
  onClose,
  externalText,
}: {
  onClose: () => void;
  /** Text Osiris was told to write on the board. */
  externalText?: string | null;
}) {
  const [text, setText] = useState(() => {
    try {
      return globalThis.localStorage?.getItem(CHALK_KEY) ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    if (externalText != null && externalText !== "") {
      setText((current) => `${current}${current ? "\n" : ""}${externalText}`);
    }
  }, [externalText]);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(CHALK_KEY, text);
    } catch {
      // best effort
    }
  }, [text]);

  return (
    <FloatingWindow
      id="chalkboard"
      title="Chalkboard"
      onClose={onClose}
      initialWidth={560}
      initialHeight={400}
    >
      <div className="window-chalkboard">
        <textarea
          className="window-chalkboard__surface"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write on the board — or tell Osiris to write on it for you."
          aria-label="Chalkboard writing surface"
        />
        <div className="window-chalkboard__actions">
          <button type="button" className="window-btn" onClick={() => setText("")}>
            <Eraser aria-hidden="true" /> Erase board
          </button>
          <span className="window-hint">
            <Pencil aria-hidden="true" /> Saved automatically.
          </span>
        </div>
      </div>
    </FloatingWindow>
  );
}

/* --------------------------- YOUTUBE PLAYER ----------------------------- */

type VideoLink = { id: string; title: string; url: string; added: number };
type Playlist = { id: string; name: string; videoIds: string[] };
const HISTORY_KEY = "augi.player.history.v1";
const PLAYLISTS_KEY = "augi.player.playlists.v1";

/** Extract a YouTube video id from a raw URL, or null. */
export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return url.pathname.slice(1).split("/")[0] || null;
    }
    if (host.endsWith("youtube.com")) {
      if (url.searchParams.get("v")) return url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1] ?? null;
    }
  } catch {
    // not a URL — fall through
  }
  // A bare 11-character id.
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  return null;
}

/** Resolve a "song name" or link into an embeddable YouTube URL. */
export function resolvePlayerSource(input: string): { videoId: string; title: string } | null {
  const id = extractYouTubeId(input);
  if (id) return { videoId: id, title: input.trim().slice(0, 80) || "Video" };
  // Search by name: use the YouTube no-cookie search embed trick via the
  // results page — embedding search directly is unreliable, so the player
  // opens the first-result embed through youtube's search param form.
  const query = encodeURIComponent(input.trim());
  if (!query) return null;
  return { videoId: `search:${query}`, title: input.trim().slice(0, 80) };
}

function embedSrc(videoId: string): string {
  if (videoId.startsWith("search:")) {
    const query = videoId.slice("search:".length);
    return `https://www.youtube.com/embed?listType=search&list=${query}`;
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // best effort
  }
}

export function PlayerWindow({
  onClose,
  seedInput,
}: {
  onClose: () => void;
  seedInput?: string | null;
}) {
  const [history, setHistory] = useState<VideoLink[]>(() => loadJson<VideoLink[]>(HISTORY_KEY, []));
  const [playlists, setPlaylists] = useState<Playlist[]>(() =>
    loadJson<Playlist[]>(PLAYLISTS_KEY, []),
  );
  const [current, setCurrent] = useState<VideoLink | null>(() =>
    seedInput ? (resolveToLink(seedInput) ?? null) : null,
  );
  const [draft, setDraft] = useState(seedInput ?? "");
  const [playlistName, setPlaylistName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function resolveToLink(input: string): VideoLink | null {
    const resolved = resolvePlayerSource(input);
    if (!resolved) return null;
    return {
      id: `v-${resolved.videoId}-${Date.now()}`,
      title: resolved.title,
      url: resolved.videoId,
      added: Date.now(),
    };
  }

  useEffect(() => {
    if (seedInput) {
      play(seedInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedInput]);

  const play = useCallback(
    (input: string) => {
      const link = resolveToLink(input);
      if (!link) return;
      setCurrent(link);
      setHistory((prev) => {
        const next = [link, ...prev.filter((v) => v.url !== link.url)].slice(0, 100);
        saveJson(HISTORY_KEY, next);
        return next;
      });
      setDraft("");
    },
    // resolveToLink is a pure closure over nothing — stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const savePlaylist = () => {
    const name = playlistName.trim();
    if (!name) return;
    const ids = history.slice(0, 10).map((v) => v.id);
    const next = [{ id: `pl-${Date.now()}`, name, videoIds: ids }, ...playlists].slice(0, 30);
    setPlaylists(next);
    saveJson(PLAYLISTS_KEY, next);
    setPlaylistName("");
  };

  const playlistVideos = (playlist: Playlist): VideoLink[] =>
    playlist.videoIds
      .map((id) => history.find((v) => v.id === id))
      .filter((v): v is VideoLink => Boolean(v));

  return (
    <FloatingWindow
      id="player"
      title="Player — YouTube"
      onClose={onClose}
      initialWidth={620}
      initialHeight={480}
    >
      <div className="window-player">
        {current ? (
          <iframe
            className="window-player__screen"
            src={embedSrc(current.url)}
            title={current.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="window-player__screen window-player__screen--empty">
            <Play aria-hidden="true" /> Paste a YouTube link, or type a song name.
          </div>
        )}
        <form
          className="window-player__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) play(draft);
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a link or type a song / video name…"
            aria-label="Video link or name"
          />
          <button type="submit" className="window-btn" disabled={!draft.trim()}>
            <Play aria-hidden="true" /> Play
          </button>
        </form>
        <div className="window-player__lists">
          <section>
            <h4>History — every link saved</h4>
            <ul>
              {history.slice(0, 12).map((v) => (
                <li key={v.id}>
                  <button type="button" onClick={() => play(v.url)} title={v.title}>
                    {v.title}
                  </button>
                </li>
              ))}
              {history.length === 0 && <li className="window-hint">Nothing played yet.</li>}
            </ul>
          </section>
          <section>
            <h4>Playlists</h4>
            <div className="window-player__save-row">
              <input
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="Name this playlist…"
                aria-label="Playlist name"
              />
              <button
                type="button"
                className="window-btn"
                onClick={savePlaylist}
                disabled={!playlistName.trim()}
              >
                <Save aria-hidden="true" /> Save
              </button>
            </div>
            <ul>
              {playlists.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}</strong>{" "}
                  <span className="window-hint">({playlistVideos(p).length} tracks)</span>
                </li>
              ))}
              {playlists.length === 0 && <li className="window-hint">No playlists yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </FloatingWindow>
  );
}
