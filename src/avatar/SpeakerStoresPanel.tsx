/**
 * SPEAKER STORES PANEL (Part 13) — the Settings face of speaker
 * separation: the operator's voiceprint lives in the calibration
 * system above; every OTHER voice ever separated lands in its own
 * labeled store here (Speaker 2, Speaker 3 — presence data only, no
 * names, no identity claims), never merged into his profile.
 */
import { useState } from "react";
import {
  clearOtherSpeakers,
  loadOtherSpeakers,
  type OtherSpeakerStore,
} from "./speakerStores";

export function SpeakerStoresPanel() {
  const [others, setOthers] = useState<OtherSpeakerStore[]>(() => loadOtherSpeakers());
  return (
    <div className="speaker-stores">
      <p className="speaker-stores__rule">
        His voiceprint stays his (calibration, above). A different voice is kept SEPARATE —
        labeled Speaker 2, Speaker 3, with presence counts only. No names are guessed, no
        identity is claimed, and nothing here ever merges into the operator&apos;s profile.
      </p>
      {others.length === 0 ? (
        <p className="speaker-stores__empty">
          No other voices stored yet. When the speech service separates another voice, its
          store appears here.
        </p>
      ) : (
        <ul className="trusted-devices__list">
          {others.map((speaker) => (
            <li key={speaker.label} className="trusted-devices__row">
              <span>
                <b>{speaker.label}</b> — {speaker.utterances} utterance(s) · last heard{" "}
                {new Date(speaker.lastHeard).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <button
          type="button"
          onClick={() => {
            clearOtherSpeakers();
            setOthers([]);
          }}
        >
          Clear other-voice stores
        </button>
      )}
    </div>
  );
}
