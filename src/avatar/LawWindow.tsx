/**
 * LAW DESK WINDOW — Part 11. Ask a law question; Augie answers from
 * the library's books with citations after every claim, and closes
 * with the honesty line (knowledge, not a licensed attorney). If no
 * dedicated law book has landed yet, the window says so up front —
 * answers then come from the general books, still cited.
 */
import { useState, type FormEvent } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import { getOperatorAccessToken } from "./trustedDevice";
import { askLawDesk, LAW_HONESTY_LINE, type LawAnswer } from "./lawDesk.server";

export function LawWindow({ onClose }: { onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<LawAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError("");
    try {
      const token = await getOperatorAccessToken();
      if (!token) {
        setError("No operator session — the Law Desk stays closed.");
        return;
      }
      const result = await askLawDesk({ data: { accessToken: token, question: q } });
      if (!result.authorized) {
        setError("This session is not authorized for the Law Desk.");
        return;
      }
      setAnswer(result);
    } catch {
      setError("The Law Desk could not answer just now. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FloatingWindow
      id="law-desk"
      title="Law Desk — answers from the books, cited"
      onClose={onClose}
      initialWidth={620}
      initialHeight={560}
    >
      <div className="window-law">
        <p className="window-law__intro">
          Ask about law — rights, courts, contracts, crime, the Constitution. Answers come only
          from the books on this machine, with the source named after the answer. {LAW_HONESTY_LINE}
        </p>
        <form className="window-law__form" onSubmit={(event) => void ask(event)}>
          <label>
            Your law question
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="e.g. What does the Fourth Amendment protect?"
              autoComplete="off"
            />
          </label>
          <button type="submit" className="window-btn" disabled={busy || !question.trim()}>
            {busy ? "Reading the books…" : "Ask the Law Desk"}
          </button>
        </form>
        {error && (
          <p role="alert" className="window-law__error">
            {error}
          </p>
        )}
        {answer && (
          <div className="window-law__answer" aria-live="polite">
            {!answer.lawShelfLanded && (
              <p className="window-law__shelf">
                Shelf note: no dedicated law book has landed on this machine yet, so this answer
                is drawn from the general books (encyclopedia and textbooks) and cites them. The
                Law shelf joins the moment a law book finishes downloading.
              </p>
            )}
            {answer.mode === "library-down" ? (
              <p>
                The library is not answering right now, so the Law Desk cannot read its books.
                Nothing was invented in place of an answer.
              </p>
            ) : (
              <>
                <p className="window-law__text">{answer.answer}</p>
                {answer.citations.length > 0 && (
                  <p className="window-law__citations">
                    Sources:{" "}
                    {answer.citations
                      .map((c) => `${c.bookTitle} — ${c.articleTitle}`)
                      .join(" · ")}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </FloatingWindow>
  );
}
