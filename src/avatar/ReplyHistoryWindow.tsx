/**
 * REPLY HISTORY WINDOW — scroll back through everything Augie said.
 * Reads the device-local log kept by replyHistory.ts (newest first);
 * the operator can clear it at any time. Operator-only: it renders
 * inside the signed-in stage like every other window.
 */
import { FloatingWindow } from "./windows/FloatingWindow";
import type { ReplyHistoryEntry } from "./replyHistory";

export function ReplyHistoryWindow({
  entries,
  onClear,
  onClose,
}: {
  entries: ReplyHistoryEntry[];
  onClear: () => void;
  onClose: () => void;
}) {
  const newestFirst = [...entries].reverse();
  return (
    <FloatingWindow
      id="reply-history"
      title="Reply history"
      onClose={onClose}
      initialWidth={440}
      initialHeight={400}
      // NO EMPTY GAPS (owner law 2026-11-22): the record opens
      // sized to what is in it — a short history no longer stands
      // over a tall empty box; a long one caps and scrolls.
      fitContentHeight
    >
      <div className="window-reply-history">
        {newestFirst.length === 0 ? (
          <p className="window-reply-history__empty">
            Nothing yet. Everything Augie says — brain replies, greetings, offline notices — is
            kept here, newest first, and stays on this device.
          </p>
        ) : (
          <ol className="window-reply-history__list">
            {newestFirst.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="window-reply-history__item">
                <div className="window-reply-history__meta">
                  {new Date(entry.at).toLocaleString()}
                </div>
                {entry.question && (
                  <div className="window-reply-history__q">You: {entry.question}</div>
                )}
                {/* The speaker of record (routing law, owner order
                    2026-11-23): the record names who actually
                    spoke — the entry's recorded speaker, Anubis
                    for anything kept before routing existed —
                    never a blanket system name. */}
                <div className="window-reply-history__a">
                  {entry.speaker ?? "Anubis"}: {entry.answer}
                </div>
              </li>
            ))}
          </ol>
        )}
        <button
          type="button"
          className="window-btn"
          onClick={onClear}
          disabled={entries.length === 0}
        >
          Clear history
        </button>
      </div>
    </FloatingWindow>
  );
}
