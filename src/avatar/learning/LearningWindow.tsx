/**
 * MY LEARNING — the Captain's shelves (owner orders
 * 2026-11-26). Psychology, Dark Psychology, and The Art of
 * War (the full public-domain Giles text, chapter by
 * chapter), plus his Quotes card and his Prayer card.
 * Owner surface only — this window is mounted by the stage
 * for the operator, never on the learner side.
 *
 * Quotes and the prayer are read aloud through the stage's
 * own voice (`onSpeak` — the same TTS path Anubis speaks
 * with). The prayer text lives in the core; this window
 * edits it there. It ships EMPTY: until he adds it, the
 * card says plainly that his prayer goes here.
 */
import { useEffect, useMemo, useState } from "react";
import { FloatingWindow } from "../windows/FloatingWindow";
import { getOperatorAccessToken } from "../trustedDevice";
import { STUDY_SHELVES } from "./studyShelves";
import { ART_OF_WAR_CHAPTERS, ART_OF_WAR_CREDIT } from "./artOfWar";
import { quoteForDay, spokenQuote } from "./quotes";
import { chicagoDayNumber } from "./time";
import { PRAYER_SLOTS, prayerTimeLine } from "./prayerTime";
import { getPrayer, savePrayer } from "./learning.server";

type Tab = "psychology" | "dark-psychology" | "art-of-war" | "quotes-prayer";

const TABS: { id: Tab; label: string }[] = [
  { id: "psychology", label: "Psychology" },
  { id: "dark-psychology", label: "Dark Psychology" },
  { id: "art-of-war", label: "The Art of War" },
  { id: "quotes-prayer", label: "Quotes & Prayer" },
];

export function LearningWindow({ onClose, onSpeak }: { onClose: () => void; onSpeak: (text: string) => void }) {
  const [tab, setTab] = useState<Tab>("psychology");
  const [chapter, setChapter] = useState(0);
  const [prayerText, setPrayerText] = useState("");
  const [prayerLoaded, setPrayerLoaded] = useState(false);
  const [prayerNote, setPrayerNote] = useState("");
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => chicagoDayNumber(new Date()), []);
  const dayQuote = useMemo(() => quoteForDay(today, "day"), [today]);
  const nightQuote = useMemo(() => quoteForDay(today, "night"), [today]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getOperatorAccessToken().catch(() => null);
      if (!token || cancelled) return;
      const view = await getPrayer({ data: { accessToken: token } }).catch(() => null);
      if (!view || cancelled) return;
      if (view.authorized && view.storageAvailable) {
        setPrayerText(view.text);
        setPrayerLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    setPrayerNote("");
    try {
      const token = await getOperatorAccessToken();
      if (!token) {
        setPrayerNote("No operator session — the prayer was not saved.");
        return;
      }
      const result = await savePrayer({ data: { accessToken: token, text: prayerText } });
      setPrayerNote(result.note);
    } catch {
      setPrayerNote("The prayer could not be saved just now. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const shelf = STUDY_SHELVES.find((s) => s.id === tab);
  const warChapter = ART_OF_WAR_CHAPTERS[chapter];

  return (
    <FloatingWindow
      id="captains-learning"
      title="My Learning — Psychology, Dark Psychology, The Art of War"
      onClose={onClose}
      initialWidth={680}
      initialHeight={600}
    >
      <div className="window-learning">
        <div className="window-learning__tabs" role="tablist" aria-label="Learning shelves">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "window-learning__tab is-active" : "window-learning__tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {shelf && (
          <div className="window-learning__shelf">
            <p className="window-learning__intro">{shelf.intro}</p>
            {shelf.notes.map((note) => (
              <article key={note.title} className="window-learning__note">
                <h4>{note.title}</h4>
                <p>{note.body}</p>
                <p className="window-learning__source">{note.source}</p>
              </article>
            ))}
          </div>
        )}

        {tab === "art-of-war" && (
          <div className="window-learning__shelf">
            <p className="window-learning__intro">
              The whole book, in the public-domain translation. Pick a chapter and read it here.
            </p>
            <div className="window-learning__chapters">
              {ART_OF_WAR_CHAPTERS.map((c, i) => (
                <button
                  key={c.numeral}
                  type="button"
                  className={chapter === i ? "window-learning__tab is-active" : "window-learning__tab"}
                  onClick={() => setChapter(i)}
                >
                  {c.numeral}. {c.title}
                </button>
              ))}
            </div>
            {warChapter && (
              <article className="window-learning__chapter">
                <h4>
                  {warChapter.numeral}. {warChapter.title}
                </h4>
                {warChapter.sections.map((section, i) => (
                  <p key={i}>{section}</p>
                ))}
              </article>
            )}
            <p className="window-learning__source">{ART_OF_WAR_CREDIT}</p>
          </div>
        )}

        {tab === "quotes-prayer" && (
          <div className="window-learning__shelf">
            <article className="window-learning__note">
              <h4>Quote of the day</h4>
              <p>
                “{dayQuote.text}” — {dayQuote.author}
              </p>
              <p className="window-learning__source">{dayQuote.source}</p>
              <button type="button" className="window-btn" onClick={() => onSpeak(spokenQuote(dayQuote, "day"))}>
                Read it aloud
              </button>
            </article>
            <article className="window-learning__note">
              <h4>Quote of the night</h4>
              <p>
                “{nightQuote.text}” — {nightQuote.author}
              </p>
              <p className="window-learning__source">{nightQuote.source}</p>
              <button type="button" className="window-btn" onClick={() => onSpeak(spokenQuote(nightQuote, "night"))}>
                Read it aloud
              </button>
            </article>

            <article className="window-learning__note">
              <h4>My Prayer</h4>
              {prayerLoaded && !prayerText.trim() && (
                <p>
                  No prayer is saved yet. Your prayer goes here — paste it in the box below and save it. Once it is
                  saved, Prayer Time will surface four times a day while the program is open, and one click reads it
                  aloud.
                </p>
              )}
              {!prayerLoaded && (
                <p>The prayer record is kept in the core. On a copy without the core store, it cannot be loaded here.</p>
              )}
              <label className="window-learning__prayer-label">
                Prayer text
                <textarea
                  value={prayerText}
                  onChange={(event) => setPrayerText(event.target.value)}
                  rows={8}
                  placeholder="Paste your prayer here…"
                />
              </label>
              <div className="window-learning__prayer-actions">
                <button type="button" className="window-btn" onClick={() => void save()} disabled={saving}>
                  {saving ? "Saving…" : "Save my prayer"}
                </button>
                <button
                  type="button"
                  className="window-btn"
                  disabled={!prayerText.trim()}
                  onClick={() => onSpeak(prayerText)}
                >
                  Read my prayer
                </button>
              </div>
              {prayerNote && (
                <p role="status" className="window-learning__source">
                  {prayerNote}
                </p>
              )}
              <p className="window-learning__source">
                Prayer Time surfaces at {PRAYER_SLOTS.map((s) => prayerTimeLine(s)).join(", ")} — your time
                (America/Chicago) — only while the program is open, at most once each.
              </p>
            </article>
          </div>
        )}
      </div>
    </FloatingWindow>
  );
}
