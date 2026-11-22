/**
 * CAPTAIN'S LOG WINDOW (Part 32) — "Captain's log, stardate…"
 * Short video journal entries: record in this small window
 * (camera + mic by the normal permissions), entries listed by
 * date/time with preview, and one click EXPORTS the video file to
 * the operator's downloads. Entries live in this browser's
 * IndexedDB on his own machine; nothing is uploaded. The recording
 * state is always honestly shown — a red RECORDING line with the
 * elapsed time while the tape rolls, never a silent capture.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FloatingWindow } from "./windows/FloatingWindow";
import {
  deleteEntry,
  entryTitle,
  exportFilename,
  listEntries,
  loadEntryBlob,
  saveEntry,
  type CaptainEntryMeta,
} from "./captainsLog";

export function CaptainsLogWindow({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<CaptainEntryMeta[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setEntries(await listEntries());
    } catch {
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const start = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const meta: CaptainEntryMeta = {
          id: `log-${startedRef.current}`,
          at: startedRef.current,
          durationMs: Date.now() - startedRef.current,
          mimeType,
          sizeBytes: blob.size,
        };
        void saveEntry(meta, blob)
          .then(refresh)
          .catch(() => setError("The entry could not be saved to this browser's storage."));
        setRecording(false);
        stopStream();
      };
      startedRef.current = Date.now();
      recorder.start(1000);
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(
        () => setElapsed(Date.now() - startedRef.current),
        250,
      );
    } catch {
      setError(
        "Camera or microphone could not be opened. Allow both for this site, then record again.",
      );
    }
  }, [refresh, stopStream]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const play = useCallback(async (id: string) => {
    const blob = await loadEntryBlob(id).catch(() => null);
    if (!blob) return;
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(blob);
    });
  }, []);

  const exportEntry = useCallback(async (entry: CaptainEntryMeta) => {
    const blob = await loadEntryBlob(entry.id).catch(() => null);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename(entry.at, entry.mimeType);
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const remove = useCallback(
    async (id: string) => {
      await deleteEntry(id).catch(() => undefined);
      void refresh();
    },
    [refresh],
  );

  return (
    <FloatingWindow id="captains-log" title="Captain's Log" onClose={onClose} initialWidth={460} initialHeight={500}>
      <div className="window-logs">
        <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", background: "#000" }} />
        {previewUrl && (
          <video src={previewUrl} controls style={{ width: "100%", background: "#000" }} />
        )}
        {recording ? (
          <p className="window-logs__note" role="status">
            ● RECORDING — {(elapsed / 1000).toFixed(0)}s. The tape is rolling; speak your log.
          </p>
        ) : (
          <p className="window-logs__note">
            Short video journal entries, kept on this machine only. Nothing is uploaded.
          </p>
        )}
        {error && (
          <p className="window-logs__note" role="alert">
            {error}
          </p>
        )}
        <div className="window-logs__tabs">
          {!recording ? (
            <button type="button" className="window-btn" onClick={() => void start()}>
              Record an entry
            </button>
          ) : (
            <button type="button" className="window-btn" onClick={stop}>
              Stop &amp; save
            </button>
          )}
        </div>
        <ol className="window-logs__list">
          {entries.length === 0 && (
            <li className="window-logs__note">No entries yet — the log awaits its first page.</li>
          )}
          {entries.map((entry) => (
            <li key={entry.id} className="window-logs__line" style={{ fontFamily: "inherit" }}>
              <strong>{entryTitle(entry.at)}</strong> · {(entry.durationMs / 1000).toFixed(0)}s ·{" "}
              {(entry.sizeBytes / 1024).toFixed(0)} KB{" "}
              <button type="button" className="window-btn" onClick={() => void play(entry.id)}>
                Play
              </button>{" "}
              <button type="button" className="window-btn" onClick={() => void exportEntry(entry)}>
                Export
              </button>{" "}
              <button type="button" className="window-btn" onClick={() => void remove(entry.id)}>
                Delete
              </button>
            </li>
          ))}
        </ol>
      </div>
    </FloatingWindow>
  );
}
