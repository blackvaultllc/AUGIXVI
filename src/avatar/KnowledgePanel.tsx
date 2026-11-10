import { CURRICULUM_PACKS, KNOWLEDGE_SOURCES, MARTIAL_ARTS, US_STATES } from "./knowledgeBase";

type KnowledgePanelProps = {
  count: number;
  error: string;
  onClose: () => void;
  onImport: (file: File) => void;
};

export function KnowledgePanel({ count, error, onClose, onImport }: KnowledgePanelProps) {
  return (
    <section className="avatar-hud__knowledge" aria-labelledby="avatar-knowledge-title">
      <header className="avatar-hud__knowledge-header">
        <div>
          <h2 id="avatar-knowledge-title">Local knowledge</h2>
          <p>{count} saved segments · stored on this device</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close knowledge panel">
          Close
        </button>
      </header>
      <label className="avatar-hud__knowledge-upload">
        Import a text or Markdown document (up to 500 KB)
        <input
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onImport(file);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {error && (
        <p className="avatar-hud__knowledge-error" role="alert">
          {error}
        </p>
      )}
      <p>
        Imports are split into sourced text segments; they are not independently fact-checked or
        synced to Supabase. PDF extraction is not supported.
      </p>
      <h3>Curriculum topic index</h3>
      {CURRICULUM_PACKS.map((pack) => (
        <p key={pack.level}>
          <strong>{pack.level}:</strong> {pack.domains.join(", ")}. {pack.coverage}
        </p>
      ))}
      <h3>Martial arts overview</h3>
      <ul>
        {MARTIAL_ARTS.map((art) => (
          <li key={art.name}>
            <strong>{art.name}:</strong> {art.focus}
          </li>
        ))}
      </ul>
      <h3>US state directory</h3>
      <p>
        {US_STATES.map(([name, abbreviation]) => `${name} (${abbreviation})`).join(", ")}. Verified
        state-specific facts are not preloaded.
      </p>
      <h3>Sources</h3>
      <ul>
        {KNOWLEDGE_SOURCES.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.label}
            </a>
          </li>
        ))}
      </ul>
      <p>Supabase writes are not enabled; the configured client remains read-only.</p>
    </section>
  );
}
