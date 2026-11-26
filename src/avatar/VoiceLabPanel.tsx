/**
 * THE VOICE LAB (owner order 2026-11-26 — the repair; expanded the
 * same day: EVERY GOD HAS A VOICE). The first lab never connected:
 * no choice could be saved and no wire ran from any selection to
 * the speech path, so he never heard a different voice. This panel
 * is wired at both ends — a Preview speaks a line through the
 * core's real synthesis path with the named voice, and a choice is
 * saved in the core store, where every spoken line reads it.
 *
 * Two halves: Anubis's voice (the catalog — the deep, dark,
 * disciplined default he ordered, modeled on the voice he chose
 * for Muse, never claimed to BE that voice) and the voices of
 * the gods: every god and goddess of his roster with a voice of
 * their own, each labeled by its real Piper model and any pitch
 * shift — processing is labeled as processing, never as another
 * person. In speech the gods address him as Zero; the previews
 * here speak that way too. His ear is the gate.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Play, Volume2 } from "lucide-react";
import {
  godPreviewLine,
  parseVoiceLabView,
  VOICE_PREVIEW_LINE,
  type VoiceLabView,
} from "./voiceLab";

export function VoiceLabPanel() {
  const [view, setView] = useState<VoiceLabView | null>(null);
  const [error, setError] = useState("");
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Record<string, string>>({});
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

  // Each god's assign-select starts at the voice he speaks in now.
  useEffect(() => {
    if (!view) return;
    setCandidates((prev) => {
      const next = { ...prev };
      for (const god of view.gods) {
        if (!(god.godId in next)) next[god.godId] = god.voiceId;
      }
      return next;
    });
  }, [view]);

  const playSay = useCallback(async (body: Record<string, string>, key: string) => {
    setPreviewingId(key);
    setError("");
    try {
      const response = await fetch("/api/say", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errBody?.error ?? `The core answered ${response.status}.`);
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

  const preview = useCallback(
    (voiceId: string) => playSay({ text: VOICE_PREVIEW_LINE, voiceId }, `voice:${voiceId}`),
    [playSay],
  );

  const previewGod = useCallback(
    (godId: string, name: string, voiceId: string) =>
      playSay({ text: godPreviewLine(name), godId, voiceId }, `god:${godId}`),
    [playSay],
  );

  const postChoice = useCallback(
    async (body: Record<string, string>, key: string) => {
      setSavingId(key);
      setError("");
      try {
        const response = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const respBody = (await response.json().catch(() => null)) as
          | { error?: string }
          | Record<string, unknown>
          | null;
        if (!response.ok) {
          throw new Error(
            respBody && "error" in respBody && typeof respBody.error === "string"
              ? respBody.error
              : `The core answered ${response.status}.`,
          );
        }
        const parsed = parseVoiceLabView(respBody);
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

  const choose = useCallback(
    (voiceId: string) => postChoice({ voiceId }, `voice:${voiceId}`),
    [postChoice],
  );

  const assignGod = useCallback(
    (godId: string, voiceId: string) => postChoice({ godId, voiceId }, `god:${godId}`),
    [postChoice],
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
                    {previewingId === `voice:${entry.voice.id}` ? "Speaking…" : "Preview"}
                  </button>
                  <button
                    type="button"
                    className="window-btn"
                    disabled={!entry.installed || entry.isChosen || savingId !== null}
                    onClick={() => void choose(entry.voice.id)}
                  >
                    {entry.isChosen
                      ? "Anubis speaks in this voice"
                      : savingId === `voice:${entry.voice.id}`
                        ? "Saving…"
                        : "Use this voice"}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <h3 className="voice-lab__gods-title">The voices of the gods</h3>
          <p className="voice-lab__hint">
            Every god and goddess of the house has a voice — the goddesses in women&apos;s
            voices, each labeled by its real model and any pitch shift. A shift is
            processing on that model, never another person. Preview a voice for a god,
            then assign it; the assignment is saved in the core.
          </p>
          <ul className="voice-lab__list">
            {view.gods.map((god) => {
              const candidate = candidates[god.godId] ?? god.voiceId;
              const candidateEntry = view.entries.find((e) => e.voice.id === candidate);
              const candidateInstalled = candidateEntry?.installed ?? false;
              return (
                <li key={god.godId} className="voice-lab__entry">
                  <div className="voice-lab__entry-head">
                    <strong>{god.name}</strong>
                    <span className="voice-lab__badge">
                      {god.source === "assigned"
                        ? "Your assignment"
                        : god.godId === "anubis"
                          ? "Voice Lab choice"
                          : "Standing voice"}
                    </span>
                    <span className="voice-lab__badge">
                      {god.installed ? "On this core" : "Not on this core yet"}
                    </span>
                  </div>
                  <p className="voice-lab__desc">{god.note}</p>
                  <p className="voice-lab__fact">
                    Speaks in: {god.voiceLabel} — {god.factLine}
                  </p>
                  <div className="voice-lab__actions">
                    <label className="voice-lab__select-label">
                      Voice for {god.name}
                      <select
                        aria-label={`Voice for ${god.name}`}
                        value={candidate}
                        onChange={(e) =>
                          setCandidates((prev) => ({ ...prev, [god.godId]: e.target.value }))
                        }
                      >
                        {view.entries.map((entry) => (
                          <option key={entry.voice.id} value={entry.voice.id}>
                            {entry.voice.label} ({entry.voice.gender}
                            {entry.installed ? "" : " — not on this core"})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="window-btn"
                      disabled={!candidateInstalled || previewingId !== null}
                      onClick={() => void previewGod(god.godId, god.name, candidate)}
                    >
                      <Play aria-hidden="true" />{" "}
                      {previewingId === `god:${god.godId}` ? "Speaking…" : "Preview"}
                    </button>
                    <button
                      type="button"
                      className="window-btn"
                      disabled={
                        !candidateInstalled || candidate === god.voiceId || savingId !== null
                      }
                      onClick={() => void assignGod(god.godId, candidate)}
                    >
                      {savingId === `god:${god.godId}` ? "Saving…" : `Assign to ${god.name}`}
                    </button>
                  </div>
                </li>
              );
            })}
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
