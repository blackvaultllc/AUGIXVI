/**
 * THE AGENT'S THREE BUTTONS (phone fix pass, owner orders
 * 2026-11-27 ~00:45 CST): every agent in this house — Khadija
 * included — carries the same three doors to the Captain:
 *
 * 1. REPORT A PROBLEM — tap it, type what is wrong, and it
 *    goes straight to the Captain; he fixes it.
 * 2. MESSAGE THE CAPTAIN — a plain message, right away,
 *    through the same door.
 * 3. EMERGENCY — one tap, no typing: it fires the host
 *    surface's emergency path at once.
 *
 * Like SectionRequestButton, this component is presentational
 * only: the host surface hands it the doors its own session
 * allows (Violet's token door; Khadija's allowlisted doorways)
 * and the words run OUT only. What "emergency" can honestly do
 * differs by surface — Khadija's rings her father's stage
 * through her daddy doorway; Violet's files an EMERGENCY
 * request that lands in his notifications the moment it is
 * filed — and each host says on its face which one it is. No
 * surface pretends to a power it does not hold.
 */
import { useState, type FormEvent } from "react";
import "./phone-fix-pass.css";

export type AgentContactResult = { ok: boolean; message: string };

export function AgentContactButtons({
  captainLabel,
  onReportError,
  onMessage,
  onEmergency,
  emergencyNote,
}: {
  /** How this surface names him — "Daddy" on Khadija's side, "the Captain" on Violet's. */
  captainLabel: string;
  onReportError: (text: string) => Promise<AgentContactResult>;
  onMessage: (text: string) => Promise<AgentContactResult>;
  onEmergency: () => Promise<AgentContactResult>;
  /** One plain sentence: what the emergency button does HERE. */
  emergencyNote: string;
}) {
  const [form, setForm] = useState<"error" | "message" | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [confirmingEmergency, setConfirmingEmergency] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const words = text.trim();
    if (!words || busy || !form) return;
    setBusy(true);
    setNote("");
    try {
      const result = await (form === "error" ? onReportError(words) : onMessage(words));
      setNote(result.message);
      if (result.ok) {
        setText("");
        setForm(null);
      }
    } catch {
      setNote("That could not be sent from here. It is not lost — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function fireEmergency() {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const result = await onEmergency();
      setNote(result.message);
      if (result.ok) setConfirmingEmergency(false);
    } catch {
      setNote("The emergency could not go out from here — try again, right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="agent-contact" aria-label={`Reach ${captainLabel}`}>
      <div className="agent-contact__row">
        <button
          type="button"
          className="agent-contact__btn"
          aria-expanded={form === "error"}
          onClick={() => {
            setForm(form === "error" ? null : "error");
            setNote("");
          }}
        >
          Report a problem
        </button>
        <button
          type="button"
          className="agent-contact__btn"
          aria-expanded={form === "message"}
          onClick={() => {
            setForm(form === "message" ? null : "message");
            setNote("");
          }}
        >
          Message {captainLabel}
        </button>
        <button
          type="button"
          className="agent-contact__btn agent-contact__btn--emergency"
          aria-expanded={confirmingEmergency}
          onClick={() => {
            setConfirmingEmergency((v) => !v);
            setNote("");
          }}
        >
          EMERGENCY
        </button>
      </div>

      {form && (
        <form className="agent-contact__form" onSubmit={(event) => void submit(event)}>
          <label>
            {form === "error" ? `What is wrong? ${captainLabel} will fix it.` : `Your message for ${captainLabel}`}
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={form === "error" ? "Type the problem…" : "Type your message…"}
              maxLength={900}
              rows={4}
              required
            />
          </label>
          <div className="agent-contact__form-row">
            <button type="submit" disabled={busy || !text.trim()}>
              {busy ? "Sending…" : form === "error" ? `Send the problem to ${captainLabel}` : `Send it to ${captainLabel}`}
            </button>
            <button type="button" onClick={() => setForm(null)} disabled={busy}>
              Not now
            </button>
          </div>
        </form>
      )}

      {confirmingEmergency && (
        <div className="agent-contact__emergency" role="alertdialog" aria-label="Confirm emergency">
          <p>{emergencyNote}</p>
          <div className="agent-contact__form-row">
            <button
              type="button"
              className="agent-contact__btn--emergency"
              disabled={busy}
              onClick={() => void fireEmergency()}
            >
              {busy ? "Sending…" : "Yes — emergency, send it now"}
            </button>
            <button type="button" onClick={() => setConfirmingEmergency(false)} disabled={busy}>
              Not now
            </button>
          </div>
        </div>
      )}

      {note && (
        <p className="agent-contact__note" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
