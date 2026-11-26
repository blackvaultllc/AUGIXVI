/**
 * "ASK FOR SOMETHING TO BE ADDED" — the one button, the one
 * path (Captain's order 2026-11-26). It stands in Violet's
 * area and in Khadija's area, same words, same behavior: she
 * clicks, types what she needs built into her section, and it
 * files to the Captain — a section-requests record on the
 * core, mirrored into his notifications.
 *
 * This component is presentational only: the host surface
 * hands it an onSubmit that carries the words out through its
 * own door (Violet's session door; Khadija's allowlisted
 * request doorway). The button itself knows no door, holds no
 * session, and opens nothing — the path runs OUT only.
 */
import { useState, type FormEvent } from "react";

export type SectionRequestSubmitResult = { ok: boolean; message: string };

export function SectionRequestButton({
  heading,
  prompt,
  placeholder,
  sendLabel,
  onSubmit,
}: {
  heading: string;
  prompt: string;
  placeholder: string;
  sendLabel: string;
  onSubmit: (text: string) => Promise<SectionRequestSubmitResult>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const words = text.trim();
    if (!words || busy) return;
    setBusy(true);
    setNote("");
    try {
      const result = await onSubmit(words);
      setNote(result.message);
      if (result.ok) {
        setText("");
        setOpen(false);
      }
    } catch {
      setNote("That could not be sent from here. It is not lost — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section-request">
      <h3 className="section-request__heading">{heading}</h3>
      <p className="section-request__prompt">{prompt}</p>
      {!open && (
        <button
          type="button"
          className="section-request__open"
          onClick={() => {
            setOpen(true);
            setNote("");
          }}
        >
          Ask for something to be added
        </button>
      )}
      {open && (
        <form className="section-request__form" onSubmit={(event) => void submit(event)}>
          <label>
            What do you need?
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={placeholder}
              maxLength={900}
              rows={4}
              required
            />
          </label>
          <div className="section-request__row">
            <button type="submit" disabled={busy || !text.trim()}>
              {busy ? "Sending…" : sendLabel}
            </button>
            <button
              type="button"
              className="section-request__cancel"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Not now
            </button>
          </div>
        </form>
      )}
      {note && (
        <p className="section-request__note" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
