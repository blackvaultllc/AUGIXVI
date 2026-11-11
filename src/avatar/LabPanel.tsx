/**
 * THE INVESTIGATIVE LAB — operator-only floating window.
 * Files: #1 CAR-T lab, #2 Tree of Life, Science core (+118-element periodic
 * table), Apothecary. Searchable; notes/files/pictures attachable privately;
 * shows the knowledge graph, spellbook, study tracker, vault, and the Oracle
 * tunnel queue (nothing sends without the operator's say).
 */
import { useMemo, useState } from "react";
import { Search, Send } from "lucide-react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { ALL_FILES, searchLab, type LabEntry } from "./lab/store";
import {
  knowledgeGraph,
  SPELLBOOK,
  loadTracker,
  trackerReport,
  loadVault,
  tunnelQueue,
  queueForOracle,
} from "./lab/wizard";
import { readSecrets, writeSecret } from "./lab/bookOfSecrets.server";

type Tab = "files" | "graph" | "spells" | "quest" | "book";

export function LabPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("files");
  const [activeFileId, setActiveFileId] = useState<string>("file-1-car-t");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [results, setResults] = useState<LabEntry[] | null>(null);
  const [bookPages, setBookPages] = useState<
    Array<{ id: string; title: string; body: string; written: number }>
  >([]);
  const [bookError, setBookError] = useState<string | null>(null);
  const [tunnel, setTunnel] = useState(tunnelQueue);

  const file = useMemo(
    () => ALL_FILES.find((f) => f.id === activeFileId) ?? ALL_FILES[0]!,
    [activeFileId],
  );
  const graph = useMemo(knowledgeGraph, []);
  const tracker = loadTracker();
  const vault = loadVault();

  const runSearch = () => {
    setResults(searchLab(query));
  };

  const saveNote = (entry: LabEntry) => {
    if (!note.trim()) return;
    void writeSecret({ data: { title: `Lab note — ${entry.title}`, body: note } });
    setNote("");
  };

  const sendToOracle = (entry: LabEntry) => {
    // THE OPERATOR DECIDES — this button IS the say-so; nothing auto-sends.
    setTunnel(queueForOracle(entry.title, entry.body));
  };

  const openBook = () => {
    void readSecrets().then((res) => {
      setBookPages(res.pages);
      setBookError(res.error);
    });
  };

  return (
    <FloatingWindow
      id="lab"
      title="Investigative Lab — operator only"
      onClose={onClose}
      initialWidth={680}
      initialHeight={520}
    >
      <div className="window-lab">
        <div className="window-lab__tabs" role="tablist">
          {(["files", "graph", "spells", "quest", "book"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className="window-lab__tab"
              onClick={() => {
                setTab(t);
                if (t === "book") openBook();
              }}
            >
              {t === "files"
                ? "Files"
                : t === "graph"
                  ? "Knowledge Graph"
                  : t === "spells"
                    ? "Spellbook"
                    : t === "quest"
                      ? "Quest Log"
                      : "Book of Secrets"}
            </button>
          ))}
        </div>

        {tab === "files" && (
          <div className="window-lab__files">
            <nav className="window-lab__filenames" aria-label="Lab files">
              {ALL_FILES.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  className={f.id === activeFileId ? "is-active" : undefined}
                  onClick={() => setActiveFileId(f.id)}
                >
                  {i === 0
                    ? "File #1"
                    : i === 1
                      ? "File #2"
                      : i === 2
                        ? "Science core"
                        : "Apothecary"}{" "}
                  — {f.title.replace(/^File #\d — |^The |^Science core — /, "")}
                </button>
              ))}
            </nav>
            <div className="window-lab__search">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Search: "CAR-T", "apheresis", "Bret Carroll", "telomeres"…'
                aria-label="Search the lab"
              />
              <button type="button" className="window-btn" onClick={runSearch}>
                <Search aria-hidden="true" /> Find
              </button>
            </div>
            {(results ?? file.entries).map((entry) => (
              <section key={entry.id} className="window-lab__entry">
                <header>
                  <strong>{entry.title}</strong>
                  <span className={`window-lab__tag window-lab__tag--${entry.tag.toLowerCase()}`}>
                    {entry.tag}
                  </span>
                </header>
                <pre className="window-lab__body">{entry.body}</pre>
                {entry.studies.length > 0 && (
                  <ul className="window-lab__studies">
                    {entry.studies.map((s) => (
                      <li key={s.id}>
                        <strong>{s.title}</strong> — {s.source}, {s.date}: {s.finding}{" "}
                        <em>[{s.tag}]</em>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="window-lab__entry-actions">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a private note to this entry…"
                    aria-label={`Note on ${entry.title}`}
                  />
                  <button type="button" className="window-btn" onClick={() => saveNote(entry)}>
                    Save to Book
                  </button>
                  <button type="button" className="window-btn" onClick={() => sendToOracle(entry)}>
                    <Send aria-hidden="true" /> Tunnel to Oracle
                  </button>
                </div>
              </section>
            ))}
            <p className="window-hint">
              Attachments (pictures/files) attach locally — private to this browser, operator only.
            </p>
          </div>
        )}

        {tab === "graph" && (
          <div className="window-lab__graph">
            <p className="window-hint">How everything connects — click a node to open its file.</p>
            <ul>
              {graph.nodes.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFileId(node.fileId);
                      setTab("files");
                    }}
                  >
                    <strong>{node.label}</strong>
                    <span className="window-hint"> opens {node.opens}</span>
                  </button>
                </li>
              ))}
            </ul>
            <ul className="window-lab__edges">
              {graph.edges.map((edge, i) => (
                <li key={i}>
                  {graph.nodes.find((n) => n.id === edge.from)?.label} →{" "}
                  {graph.nodes.find((n) => n.id === edge.to)?.label}: <em>{edge.why}</em>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "spells" && (
          <div className="window-lab__spells">
            {SPELLBOOK.map((spell) => (
              <p key={spell.spell}>
                <code>{spell.spell}</code> — {spell.does}{" "}
                <em className="window-hint">When: {spell.when}</em>
              </p>
            ))}
          </div>
        )}

        {tab === "quest" && (
          <div className="window-lab__quest">
            <p className="window-hint">{trackerReport(tracker)}</p>
            {tracker.map((topic) => (
              <section key={topic.id}>
                <strong>{topic.topic}</strong>
                <p>Read: {topic.done.join(", ")}</p>
                <p>Next: {topic.next.join(", ")}</p>
                <p className="window-hint">Learned from Anubis: {topic.learnedFromAnubis}</p>
              </section>
            ))}
            <p className="window-hint">
              Memory vault — the wizard's library ({vault.length} inventoried):
            </p>
            <ul>
              {vault.map((v) => (
                <li key={v.id}>
                  {v.name} ({v.kind}) — {v.location}: {v.note}
                </li>
              ))}
            </ul>
            <p className="window-hint">
              Oracle tunnel queue ({tunnel.filter((t) => !t.sent).length} waiting — nothing sends
              without your say):
            </p>
            <ul>
              {tunnel.map((t) => (
                <li key={t.id}>
                  {t.document.slice(0, 60)}… → Oracle {t.sent ? "(sent)" : "(queued)"}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "book" && (
          <div className="window-lab__book">
            {bookError && <p className="window-hint">{bookError}</p>}
            {bookPages.length === 0 && !bookError && (
              <p className="window-hint">
                The Book is empty — or the vault binding is not configured yet.
              </p>
            )}
            {bookPages.map((page) => (
              <section key={page.id}>
                <strong>{page.title}</strong>
                <pre>{page.body}</pre>
                <p className="window-hint">{new Date(page.written).toLocaleString()}</p>
              </section>
            ))}
          </div>
        )}
      </div>
    </FloatingWindow>
  );
}
