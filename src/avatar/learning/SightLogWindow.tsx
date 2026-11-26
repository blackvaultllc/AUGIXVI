/**
 * THE SIGHT LOG — owner-only (owner orders 2026-11-26).
 * He records an impression — what he saw or picked up, in
 * his own words; the time is stamped automatically. Later
 * he marks the outcome himself: came to pass / did not /
 * not yet known. The system analyzes NOTHING here and
 * judges NOTHING — the record is his, so the pattern is
 * there for him to see (his fact-and-concurrence doctrine).
 */
import { useEffect, useState, type FormEvent } from "react";
import { FloatingWindow } from "../windows/FloatingWindow";
import { getOperatorAccessToken } from "../trustedDevice";
import { CAPTAIN_TIME_ZONE } from "./time";
import { SIGHT_OUTCOME_LABELS, type SightEntry, type SightOutcome } from "./sightLog";
import { addSightEntry, getSightLog, setSightOutcome } from "./learning.server";

const OUTCOMES: SightOutcome[] = ["came-to-pass", "did-not", "not-yet-known"];

function formatWhen(at: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CAPTAIN_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(at));
}

export function SightLogWindow({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<SightEntry[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const token = await getOperatorAccessToken().catch(() => null);
    if (!token) return;
    const view = await getSightLog({ data: { accessToken: token } }).catch(() => null);
    if (!view || !view.authorized) return;
    setEntries(view.entries);
    setStorageAvailable(view.storageAvailable);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, []);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setNote("");
    try {
      const token = await getOperatorAccessToken();
      if (!token) {
        setNote("No operator session — the entry was not recorded.");
        return;
      }
      const result = await addSightEntry({ data: { accessToken: token, text: value } });
      if (result.ok) {
        setText("");
        await load();
      } else {
        setNote(result.note);
      }
    } catch {
      setNote("The entry could not be recorded just now. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function mark(entry: SightEntry, outcome: SightOutcome) {
    const token = await getOperatorAccessToken().catch(() => null);
    if (!token) return;
    const result = await setSightOutcome({
      data: { accessToken: token, entryId: entry.id, outcome },
    }).catch(() => null);
    if (result?.ok) await load();
  }

  return (
    <FloatingWindow id="captains-sight-log" title="Sight Log — my record" onClose={onClose} initialWidth={600} initialHeight={560}>
      <div className="window-learning">
        <p className="window-learning__intro">
          What you saw, or what you picked up — in your words. The time is stamped for you. Later, mark what came of
          it. Nothing here is analyzed or judged by the system; the record is yours.
        </p>
        <form className="window-learning__sight-form" onSubmit={(event) => void add(event)}>
          <label>
            New entry
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              placeholder="What did you see, or pick up?"
            />
          </label>
          <button type="submit" className="window-btn" disabled={busy || !text.trim()}>
            {busy ? "Recording…" : "Record it"}
          </button>
        </form>
        {note && (
          <p role="alert" className="window-learning__source">
            {note}
          </p>
        )}
        {loaded && !storageAvailable && (
          <p className="window-learning__source">
            The sight log lives in the core. On a copy without the core store, entries cannot be kept here.
          </p>
        )}
        <div className="window-learning__sight-list">
          {entries.map((entry) => (
            <article key={entry.id} className="window-learning__note">
              <p className="window-learning__source">{formatWhen(entry.at)}</p>
              <p>{entry.text}</p>
              <div className="window-learning__prayer-actions" role="group" aria-label="Outcome">
                {OUTCOMES.map((outcome) => (
                  <button
                    key={outcome}
                    type="button"
                    className={entry.outcome === outcome ? "window-learning__tab is-active" : "window-learning__tab"}
                    onClick={() => void mark(entry, outcome)}
                  >
                    {SIGHT_OUTCOME_LABELS[outcome]}
                  </button>
                ))}
              </div>
            </article>
          ))}
          {loaded && entries.length === 0 && <p>No entries yet. The first one you record starts the record.</p>}
        </div>
      </div>
    </FloatingWindow>
  );
}
