/**
 * THE VOICE LAB (owner order 2026-11-26 — the repair). The first
 * lab never connected: no choice could be saved and no wire ran
 * from any selection to the speech path, so he never heard a
 * different voice. This panel is wired at both ends — Preview
 * speaks a line through the core's real synthesis path with the
 * named voice, and "Use this voice" saves the choice in the core
 * store, where every line Anubis speaks reads it.
 *
 * The standing default is the deep one he ordered: modeled on the
 * voice he chose for the assistant — deeper, darker, disciplined.
 * It is labeled with what it actually is (Piper model + the pitch
 * shift applied); it does not claim to be the assistant's voice.
 * His ear is the gate.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Play, Volume2 } from "lucide-react";
import { parseVoiceLabView, VOICE_PREVIEW_LINE, type VoiceLabView } from "./voiceLab";

export function VoiceLabPanel() {
  const [view, setView] = useState<VoiceLabView | null>(null);
  const [error, setError] = useState("");
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/voice");
      if (!response.ok) throw new Error(`The core answered ${response.status}.`);
      const parsed = parseVoiceLabView(await response.json());
      if (parsed) {
        setView(parsed);
        setError("");
      } else {
        setError("The core's voice answer could not be read.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The core did not answer.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const preview = useCallback(async (voiceId: string) => {
    setPreviewingId(voiceId);
    setError("");
    try {
      const response = await fetch("/api/say", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: VOICE_PREVIEW_LINE, voiceId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The core answered ${response.status}.`);
      }
      const blob = await response.blob();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = URL.createObjectURL(blob);
      audioRef.current?.pause();
      const audio = new Audio(objectUrlRef.current);
      audioRef.current = audio;
      await audio.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The preview could not be played.");
    } finally {
      setPreviewingId(null);
    }
  }, []);

  const choose = useCallback(
    async (voiceId: string) => {
      setSavingId(voiceId);
      setError("");
      try {
        const response = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceId }),
        });
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | Record<string, unknown>
          | null;
        if (!response.ok) {
          throw new Error(
            body && "error" in body && typeof body.error === "string"
              ? body.error
              : `The core answered ${response.status}.`,
          );
        }
        const parsed = parseVoiceLabView(body);
        if (parsed) setView(parsed);
        else void refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "The choice could not be saved.");
      } finally {
        setSavingId(null);
      }
    },
    [refresh],
  );

  return (
    <div className="voice-lab">
      <p className="voice-lab__rule">
        Anubis&apos;s voice is made on this core (Piper) — pick it here and every line he
        speaks uses it: greetings, reports, the readings. Modeled on the voice you chose for
        Muse — deeper, darker, disciplined. It is not Muse&apos;s voice itself; each entry
        below says exactly what it is.
      </p>
      {error && <p className="voice-lab__error">{error}</p>}
      {!error && !view && <p className="voice-lab__empty">Reading the voices on this core…</p>}
      {view && (
        <>
          <p className="voice-lab__speaking" role="status">
            <Volume2 aria-hidden="true" /> {view.speaking.note}
            {view.speaking.factLine ? ` (${view.speaking.factLine})` : ""}
          </p>
          <ul className="voice-lab__list">
            {view.entries.map((entry) => (
              <li key={entry.voice.id} className="voice-lab__entry">
                <div className="voice-lab__entry-head">
                  <strong>{entry.voice.label}</strong>
                  {entry.isDefault && <span className="voice-lab__badge">Standing default</span>}
                  {entry.isChosen && (
                    <span className="voice-lab__badge voice-lab__badge--chosen">
                      <Check aria-hidden="true" /> Your choice
                    </span>
                  )}
                  <span className="voice-lab__badge">
                    {entry.installed ? "On this core" : "Not on this core yet"}
                  </span>
                </div>
                <p className="voice-lab__desc">{entry.voice.description}</p>
                <p className="voice-lab__fact">{entry.factLine}</p>
                <div className="voice-lab__actions">
                  <button
                    type="button"
                    className="window-btn"
                    disabled={!entry.installed || previewingId !== null}
                    onClick={() => void preview(entry.voice.id)}
                  >
                    <Play aria-hidden="true" />{" "}
                    {previewingId === entry.voice.id ? "Speaking…" : "Preview"}
                  </button>
                  <button
                    type="button"
                    className="window-btn"
                    disabled={!entry.installed || entry.isChosen || savingId !== null}
                    onClick={() => void choose(entry.voice.id)}
                  >
                    {entry.isChosen
                      ? "Anubis speaks in this voice"
                      : savingId === entry.voice.id
                        ? "Saving…"
                        : "Use this voice"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="voice-lab__hint">
            A voice marked &ldquo;not on this core yet&rdquo; needs its model file installed
            on the core before it can be previewed or chosen — the lab never pretends a voice
            is there when it isn&apos;t. Khadija&apos;s Flower keeps her own voice; this lab
            never touches it.
          </p>
        </>
      )}
    </div>
  );
}
