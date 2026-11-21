import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Mic, Power, RefreshCw, Square, Trash2 } from "lucide-react";
import { micErrorMessage, pickRecorderMimeType } from "./localEar";
import {
  ENROLL_SENTENCES,
  commitVoiceEnrollment,
  deleteVoiceprint,
  enrollVoiceSample,
  fetchVoiceprintStatus,
  resetVoiceEnrollment,
  type VoiceCalibrationPrefs,
  type VoiceprintStatus,
} from "./voiceCalibration";

/**
 * VOICE CALIBRATION panel (Settings tab).
 *
 * Enrollment: he reads a few shown sentences into the mic. Each clip
 * goes to the local speech service, which embeds it and discards the
 * raw audio — the machine keeps a mathematical voiceprint, never a
 * recording. With calibration ON, the ear checks every spoken command
 * against that voiceprint before it may run (see localEar.ts).
 *
 * Honest limits, in the small print below and by design: this stops
 * other voices in the room from commanding Augie in his name. It is
 * not a liveness check, and it never pretends to be one.
 */

interface RecorderState {
  stream: MediaStream;
  recorder: MediaRecorder;
  chunks: Blob[];
}

export function VoiceCalibrationPanel({
  prefs,
  onPrefsChange,
}: {
  prefs: VoiceCalibrationPrefs;
  onPrefsChange: (next: VoiceCalibrationPrefs) => void;
}) {
  const [status, setStatus] = useState<VoiceprintStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [samples, setSamples] = useState(0);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const recorderRef = useRef<RecorderState | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await fetchVoiceprintStatus();
      setStatus(next);
      setStatusError(null);
      setSamples(next.pendingSamples);
    } catch (error) {
      setStatus(null);
      setStatusError(
        error instanceof Error ? error.message : "The local speech service did not answer.",
      );
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(
    () => () => {
      const active = recorderRef.current;
      if (active) {
        try {
          active.recorder.stop();
        } catch {
          /* already stopped */
        }
        active.stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
      }
    },
    [],
  );

  const stopTracks = useCallback(() => {
    const active = recorderRef.current;
    if (active) {
      active.stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
    }
  }, []);

  const finishRecording = useCallback(async () => {
    const active = recorderRef.current;
    if (!active) return;
    const mimeType = active.recorder.mimeType || "audio/webm";
    const audio = new Blob(active.chunks, { type: mimeType });
    stopTracks();
    setRecording(false);
    if (audio.size === 0) {
      setMessage("No audio was captured from the microphone. Try the reading again.");
      return;
    }
    setBusy(true);
    try {
      const result = await enrollVoiceSample(audio);
      setSamples(result.samples);
      setMessage(
        `Reading ${result.samples} held. ${
          result.samples >= (status?.minSamples ?? 3)
            ? "That is enough to finish — or add another reading for a stronger print."
            : "Read the next sentence when you are ready."
        }`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That reading could not be saved.");
    } finally {
      setBusy(false);
    }
  }, [status?.minSamples, stopTracks]);

  const toggleRecord = useCallback(async () => {
    if (recording) {
      try {
        recorderRef.current?.recorder.stop(); // onstop → finishRecording
      } catch {
        void finishRecording();
      }
      return;
    }
    setMessage(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setMessage(micErrorMessage(error));
      return;
    }
    const mime = pickRecorderMimeType((m) => MediaRecorder.isTypeSupported(m));
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    const state: RecorderState = { stream, recorder, chunks: [] };
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) state.chunks.push(event.data);
    };
    recorder.onstop = () => {
      void finishRecording();
    };
    recorderRef.current = state;
    try {
      recorder.start();
      setRecording(true);
    } catch (error) {
      stopTracks();
      setMessage(micErrorMessage(error));
    }
  }, [finishRecording, recording, stopTracks]);

  const finishEnrollment = useCallback(async () => {
    setBusy(true);
    try {
      const result = await commitVoiceEnrollment();
      setMessage(`Enrollment complete — Augie knows your voice from ${result.samples} readings.`);
      setSamples(0);
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enrollment could not be finished.");
    } finally {
      setBusy(false);
    }
  }, [refreshStatus]);

  const startOver = useCallback(async () => {
    setBusy(true);
    try {
      await resetVoiceEnrollment();
      setSamples(0);
      setMessage("Held readings cleared. Start again whenever you are ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not clear the readings.");
    } finally {
      setBusy(false);
    }
  }, []);

  const removeVoiceprint = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      await deleteVoiceprint();
      setConfirmDelete(false);
      setMessage("Voiceprint removed from this machine. Calibration can no longer match a voice.");
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The voiceprint could not be removed.");
    } finally {
      setBusy(false);
    }
  }, [confirmDelete, refreshStatus]);

  const enrolled = status?.enrolled === true;
  const minSamples = status?.minSamples ?? 3;
  const sentence =
    ENROLL_SENTENCES[Math.min(samples, ENROLL_SENTENCES.length - 1)] ?? ENROLL_SENTENCES[0];

  return (
    <div className="voice-calibration">
      {statusError && !status ? (
        <>
          <p role="alert">
            The local speech service did not answer, so calibration state is unknown: {statusError}
          </p>
          <p>
            While calibration is on, voice commands fail closed — a check that cannot run is never
            treated as a match.
          </p>
          <div className="avatar-command-box__grid">
            <button
              type="button"
              className="avatar-command-box__action"
              onClick={() => void refreshStatus()}
            >
              <RefreshCw aria-hidden="true" />
              <span>Check again</span>
            </button>
          </div>
        </>
      ) : (
        <p role="status">
          {status === null
            ? "Checking the voiceprint on this machine…"
            : enrolled
              ? `Enrolled — Augie knows your voice${
                  status.samples ? `, from ${status.samples} readings` : ""
                }.`
              : "Not enrolled — Augie cannot yet tell your voice from anyone else's."}
        </p>
      )}

      <div className="avatar-command-box__grid">
        <button
          type="button"
          className="avatar-command-box__action"
          onClick={() => onPrefsChange({ ...prefs, enabled: !prefs.enabled })}
          aria-pressed={prefs.enabled}
        >
          <Power aria-hidden="true" />
          <span>{prefs.enabled ? "Calibration: ON" : "Calibration: OFF"}</span>
        </button>
      </div>
      <label className="avatar-hud__row">
        <span>
          Match threshold <span className="avatar-hud__value">{prefs.threshold.toFixed(2)}</span>
        </span>
        <input
          type="range"
          className="avatar-hud__range"
          min={0.3}
          max={0.8}
          step={0.01}
          value={prefs.threshold}
          onChange={(e) => onPrefsChange({ ...prefs, threshold: Number(e.target.value) })}
          aria-label="Voice match threshold"
        />
      </label>
      <p>
        Higher is stricter: fewer strangers pass, but your own voice must match more closely. 0.50
        is the balanced start.
      </p>

      {status && !enrolled && (
        <>
          <p>
            <strong>Enroll your voice.</strong> Read each sentence out loud, in your normal voice,
            in a quiet room. {minSamples} readings are needed; the raw audio is discarded by the
            speech service the moment each reading is embedded.
          </p>
          <p className="voice-calibration__sentence" role="status">
            “{sentence}”
          </p>
          <div className="avatar-command-box__grid">
            <button
              type="button"
              className="avatar-command-box__action"
              onClick={() => void toggleRecord()}
              disabled={busy}
            >
              {recording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
              <span>
                {recording ? "Stop — send this reading" : `Record reading ${samples + 1}`}
              </span>
            </button>
            {samples >= minSamples && (
              <button
                type="button"
                className="avatar-command-box__action"
                onClick={() => void finishEnrollment()}
                disabled={busy || recording}
              >
                <Check aria-hidden="true" />
                <span>Finish enrollment</span>
              </button>
            )}
            {samples > 0 && (
              <button
                type="button"
                className="avatar-command-box__action"
                onClick={() => void startOver()}
                disabled={busy || recording}
              >
                <RefreshCw aria-hidden="true" />
                <span>Start over</span>
              </button>
            )}
          </div>
          <p role="status">
            Readings held: {samples} of {minSamples} needed.
          </p>
        </>
      )}

      {status && enrolled && (
        <div className="avatar-command-box__grid">
          <button
            type="button"
            className="avatar-command-box__action"
            onClick={() => void removeVoiceprint()}
            disabled={busy}
          >
            <Trash2 aria-hidden="true" />
            <span>{confirmDelete ? "Click again to remove it" : "Remove voiceprint"}</span>
          </button>
        </div>
      )}

      {message && <p role="status">{message}</p>}

      <p className="voice-calibration__smallprint">
        Voice calibration keeps other voices in the room — family, visitors, the TV — from giving
        Augie commands in your name. It is not a liveness check: a recording of your voice is not
        defeated by this gate. Your voiceprint is a mathematical embedding stored only on this
        machine, and enrollment audio is deleted the moment it is embedded.
      </p>
    </div>
  );
}
