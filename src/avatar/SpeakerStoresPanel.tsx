/**
 * SPEAKER STORES PANEL (Part 13) — the Settings face of speaker
 * separation: the operator's voiceprint lives in the calibration
 * system above; every OTHER voice the Parrot ear service separates
 * lands in its own labeled store (Speaker 2, Speaker 3 — presence
 * data only, no names, no identity claims), never merged into his
 * profile. The data comes from the service itself
 * (GET /api/speakers/others); the store is service-side, so this
 * panel offers no fake local controls over it.
 *
 * Merge note (2026-11-22): the learner-build line's panel read a
 * browser-local store; the final-five line's service contract won
 * the merge, and this panel now renders that contract through
 * speakerStores.ts (parseOtherVoices / summarizeOtherVoices) — the
 * same data the Listening window shows.
 */
import { useCallback, useEffect, useState } from "react";
import {
  parseOtherVoices,
  separationStateText,
  type OtherVoicesView,
} from "./speakerStores";

export function SpeakerStoresPanel() {
  const [view, setView] = useState<OtherVoicesView | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/speakers/others");
      if (!response.ok) throw new Error(`The speech service answered ${response.status}.`);
      const parsed = parseOtherVoices(await response.json());
      if (parsed) {
        setView(parsed);
        setError("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The local speech service did not answer.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const speakers = view?.speakers ?? [];

  return (
    <div className="speaker-stores">
      <p className="speaker-stores__rule">
        His voiceprint stays his (calibration, above). A different voice is kept SEPARATE —
        labeled Speaker 2, Speaker 3, with presence counts only. No names are guessed, no
        identity is claimed, and nothing here ever merges into the operator&apos;s profile.
        Kept by the speech service as {view?.kept ?? "embeddings and transcripts only"}.
      </p>
      {error && <p className="speaker-stores__empty">The speaker store could not be read: {error}</p>}
      {!error && view && <p className="speaker-stores__empty">{separationStateText(view)}</p>}
      {!error && view && speakers.length === 0 && (
        <p className="speaker-stores__empty">
          No other voices stored yet. When the speech service separates another voice, its
          store appears here.
        </p>
      )}
      {speakers.length > 0 && (
        <ul className="trusted-devices__list">
          {speakers.map((speaker) => (
            <li key={speaker.label} className="trusted-devices__row">
              <span>
                <b>{speaker.label}</b> — {speaker.utterances} utterance(s)
                {speaker.lastHeard
                  ? ` · last heard ${new Date(speaker.lastHeard).toLocaleString()}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => void refresh()}>
        Refresh
      </button>
    </div>
  );
}
